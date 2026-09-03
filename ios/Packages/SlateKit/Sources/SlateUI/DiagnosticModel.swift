#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateAI
import SlateFoundation
import SlateLearning
import SlateModel

/// Six questions instead of thirty.
///
/// A diagnostic's job is to tell apart the possible reasons a student is going wrong,
/// so each question is chosen to *split the remaining hypotheses* rather than to cover
/// a syllabus. It stops the moment it is confident enough, because asking a question
/// whose answer you can already predict wastes the student's time — and it says how
/// much it actually learned rather than implying certainty it did not earn.
@MainActor
public final class DiagnosticModel: ObservableObject, Identifiable {

    public nonisolated let id = UUID()

    public enum Phase: Equatable {
        case preparing
        case asking(DiagnosticSet.Question)
        case finished(Conclusion)
        case inconclusive(String)
        case failed(String)
    }

    public struct Conclusion: Equatable {
        public let hypothesis: DiagnosticSet.Hypothesis
        public let probability: Double
        /// Bits removed. Reported so "we are fairly sure" and "we narrowed it a little"
        /// are visibly different claims.
        public let bitsLearned: Double
        public let questionsAsked: Int
    }

    @Published public private(set) var phase: Phase = .preparing
    @Published public var typedAnswer = ""
    @Published public private(set) var isWorking = false
    @Published public private(set) var askedCount = 0

    public let concepts: [Concept]
    public var onFix: ((ConceptID) -> Void)?

    private let tutorService: TutorService
    private let events: EventStore
    private let clock: Clock
    private let sessionID = SessionID.new()
    private let maxQuestions: Int
    private let confidenceThreshold: Double

    private var set: DiagnosticSet?
    private var run: InformationGain.Run?
    private var candidates: [InformationGain.CandidateQuestion] = []
    private var byPrompt: [String: DiagnosticSet.Question] = [:]
    private var startingEntropy: Double = 0

    public init(concepts: [Concept], tutorService: TutorService, events: EventStore,
                maxQuestions: Int = 6, confidenceThreshold: Double = 0.8,
                clock: Clock = SystemClock()) {
        self.concepts = concepts
        self.tutorService = tutorService
        self.events = events
        self.maxQuestions = maxQuestions
        self.confidenceThreshold = confidenceThreshold
        self.clock = clock
    }

    // MARK: - Setting up

    public func start(recentErrors: [ErrorType] = [], wrongAnswers: [String] = []) async {
        phase = .preparing
        isWorking = true
        defer { isWorking = false }

        do {
            let fetched = try await tutorService.diagnose(DiagnoseRequest(
                conceptIDs: concepts.map(\.conceptID),
                subject: concepts.first?.subject,
                recentErrors: recentErrors,
                wrongAnswers: wrongAnswers,
                count: maxQuestions
            ))
            set = fetched
            byPrompt = Dictionary(uniqueKeysWithValues: fetched.questions.map { ($0.prompt, $0) })
            candidates = fetched.questions.map(Self.candidate)
            let hypotheses = fetched.hypotheses.map {
                InformationGain.Hypothesis(id: $0.id, label: $0.label, prior: $0.prior)
            }
            var newRun = InformationGain.Run(hypotheses: hypotheses)
            startingEntropy = newRun.remainingUncertainty
            run = newRun
            try? events.append(.sessionStarted(id: .new(), at: clock.now, sessionID: sessionID))
            askNext(&newRun)
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription
                ?? "The questions could not be prepared.")
        }
    }

    /// Translate one diagnostic question into the form the engine reasons about.
    static func candidate(_ question: DiagnosticSet.Question) -> InformationGain.CandidateQuestion {
        var table: [String: [String: Double]] = [:]
        for entry in question.discriminates ?? [] {
            table[entry.hypothesisId] = Dictionary(
                uniqueKeysWithValues: entry.responses.map { ($0.category, $0.probability) }
            )
        }
        return InformationGain.CandidateQuestion(
            id: question.prompt, prompt: question.prompt, likelihoods: table,
            estimatedMinutes: 1.0, conceptID: question.conceptIds.first ?? ""
        )
    }

    // MARK: - The loop

    private func askNext(_ current: inout InformationGain.Run) {
        if current.isConfident(threshold: confidenceThreshold) || askedCount >= maxQuestions {
            conclude(current)
            return
        }
        guard let next = InformationGain.selectNext(
            prior: current.prior, candidates: candidates, asked: Set(current.asked)
        ) else {
            // Nothing left that would tell us anything new. Stopping here is the point
            // of the whole approach, not a failure of it.
            conclude(current)
            return
        }
        guard let question = byPrompt[next.id] else {
            conclude(current)
            return
        }
        typedAnswer = ""
        phase = .asking(question)
        run = current
    }

    public func submit() async {
        guard case .asking(let question) = phase, var current = run else { return }
        let answer = typedAnswer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !answer.isEmpty else { return }

        isWorking = true
        defer { isWorking = false }

        let category = await categorise(answer, for: question)
        guard let candidate = candidates.first(where: { $0.id == question.prompt }) else { return }

        current.observe(candidate, response: category)
        askedCount += 1
        record(question: question, category: category)
        askNext(&current)
    }

    /// Which response category the answer falls into.
    ///
    /// The deterministic marker decides this, not a model: it already knows whether the
    /// answer is right and, when it is wrong, *how* it missed. A flipped sign is exactly
    /// the kind of signature a diagnostic question is written to detect, so the grader's
    /// near-miss is the category.
    private func categorise(_ answer: String, for question: DiagnosticSet.Question) async -> String {
        let expected = question.acceptableAnswers.map {
            ExpectedAnswer(text: $0, shape: question.answerShape,
                           unit: question.unit, significantFigures: question.significantFigures)
        }
        guard let graded = try? await tutorService.gradeOnly(submitted: answer, expected: expected) else {
            return "other"
        }
        if graded.verdict == "correct" { return "correct" }
        switch graded.nearMiss?.kind {
        case "signFlipped": return "signError"
        case "offByFactor", "degreesForRadians", "radiansForDegrees": return "scaleError"
        case "reciprocal", "squared", "squareRooted": return "wrongOperation"
        case "unitMismatch", "missingUnit", "rightNumberWrongUnit": return "unitError"
        default: return "other"
        }
    }

    private func record(question: DiagnosticSet.Question, category: String) {
        let conceptIDs = question.conceptIds.map(ConceptID.init)
        for concept in conceptIDs.isEmpty ? concepts.map(\.conceptID) : conceptIDs {
            try? events.append(.attempted(Attempt(
                conceptID: concept, at: clock.now,
                outcome: category == "correct" ? .correct : .incorrect,
                assistance: .none, kind: .diagnostic,
                errorType: category == "correct" ? nil : .unknown,
                sessionID: sessionID
            )))
        }
    }

    private func conclude(_ current: InformationGain.Run) {
        run = current
        try? events.append(.sessionEnded(id: .new(), at: clock.now,
                                         sessionID: sessionID, activeSeconds: 0))

        let leading = current.leading
        let bits = max(0, startingEntropy - current.remainingUncertainty)

        guard let hypothesis = set?.hypotheses.first(where: { $0.id == leading.id }),
              leading.probability >= 0.5 else {
            // Refusing to name a cause is a legitimate outcome. Announcing the least
            // unlikely of four possibilities as the answer would be worse than useless.
            phase = .inconclusive(
                askedCount == 0
                    ? "There was nothing here that would have told us anything new."
                    : "These questions did not separate the possibilities. Some more work on paper would tell us more than more questions would."
            )
            return
        }

        phase = .finished(Conclusion(
            hypothesis: hypothesis,
            probability: leading.probability,
            bitsLearned: bits,
            questionsAsked: askedCount
        ))
    }

    public func fix() {
        guard case .finished(let conclusion) = phase else { return }
        let concept = conclusion.hypothesis.conceptIDs.first ?? concepts.first?.conceptID
        guard let concept else { return }
        onFix?(concept)
    }

    /// How sure the conclusion is, in words rather than a number.
    public func confidenceWording(_ conclusion: Conclusion) -> String {
        if conclusion.probability >= 0.85 { return "Fairly sure" }
        if conclusion.probability >= 0.65 { return "Likely" }
        return "Best guess"
    }
}
#endif
