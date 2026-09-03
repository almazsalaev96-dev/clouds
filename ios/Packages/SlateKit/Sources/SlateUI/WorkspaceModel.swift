#if canImport(SwiftUI)
import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
import SlateAI
import SlateDocuments
import SlateFoundation
import SlateInk
import SlateLearning
import SlateModel

/// The workspace: the document, the pencil, and the tutor that understands both.
///
/// The order of operations in `check()` is the product's central claim. Deterministic
/// marking runs first and returns in milliseconds, so the student sees a verdict almost
/// immediately; the model is asked afterwards for the part it is actually better at,
/// which is explaining what went wrong. If the two disagree, the arithmetic wins.
@MainActor
public final class WorkspaceModel: ObservableObject, Identifiable {

    public nonisolated let id = UUID()

    public enum Selection: Equatable {
        case none
        case region(page: Int, rect: NormalisedRect)
        case question(QuestionID)
    }

    @Published public private(set) var meta: DocumentMeta
    @Published public var page: Int
    @Published public var tool: InkTool = InkTool.defaults[.pen] ?? InkTool()
    @Published public var selection: Selection = .none
    @Published public private(set) var map = QuestionMap()

    @Published public private(set) var tutorReply: TutorReply?
    @Published public private(set) var lastCheck: CheckReply?
    @Published public private(set) var fastVerdict: Outcome?
    @Published public private(set) var isThinking = false
    @Published public var isTutorOpen = false
    @Published public private(set) var problem: String?
    /// Shown once, after the fact, and only when something was genuinely recovered.
    @Published public private(set) var recoveryNotice: String?
    @Published public private(set) var isDistractionFree = false
    /// A draft, not a note. It becomes one only if the student keeps it.
    @Published public var notesDraft: RevisionNotes?

    private let store: DocumentStore
    private let ink: InkStore
    private let tutorService: TutorService
    private let events: EventStore
    private let contextEngine = ContextEngine()
    private let clock: Clock
    private let sessionID = SessionID.new()

    private var ladder = AssistanceLadder()
    private var conversation: [String] = []
    private var attemptsByQuestion: [QuestionID: [String]] = [:]
    private var transcribed: [QuestionID: String] = [:]
    private var strategiesUsed: [ConceptID: [TeachingStrategy]] = [:]
    private var projection: [ConceptID: MasteryState] = [:]
    private var conceptNames: [ConceptID: String] = [:]

    public init(meta: DocumentMeta, store: DocumentStore, ink: InkStore,
                tutorService: TutorService, events: EventStore,
                clock: Clock = SystemClock()) {
        self.meta = meta
        self.store = store
        self.ink = ink
        self.tutorService = tutorService
        self.events = events
        self.clock = clock
        page = meta.lastPage

        if let report = ink.recovery, report.recoveredWork {
            // Stated after the recovery has already happened, and never phrased as the
            // student's fault. They did nothing wrong; the app stopped.
            recoveryNotice = "Your most recent writing was recovered."
        }
        map = (try? loadMap()) ?? QuestionMap()
        try? events.append(.sessionStarted(id: .new(), at: clock.now, sessionID: sessionID))
    }

    // MARK: - Ink

    /// The immutable source, opened read-only by the page view. Nothing in the app
    /// holds a writable handle to it.
    public var documentURL: URL { store.paths(for: meta.id).original }

    public func drawing(for page: Int) -> Data? { ink.drawing(page: page) }

    /// Called by the canvas after a short pause. Journalled before anything else.
    public func inkChanged(_ data: Data, page: Int, pageSize: CGSize) {
        do {
            try ink.setDrawing(data, page: page)
        } catch {
            problem = "Your writing could not be saved just now. Nothing has been lost yet, but free up some space if you can."
            return
        }
        guard let summary = StrokeAnalysis.summarise(data, page: page, pageSize: pageSize) else {
            return
        }
        markWork(from: [summary])
    }

    /// Bind strokes to questions so "check this" resolves without being told.
    private func markWork(from summaries: [AnswerDetection.StrokeSummary]) {
        let assigned = AnswerDetection.assign(summaries: summaries, to: map)
        guard !assigned.isEmpty else { return }
        for index in map.questions.indices {
            if assigned[map.questions[index].id] != nil {
                map.questions[index].hasWork = true
            }
        }
        try? saveMap()
    }

    // MARK: - Selection

    public var focusedQuestion: MappedQuestion? {
        switch selection {
        case .question(let id): map.question(id: id)
        case .region(let page, let rect): map.question(atPage: page, y: rect.midY)
        case .none: map.question(atPage: page, y: 0.5)
        }
    }

    /// The actions offered for what is selected.
    ///
    /// The toolbar adapts instead of making the student walk a menu: selecting their
    /// own handwriting offers Check, selecting a printed question offers Hint, and
    /// selecting a diagram offers Explain.
    public var contextualModes: [TutorReply.Mode] {
        let question = focusedQuestion
        let rung = question.map { startingRung(for: $0) } ?? ladder.current
        return AssistanceLadder.offeredModes(at: rung, hasWork: question?.hasWork ?? false)
    }

    private func startingRung(for question: MappedQuestion) -> Assistance {
        let states = question.conceptIDs.compactMap { projection[$0] }
        let weakest = states.min() ?? .unseen
        return AssistanceLadder.startingRung(for: weakest, independence: nil)
    }

    // MARK: - Checking

    /// Mark the current question.
    ///
    /// Two phases on purpose. The first is local and instant; the second explains.
    public func check(expected: [ExpectedAnswer], pageSize: CGSize) async {
        guard let question = focusedQuestion else {
            problem = "Tap the question you want checked."
            return
        }
        isThinking = true
        problem = nil
        defer { isThinking = false }

        // Read the handwriting first. If we cannot read it, say so rather than marking
        // a guess: a confidently wrong mark on work the app misread is the single most
        // damaging thing it could do.
        let reading: HandwritingReading?
        do {
            reading = try await transcribe(question: question, pageSize: pageSize)
        } catch {
            problem = (error as? LocalizedError)?.errorDescription
                ?? "Could not read that just now."
            return
        }
        guard let reading, reading.isReliable, !reading.text.isEmpty else {
            problem = reading?.unreadable.first.map { "I could not read \($0). Could you write it a little larger?" }
                ?? "I could not read that clearly enough to mark it."
            recordUnreadable(question: question)
            return
        }

        let submitted = reading.finalAnswer ?? reading.text
        transcribed[question.id] = reading.text

        // Phase one: arithmetic, immediately.
        if let fast = try? await tutorService.gradeOnly(submitted: submitted, expected: expected) {
            fastVerdict = fast.outcome
        }

        // Phase two: the explanation, and the reconciled verdict.
        do {
            let reply = try await tutorService.check(CheckRequest(
                submitted: submitted,
                expected: expected,
                questionText: "\(question.number). \(question.text)",
                workingText: reading.text,
                previousAttempts: attemptsByQuestion[question.id],
                subject: meta.subject
            ))
            lastCheck = reply
            fastVerdict = reply.outcome
            record(reply, for: question)
            attemptsByQuestion[question.id, default: []].append(submitted)
            isTutorOpen = true
        } catch {
            // The fast verdict still stands; only the teaching is missing, and saying
            // so is better than throwing the verdict away too.
            problem = (error as? LocalizedError)?.errorDescription
                ?? "Marked, but the explanation could not be fetched."
        }
    }

    private func transcribe(question: MappedQuestion, pageSize: CGSize) async throws -> HandwritingReading? {
        guard let data = ink.drawing(page: question.page) else { return nil }
        let region = question.answerRegion ?? question.questionRegion
        guard let image = StrokeAnalysis.image(from: data, region: region, pageSize: pageSize),
              let png = image.pngData() else { return nil }
        return try await tutorService.readHandwriting(HandwritingRequest(
            images: [.init(mediaType: "image/png", data: png.base64EncodedString())],
            questionText: question.text,
            subject: meta.subject
        ))
    }

    // MARK: - Asking

    public func ask(_ text: String, mode: TutorReply.Mode? = nil) async {
        isThinking = true
        problem = nil
        defer { isThinking = false }

        let focus: ContextEngine.Focus = switch selection {
        case .question(let id): .question(id)
        case .region(let page, let rect): .selection(page: page, rect: rect, text: nil)
        case .none: .wherever
        }

        let payload = contextEngine.build(
            ContextEngine.Request(
                ask: text, mode: mode, focus: focus, page: page,
                conversation: conversation,
                previousAttempts: focusedQuestion.flatMap { attemptsByQuestion[$0.id] } ?? []
            ),
            from: ContextEngine.Sources(
                map: map, pages: [], subject: meta.subject,
                transcribedWorking: transcribed,
                projection: projection, conceptNames: conceptNames
            )
        )

        do {
            let reply = try await tutorService.tutor(payload)
            tutorReply = reply
            conversation.append("Student: \(text)")
            conversation.append("Tutor: \(reply.message)")
            isTutorOpen = true
            recordAssistance(mode: mode ?? reply.mode)
        } catch {
            problem = (error as? LocalizedError)?.errorDescription
                ?? "The tutor could not answer that just now. Your work is saved."
        }
    }

    /// Ask for more help. Never refused, never bargained over.
    public func askForMore() async {
        let rung = ladder.advance()
        let mode: TutorReply.Mode = switch rung {
        case .none, .nudge: .nudge
        case .hint: .hint
        case .guided: .explain
        case .worked: .steps
        case .solution: .solve
        }
        await ask("Show me more.", mode: mode)
    }

    // MARK: - Notes

    /// Turn what is on this page into revision notes.
    ///
    /// The result is a draft held here and shown for approval. Nothing is written to
    /// the student's notes unless they say so, and anything the tutor added that the
    /// page did not say travels with the draft so it can be marked.
    public func makeRevisionNotes() async {
        isThinking = true
        problem = nil
        defer { isThinking = false }

        // The page's own text, pulled here rather than passed in, so the caller cannot
        // accidentally ask for notes about nothing.
        let pageText = extractedPageText()
        let questions = map.questions.filter { $0.page == page }.map { "\($0.number). \($0.text)" }
        guard !pageText.isEmpty || !questions.isEmpty else {
            problem = "There is nothing on this page to make notes from yet."
            return
        }

        do {
            notesDraft = try await tutorService.makeNotes(NotesRequest(
                sourceText: pageText,
                questionTexts: questions,
                conceptIDs: map.questions.filter { $0.page == page }.flatMap(\.conceptIDs),
                subject: meta.subject,
                title: meta.title
            ))
        } catch {
            problem = (error as? LocalizedError)?.errorDescription
                ?? "Notes could not be drafted just now."
        }
    }

    public func discardNotesDraft() { notesDraft = nil }

    /// Text of the current page. Empty for a scan, which is fine: the questions the
    /// analysis found are enough to make notes from, and sending a picture of a page
    /// for this would be an expensive way to get the same paragraph.
    private func extractedPageText() -> String {
        #if canImport(PDFKit)
        return PDFText.pages(of: documentURL, range: page..<(page + 1))
            .first?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        #else
        return ""
        #endif
    }

    // MARK: - Evidence

    private func record(_ reply: CheckReply, for question: MappedQuestion) {
        let concepts = reply.conceptIDs.isEmpty ? question.conceptIDs : reply.conceptIDs
        guard !concepts.isEmpty else { return }
        let now = clock.now
        // One attempt per concept: the engine never blurs evidence across topics.
        for concept in concepts {
            let attempt = Attempt(
                conceptID: concept,
                at: now,
                outcome: reply.outcome,
                assistance: ladder.current,
                kind: .practice,
                errorType: reply.error,
                sessionID: sessionID,
                questionID: question.id
            )
            try? events.append(.attempted(attempt))
        }
        if let index = map.questions.firstIndex(where: { $0.id == question.id }) {
            map.questions[index].lastCheckedAt = now
            map.questions[index].lastVerdict = reply.outcome
        }
        try? saveMap()
    }

    /// Work we could not read is recorded as exactly that, and excluded from ability.
    private func recordUnreadable(question: MappedQuestion) {
        let now = clock.now
        for concept in question.conceptIDs {
            try? events.append(.attempted(Attempt(
                conceptID: concept, at: now, outcome: .incorrect,
                assistance: ladder.current, kind: .practice,
                errorType: .unreadable, sessionID: sessionID, questionID: question.id
            )))
        }
    }

    private func recordAssistance(mode: TutorReply.Mode) {
        guard let question = focusedQuestion else { return }
        for concept in question.conceptIDs {
            try? events.append(.assistanceRequested(.init(
                at: clock.now, conceptID: concept,
                questionID: question.id, level: mode.assistance
            )))
        }
    }

    // MARK: - Lifecycle

    public func setProjection(_ states: [ConceptID: MasteryState], names: [ConceptID: String]) {
        projection = states
        conceptNames = names
    }

    public func toggleDistractionFree() {
        isDistractionFree.toggle()
    }

    public func dismissRecoveryNotice() { recoveryNotice = nil }
    public func dismissProblem() { problem = nil }

    /// Called on background and on close. Cheap, and the last thing standing between a
    /// terminated process and lost work.
    public func flush() {
        ink.flush()
        var updated = meta
        updated.lastPage = page
        updated.lastOpenedAt = clock.now
        meta = updated
        try? store.write(updated)
        try? saveMap()
        try? events.append(.sessionEnded(
            id: .new(), at: clock.now, sessionID: sessionID, activeSeconds: 0
        ))
    }

    private func loadMap() throws -> QuestionMap {
        let url = store.paths(for: meta.id).questions
        guard let data = try? Data(contentsOf: url) else { return QuestionMap() }
        return try JSONDecoder().decode(QuestionMap.self, from: data)
    }

    private func saveMap() throws {
        let url = store.paths(for: meta.id).questions
        try JSONEncoder().encode(map).write(to: url, options: .atomic)
    }
}
#endif
