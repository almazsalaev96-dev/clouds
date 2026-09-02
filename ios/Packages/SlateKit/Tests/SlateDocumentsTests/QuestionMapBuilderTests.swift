import XCTest
import SlateFoundation
import SlateModel
@testable import SlateDocuments

/// Re-analysing a document the student has already answered must not lose anything.
/// This is the test that stops a background refresh from quietly destroying an evening
/// of work.
final class QuestionMapBuilderTests: XCTestCase {

    private func detected(_ number: String, page: Int = 0,
                          region: NormalisedRect? = nil) -> QuestionMapBuilder.DetectedQuestion {
        QuestionMapBuilder.DetectedQuestion(
            number: number, text: "Question \(number)", marks: 3,
            conceptIDs: [ConceptID("quadratics")], page: page, region: region
        )
    }

    func testQuestionsAreLaidOutDownThePageInOrder() {
        let map = QuestionMapBuilder.build(
            from: [detected("1"), detected("2"), detected("3")], pageCount: 1
        )
        XCTAssertEqual(map.questions.map(\.number), ["1", "2", "3"])
        let ys = map.questions.map(\.questionRegion.y)
        XCTAssertEqual(ys, ys.sorted())
    }

    func testAnAnswerSpaceIsPlacedBetweenConsecutiveQuestions() {
        let map = QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1)
        let first = map.questions[0]
        XCTAssertNotNil(first.answerRegion)
        XCTAssertGreaterThan(first.answerRegion!.y, first.questionRegion.y)
        XCTAssertLessThanOrEqual(
            first.answerRegion!.y + first.answerRegion!.height,
            map.questions[1].questionRegion.y + 0.001
        )
    }

    func testASuppliedRegionIsPreferredToAGuess() {
        let supplied = NormalisedRect(x: 0.1, y: 0.42, width: 0.8, height: 0.05)
        let map = QuestionMapBuilder.build(from: [detected("1", region: supplied)], pageCount: 1)
        XCTAssertEqual(map.questions[0].questionRegion.y, 0.42, accuracy: 1e-9)
    }

    func testPagesAreKeptSeparate() {
        let map = QuestionMapBuilder.build(
            from: [detected("1", page: 0), detected("2", page: 1)], pageCount: 2
        )
        XCTAssertEqual(map.questions.filter { $0.page == 0 }.count, 1)
        XCTAssertEqual(map.questions.filter { $0.page == 1 }.count, 1)
    }

    // MARK: - Merging

    private func answered() -> QuestionMap {
        var map = QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1)
        map.questions[0].hasWork = true
        map.questions[0].lastVerdict = .correct
        map.questions[0].lastCheckedAt = Date(timeIntervalSince1970: 1_767_225_600)
        return map
    }

    func testMergingKeepsTheStudentsProgress() {
        let existing = answered()
        let fresh = QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1)
        let merged = QuestionMapBuilder.merge(fresh, into: existing)

        let first = try? XCTUnwrap(merged.questions.first { $0.number == "1" })
        XCTAssertEqual(first??.hasWork, true)
        XCTAssertEqual(first??.lastVerdict, .correct)
        XCTAssertNotNil(first??.lastCheckedAt)
    }

    func testMergingKeepsQuestionIdentitySoRecordedAttemptsStillPointatIt() {
        let existing = answered()
        let originalID = existing.questions[0].id
        let merged = QuestionMapBuilder.merge(
            QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1),
            into: existing
        )
        XCTAssertEqual(merged.questions.first { $0.number == "1" }?.id, originalID)
    }

    func testAnAnsweredQuestionSurvivesARereadThatMissesIt() {
        // The worst case: a second analysis reads the page differently and drops a
        // question the student has already answered. Losing it would be indefensible.
        let existing = answered()
        let fresh = QuestionMapBuilder.build(from: [detected("2")], pageCount: 1)
        let merged = QuestionMapBuilder.merge(fresh, into: existing)

        XCTAssertTrue(merged.questions.contains { $0.number == "1" && $0.hasWork })
    }

    func testAnUnansweredQuestionMayBeDroppedByAReread() {
        var existing = QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1)
        existing.questions[0].hasWork = false
        let merged = QuestionMapBuilder.merge(
            QuestionMapBuilder.build(from: [detected("2")], pageCount: 1), into: existing
        )
        XCTAssertEqual(merged.questions.map(\.number), ["2"])
    }

    func testAConfirmedAnswerRegionBeatsAFreshGuess() {
        var existing = answered()
        let confirmed = NormalisedRect(x: 0.0, y: 0.70, width: 1.0, height: 0.2)
        existing.questions[0].answerRegion = confirmed

        let merged = QuestionMapBuilder.merge(
            QuestionMapBuilder.build(from: [detected("1"), detected("2")], pageCount: 1),
            into: existing
        )
        let region = merged.questions.first { $0.number == "1" }?.answerRegion
        XCTAssertEqual(region?.y ?? 0, 0.70, accuracy: 1e-9,
                       "a region the student's writing confirmed must not be re-guessed")
    }

    func testMergingIntoAnEmptyMapIsJustTheFreshMap() {
        let fresh = QuestionMapBuilder.build(from: [detected("1")], pageCount: 1)
        XCTAssertEqual(QuestionMapBuilder.merge(fresh, into: QuestionMap()).questions.count, 1)
    }
}
