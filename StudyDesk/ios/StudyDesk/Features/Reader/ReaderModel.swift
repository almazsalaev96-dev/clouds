import SwiftUI
import SwiftData
import PDFKit
import PencilKit

/// The state of one open worksheet.
///
/// Holds the pieces that must agree with each other — which page is showing,
/// what ink is on it, what the tutor can see, whether anything is unsaved — so
/// that no view has to reconstruct them.
@MainActor
@Observable
final class ReaderModel {

    // MARK: Identity

    let document: StudyDocument
    let pdf: PDFDocument
    let drawings: DrawingRepository

    // MARK: Observable state

    var pageIndex: Int = 0
    var selectedText: String?
    var selectedRegion: CGRect?
    var isSelectingRegion = false
    var showsThumbnails = false
    var isFinishing = false
    var examMode = false
    var tutorPresentation: TutorPresentation = .collapsed
    /// The gentle "need a hint?" nudge. Never more than one at a time, never
    /// while the tutor is already open.
    var suggestion: String?

    private(set) var canUndo = false
    private(set) var canRedo = false

    enum TutorPresentation: Equatable {
        case collapsed
        case expanded

        mutating func toggle() {
            self = self == .expanded ? .collapsed : .expanded
        }
    }

    // MARK: Dependencies

    let tutor: TutorEngine?
    let voice: VoicePlayer?
    private let app: AppEnvironment
    private let settings: AppSettings
    private let modelContext: ModelContext
    private weak var controller: PDFStudyController?

    private var idleTask: Task<Void, Never>?
    private var lastInkAt = Date()

    init(document: StudyDocument, pdf: PDFDocument, app: AppEnvironment, settings: AppSettings, modelContext: ModelContext) {
        self.document = document
        self.pdf = pdf
        self.app = app
        self.settings = settings
        self.modelContext = modelContext
        self.drawings = DrawingRepository(document: document, context: modelContext)
        self.pageIndex = min(document.lastPageIndex, max(pdf.pageCount - 1, 0))
        self.voice = app.voicePlayer

        if let provider = app.aiProvider {
            let conversation = Self.conversation(for: document, context: modelContext)
            let engine = TutorEngine(
                provider: provider,
                contextEngine: app.contextEngine(repository: drawings),
                settings: settings,
                modelContext: modelContext,
                analytics: app.analytics,
                conversation: conversation,
                contextProvider: { nil } // replaced below, once self exists
            )
            self.tutor = engine
        } else {
            self.tutor = nil
        }

        // The tutor asks for context at send time, not at open time, so it
        // always sees the page and the ink as they are *now*.
        tutor?.contextProvider = { [weak self] in self?.currentContextInput() }

        app.analytics.beginSession(document: document)
        document.lastOpenedAt = Date()
        try? modelContext.save()
        scheduleIdleCheck()
    }

    private static func conversation(for document: StudyDocument, context: ModelContext) -> TutorConversation {
        if let existing = document.conversations.max(by: { $0.updatedAt < $1.updatedAt }) {
            return existing
        }
        let created = TutorConversation(document: document)
        context.insert(created)
        document.conversations.append(created)
        return created
    }

    // MARK: Controller

    func attach(controller: PDFStudyController) {
        self.controller = controller
        refreshUndoState()
    }

    func go(to index: Int) {
        guard index >= 0, index < pdf.pageCount else { return }
        controller?.go(toPage: index)
        pageChanged(to: index)
    }

    // MARK: Page and ink events

    func pageChanged(to index: Int) {
        guard index != pageIndex else { return }
        // Committing on page change means a student who writes an answer and
        // immediately flicks to the next question never loses it.
        drawings.flush()
        pageIndex = index
        document.lastPageIndex = index
        drawings.trimCache(around: index)
        app.analytics.recordPageVisit()
        selectedRegion = nil
        selectedText = nil
        refreshUndoState()
        scheduleIdleCheck()
    }

    func drawingChanged(_ drawing: PKDrawing, page: Int) {
        drawings.record(drawing, forPage: page)
        lastInkAt = Date()
        suggestion = nil
        app.analytics.recordStroke()
        refreshUndoState()
        scheduleIdleCheck()
    }

    func currentDrawings() -> [Int: PKDrawing] {
        drawings.flush()
        var result: [Int: PKDrawing] = [:]
        for annotation in document.annotations where !annotation.isEmpty {
            result[annotation.pageIndex] = drawings.drawing(forPage: annotation.pageIndex)
        }
        return result
    }

    // MARK: Region and selection

    func beginRegionSelection() {
        selectedRegion = nil
        isSelectingRegion = true
    }

    func regionSelected(_ rect: CGRect, page: Int) {
        isSelectingRegion = false
        selectedRegion = rect
        pageIndex = page
        tutorPresentation = .expanded
    }

    func askAboutSelection() {
        tutorPresentation = .expanded
        tutor?.ask(mode: smartActionMode, message: nil)
    }

    /// What the tutor button should say right now.
    ///
    /// This is the small feature that makes the assistant feel like it is in
    /// the room: the button reads the situation instead of offering a menu.
    var smartActionTitle: String {
        if selectedRegion != nil { return "Ask about this part" }
        if let selectedText, !selectedText.isEmpty { return "Explain this" }
        if hasInkOnCurrentPage { return "Check my work" }
        if detectedQuestionLabel != nil { return "Help with this question" }
        return "Ask about this page"
    }

    var smartActionMode: TutorMode {
        if selectedRegion != nil || selectedText?.isEmpty == false { return .explain }
        if hasInkOnCurrentPage { return .check }
        return .explain
    }

    var hasInkOnCurrentPage: Bool {
        !drawings.drawing(forPage: pageIndex).strokes.isEmpty
    }

    var detectedQuestionLabel: String? {
        guard let text = document.text(onPage: pageIndex) else { return nil }
        let ink = HandwritingRecognizer.verticalPosition(
            of: drawings.drawing(forPage: pageIndex),
            pageSize: pdf.page(at: pageIndex)?.bounds(for: .mediaBox).size ?? .zero
        )
        return QuestionDetector().activeQuestion(in: text, inkVerticalPosition: ink)?.label
    }

    var suggestedModes: [TutorMode] {
        TutorMode.suggested(for: document.subject, hasStudentWork: hasInkOnCurrentPage)
    }

    // MARK: Context

    func currentContextInput() -> ContextEngine.Input {
        ContextEngine.Input(
            document: document,
            pdf: pdf,
            pageIndex: pageIndex,
            drawing: drawings.drawing(forPage: pageIndex),
            selectedText: selectedText,
            region: selectedRegion,
            mode: nil,
            studentMessage: nil,
            conversation: nil,
            examMode: examMode,
            allowFullSolutions: !examMode,
            includeImage: settings.sendsPageImages
        )
    }

    // MARK: Undo

    func undo() {
        controller?.activeUndoManager?.undo()
        refreshUndoState()
    }

    func redo() {
        controller?.activeUndoManager?.redo()
        refreshUndoState()
    }

    private func refreshUndoState() {
        let manager = controller?.activeUndoManager
        canUndo = manager?.canUndo ?? false
        canRedo = manager?.canRedo ?? false
    }

    // MARK: Nudges

    /// After two quiet minutes on a page with unfinished-looking work, offer a
    /// hint once. It is dismissible, it never repeats on the same page, and it
    /// is off entirely if the student turned suggestions off.
    private func scheduleIdleCheck() {
        idleTask?.cancel()
        guard settings.smartSuggestions, tutor != nil else { return }
        let page = pageIndex

        idleTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(120))
            guard let self, !Task.isCancelled else { return }
            guard self.pageIndex == page,
                  self.tutorPresentation == .collapsed,
                  self.suggestion == nil,
                  Date().timeIntervalSince(self.lastInkAt) >= 110 else { return }
            self.suggestion = "Need a hint?"
        }
    }

    func dismissSuggestion() {
        suggestion = nil
        idleTask?.cancel()
    }

    // MARK: Closing

    func flush() {
        drawings.flush()
        try? modelContext.save()
    }

    func close() {
        idleTask?.cancel()
        voice?.stop()
        tutor?.cancel()
        flush()
        document.assignment?.refreshStatusFromWork()
        app.analytics.endSession()
        try? modelContext.save()
    }
}
