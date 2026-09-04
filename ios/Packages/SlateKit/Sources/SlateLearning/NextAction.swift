import Foundation
import SlateFoundation
import SlateModel

/// What is the single most useful thing this student could do right now?
///
/// Specification: `docs/LEARNING-MODEL.md` section 8. Everything is scored in expected
/// mastery gain per minute, so a five-minute targeted intervention can legitimately
/// beat thirty minutes of rereading — and rest is a real candidate, because a study
/// product that can never recommend stopping is optimising for the wrong thing.
public enum NextAction {

    public enum Kind: String, Sendable, CaseIterable {
        case fixWeakness, retrievalReview, transferProbe, finishAssignment, diagnostic, rest
    }

    public struct AssignmentSnapshot: Sendable, Hashable, Identifiable {
        public let id: AssignmentID
        public let title: String
        public let subject: String
        public let dueAt: Date?
        public let questionsTotal: Int
        public let questionsDone: Int
        public let conceptIDs: [ConceptID]

        public init(id: AssignmentID, title: String, subject: String, dueAt: Date?,
                    questionsTotal: Int, questionsDone: Int, conceptIDs: [ConceptID] = []) {
            self.id = id; self.title = title; self.subject = subject; self.dueAt = dueAt
            self.questionsTotal = questionsTotal; self.questionsDone = questionsDone
            self.conceptIDs = conceptIDs
        }

        public var remaining: Int { max(0, questionsTotal - questionsDone) }
    }

    public struct SessionContext: Sendable {
        public var now: Date
        public var availableMinutes: Double
        public var minutesWorkedContinuously: Double
        public var daysUntilExam: Double?
        /// Normalised entropy over open hypotheses, 0...1.
        public var modelUncertainty: Double

        public init(now: Date, availableMinutes: Double = 30,
                    minutesWorkedContinuously: Double = 0,
                    daysUntilExam: Double? = nil, modelUncertainty: Double = 0) {
            self.now = now; self.availableMinutes = availableMinutes
            self.minutesWorkedContinuously = minutesWorkedContinuously
            self.daysUntilExam = daysUntilExam; self.modelUncertainty = modelUncertainty
        }
    }

    public struct Recommendation: Sendable, Hashable, Identifiable {
        public let kind: Kind
        public let title: String
        /// Why this, in words the student can check against their own experience.
        public let reason: String
        public let minutes: Double
        public let value: Double
        public let score: Double
        public let conceptIDs: [ConceptID]
        public let assignmentID: AssignmentID?

        public var id: String { "\(kind.rawValue):\(title)" }

        public init(kind: Kind, title: String, reason: String, minutes: Double,
                    value: Double, score: Double, conceptIDs: [ConceptID],
                    assignmentID: AssignmentID?) {
            self.kind = kind; self.title = title; self.reason = reason
            self.minutes = minutes; self.value = value; self.score = score
            self.conceptIDs = conceptIDs; self.assignmentID = assignmentID
        }
    }

    // MARK: - Weights

    public static let wFix = 0.55
    public static let wReview = 0.40
    public static let wTransfer = 0.25
    public static let wAssignment = 2.20
    public static let wDiagnostic = 0.50
    public static let wRest = 0.60

    public static let fatigueOnsetMinutes = 25.0
    public static let fatigueSpanMinutes = 45.0
    public static let restMinutes = 5.0
    public static let deadlineHorizonHours = 72.0
    public static let minutesPerQuestion = 3.0
    public static let workBlockMinutes = 10.0
    public static let minAssignmentUrgency = 0.15

    // MARK: - Components

    public static func importance(_ c: Concept, fanout: Int, maxFanout: Int) -> Double {
        let fan = maxFanout > 0 ? Double(fanout) / Double(maxFanout) : 0
        let upcoming = Double(min(c.upcomingUses, 4)) / 4.0
        return c.examWeight * (1.0 + 0.25 * fan + 0.25 * upcoming)
    }

    /// Starts mattering two days out, not on the morning it is due.
    public static func deadlineUrgency(dueAt: Date?, now: Date) -> Double {
        guard let due = dueAt else { return minAssignmentUrgency }
        let hours = due.timeIntervalSince(now) / 3600
        if hours <= 0 { return 1.0 }
        let ramp = pow(Mastery.clamp(1.0 - hours / deadlineHorizonHours, 0, 1), 1.5)
        return max(minAssignmentUrgency, ramp)
    }

    public static func fatigue(minutesWorked: Double) -> Double {
        Mastery.clamp((minutesWorked - fatigueOnsetMinutes) / fatigueSpanMinutes, 0, 1)
    }

    private static func fanout(_ concepts: [Concept]) -> [ConceptID: Int] {
        var counts = Dictionary(uniqueKeysWithValues: concepts.map { ($0.conceptID, 0) })
        for c in concepts {
            for p in c.prerequisites where counts[p] != nil { counts[p]! += 1 }
        }
        return counts
    }

    // MARK: - Recommendation

    public static func recommend(states: [ConceptID: ConceptState],
                                 concepts: [Concept],
                                 assignments: [AssignmentSnapshot],
                                 context: SessionContext) -> [Recommendation] {
        let now = context.now
        let byID = Dictionary(uniqueKeysWithValues: concepts.map { ($0.conceptID, $0) })
        let fan = fanout(concepts)
        let maxFan = fan.values.max() ?? 0
        let reviewContext = Scheduling.ReviewContext(daysUntilExam: context.daysUntilExam)
        var out: [Recommendation] = []

        for (id, state) in states {
            guard let concept = byID[id] else { continue }
            let imp = importance(concept, fanout: fan[id] ?? 0, maxFanout: maxFan)
            let p = Mastery.predictedP(state)
            // Deliberately the *fresh* state. Something known but faded is a recall
            // problem, handled by the next candidate; scoring it as a knowledge gap
            // too would send the student back to relearn what they already understand.
            let fresh = Mastery.freshState(state)

            if fresh < .reliable && state.attempts > 0 {
                let minutes = 8.0
                let value = (1.0 - p) * wFix * imp
                out.append(.init(
                    kind: .fixWeakness,
                    title: "Fix: \(concept.name)",
                    reason: "You are at \(Int((p * 100).rounded()))% unaided on this.",
                    minutes: minutes, value: value, score: value / minutes,
                    conceptIDs: [id], assignmentID: nil
                ))
            }

            let risk = Scheduling.forgettingRisk(state, at: now)
            if risk > 0.05 {
                let minutes = 2.5
                let value = risk * wReview * imp
                let over = Scheduling.overdueDays(state, at: now, context: reviewContext)
                let when = over <= 0 ? "due now" : "\(Int(over)) days overdue"
                let recall = Int((Mastery.retrievability(of: state, at: now) * 100).rounded())
                out.append(.init(
                    kind: .retrievalReview,
                    title: "Recall: \(concept.name)",
                    reason: "Review \(when); recall is at \(recall)%.",
                    minutes: minutes, value: value, score: value / minutes,
                    conceptIDs: [id], assignmentID: nil
                ))
            }

            if fresh >= .reliable && state.transferCorrect == 0 {
                let minutes = 4.0
                let value = wTransfer * imp
                out.append(.init(
                    kind: .transferProbe,
                    title: "Try a different angle: \(concept.name)",
                    reason: "You can do the standard version. This checks you understand it.",
                    minutes: minutes, value: value, score: value / minutes,
                    conceptIDs: [id], assignmentID: nil
                ))
            }
        }

        for a in assignments where a.remaining > 0 {
            let urgency = deadlineUrgency(dueAt: a.dueAt, now: now)
            // Score the *next block* of work, not the whole assignment: dividing a
            // worksheet's value by a worksheet's minutes buries urgent work beneath
            // optional five-minute reviews.
            let minutes = min(Double(a.remaining) * minutesPerQuestion, workBlockMinutes,
                              max(1.0, context.availableMinutes))
            let value = urgency * wAssignment
            out.append(.init(
                kind: .finishAssignment,
                title: "Continue: \(a.title)",
                reason: "\(a.remaining) of \(a.questionsTotal) questions left.",
                minutes: minutes, value: value, score: value / minutes,
                conceptIDs: a.conceptIDs, assignmentID: a.id
            ))
        }

        if context.modelUncertainty > 0.35 {
            let minutes = 6.0
            let value = context.modelUncertainty * wDiagnostic
            out.append(.init(
                kind: .diagnostic,
                title: "Six quick questions",
                reason: "Your recent work does not say clearly where the problem is.",
                minutes: minutes, value: value, score: value / minutes,
                conceptIDs: [], assignmentID: nil
            ))
        }

        let f = fatigue(minutesWorked: context.minutesWorkedContinuously)
        if f > 0 {
            let value = f * f * wRest
            out.append(.init(
                kind: .rest,
                title: "Take five minutes",
                reason: "You have been working for \(Int(context.minutesWorkedContinuously)) minutes.",
                minutes: restMinutes, value: value, score: value / restMinutes,
                conceptIDs: [], assignmentID: nil
            ))
        }

        return out.sorted {
            if $0.score != $1.score { return $0.score > $1.score }
            if $0.minutes != $1.minutes { return $0.minutes < $1.minutes }
            if $0.kind.rawValue != $1.kind.rawValue { return $0.kind.rawValue < $1.kind.rawValue }
            return $0.title < $1.title
        }
    }

    /// Greedy pack by value density.
    ///
    /// It never pads to fill the time. If the highest-value work takes eleven minutes
    /// of a stated thirty, the plan is eleven minutes long — filling time is how
    /// revision apps waste afternoons.
    public static func planSession(_ recommendations: [Recommendation],
                                   availableMinutes: Double,
                                   maxItems: Int = 6) -> [Recommendation] {
        var chosen: [Recommendation] = []
        var used = 0.0
        var seenConcepts: Set<[String]> = []

        for r in recommendations {
            if chosen.count >= maxItems || used + r.minutes > availableMinutes { continue }
            if r.kind == .rest && chosen.isEmpty {
                chosen.append(r)
                used += r.minutes
                continue
            }
            let key = r.conceptIDs.map(\.rawValue).sorted()
            if !key.isEmpty && seenConcepts.contains(key) { continue }
            chosen.append(r)
            if !key.isEmpty { seenConcepts.insert(key) }
            used += r.minutes
        }
        return chosen
    }
}
