#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateAI
import SlateFoundation
import SlateLearning
import SlateModel

/// Sitting a test.
///
/// Two things make this different from practice. The tutor is unavailable, because a
/// test that can be asked for hints measures nothing. And confidence is captured
/// alongside each answer, because "sure and wrong" and "unsure and right" need
/// completely different responses, and neither is visible from the score.
@MainActor
public final class TestSessionModel: ObservableObject, Identifiable {

    public nonisolated let id = UUID()

    public struct Item: Identifiable, Sendable {
        public let id = UUID()
        public let question: GeneratedQuestion
        public var answer: String = ""
        public var confidence: Double?
        public var secondsSpent: Double = 0
        public var isFlagged = false
        public var outcome: Outcome?
        public var marksAwarded: Int = 0
        public var errorType: ErrorType?

        public var isAnswered: Bool { !answer.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    public enum Stage: Equatable {
        case loading
        case sitting
        case marking(done: Int, total: Int)
        case results
        case failed(String)
    }

    @Published public private(set) var stage: Stage = .loading
    @Published public private(set) var items: [Item] = []
    @Published public var index = 0
    @Published public private(set) var report: TestReport?
    @Published public private(set) var elapsed: TimeInterval = 0

    /// Optional. A timer changes how a test feels, and forcing one on every practice
    /// paper would make the app stressful to open.
    public let timeLimit: TimeInterval?
    public let title: String
    public let concepts: [Concept]

    private let tutorService: TutorService
    private let events: EventStore
    private let clock: Clock
    private let sessionID = SessionID.new()
    private var startedAt: Date?
    private var questionStartedAt: Date?
    private var ticker: Task<Void, Never>?

    public var current: Item? { items.indices.contains(index) ? items[index] : nil }

    public var answeredCount: Int { items.filter(\.isAnswered).count }

    public var remainingTime: TimeInterval? {
        guard let timeLimit else { return nil }
        return max(0, timeLimit - elapsed)
    }

    public init(title: String, concepts: [Concept], timeLimit: TimeInterval? = nil,
                tutorService: TutorService, events: EventStore,
                clock: Clock = SystemClock()) {
        self.title = title
        self.concepts = concepts
        self.timeLimit = timeLimit
        self.tutorService = tutorService
        self.events = events
        self.clock = clock
    }

    /// Called when the view goes away. A test abandoned mid-question must not leave a
    /// timer running against a session nobody is sitting.
    public func stop() {
        ticker?.cancel()
        ticker = nil
    }

    // MARK: - Setting up

    public func start(questionCount: Int = 8, difficulty: String = "exam") async {
        stage = .loading
        do {
            let generated = try await tutorService.generate(GenerateRequest(
                conceptIDs: concepts.map(\.conceptID),
                subject: concepts.first?.subject,
                count: questionCount,
                difficulty: difficulty,
                purpose: "test"
            ))
            guard !generated.isEmpty else {
                stage = .failed("No questions came back. Nothing unverified is ever shown.")
                return
            }
            items = generated.map { Item(question: $0) }
            startedAt = clock.now
            questionStartedAt = clock.now
            stage = .sitting
            try? events.append(.sessionStarted(id: .new(), at: clock.now, sessionID: sessionID))
            startTicking()
        } catch {
            stage = .failed((error as? LocalizedError)?.errorDescription
                ?? "The test could not be prepared.")
        }
    }

    private func startTicking() {
        ticker?.cancel()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self else { return }
                await MainActor.run {
                    guard case .sitting = self.stage, let started = self.startedAt else { return }
                    self.elapsed = self.clock.now.timeIntervalSince(started)
                    // Time runs out; the test submits itself rather than sitting there
                    // while a student stares at a zero.
                    if let limit = self.timeLimit, self.elapsed >= limit {
                        Task { await self.submit() }
                    }
                }
            }
        }
    }

    // MARK: - Navigating

    public func go(to newIndex: Int) {
        recordTimeOnCurrent()
        index = max(0, min(newIndex, items.count - 1))
        questionStartedAt = clock.now
    }

    public func next() { go(to: index + 1) }
    public func previous() { go(to: index - 1) }

    public func setAnswer(_ text: String) {
        guard items.indices.contains(index) else { return }
        items[index].answer = text
    }

    /// Asked once per question, after the answer, never before.
    ///
    /// Before, it primes them; after, it is a genuine self-assessment, and the gap
    /// between it and the result is the most diagnostic number in the whole report.
    public func setConfidence(_ value: Double) {
        guard items.indices.contains(index) else { return }
        items[index].confidence = value
    }

    public func toggleFlag() {
        guard items.indices.contains(index) else { return }
        items[index].isFlagged.toggle()
    }

    private func recordTimeOnCurrent() {
        guard let started = questionStartedAt, items.indices.contains(index) else { return }
        items[index].secondsSpent += clock.now.timeIntervalSince(started)
    }

    // MARK: - Marking

    public func submit() async {
        guard case .sitting = stage else { return }
        recordTimeOnCurrent()
        ticker?.cancel()
        stage = .marking(done: 0, total: items.count)

        for position in items.indices {
            let item = items[position]
            defer { stage = .marking(done: position + 1, total: items.count) }
            guard item.isAnswered else {
                items[position].outcome = .incorrect
                items[position].marksAwarded = 0
                continue
            }

            let expected = item.question.acceptableAnswers.map {
                ExpectedAnswer(text: $0, shape: item.question.answerShape,
                               unit: item.question.unit,
                               significantFigures: item.question.significantFigures)
            }
            // Deterministic marking first for every question. Most tests are entirely
            // decidable by arithmetic, and asking a model about answers it cannot
            // improve on is slow and pointless.
            if let fast = try? await tutorService.gradeOnly(submitted: item.answer,
                                                           expected: expected),
               let outcome = fast.outcome, fast.verdict != "abstain" {
                items[position].outcome = outcome
                items[position].marksAwarded = marks(for: outcome, of: item.question)
                if outcome != .correct, let near = fast.nearMiss {
                    items[position].errorType = ErrorType(rawValue: near.suggestedErrorType)
                }
                if outcome == .correct { continue }
            }

            // Wrong, or the marker abstained. Now the model earns its keep by saying
            // what went wrong.
            if let reply = try? await tutorService.check(CheckRequest(
                submitted: item.answer, expected: expected,
                questionText: item.question.prompt,
                subject: concepts.first?.subject
            )) {
                items[position].outcome = reply.outcome
                items[position].marksAwarded = marks(for: reply.outcome, of: item.question)
                items[position].errorType = reply.error
            }
        }

        record()
        stage = .results
    }

    private func marks(for outcome: Outcome, of question: GeneratedQuestion) -> Int {
        switch outcome {
        case .correct: question.marks
        case .partial: max(1, question.marks / 2)
        case .incorrect: 0
        }
    }

    private func record() {
        let now = clock.now
        var results: [TestReport.QuestionResult] = []

        for item in items {
            let conceptIDs = item.question.conceptIDs.isEmpty
                ? concepts.map(\.conceptID) : item.question.conceptIDs
            guard let outcome = item.outcome else { continue }

            for concept in conceptIDs {
                // Exam evidence, unaided by construction: nothing in this screen can
                // offer help, so `assistance: .none` is a fact rather than an assumption.
                try? events.append(.attempted(Attempt(
                    conceptID: concept, at: now, outcome: outcome,
                    assistance: .none, kind: .exam, errorType: item.errorType,
                    sessionID: sessionID, questionID: nil,
                    confidence: item.confidence, secondsSpent: item.secondsSpent
                )))
            }

            results.append(TestReport.QuestionResult(
                id: QuestionID(rawValue: item.id.uuidString),
                conceptID: conceptIDs.first ?? ConceptID("unknown"),
                outcome: outcome,
                marksAvailable: item.question.marks,
                marksAwarded: item.marksAwarded,
                seconds: item.secondsSpent,
                errorType: item.errorType,
                confidence: item.confidence
            ))
        }

        let attempts = (try? events.liveAttempts()) ?? []
        let projection = LearningEngine.project(
            attempts: attempts, concepts: concepts,
            context: .init(now: now, availableMinutes: 20)
        )
        report = TestReport.build(
            results: results, projection: projection,
            conceptNames: Dictionary(uniqueKeysWithValues: concepts.map { ($0.conceptID, $0.name) })
        )
        try? events.append(.sessionEnded(id: .new(), at: now, sessionID: sessionID,
                                         activeSeconds: elapsed))
    }

    /// Look up a question by the identifier the report uses, so a result row can show
    /// the question it came from.
    public func question(for id: QuestionID) -> GeneratedQuestion? {
        items.first { $0.id.uuidString == id.rawValue }?.question
    }

    public func item(for id: QuestionID) -> Item? {
        items.first { $0.id.uuidString == id.rawValue }
    }
}
#endif
