import XCTest
import SlateFoundation
import SlateModel
@testable import SlateDocuments

/// Annotations get the same durability guarantee as handwriting.
///
/// Twenty minutes spent marking up a past paper is twenty minutes of work, and losing
/// it to a force-quit is no more acceptable because it was not written with a Pencil.
final class AnnotationStoreTests: XCTestCase {

    private var directory: URL!
    private var paths: DocumentPaths!
    private let clock = TestClock(Date(timeIntervalSince1970: 1_767_225_600))

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        paths = DocumentPaths(root: directory)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func store() throws -> AnnotationStore {
        try AnnotationStore(paths: paths, clock: clock)
    }

    private func highlight(_ id: String, page: Int = 0) -> Annotation {
        Annotation(
            id: id, kind: .highlight, page: page,
            rect: NormalisedRect(x: 0.1, y: 0.2, width: 0.6, height: 0.04),
            colourHex: "FFDC47", createdAt: clock.now
        )
    }

    func testAnnotationsSurviveAReopen() throws {
        let first = try store()
        try first.add(highlight("a"))
        try first.add(highlight("b", page: 2))
        try first.saveSnapshot()

        let reopened = try store()
        XCTAssertEqual(Set(reopened.annotations.map(\.id)), ["a", "b"])
        XCTAssertEqual(reopened.annotations(onPage: 2).map(\.id), ["b"])
    }

    func testUnsavedAnnotationsAreRecoveredFromTheJournal() throws {
        // No snapshot: exactly the state a force-quit leaves behind.
        let first = try store()
        try first.add(highlight("a"))
        try first.add(highlight("b"))

        let recovered = try store()
        XCTAssertEqual(Set(recovered.annotations.map(\.id)), ["a", "b"])
        XCTAssertEqual(recovered.recovery?.replayed, 2)
    }

    func testRecoveryIsOnlyReportedWhenThereWasSomethingToRecover() throws {
        let first = try store()
        try first.add(highlight("a"))
        try first.saveSnapshot()

        // A clean close leaves nothing in the log, so the student is not told their
        // work was rescued when it was simply saved.
        XCTAssertNil(try store().recovery)
    }

    func testRemovingAnAnnotationSticks() throws {
        let first = try store()
        try first.add(highlight("a"))
        try first.add(highlight("b"))
        try first.remove("a")

        let reopened = try store()
        XCTAssertEqual(reopened.annotations.map(\.id), ["b"])
    }

    func testReaddingTheSameIdReplacesRatherThanDuplicates() throws {
        let store = try store()
        try store.add(highlight("a"))
        var moved = highlight("a")
        moved.rect = NormalisedRect(x: 0.5, y: 0.5, width: 0.2, height: 0.02)
        try store.add(moved)

        XCTAssertEqual(store.annotations.count, 1)
        XCTAssertEqual(store.annotations.first?.rect.x, 0.5)
    }

    func testTypedAnswersRoundTrip() throws {
        let question = QuestionID(rawValue: "q1")
        let first = try store()
        try first.setTypedAnswer("x = 4", for: question)

        XCTAssertEqual(try store().typedAnswers[question], "x = 4")
    }

    func testAnEmptyTypedAnswerClearsIt() throws {
        let question = QuestionID(rawValue: "q1")
        let store = try store()
        try store.setTypedAnswer("x = 4", for: question)
        try store.setTypedAnswer("   ", for: question)

        XCTAssertNil(store.typedAnswers[question])
    }

    func testTypedAnswersArePlacedInTheirOwnAnswerRegion() throws {
        let question = MappedQuestion(
            id: QuestionID(rawValue: "q1"), number: "1", text: "Solve", page: 3,
            questionRegion: NormalisedRect(x: 0, y: 0.1, width: 1, height: 0.05),
            answerRegion: NormalisedRect(x: 0.05, y: 0.16, width: 0.9, height: 0.1)
        )
        let store = try store()
        try store.setTypedAnswer("x = 4", for: question.id)

        let placed = store.placedTypedAnswers(using: QuestionMap(questions: [question]))
        XCTAssertEqual(placed.count, 1)
        XCTAssertEqual(placed.first?.page, 3)
        XCTAssertEqual(placed.first?.rect.y ?? 0, 0.16, accuracy: 1e-9)
    }

    func testAnAnswerWithNowhereToGoIsDroppedNotStampedAtTheOrigin() throws {
        // A teacher opening the PDF must not find an answer floating in the corner.
        let question = MappedQuestion(
            id: QuestionID(rawValue: "q1"), number: "1", text: "Solve", page: 0,
            questionRegion: NormalisedRect(x: 0, y: 0.1, width: 1, height: 0.05),
            answerRegion: nil
        )
        let store = try store()
        try store.setTypedAnswer("x = 4", for: question.id)

        XCTAssertTrue(store.placedTypedAnswers(using: QuestionMap(questions: [question])).isEmpty)
    }

    func testAnAnswerForAQuestionThatNoLongerExistsIsDropped() throws {
        let store = try store()
        try store.setTypedAnswer("x = 4", for: QuestionID(rawValue: "gone"))
        XCTAssertTrue(store.placedTypedAnswers(using: QuestionMap()).isEmpty)
    }

    func testASnapshotClearsTheLogWithoutLosingAnything() throws {
        let first = try store()
        for id in ["a", "b", "c"] { try first.add(highlight(id)) }
        try first.saveSnapshot()

        let reopened = try store()
        XCTAssertEqual(reopened.annotations.count, 3)
        XCTAssertNil(reopened.recovery, "the snapshot holds it, so nothing needed recovering")
    }
}
