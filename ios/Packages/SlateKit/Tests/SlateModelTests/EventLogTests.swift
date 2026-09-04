import XCTest
import SlateFoundation
@testable import SlateModel

/// The event log's job is that deleting evidence deletes the beliefs built on it.
/// These tests are that promise, written down.
final class EventLogTests: XCTestCase {

    private let t0 = Date(timeIntervalSince1970: 1_767_225_600)

    private func attempt(_ concept: String, day: Double,
                         session: String = "s", outcome: Outcome = .correct) -> Attempt {
        Attempt(conceptID: ConceptID(concept),
                at: t0.addingTimeInterval(day * 86_400),
                outcome: outcome, sessionID: SessionID(rawValue: session))
    }

    func testLiveAttemptsReturnsWhatWasRecorded() throws {
        let store = InMemoryEventStore()
        try store.append(.attempted(attempt("a", day: 0)))
        try store.append(.attempted(attempt("b", day: 1)))
        XCTAssertEqual(try store.liveAttempts().count, 2)
    }

    func testRedactingAConceptRemovesItsEvidence() throws {
        let store = InMemoryEventStore()
        try store.append(.attempted(attempt("a", day: 0)))
        try store.append(.attempted(attempt("b", day: 1)))
        try store.append(.evidenceRedacted(id: .new(), at: t0.addingTimeInterval(2 * 86_400),
                                           target: .concept(ConceptID("a"))))

        let live = try store.liveAttempts()
        XCTAssertEqual(live.map(\.conceptID.rawValue), ["b"])
    }

    func testRedactingASessionRemovesOnlyThatSession() throws {
        let store = InMemoryEventStore()
        try store.append(.attempted(attempt("a", day: 0, session: "morning")))
        try store.append(.attempted(attempt("a", day: 1, session: "evening")))
        try store.append(.evidenceRedacted(id: .new(), at: t0.addingTimeInterval(2 * 86_400),
                                           target: .session(SessionID(rawValue: "morning"))))
        XCTAssertEqual(try store.liveAttempts().count, 1)
    }

    func testRedactingEverythingLeavesNothing() throws {
        let store = InMemoryEventStore()
        try store.append(.attempted(attempt("a", day: 0)))
        try store.append(.attempted(attempt("b", day: 1)))
        try store.append(.evidenceRedacted(id: .new(), at: t0.addingTimeInterval(2 * 86_400),
                                           target: .everything))
        XCTAssertTrue(try store.liveAttempts().isEmpty)
    }

    func testEvidenceRecordedAfterARedactionStillCounts() throws {
        // Deleting a subject's history must not silently mute everything that follows.
        let store = InMemoryEventStore()
        try store.append(.attempted(attempt("a", day: 0)))
        try store.append(.evidenceRedacted(id: .new(), at: t0.addingTimeInterval(86_400),
                                           target: .concept(ConceptID("a"))))
        try store.append(.attempted(attempt("a", day: 2)))
        XCTAssertEqual(try store.liveAttempts().count, 1)
    }

    func testTheLogRoundTripsThroughJSON() throws {
        let events: [LearningEvent] = [
            .attempted(attempt("a", day: 0)),
            .assistanceRequested(.init(at: t0, conceptID: ConceptID("a"),
                                       questionID: QuestionID(rawValue: "q1"), level: .hint)),
            .conceptTaught(.init(at: t0, conceptID: ConceptID("a"), strategy: .analogy)),
            .sessionStarted(id: .new(), at: t0, sessionID: SessionID(rawValue: "s")),
        ]
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let data = try encoder.encode(events)
        let restored = try decoder.decode([LearningEvent].self, from: data)
        XCTAssertEqual(restored.count, events.count)
        XCTAssertEqual(restored.map(\.at), events.map(\.at))
    }
}

final class EvidenceSemanticsTests: XCTestCase {
    func testSolutionCarriesNoCredit() {
        XCTAssertEqual(Assistance.solution.creditWeight, 0)
    }

    func testHelpIsOrderedFromLeastToMost() {
        let ladder: [Assistance] = [.none, .nudge, .hint, .guided, .worked, .solution]
        let weights = ladder.map(\.creditWeight)
        XCTAssertEqual(weights, weights.sorted(by: >))
    }

    func testOnlyUnaidedAnswersCountAsIndependent() {
        XCTAssertTrue(Assistance.none.isIndependent)
        XCTAssertTrue(Assistance.nudge.isIndependent)
        XCTAssertFalse(Assistance.hint.isIndependent)
        XCTAssertFalse(Assistance.solution.isIndependent)
    }

    func testSlipsAndUnreadableWorkAreNotKnowledgeClaims() {
        XCTAssertFalse(ErrorType.careless.countsAgainstAbility)
        XCTAssertFalse(ErrorType.unreadable.countsAgainstAbility)
        XCTAssertTrue(ErrorType.misconception.countsAgainstAbility)
    }

    func testMasteryStatesAreOrdered() {
        XCTAssertLessThan(MasteryState.introduced, MasteryState.reliable)
        XCTAssertLessThan(MasteryState.reliable, MasteryState.mastered)
        XCTAssertEqual(MasteryState.atRank(99), .mastered)
        XCTAssertEqual(MasteryState.atRank(-1), .unseen)
    }

    func testAskingForMoreHelpAlwaysReachesTheSolution() {
        var level = Assistance.none
        for _ in 0..<10 { level = level.moreHelp }
        XCTAssertEqual(level, .solution, "the ladder must terminate at the answer, not stall short of it")
    }
}

/// In-memory store used by the tests above.
final class InMemoryEventStore: EventStore, @unchecked Sendable {
    private var events: [LearningEvent] = []
    private let lock = NSLock()

    func append(_ event: LearningEvent) throws { try append(contentsOf: [event]) }

    func append(contentsOf newEvents: [LearningEvent]) throws {
        lock.lock(); defer { lock.unlock() }
        events.append(contentsOf: newEvents)
    }

    func all() throws -> [LearningEvent] {
        lock.lock(); defer { lock.unlock() }
        return events
    }

    func events(since date: Date) throws -> [LearningEvent] {
        try all().filter { $0.at >= date }
    }
}
