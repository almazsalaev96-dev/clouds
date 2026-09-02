import Foundation
import SlateFoundation
import SlateModel

/// The projection: evidence log in, understanding out.
///
/// `project` is a pure function of the attempt log and the clock. Nothing in the
/// product stores a conclusion; every conclusion is recomputed here. That is what makes
/// "why am I being shown this?" answerable, and what makes deleting your data actually
/// delete the beliefs derived from it.
public struct Projection: Sendable {
    public let at: Date
    public let concepts: [ConceptView]
    public let patterns: [Misconceptions.Pattern]
    public let recommendations: [NextAction.Recommendation]
    public let plan: [NextAction.Recommendation]
    public let states: [ConceptID: ConceptState]

    public struct ConceptView: Sendable, Hashable, Identifiable {
        public let conceptID: ConceptID
        public let name: String
        public let state: MasteryState
        public let freshState: MasteryState
        public let pUnaided: Double
        public let retrievability: Double
        public let stabilityDays: Double
        public let difficulty: Double
        public let attempts: Int
        public let independentCorrect: Int
        public let evidence: Double
        public let independence: Double?
        public let dueAt: Date?
        public let overdueDays: Double

        public var id: ConceptID { conceptID }
        public var needsReview: Bool { state < freshState }
    }

    public func concept(_ id: ConceptID) -> ConceptView? {
        concepts.first { $0.conceptID == id }
    }

    public var weakest: [ConceptView] {
        concepts.filter { $0.attempts > 0 }
            .sorted {
                $0.pUnaided == $1.pUnaided
                    ? $0.conceptID.rawValue < $1.conceptID.rawValue
                    : $0.pUnaided < $1.pUnaided
            }
    }

    public var dueNow: [ConceptView] { concepts.filter { $0.overdueDays > 0 } }

    /// The one thing to show at the top of the desk. Nothing else on the screen has to
    /// compete with it.
    public var nextBestAction: NextAction.Recommendation? { recommendations.first }
}

public enum LearningEngine {

    /// Replay the log. Order matters, so it is enforced here rather than assumed of
    /// whoever happens to be calling.
    public static func fold(_ attempts: [Attempt]) -> [ConceptID: ConceptState] {
        var states: [ConceptID: ConceptState] = [:]
        let ordered = attempts.sorted {
            if $0.at != $1.at { return $0.at < $1.at }
            if $0.conceptID.rawValue != $1.conceptID.rawValue {
                return $0.conceptID.rawValue < $1.conceptID.rawValue
            }
            return ($0.questionID?.rawValue ?? "") < ($1.questionID?.rawValue ?? "")
        }
        for a in ordered {
            let existing = states[a.conceptID] ?? ConceptState(conceptID: a.conceptID)
            states[a.conceptID] = Mastery.apply(existing, a)
        }
        return states
    }

    public static func project(attempts: [Attempt],
                               concepts: [Concept],
                               assignments: [NextAction.AssignmentSnapshot] = [],
                               context: NextAction.SessionContext) -> Projection {
        let now = context.now
        let states = fold(attempts)
        let byID = Dictionary(uniqueKeysWithValues: concepts.map { ($0.conceptID, $0) })
        let reviewContext = Scheduling.ReviewContext(daysUntilExam: context.daysUntilExam)

        let views: [Projection.ConceptView] = states
            .sorted { $0.key.rawValue < $1.key.rawValue }
            .map { id, state in
                Projection.ConceptView(
                    conceptID: id,
                    name: byID[id]?.name ?? id.rawValue,
                    state: Mastery.effectiveState(state, at: now),
                    freshState: Mastery.freshState(state),
                    pUnaided: Mastery.predictedP(state),
                    retrievability: Mastery.retrievability(of: state, at: now),
                    stabilityDays: state.stability,
                    difficulty: state.difficulty,
                    attempts: state.attempts,
                    independentCorrect: state.independentCorrect,
                    evidence: Mastery.evidenceStrength(state),
                    independence: Mastery.independence(state),
                    dueAt: Scheduling.dueAt(state, context: reviewContext),
                    overdueDays: Scheduling.overdueDays(state, at: now, context: reviewContext)
                )
            }

        let recommendations = NextAction.recommend(
            states: states, concepts: concepts, assignments: assignments, context: context
        )
        return Projection(
            at: now,
            concepts: views,
            patterns: Misconceptions.detect(in: attempts, now: now),
            recommendations: recommendations,
            plan: NextAction.planSession(recommendations, availableMinutes: context.availableMinutes),
            states: states
        )
    }
}
