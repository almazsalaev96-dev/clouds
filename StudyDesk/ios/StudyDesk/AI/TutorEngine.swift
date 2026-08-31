import Foundation
import SwiftData

/// Runs one tutoring conversation.
///
/// Owns the state the panel shows, which is deliberately small: the messages,
/// whether a reply is streaming, and the last error. Everything about *what*
/// to say lives on the proxy; everything about *what the tutor can see* lives
/// in `ContextEngine`. This type is the seam between them.
@MainActor
@Observable
final class TutorEngine {

    // MARK: Observable state

    private(set) var messages: [DisplayMessage] = []
    private(set) var isStreaming = false
    private(set) var error: StudyDeskError?
    /// Set when the student asked for an answer and `hintFirst` is on. The panel
    /// shows "Hint" / "Full solution" instead of answering immediately.
    private(set) var pendingSolutionRequest: PendingRequest?

    /// What the app is about to send, shown before it is sent.
    private(set) var lastPrivacySummary: [String] = []

    struct DisplayMessage: Identifiable, Equatable {
        let id: UUID
        var role: TutorRole
        var text: String
        var verdict: AnswerVerdict?
        var mode: TutorMode?
        var includedImage: Bool
        var isStreaming: Bool = false
    }

    struct PendingRequest: Equatable {
        var mode: TutorMode
        var studentMessage: String?
    }

    // MARK: Dependencies

    private let provider: AIProvider
    private let contextEngine: ContextEngine
    private let settings: AppSettings
    private let analytics: StudyAnalytics?
    private let modelContext: ModelContext
    private var conversation: TutorConversation?

    private var streamTask: Task<Void, Never>?

    /// Supplies the live state of the reader when a request is made. A closure
    /// rather than a stored snapshot because the student may have written
    /// something else between opening the panel and pressing send.
    var contextProvider: () -> ContextEngine.Input?

    init(
        provider: AIProvider,
        contextEngine: ContextEngine,
        settings: AppSettings,
        modelContext: ModelContext,
        analytics: StudyAnalytics?,
        conversation: TutorConversation?,
        contextProvider: @escaping () -> ContextEngine.Input?
    ) {
        self.provider = provider
        self.contextEngine = contextEngine
        self.settings = settings
        self.modelContext = modelContext
        self.analytics = analytics
        self.conversation = conversation
        self.contextProvider = contextProvider
        self.messages = (conversation?.orderedMessages ?? []).map(DisplayMessage.init)
    }

    // MARK: Asking

    /// The single entry point. Everything the panel offers ends up here.
    func ask(mode: TutorMode?, message: String? = nil) {
        error = nil

        let resolvedMode = mode ?? .explain
        // Hint-first: when a student asks for the answer outright, offer the
        // smaller step before the bigger one. They can still take either.
        if settings.hintFirst, resolvedMode.revealsAnswer, pendingSolutionRequest == nil {
            pendingSolutionRequest = PendingRequest(mode: resolvedMode, studentMessage: message)
            return
        }
        pendingSolutionRequest = nil
        send(mode: resolvedMode, message: message)
    }

    /// The student chose the hint from the hint-first prompt.
    func takeHintInstead() {
        let pending = pendingSolutionRequest
        pendingSolutionRequest = nil
        send(mode: .hint, message: pending?.studentMessage)
    }

    /// The student insisted on the full solution.
    func takeFullSolution() {
        guard let pending = pendingSolutionRequest else { return }
        pendingSolutionRequest = nil
        send(mode: pending.mode, message: pending.studentMessage, force: true)
    }

    func cancel() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
        // Keep whatever arrived; a half-finished explanation is still useful.
        finishStreamingMessage()
    }

    private func send(mode: TutorMode, message: String?, force: Bool = false) {
        guard let input = buildInput(mode: mode, message: message, allowFullSolution: force) else {
            error = .tutorUnavailable
            return
        }

        streamTask?.cancel()
        isStreaming = true

        let studentText = message?.trimmedNonEmpty ?? mode.spokenIntent
        appendStudent(text: studentText, mode: mode, pageIndex: input.pageIndex)

        streamTask = Task { [weak self] in
            guard let self else { return }
            let built = await contextEngine.build(input)
            self.lastPrivacySummary = built.context.privacySummary

            var reply = DisplayMessage(
                id: UUID(),
                role: .tutor,
                text: "",
                verdict: nil,
                mode: mode,
                includedImage: built.context.includesImage,
                isStreaming: true
            )
            self.messages.append(reply)

            do {
                for try await event in provider.streamReply(to: built.context, attachments: built.attachments) {
                    if Task.isCancelled { break }
                    switch event {
                    case .text(let fragment):
                        reply.text += fragment
                        self.replace(reply)
                    case .verdict(let verdict):
                        reply.verdict = verdict
                        self.replace(reply)
                    case .finished:
                        break
                    }
                }
                reply.isStreaming = false
                self.replace(reply)
                self.persist(reply, pageIndex: input.pageIndex)
                self.analytics?.recordTutorRequest(mode: mode, subject: input.document.subject)
            } catch let failure as StudyDeskError {
                self.error = failure
                self.dropIfEmpty(reply)
            } catch {
                self.error = .tutorUnavailable
                self.dropIfEmpty(reply)
            }
            self.isStreaming = false
            self.streamTask = nil
        }
    }

    private func buildInput(mode: TutorMode, message: String?, allowFullSolution: Bool) -> ContextEngine.Input? {
        guard var input = contextProvider() else { return nil }
        input.mode = mode
        input.studentMessage = message
        input.includeImage = settings.sendsPageImages
        input.conversation = conversation
        // Exam Mode withholds worked answers unless the student has just
        // explicitly asked for one through the hint-first prompt.
        if input.examMode {
            input.allowFullSolutions = allowFullSolution
        }
        return input
    }

    // MARK: Message bookkeeping

    private func appendStudent(text: String, mode: TutorMode, pageIndex: Int) {
        let display = DisplayMessage(
            id: UUID(), role: .student, text: text,
            verdict: nil, mode: mode, includedImage: false
        )
        messages.append(display)

        guard let conversation else { return }
        let stored = TutorMessage(role: .student, text: text, pageIndex: pageIndex, mode: mode)
        stored.conversation = conversation
        modelContext.insert(stored)
        conversation.messages.append(stored)
        conversation.updatedAt = Date()
    }

    private func persist(_ message: DisplayMessage, pageIndex: Int) {
        guard let conversation, !message.text.isEmpty else { return }
        let stored = TutorMessage(
            role: .tutor, text: message.text, pageIndex: pageIndex,
            mode: message.mode, includedPageImage: message.includedImage
        )
        stored.conversation = conversation
        modelContext.insert(stored)
        conversation.messages.append(stored)
        conversation.updatedAt = Date()
        try? modelContext.save()
    }

    private func replace(_ message: DisplayMessage) {
        guard let index = messages.firstIndex(where: { $0.id == message.id }) else { return }
        messages[index] = message
    }

    /// A reply that failed before producing a word shouldn't leave an empty
    /// bubble behind — the error banner says what happened.
    private func dropIfEmpty(_ message: DisplayMessage) {
        guard let index = messages.firstIndex(where: { $0.id == message.id }) else { return }
        if messages[index].text.isEmpty {
            messages.remove(at: index)
        } else {
            messages[index].isStreaming = false
        }
    }

    private func finishStreamingMessage() {
        guard let index = messages.lastIndex(where: { $0.isStreaming }) else { return }
        messages[index].isStreaming = false
    }

    /// The reply the voice player should read, if any.
    var lastTutorText: String? {
        messages.last { $0.role == .tutor && !$0.isStreaming }?.text
    }
}

private extension TutorEngine.DisplayMessage {
    init(_ stored: TutorMessage) {
        self.init(
            id: stored.id,
            role: stored.role,
            text: stored.text,
            verdict: nil,
            mode: stored.mode,
            includedImage: stored.includedPageImage,
            isStreaming: false
        )
    }
}
