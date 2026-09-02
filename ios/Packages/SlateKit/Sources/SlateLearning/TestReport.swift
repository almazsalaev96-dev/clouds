import Foundation
import SlateFoundation
import SlateModel

/// A score alone changes nothing.
///
/// Every completed test produces this, and it answers the five questions a student
/// actually has: how did I do, what did I get wrong, why, what should I study, and what
/// do I do next. A results screen that answers fewer than five is not finished.
public struct TestReport: Sendable {
    public let marksAwarded: Int
    public let marksAvailable: Int
    public let seconds: Double
    public let byConcept: [ConceptBreakdown]
    public let errorCounts: [ErrorType: Int]
    public let calibration: Calibration?
    public let slowest: [QuestionID]
    public let strengths: [ConceptID]
    public let weaknesses: [ConceptID]
    public let nextStep: NextAction.Recommendation?

    public var percentage: Double {
        marksAvailable == 0 ? 0 : 100 * Double(marksAwarded) / Double(marksAvailable)
    }

    public struct QuestionResult: Sendable, Hashable, Identifiable {
        public let id: QuestionID
        public let conceptID: ConceptID
        public let outcome: Outcome
        public let marksAvailable: Int
        public let marksAwarded: Int
        public let seconds: Double
        public let errorType: ErrorType?
        public let confidence: Double?

        public init(id: QuestionID, conceptID: ConceptID, outcome: Outcome,
                    marksAvailable: Int, marksAwarded: Int, seconds: Double = 0,
                    errorType: ErrorType? = nil, confidence: Double? = nil) {
            self.id = id; self.conceptID = conceptID; self.outcome = outcome
            self.marksAvailable = marksAvailable; self.marksAwarded = marksAwarded
            self.seconds = seconds; self.errorType = errorType; self.confidence = confidence
        }
    }

    public struct ConceptBreakdown: Sendable, Hashable, Identifiable {
        public let conceptID: ConceptID
        public let name: String
        public let marksAwarded: Int
        public let marksAvailable: Int
        public let questions: Int
        public let seconds: Double
        public var id: ConceptID { conceptID }
        public var percentage: Double {
            marksAvailable == 0 ? 0 : 100 * Double(marksAwarded) / Double(marksAvailable)
        }
    }

    /// Confidence against performance.
    ///
    /// Where a student is sure and wrong, the problem is usually a misconception rather
    /// than a gap, and that changes what the intervention should be. The individual
    /// confidently-wrong questions matter more than the average, so they are listed.
    public struct Calibration: Sendable, Hashable {
        public let meanConfidence: Double
        public let meanScore: Double
        public let gap: Double
        public let verdict: Verdict
        public let confidentlyWrong: [QuestionID]

        public enum Verdict: String, Sendable {
            case overconfident, underconfident, wellCalibrated
        }
    }

    public static let calibrationGap = 0.25

    public static func build(results: [QuestionResult],
                             projection: Projection? = nil,
                             conceptNames: [ConceptID: String] = [:]) -> TestReport {
        let awarded = results.reduce(0) { $0 + $1.marksAwarded }
        let available = results.reduce(0) { $0 + $1.marksAvailable }
        let seconds = results.reduce(0.0) { $0 + $1.seconds }

        var grouped: [ConceptID: [QuestionResult]] = [:]
        for r in results { grouped[r.conceptID, default: []].append(r) }

        let byConcept = grouped
            .map { id, rs in
                ConceptBreakdown(
                    conceptID: id,
                    name: conceptNames[id] ?? id.rawValue,
                    marksAwarded: rs.reduce(0) { $0 + $1.marksAwarded },
                    marksAvailable: rs.reduce(0) { $0 + $1.marksAvailable },
                    questions: rs.count,
                    seconds: rs.reduce(0.0) { $0 + $1.seconds }
                )
            }
            .sorted {
                $0.percentage == $1.percentage
                    ? $0.conceptID.rawValue < $1.conceptID.rawValue
                    : $0.percentage < $1.percentage
            }

        var errorCounts: [ErrorType: Int] = [:]
        for r in results where r.outcome != .correct {
            if let e = r.errorType { errorCounts[e, default: 0] += 1 }
        }

        let scored = results.filter { $0.confidence != nil }
        var calibration: Calibration?
        if !scored.isEmpty {
            let meanConfidence = scored.reduce(0.0) { $0 + ($1.confidence ?? 0) } / Double(scored.count)
            let meanScore = scored.reduce(0.0) {
                $0 + Double($1.marksAwarded) / Double(max(1, $1.marksAvailable))
            } / Double(scored.count)
            let gap = meanConfidence - meanScore
            calibration = Calibration(
                meanConfidence: meanConfidence,
                meanScore: meanScore,
                gap: gap,
                verdict: gap > calibrationGap ? .overconfident
                    : (-gap > calibrationGap ? .underconfident : .wellCalibrated),
                confidentlyWrong: scored
                    .filter { ($0.confidence ?? 0) >= 0.7 && $0.marksAwarded < $0.marksAvailable }
                    .map(\.id)
                    .sorted { $0.rawValue < $1.rawValue }
            )
        }

        return TestReport(
            marksAwarded: awarded,
            marksAvailable: available,
            seconds: seconds,
            byConcept: byConcept,
            errorCounts: errorCounts,
            calibration: calibration,
            slowest: results.sorted { $0.seconds > $1.seconds }.prefix(3)
                .filter { $0.seconds > 0 }.map(\.id),
            strengths: byConcept.reversed().filter { $0.percentage >= 80 }.map(\.conceptID),
            weaknesses: byConcept.filter { $0.percentage < 60 }.map(\.conceptID),
            nextStep: projection?.recommendations.first
        )
    }

    /// One sentence explaining the score, not the score itself. The number is already
    /// on the screen; this is the part the student cannot work out alone.
    public var headline: String {
        if let calibration, !calibration.confidentlyWrong.isEmpty {
            return "You were sure about \(calibration.confidentlyWrong.count) "
                + "\(calibration.confidentlyWrong.count == 1 ? "answer" : "answers") that did not work out. "
                + "That usually means a misunderstanding rather than a gap."
        }
        if let weakest = byConcept.first, weakest.percentage < 60 {
            return "Most of the lost marks were in \(weakest.name)."
        }
        if weaknesses.isEmpty && marksAvailable > 0 {
            return "No topic stands out as a weakness here."
        }
        return "Marks were spread across several topics rather than concentrated in one."
    }
}
