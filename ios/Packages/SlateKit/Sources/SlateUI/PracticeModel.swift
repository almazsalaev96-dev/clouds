#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateAI
import SlateFoundation
import SlateLearning
import SlateModel

/// Running one intervention, step by step.
///
/// This is the closed loop the whole product is built around: diagnose, teach,
/// practise, verify — and if verification fails, come back with a *different* approach
/// rather than the same one reworded. The session ends by measuring whether the student
/// can now do it unaided, not by asking whether it made sense.
@MainActor
public final class PracticeModel: ObservableObject, Identifiable {

    public nonisolated let id = UUID()

    public enum Phase: Equatable {
        case preparing
        /// Reading or watching. Nothing to answer yet.
        case learning(Intervention.Step, text: String)
        /// A question is on screen and the answer box is live.
        case answering(Intervention.Step, GeneratedQuestion)
        /// Marked, with the explanation.
        case marked(Intervention.Step, GeneratedQuestion, CheckReply)
        case finished(Outcome)
        case failed(String)
    }

    @Published public private(set) var phase: Phase = .preparing
    @Published public private(set) var plan: Intervention.Plan
    @Published public private(set) var stepIndex = 0
    @Published public var typedAnswer = ""
    @Published public private(set) var isWorking = false
    /// The whole point: did the student end up able to do this unaided?
    @Published public private(set) var improved: Bool?

    public let concept: Concept

    private let tutorService: TutorService
    private let events: EventStore
    private let clock: Clock
    private let sessionID = SessionID.new()
    private var strategiesUsed: [Intervention.Strategy]
    private var stateBefore: ConceptState
    private var stateNow: ConceptState
    private var attemptsThisStep = 0
    /// Questions already used, so verification is never the question they just did.
    private var seenPrompts: Set<String> = []

    public var currentStep: Intervention.Step? {
        stepIndex < plan.steps.count ? plan.steps[stepIndex] : nil
    }

    public var progress: Double {
        plan.steps.isEmpty ? 0 : Double(stepIndex) / Double(plan.steps.count)
    }

    public init(concept: Concept, state: ConceptState, plan: Intervention.Plan,
                tutorService: TutorService, events: EventStore,
                strategiesUsed: [Intervention.Strategy] = [],
                clock: Clock = SystemClock()) {
        self.concept = concept
        self.plan = plan
        self.tutorService = tutorService
        self.events = events
        self.clock = clock
        self.strategiesUsed = strategiesUsed
        stateBefore = state
        stateNow = state
    }

    // MARK: - Driving the plan

    public func start() async {
        try? events.append(.sessionStarted(id: .new(), at: clock.now, sessionID: sessionID))
        await enter(stepIndex)
    }

    public func advance() async {
        stepIndex += 1
        attemptsThisStep = 0
        typedAnswer = ""
        await enter(stepIndex)
    }

    private func enter(_ index: Int) async {
        guard index < plan.steps.count else {
            await finish()
            return
        }
        let step = plan.steps[index]
        isWorking = true
        defer { isWorking = false }

        switch step.kind {
        case .teach, .example, .prerequisite, .diagnose:
            await present(step)
        case .guided, .practise, .verify, .transfer:
            await pose(step)
        }
    }

    /// Teaching steps ask the tutor for one explanation in the chosen style.
    private func present(_ step: Intervention.Step) async {
        if let strategy = step.strategy {
            strategiesUsed.append(strategy)
            try? events.append(.conceptTaught(.init(
                at: clock.now, conceptID: concept.conceptID, strategy: strategy.teaching
            )))
        }
        let payload = ContextEngine.Payload(ask: prompt(for: step))
        do {
            let reply = try await tutorService.tutor(payload)
            phase = .learning(step, text: reply.message)
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription
                ?? "That could not be loaded. Your progress is saved.")
        }
    }

    /// Question steps generate a fresh question, never one already used in this session.
    private func pose(_ step: Intervention.Step) async {
        do {
            let questions = try await tutorService.generate(GenerateRequest(
                conceptIDs: [concept.conceptID],
                subject: concept.subject,
                count: 2,
                difficulty: step.difficulty,
                purpose: step.kind == .verify ? "verification" : "practice"
            ))
            guard let question = questions.first(where: { !seenPrompts.contains($0.prompt) })
                ?? questions.first else {
                phase = .failed("No suitable question came back. Try again in a moment.")
                return
            }
            seenPrompts.insert(question.prompt)
            phase = .answering(step, question)
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription
                ?? "A question could not be prepared. Your progress is saved.")
        }
    }

    // MARK: - Answering

    public func submit() async {
        guard case .answering(let step, let question) = phase else { return }
        let answer = typedAnswer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !answer.isEmpty else { return }

        isWorking = true
        defer { isWorking = false }
        attemptsThisStep += 1

        do {
            let reply = try await tutorService.check(CheckRequest(
                submitted: answer,
                expected: question.acceptableAnswers.map {
                    ExpectedAnswer(text: $0, shape: question.answerShape,
                                   unit: question.unit,
                                   significantFigures: question.significantFigures)
                },
                questionText: question.prompt,
                subject: concept.subject
            ))
            record(reply, step: step)
            phase = .marked(step, question, reply)
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription
                ?? "That could not be marked. Your answer is saved.")
        }
    }

    private func record(_ reply: CheckReply, step: Intervention.Step) {
        let attempt = Attempt(
            conceptID: concept.conceptID,
            at: clock.now,
            outcome: reply.outcome,
            // The verification step is unaided by definition; the guided step is not,
            // and recording otherwise would credit ability that was not demonstrated.
            assistance: step.kind == .guided ? .guided : .none,
            kind: kind(for: step),
            errorType: reply.error,
            sessionID: sessionID,
            questionID: nil
        )
        try? events.append(.attempted(attempt))
        stateNow = Mastery.apply(stateNow, attempt)
    }

    private func kind(for step: Intervention.Step) -> AttemptKind {
        switch step.kind {
        case .transfer: .transfer
        case .verify: .retrieval
        case .diagnose: .diagnostic
        default: .practice
        }
    }

    // MARK: - Ending

    private func finish() async {
        let passed = Intervention.verifyPassed(before: stateBefore, after: stateNow)
        improved = passed
        phase = .finished(passed ? .correct : .partial)
        try? events.append(.sessionEnded(
            id: .new(), at: clock.now, sessionID: sessionID,
            activeSeconds: plan.minutes * 60
        ))
    }

    /// Verification failed. Come back with a different approach, not the same one
    /// reworded, and say so plainly.
    public func tryADifferentApproach() async {
        plan = Intervention.build(
            state: stateNow, at: clock.now,
            availableMinutes: plan.minutes,
            strategiesUsed: strategiesUsed
        )
        stepIndex = 0
        attemptsThisStep = 0
        typedAnswer = ""
        improved = nil
        await enter(0)
    }

    // MARK: - Wording

    /// What each teaching step actually asks the tutor for.
    private func prompt(for step: Intervention.Step) -> String {
        switch step.kind {
        case .diagnose:
            "I keep getting \(concept.name) wrong. Ask me one question that would show you why."
        case .prerequisite:
            "Before \(concept.name), what do I need to be solid on? Explain that instead."
        case .teach:
            switch step.strategy {
            case .workedExample: "Work through one \(concept.name) problem, showing every step."
            case .analogy: "Explain \(concept.name) with an analogy."
            case .visual: "Explain \(concept.name) in terms of what it looks like."
            case .guidedQuestion: "Ask me a question that leads me to \(concept.name) myself."
            case .counterexample: "Show me a case where the obvious approach to \(concept.name) fails."
            case .retrievalPrompt: "Ask me what I remember about \(concept.name)."
            case .prerequisite: "Explain what \(concept.name) is built on."
            default: "Explain \(concept.name) simply."
            }
        case .example:
            "Show me one worked example of \(concept.name)."
        default:
            "Explain \(concept.name)."
        }
    }

    public var headline: String {
        switch phase {
        case .finished(let outcome):
            outcome == .correct
                ? "You solved the last one unaided. That is the bit that counts."
                : "Not there yet. Worth another go with a different approach."
        default:
            currentStep?.kind.label ?? concept.name
        }
    }
}
#endif
