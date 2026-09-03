import XCTest
import SlateFoundation
import SlateModel
@testable import SlateLearning

/// The privacy promise, as a test.
///
/// `docs/PRIVACY.md` says deleting evidence deletes the conclusions built on it. That
/// is only true because the model is *derived* rather than accumulated, and it is the
/// kind of claim that quietly stops being true the first time someone caches a score.
/// So it is asserted here rather than trusted.
final class RedactionTests: XCTestCase {

    private let t0 = Date(timeIntervalSince1970: 1_767_225_600)

    private func attempts(_ concept: String, count: Int, from day: Double = 0) -> [Attempt] {
        (0..<count).map { i in
            Attempt(conceptID: ConceptID(concept),
                    at: t0.addingTimeInterval((day + Double(i)) * 86_400),
                    outcome: .correct, assistance: .none,
                    sessionID: SessionID(rawValue: "\(concept)-\(i)"))
        }
    }

    private func concept(_ id: String) -> Concept {
        Concept(conceptID: ConceptID(id), name: id, subject: "Maths")
    }

    private func project(_ store: EventStore, at now: Date) throws -> Projection {
        LearningEngine.project(
            attempts: try store.liveAttempts(),
            concepts: [concept("algebra"), concept("graphs")],
            context: .init(now: now)
        )
    }

    func testDeletingAConceptRemovesWhatWasConcludedFromIt() throws {
        let store = RecordingEventStore()
        for attempt in attempts("algebra", count: 6) { try store.append(.attempted(attempt)) }
        for attempt in attempts("graphs", count: 6) { try store.append(.attempted(attempt)) }

        let now = t0.addingTimeInterval(10 * 86_400)
        let before = try project(store, at: now)
        XCTAssertEqual(before.concept(ConceptID("algebra"))?.freshState, .reliable)
        XCTAssertEqual(before.concepts.count, 2)

        try store.append(.evidenceRedacted(id: .new(), at: now, target: .concept(ConceptID("algebra"))))

        let after = try project(store, at: now)
        XCTAssertNil(after.concept(ConceptID("algebra")),
                     "the mastery built on deleted evidence must not survive it")
        XCTAssertEqual(after.concept(ConceptID("graphs"))?.freshState, .reliable,
                       "and nothing else may be affected")
    }

    func testDeletingEverythingLeavesNoConclusionsAtAll() throws {
        let store = RecordingEventStore()
        for attempt in attempts("algebra", count: 6) { try store.append(.attempted(attempt)) }
        for attempt in attempts("graphs", count: 4) { try store.append(.attempted(attempt)) }

        let now = t0.addingTimeInterval(10 * 86_400)
        try store.append(.evidenceRedacted(id: .new(), at: now, target: .everything))

        let after = try project(store, at: now)
        XCTAssertTrue(after.concepts.isEmpty)
        XCTAssertTrue(after.patterns.isEmpty)
        XCTAssertTrue(after.recommendations.allSatisfy { $0.conceptIDs.isEmpty },
                      "nothing may still be recommended on the strength of deleted work")
    }

    func testDeletingDoesNotSilenceWhatComesAfterIt() throws {
        // A student who clears a subject and then does more work must build a new
        // model, not stay invisible.
        let store = RecordingEventStore()
        for attempt in attempts("algebra", count: 6) { try store.append(.attempted(attempt)) }

        let cleared = t0.addingTimeInterval(10 * 86_400)
        try store.append(.evidenceRedacted(id: .new(), at: cleared, target: .everything))
        for attempt in attempts("algebra", count: 3, from: 11) { try store.append(.attempted(attempt)) }

        let after = try project(store, at: t0.addingTimeInterval(20 * 86_400))
        XCTAssertEqual(after.concept(ConceptID("algebra"))?.attempts, 3)
    }

    func testTheLogItselfIsNeverRewritten() throws {
        // Redaction is an event, not a deletion, so a projection rebuilt next year
        // agrees with one built today. Editing history in place is how two devices
        // end up with two different pasts.
        let store = RecordingEventStore()
        for attempt in attempts("algebra", count: 3) { try store.append(.attempted(attempt)) }
        let countBefore = try store.all().count

        try store.append(.evidenceRedacted(id: .new(), at: t0, target: .everything))

        XCTAssertEqual(try store.all().count, countBefore + 1)
        XCTAssertEqual(store.deletions, 0, "nothing may be removed from the log")
        XCTAssertTrue(try store.liveAttempts().isEmpty)
    }

    func testARedactedConceptContributesNothingToRecommendations() throws {
        let store = RecordingEventStore()
        // Weak evidence: exactly the sort that would otherwise be recommended for work.
        for i in 0..<3 {
            try store.append(.attempted(Attempt(
                conceptID: ConceptID("algebra"),
                at: t0.addingTimeInterval(Double(i) * 86_400),
                outcome: .incorrect, assistance: .hint,
                sessionID: SessionID(rawValue: "s\(i)")
            )))
        }
        let now = t0.addingTimeInterval(5 * 86_400)
        XCTAssertTrue(try project(store, at: now).recommendations
            .contains { $0.conceptIDs.contains(ConceptID("algebra")) })

        try store.append(.evidenceRedacted(id: .new(), at: now, target: .concept(ConceptID("algebra"))))

        XCTAssertFalse(try project(store, at: now).recommendations
            .contains { $0.conceptIDs.contains(ConceptID("algebra")) })
    }
}

/// An event store that counts removals, so a test can assert none happened.
final class RecordingEventStore: EventStore, @unchecked Sendable {
    private var events: [LearningEvent] = []
    private let lock = NSLock()
    private(set) var deletions = 0

    func append(_ event: LearningEvent) throws { try append(contentsOf: [event]) }

    func append(contentsOf newEvents: [LearningEvent]) throws {
        lock.lock(); defer { lock.unlock() }
        let before = events.count
        events.append(contentsOf: newEvents)
        if events.count < before + newEvents.count { deletions += 1 }
    }

    func all() throws -> [LearningEvent] {
        lock.lock(); defer { lock.unlock() }
        return events
    }

    func events(since date: Date) throws -> [LearningEvent] {
        try all().filter { $0.at >= date }
    }
}
