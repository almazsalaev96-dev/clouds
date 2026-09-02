import XCTest
import SlateFoundation
import SlateModel
@testable import SlateLearning

/// Cross-language parity.
///
/// `fixtures/learning-golden.json` is produced by the Python reference implementation
/// in `tools/learning-sim`. These tests load that exact file and assert this Swift
/// implementation reproduces every number to nine decimal places, at every step rather
/// than only at the end, so a divergence is located rather than merely detected.
///
/// If these fail after a model change, regenerate the fixture with
/// `python3 -m slatelearn.golden` and make both implementations agree.
final class GoldenParityTests: XCTestCase {

    private static let tolerance = 5e-9

    private var fixture: JSONValue!

    override func setUpWithError() throws {
        let url = Bundle.module.url(forResource: "learning-golden", withExtension: "json")
            ?? Bundle.module.url(forResource: "learning-golden", withExtension: "json",
                                 subdirectory: "Fixtures")
        guard let url else {
            throw XCTSkip("learning-golden.json is not bundled with the test target")
        }
        fixture = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }

    private func scenario(_ name: String) throws -> JSONValue {
        let found = fixture["scenarios"].array.first { $0["name"].string == name }
        return try XCTUnwrap(found, "the fixture has no scenario named \(name)")
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func date(_ value: JSONValue) throws -> Date {
        let text = try XCTUnwrap(value.string, "expected an ISO-8601 timestamp")
        return try XCTUnwrap(Self.iso.date(from: text), "could not parse \(text)")
    }

    private func attempt(_ json: JSONValue) throws -> Attempt {
        Attempt(
            conceptID: ConceptID(try XCTUnwrap(json["conceptId"].string)),
            at: try date(json["at"]),
            outcome: try XCTUnwrap(Outcome(rawValue: try XCTUnwrap(json["outcome"].string))),
            assistance: try XCTUnwrap(Assistance(rawValue: try XCTUnwrap(json["assistance"].string))),
            kind: try XCTUnwrap(AttemptKind(rawValue: try XCTUnwrap(json["kind"].string))),
            errorType: json["errorType"].string.flatMap(ErrorType.init(rawValue:)),
            sessionID: json["sessionId"].string.flatMap { $0.isEmpty ? nil : SessionID(rawValue: $0) },
            questionID: json["questionId"].string.flatMap { $0.isEmpty ? nil : QuestionID(rawValue: $0) }
        )
    }

    private func assertClose(_ actual: Double, _ expected: JSONValue,
                             _ label: String, file: StaticString = #filePath, line: UInt = #line) throws {
        let want = try XCTUnwrap(expected.double, "\(label): fixture value is not a number")
        XCTAssertEqual(actual, want, accuracy: Self.tolerance,
                       "\(label): Swift produced \(actual), the reference says \(want)",
                       file: file, line: line)
    }

    private func assertState(_ state: ConceptState, matches json: JSONValue,
                             _ label: String, file: StaticString = #filePath, line: UInt = #line) throws {
        try assertClose(state.alpha, json["alpha"], "\(label).alpha", file: file, line: line)
        try assertClose(state.beta, json["beta"], "\(label).beta", file: file, line: line)
        try assertClose(state.difficulty, json["difficulty"], "\(label).difficulty", file: file, line: line)
        try assertClose(state.stability, json["stability"], "\(label).stability", file: file, line: line)
        try assertClose(Mastery.predictedP(state), json["pUnaided"], "\(label).pUnaided", file: file, line: line)
        try assertClose(Mastery.evidenceStrength(state), json["evidence"], "\(label).evidence", file: file, line: line)
        XCTAssertEqual(state.attempts, json["attempts"].int, "\(label).attempts", file: file, line: line)
        XCTAssertEqual(state.independentCorrect, json["independentCorrect"].int,
                       "\(label).independentCorrect", file: file, line: line)
        XCTAssertEqual(state.transferCorrect, json["transferCorrect"].int,
                       "\(label).transferCorrect", file: file, line: line)
        XCTAssertEqual(state.retentionCorrect, json["retentionCorrect"].int,
                       "\(label).retentionCorrect", file: file, line: line)
        XCTAssertEqual(state.carelessSlips, json["carelessSlips"].int,
                       "\(label).carelessSlips", file: file, line: line)
        XCTAssertEqual(state.sessions.count, json["sessions"].int, "\(label).sessions", file: file, line: line)
        XCTAssertEqual(Mastery.freshState(state).rawValue, json["freshState"].string,
                       "\(label).freshState", file: file, line: line)
    }

    private func walk(_ steps: [JSONValue], _ label: String) throws {
        var state: ConceptState?
        for (index, step) in steps.enumerated() {
            let a = try attempt(step["attempt"])
            let current = state ?? ConceptState(conceptID: a.conceptID)
            let next = Mastery.apply(current, a)
            try assertState(next, matches: step["state"], "\(label)[\(index)]")
            state = next
        }
    }

    // MARK: - Constants

    func testConstantsMatchTheReference() throws {
        let c = fixture["constants"]
        try assertClose(Mastery.alpha0, c["alpha0"], "alpha0")
        try assertClose(Mastery.beta0, c["beta0"], "beta0")
        try assertClose(Mastery.evidenceHalfLife, c["evidenceHalfLifeDays"], "evidenceHalfLife")
        try assertClose(Mastery.stabA, c["stabA"], "stabA")
        try assertClose(Mastery.stabB, c["stabB"], "stabB")
        try assertClose(Mastery.stabC, c["stabC"], "stabC")
        try assertClose(Mastery.lapseK, c["lapseK"], "lapseK")
        try assertClose(Mastery.lapseD, c["lapseD"], "lapseD")
        try assertClose(Mastery.lapseS, c["lapseS"], "lapseS")
        try assertClose(Mastery.lapseR, c["lapseR"], "lapseR")
        try assertClose(Mastery.dStep, c["dStep"], "dStep")
        try assertClose(Mastery.dRevert, c["dRevert"], "dRevert")
        try assertClose(Mastery.pReliable, c["pReliable"], "pReliable")
        try assertClose(Mastery.pMastered, c["pMastered"], "pMastered")
        try assertClose(Mastery.rCapReliable, c["rCapReliable"], "rCapReliable")
        try assertClose(Scheduling.rDefault, c["rDefault"], "rDefault")
        try assertClose(Scheduling.rExamImminent, c["rExamImminent"], "rExamImminent")
        try assertClose(NextAction.wAssignment, c["wAssignment"], "wAssignment")
        try assertClose(NextAction.wRest, c["wRest"], "wRest")
        try assertClose(NextAction.deadlineHorizonHours, c["deadlineHorizonHours"], "deadlineHorizonHours")
    }

    // MARK: - Mastery

    func testMasteryLadder() throws {
        try walk(try scenario("masteryLadder")["steps"].array, "masteryLadder")
    }

    func testSolutionDependencyProducesNoAbility() throws {
        try walk(try scenario("solutionDependency")["steps"].array, "solutionDependency")
    }

    func testAssistanceLadder() throws {
        let s = try scenario("assistanceLadder")
        try walk(s["steps"].array, "assistanceLadder")

        var state: ConceptState?
        for step in s["steps"].array {
            let a = try attempt(step["attempt"])
            state = Mastery.apply(state ?? ConceptState(conceptID: a.conceptID), a)
        }
        let independence = try XCTUnwrap(Mastery.independence(try XCTUnwrap(state)))
        try assertClose(independence, s["independence"], "assistanceLadder.independence")
    }

    func testCarelessSlipCostsLessThanAKnowledgeGap() throws {
        let s = try scenario("carelessVsGap")
        try walk(s["careless"].array, "carelessVsGap.careless")
        try walk(s["knowledgeGap"].array, "carelessVsGap.knowledgeGap")
    }

    func testUnreadableWorkIsNotEvidence() throws {
        try walk(try scenario("unreadableIsNotEvidence")["steps"].array, "unreadable")
    }

    func testLapseAndRecovery() throws {
        try walk(try scenario("lapseAndRecovery")["steps"].array, "lapseAndRecovery")
    }

    // MARK: - Memory

    func testForgettingCurveAndExpiry() throws {
        let s = try scenario("forgetting")
        let finalJSON = s["finalState"]

        // The scenario stores the end state and the curve after it, so rebuild the
        // state directly rather than replaying attempts a second time — this test is
        // about forgetting, and the fold is covered by the ladder tests above.
        var state = ConceptState(conceptID: ConceptID("forget"))
        state.alpha = try XCTUnwrap(finalJSON["alpha"].double)
        state.beta = try XCTUnwrap(finalJSON["beta"].double)
        state.difficulty = try XCTUnwrap(finalJSON["difficulty"].double)
        state.stability = try XCTUnwrap(finalJSON["stability"].double)
        state.lastReviewed = try date(finalJSON["lastReviewed"])
        state.attempts = try XCTUnwrap(finalJSON["attempts"].int)
        state.independentCorrect = try XCTUnwrap(finalJSON["independentCorrect"].int)
        state.transferCorrect = try XCTUnwrap(finalJSON["transferCorrect"].int)
        state.retentionCorrect = try XCTUnwrap(finalJSON["retentionCorrect"].int)
        state.sessions = Set((0..<(try XCTUnwrap(finalJSON["sessions"].int))).map(String.init))

        XCTAssertEqual(Mastery.freshState(state).rawValue, finalJSON["freshState"].string,
                       "the rebuilt state should read as mastered when fresh")

        let anchor = try XCTUnwrap(state.lastReviewed)
        for point in s["curve"].array {
            let days = try XCTUnwrap(point["days"].double)
            let when = anchor.addingTimeInterval(days * 86_400)
            try assertClose(Mastery.retrievability(of: state, at: when),
                            point["retrievability"], "forgetting.retrievability[\(days)d]")
            XCTAssertEqual(Mastery.effectiveState(state, at: when).rawValue,
                           point["effectiveState"].string,
                           "forgetting.effectiveState after \(days) days")
        }
    }

    // MARK: - Scheduling

    func testSchedulingIntervals() throws {
        let s = try scenario("scheduling")
        for row in s["intervals"].array {
            let stability = try XCTUnwrap(row["stability"].double)
            let label = try XCTUnwrap(row["context"].string)
            let context: Scheduling.ReviewContext = switch label {
            case "default": .init()
            case "examIn10": .init(daysUntilExam: 10)
            case "examIn3": .init(daysUntilExam: 3)
            case "prerequisite": .init(isPrerequisiteOfDueWork: true)
            case "lowPriority": .init(lowPriority: true)
            default: .init()
            }
            try assertClose(Scheduling.targetRetention(context),
                            row["targetRetention"], "target(\(label))")
            try assertClose(Scheduling.intervalDays(stability: stability, context: context),
                            row["intervalDays"], "interval(\(stability), \(label))")
        }
        for row in s["retrievability"].array {
            let stability = try XCTUnwrap(row["stability"].double)
            let days = try XCTUnwrap(row["days"].double)
            try assertClose(Mastery.retrievability(stability: stability, elapsedDays: days),
                            row["retrievability"], "R(\(stability), \(days))")
        }
    }

    // MARK: - Misconceptions

    func testMisconceptionPatterns() throws {
        let s = try scenario("misconceptionPatterns")
        let now = try date(s["now"])
        let attempts = try s["attempts"].array.map(attempt)
        let found = Misconceptions.detect(in: attempts, now: now)
        let expected = s["patterns"].array

        XCTAssertEqual(found.count, expected.count, "different number of patterns")
        for (i, pattern) in found.enumerated() {
            let want = expected[i]
            XCTAssertEqual(pattern.errorType.rawValue, want["errorType"].string, "pattern[\(i)].errorType")
            XCTAssertEqual(pattern.occurrences, want["occurrences"].int, "pattern[\(i)].occurrences")
            XCTAssertEqual(pattern.distinctConcepts, want["distinctConcepts"].int,
                           "pattern[\(i)].distinctConcepts")
            XCTAssertEqual(pattern.distinctQuestions, want["distinctQuestions"].int,
                           "pattern[\(i)].distinctQuestions")
            try assertClose(pattern.strength, want["strength"], "pattern[\(i)].strength")
        }
        XCTAssertEqual(found.map(\.headline), s["headlines"].array.compactMap(\.string))
    }

    // MARK: - Information gain

    func testExpectedInformationGain() throws {
        let s = try scenario("expectedInformationGain")
        let hypotheses = ["formula", "sign", "rearrange", "none"].map {
            InformationGain.Hypothesis(id: $0, label: $0, prior: 1.0)
        }
        let candidates = try Self.eigCandidates()
        let prior = InformationGain.priorMap(hypotheses)

        try assertClose(InformationGain.entropy(Array(prior.values)),
                        s["priorEntropyBits"], "priorEntropy")

        let ranked = InformationGain.rank(prior: prior, candidates: candidates)
        let expected = s["ranked"].array
        XCTAssertEqual(ranked.map(\.question.id), expected.compactMap { $0["questionId"].string },
                       "questions ranked in a different order")
        for (i, entry) in ranked.enumerated() {
            try assertClose(
                InformationGain.expectedInformationGain(prior: prior, question: entry.question),
                expected[i]["eig"], "ranked[\(i)].eig")
            try assertClose(entry.score, expected[i]["eigPerMinute"], "ranked[\(i)].eigPerMinute")
        }

        let run = InformationGain.runAdaptive(hypotheses: hypotheses, candidates: candidates) { q in
            q.responses.contains("signError") ? "signError"
                : (q.responses.contains("other") ? "other" : "correct")
        }
        let wanted = s["adaptiveRun"]
        XCTAssertEqual(run.asked, wanted["asked"].array.compactMap(\.string), "questions asked")
        XCTAssertEqual(run.leading.id, wanted["leading"].string, "leading hypothesis")
        try assertClose(run.leading.probability, wanted["leadingProbability"], "leadingProbability")
        try assertClose(run.remainingUncertainty, wanted["remainingBits"], "remainingBits")
        for (id, value) in wanted["posterior"].object {
            try assertClose(run.prior[id] ?? 0, value, "posterior[\(id)]")
        }
    }

    /// Mirrors `sc_eig` in the Python reference exactly.
    private static func eigCandidates() throws -> [InformationGain.CandidateQuestion] {
        [
            .init(id: "splitFormula", prompt: "Which formula applies here?", likelihoods: [
                "formula": ["correct": 0.10, "wrongFormula": 0.80, "signError": 0.05, "other": 0.05],
                "sign": ["correct": 0.30, "wrongFormula": 0.05, "signError": 0.60, "other": 0.05],
                "rearrange": ["correct": 0.15, "wrongFormula": 0.10, "signError": 0.15, "other": 0.60],
                "none": ["correct": 0.90, "wrongFormula": 0.03, "signError": 0.04, "other": 0.03],
            ], estimatedMinutes: 1.5, conceptID: "cts"),
            .init(id: "uninformative", prompt: "Restate the question", likelihoods: [
                "formula": ["correct": 0.5, "other": 0.5],
                "sign": ["correct": 0.5, "other": 0.5],
                "rearrange": ["correct": 0.5, "other": 0.5],
                "none": ["correct": 0.5, "other": 0.5],
            ], estimatedMinutes: 1.5, conceptID: "cts"),
            .init(id: "slowButSharp", prompt: "Full worked solution, 6 minutes", likelihoods: [
                "formula": ["correct": 0.05, "other": 0.95],
                "sign": ["correct": 0.95, "other": 0.05],
                "rearrange": ["correct": 0.50, "other": 0.50],
                "none": ["correct": 0.98, "other": 0.02],
            ], estimatedMinutes: 6.0, conceptID: "cts"),
            .init(id: "signProbe", prompt: "Expand -(x - 3)^2", likelihoods: [
                "formula": ["correct": 0.85, "signError": 0.10, "other": 0.05],
                "sign": ["correct": 0.15, "signError": 0.80, "other": 0.05],
                "rearrange": ["correct": 0.60, "signError": 0.20, "other": 0.20],
                "none": ["correct": 0.95, "signError": 0.03, "other": 0.02],
            ], estimatedMinutes: 1.0, conceptID: "signs"),
        ]
    }

    // MARK: - Projection and recommendation

    private func demoConcepts() -> [Concept] {
        [
            Concept(conceptID: ConceptID("cts"), name: "Completing the square",
                    subject: "Mathematics", prerequisites: [ConceptID("fact")],
                    examWeight: 1.3, upcomingUses: 2),
            Concept(conceptID: ConceptID("fact"), name: "Factorising", subject: "Mathematics"),
            Concept(conceptID: ConceptID("graphs"), name: "Quadratic graphs",
                    subject: "Mathematics", prerequisites: [ConceptID("cts")],
                    examWeight: 1.1, upcomingUses: 1),
        ]
    }

    func testProjectionMatchesTheReference() throws {
        let source = try scenario("nextBestAction")
        let now = try date(source["now"])
        let attempts = try source["attempts"].array.map(attempt)

        let projection = LearningEngine.project(
            attempts: attempts, concepts: demoConcepts(),
            assignments: [.init(id: AssignmentID(rawValue: "a1"), title: "Physics worksheet",
                                subject: "Physics", dueAt: now.addingTimeInterval(20 * 3600),
                                questionsTotal: 18, questionsDone: 12,
                                conceptIDs: [ConceptID("graphs")])],
            context: .init(now: now, availableMinutes: 30)
        )

        let expected = try scenario("projection")
        XCTAssertEqual(projection.weakest.map(\.conceptID.rawValue),
                       expected["weakestFirst"].array.compactMap(\.string),
                       "weakest concepts in a different order")

        for want in expected["concepts"].array {
            let id = try XCTUnwrap(want["conceptId"].string)
            let view = try XCTUnwrap(projection.concept(ConceptID(id)), "no view for \(id)")
            XCTAssertEqual(view.state.rawValue, want["state"].string, "\(id).state")
            XCTAssertEqual(view.freshState.rawValue, want["freshState"].string, "\(id).freshState")
            try assertClose(view.pUnaided, want["pUnaided"], "\(id).pUnaided")
            try assertClose(view.retrievability, want["retrievability"], "\(id).retrievability")
            try assertClose(view.stabilityDays, want["stabilityDays"], "\(id).stabilityDays")
            try assertClose(view.overdueDays, want["overdueDays"], "\(id).overdueDays")
        }
    }

    func testNextBestActionMatchesTheReference() throws {
        let s = try scenario("nextBestAction")
        let now = try date(s["now"])
        let attempts = try s["attempts"].array.map(attempt)
        let states = LearningEngine.fold(attempts)

        for testCase in s["cases"].array {
            let label = try XCTUnwrap(testCase["case"].string)
            let (dueHours, worked, available, uncertainty): (Double, Double, Double, Double) =
                switch label {
                case "dueTomorrow": (20, 0, 30, 0)
                case "dueInFiveDays": (120, 0, 30, 0)
                case "tired": (20, 70, 30, 0)
                case "uncertainModel": (120, 0, 30, 0.9)
                case "tenMinutesOnly": (120, 0, 10, 0)
                default: (20, 0, 30, 0)
                }

            let assignment = NextAction.AssignmentSnapshot(
                id: AssignmentID(rawValue: "a1"), title: "Physics worksheet", subject: "Physics",
                dueAt: now.addingTimeInterval(dueHours * 3600),
                questionsTotal: 18, questionsDone: 12, conceptIDs: [ConceptID("graphs")]
            )
            let recommendations = NextAction.recommend(
                states: states, concepts: demoConcepts(), assignments: [assignment],
                context: .init(now: now, availableMinutes: available,
                               minutesWorkedContinuously: worked, modelUncertainty: uncertainty)
            )

            let expected = testCase["recommendations"].array
            XCTAssertEqual(recommendations.count, expected.count, "\(label): different number of actions")
            for (i, rec) in recommendations.enumerated() where i < expected.count {
                XCTAssertEqual(rec.kind.rawValue, expected[i]["kind"].string, "\(label)[\(i)].kind")
                XCTAssertEqual(rec.title, expected[i]["title"].string, "\(label)[\(i)].title")
                try assertClose(rec.minutes, expected[i]["minutes"], "\(label)[\(i)].minutes")
                try assertClose(rec.score, expected[i]["score"], "\(label)[\(i)].score")
            }

            let plan = NextAction.planSession(recommendations, availableMinutes: available)
            XCTAssertEqual(plan.map(\.title), testCase["plan"].array.compactMap { $0["title"].string },
                           "\(label): different plan")
            try assertClose(plan.reduce(0) { $0 + $1.minutes }, testCase["planMinutes"],
                            "\(label).planMinutes")
        }
    }

    // MARK: - Test report

    func testReportMatchesTheReference() throws {
        let want = try scenario("testReport")["report"]
        let names: [ConceptID: String] = [
            ConceptID("cts"): "Completing the square",
            ConceptID("fact"): "Factorising",
            ConceptID("graphs"): "Quadratic graphs",
        ]
        let results: [TestReport.QuestionResult] = [
            .init(id: QuestionID(rawValue: "q1"), conceptID: ConceptID("fact"), outcome: .correct,
                  marksAvailable: 3, marksAwarded: 3, seconds: 45, confidence: 0.9),
            .init(id: QuestionID(rawValue: "q2"), conceptID: ConceptID("cts"), outcome: .incorrect,
                  marksAvailable: 4, marksAwarded: 1, seconds: 210,
                  errorType: .misconception, confidence: 0.85),
            .init(id: QuestionID(rawValue: "q3"), conceptID: ConceptID("cts"), outcome: .incorrect,
                  marksAvailable: 4, marksAwarded: 0, seconds: 180,
                  errorType: .calculation, confidence: 0.80),
            .init(id: QuestionID(rawValue: "q4"), conceptID: ConceptID("graphs"), outcome: .correct,
                  marksAvailable: 3, marksAwarded: 3, seconds: 60, confidence: 0.50),
            .init(id: QuestionID(rawValue: "q5"), conceptID: ConceptID("graphs"), outcome: .partial,
                  marksAvailable: 2, marksAwarded: 1, seconds: 95,
                  errorType: .reasoningGap, confidence: 0.60),
        ]
        let report = TestReport.build(results: results, conceptNames: names)

        XCTAssertEqual(report.marksAwarded, want["marksAwarded"].int)
        XCTAssertEqual(report.marksAvailable, want["marksAvailable"].int)
        try assertClose(report.percentage, want["percentage"], "percentage")
        XCTAssertEqual(report.weaknesses.map(\.rawValue), want["weaknesses"].array.compactMap(\.string))
        XCTAssertEqual(report.strengths.map(\.rawValue), want["strengths"].array.compactMap(\.string))
        XCTAssertEqual(report.slowest.map(\.rawValue), want["slowest"].array.compactMap(\.string))

        let calibration = try XCTUnwrap(report.calibration)
        try assertClose(calibration.gap, want["calibration"]["gap"], "calibration.gap")
        XCTAssertEqual(calibration.verdict.rawValue, want["calibration"]["verdict"].string)
        XCTAssertEqual(calibration.confidentlyWrong.map(\.rawValue),
                       want["calibration"]["confidentlyWrong"].array.compactMap(\.string))
    }
}
