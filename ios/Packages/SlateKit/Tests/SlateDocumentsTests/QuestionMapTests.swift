import XCTest
import SlateFoundation
import SlateModel
@testable import SlateDocuments

/// Resolving "this".
///
/// If these fail, every contextual feature in the product degrades into asking the
/// student which question they meant.
final class QuestionMapTests: XCTestCase {

    private func rect(_ y: Double, _ height: Double = 0.05) -> NormalisedRect {
        NormalisedRect(x: 0.05, y: y, width: 0.9, height: height)
    }

    private func map() -> QuestionMap {
        QuestionMap(questions: [
            MappedQuestion(id: QuestionID(rawValue: "q1"), number: "1", text: "Solve",
                           page: 0, questionRegion: rect(0.10),
                           answerRegion: rect(0.16, 0.14)),
            MappedQuestion(id: QuestionID(rawValue: "q2"), number: "2", text: "Expand",
                           page: 0, questionRegion: rect(0.40),
                           answerRegion: rect(0.46, 0.14)),
            MappedQuestion(id: QuestionID(rawValue: "q3"), number: "3(a)", text: "Explain",
                           page: 1, questionRegion: rect(0.10)),
        ])
    }

    func testATapInsideAnAnswerAreaFindsItsQuestion() {
        XCTAssertEqual(map().question(atPage: 0, y: 0.22)?.number, "1")
        XCTAssertEqual(map().question(atPage: 0, y: 0.52)?.number, "2")
    }

    func testATapOnThePromptFindsItsQuestion() {
        XCTAssertEqual(map().question(atPage: 0, y: 0.12)?.number, "1")
    }

    func testWritingBelowAQuestionBelongsToIt() {
        // On a worksheet, working under a prompt is that question's working, even when
        // it runs past the space provided.
        XCTAssertEqual(map().question(atPage: 0, y: 0.36)?.number, "1")
        XCTAssertEqual(map().question(atPage: 0, y: 0.95)?.number, "2")
    }

    func testQuestionsDoNotLeakBetweenPages() {
        XCTAssertEqual(map().question(atPage: 1, y: 0.12)?.number, "3(a)")
        XCTAssertNil(map().question(atPage: 5, y: 0.5))
    }

    func testSubPartNumberingIsPreservedExactly() {
        XCTAssertEqual(map().question(id: QuestionID(rawValue: "q3"))?.number, "3(a)")
    }

    func testProgressCountsQuestionsWithWork() {
        var m = map()
        m.questions[0].hasWork = true
        XCTAssertEqual(m.progress.done, 1)
        XCTAssertEqual(m.progress.total, 3)
        XCTAssertEqual(m.unanswered.count, 2)
    }
}

final class AnswerDetectionTests: XCTestCase {

    private let region = NormalisedRect(x: 0.05, y: 0.20, width: 0.9, height: 0.2)

    private func strokes(_ x: Double, _ y: Double, width: Double,
                         count: Int) -> AnswerDetection.StrokeSummary {
        AnswerDetection.StrokeSummary(
            bounds: NormalisedRect(x: x, y: y, width: width, height: 0.05),
            strokeCount: count, page: 0
        )
    }

    func testRealWorkingIsRecognised() {
        XCTAssertTrue(AnswerDetection.looksLikeAnswer(
            strokes(0.1, 0.25, width: 0.4, count: 12), in: region))
    }

    func testASingleTickIsNotAnAnswer() {
        // Not every pencil stroke is an answer. Treating a tick as one produces
        // confident nonsense about work the student has not done.
        XCTAssertFalse(AnswerDetection.looksLikeAnswer(
            strokes(0.1, 0.25, width: 0.01, count: 1), in: region))
    }

    func testAMarginDoodleIsNotAnAnswer() {
        XCTAssertFalse(AnswerDetection.looksLikeAnswer(
            strokes(0.1, 0.80, width: 0.3, count: 8), in: region))
    }

    func testStrokesAreAssignedToTheRightQuestion() {
        let map = QuestionMap(questions: [
            MappedQuestion(id: QuestionID(rawValue: "q1"), number: "1", text: "", page: 0,
                           questionRegion: NormalisedRect(x: 0, y: 0.05, width: 1, height: 0.05),
                           answerRegion: NormalisedRect(x: 0, y: 0.10, width: 1, height: 0.2)),
            MappedQuestion(id: QuestionID(rawValue: "q2"), number: "2", text: "", page: 0,
                           questionRegion: NormalisedRect(x: 0, y: 0.50, width: 1, height: 0.05),
                           answerRegion: NormalisedRect(x: 0, y: 0.55, width: 1, height: 0.2)),
        ])
        let assigned = AnswerDetection.assign(summaries: [
            strokes(0.1, 0.15, width: 0.5, count: 9),
            strokes(0.1, 0.60, width: 0.5, count: 6),
        ], to: map)

        XCTAssertEqual(assigned[QuestionID(rawValue: "q1")]?.count, 1)
        XCTAssertEqual(assigned[QuestionID(rawValue: "q2")]?.count, 1)
    }
}

final class ExportNamingTests: XCTestCase {
    func testFilenameReadsTheWayATeacherFilesIt() {
        XCTAssertEqual(
            Exporter.suggestedFilename(subject: "Physics", title: "Forces worksheet",
                                       studentName: "Almaz Salaev"),
            "Physics_Forces_worksheet_Almaz_Salaev.pdf"
        )
    }

    func testPunctuationThatBreaksMailClientsIsRemoved() {
        let name = Exporter.suggestedFilename(subject: "Maths / Stats",
                                              title: "Paper 1: Quadratics", studentName: nil)
        XCTAssertFalse(name.contains("/"))
        XCTAssertFalse(name.contains(":"))
        XCTAssertTrue(name.hasSuffix(".pdf"))
    }

    func testAnUnnamedDocumentStillGetsAUsableName() {
        XCTAssertEqual(Exporter.suggestedFilename(subject: "", title: "", studentName: nil),
                       "Document.pdf")
    }
}

final class FinalReviewTests: XCTestCase {
    func testBlankAnswersAreReported() {
        let map = QuestionMap(questions: [
            MappedQuestion(id: QuestionID(rawValue: "q1"), number: "1", text: "", page: 0,
                           questionRegion: NormalisedRect(x: 0, y: 0, width: 1, height: 0.1),
                           hasWork: true),
            MappedQuestion(id: QuestionID(rawValue: "q2"), number: "2", text: "", page: 0,
                           questionRegion: NormalisedRect(x: 0, y: 0.2, width: 1, height: 0.1),
                           hasWork: false),
        ])
        let review = FinalReview.local(map: map, strokeSummaries: [
            AnswerDetection.StrokeSummary(
                bounds: NormalisedRect(x: 0, y: 0.05, width: 0.5, height: 0.05),
                strokeCount: 5, page: 0),
        ], pageCount: 1)

        XCTAssertTrue(review.findings.contains { $0.questionNumber == "2" })
        XCTAssertFalse(review.findings.contains { $0.questionNumber == "1" })
    }

    func testACleanAssignmentDoesNotClaimPerfection() {
        let map = QuestionMap(questions: [
            MappedQuestion(id: QuestionID(rawValue: "q1"), number: "1", text: "", page: 0,
                           questionRegion: NormalisedRect(x: 0, y: 0, width: 1, height: 0.1),
                           hasWork: true),
        ])
        let review = FinalReview.local(map: map, strokeSummaries: [
            AnswerDetection.StrokeSummary(
                bounds: NormalisedRect(x: 0, y: 0.05, width: 0.5, height: 0.05),
                strokeCount: 5, page: 0),
        ], pageCount: 1)

        XCTAssertTrue(review.isClear)
        // We checked some things and found nothing. That is a smaller claim than
        // "everything is perfect", and it is the true one.
        XCTAssertTrue(review.headline.contains("last look"))
    }

    func testTheSameFindingIsNotReportedTwice() {
        let first = FinalReview(findings: [
            .init(kind: .blankAnswer, page: 0, questionNumber: "1", detail: "a"),
        ])
        let second = FinalReview(findings: [
            .init(kind: .blankAnswer, page: 0, questionNumber: "1", detail: "worded differently"),
        ])
        XCTAssertEqual(first.merging(second).findings.count, 1)
    }

    func testCertainFindingsComeFirst() {
        let review = FinalReview(findings: [
            .init(kind: .strayMark, page: 3, detail: "maybe", certain: false),
            .init(kind: .blankAnswer, page: 5, detail: "definitely", certain: true),
        ])
        XCTAssertEqual(review.merging(FinalReview(findings: [])).findings.first?.detail, "definitely")
    }
}
