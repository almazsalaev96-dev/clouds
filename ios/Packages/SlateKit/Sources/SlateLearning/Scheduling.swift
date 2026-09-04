import Foundation
import SlateFoundation
import SlateModel

/// When to come back to something.
///
/// Specification: `docs/LEARNING-MODEL.md` section 5. Exam proximity shortens intervals
/// as a consequence of one formula rather than as a pile of special cases.
public enum Scheduling {
    public static let rDefault = 0.90
    public static let rExamNear = 0.93
    public static let rExamImminent = 0.95
    public static let rPrerequisite = 0.93
    public static let rLowPriority = 0.85

    public static let examNearDays = 14.0
    public static let examImminentDays = 5.0

    public static let minIntervalDays = 0.02
    public static let maxIntervalDays = 365.0

    public struct ReviewContext: Sendable, Hashable {
        public var daysUntilExam: Double?
        public var isPrerequisiteOfDueWork: Bool
        public var lowPriority: Bool

        public init(daysUntilExam: Double? = nil,
                    isPrerequisiteOfDueWork: Bool = false,
                    lowPriority: Bool = false) {
            self.daysUntilExam = daysUntilExam
            self.isPrerequisiteOfDueWork = isPrerequisiteOfDueWork
            self.lowPriority = lowPriority
        }
    }

    public static func targetRetention(_ ctx: ReviewContext) -> Double {
        if ctx.lowPriority { return rLowPriority }
        var t = rDefault
        if let days = ctx.daysUntilExam {
            if days <= examImminentDays { t = max(t, rExamImminent) }
            else if days <= examNearDays { t = max(t, rExamNear) }
        }
        if ctx.isPrerequisiteOfDueWork { t = max(t, rPrerequisite) }
        return t
    }

    /// Days from the last review until retrievability decays to the target.
    public static func intervalDays(stability: Double,
                                    context: ReviewContext = .init()) -> Double {
        guard stability > 0 else { return minIntervalDays }
        let r = targetRetention(context)
        return Mastery.clamp(9.0 * stability * (1.0 / r - 1.0), minIntervalDays, maxIntervalDays)
    }

    public static func dueAt(_ state: ConceptState,
                             context: ReviewContext = .init()) -> Date? {
        guard let last = state.lastReviewed else { return nil }
        return last.addingTimeInterval(intervalDays(stability: state.stability, context: context) * 86_400)
    }

    public static func isDue(_ state: ConceptState, at now: Date,
                             context: ReviewContext = .init()) -> Bool {
        guard let due = dueAt(state, context: context) else { return false }
        return now >= due
    }

    public static func overdueDays(_ state: ConceptState, at now: Date,
                                   context: ReviewContext = .init()) -> Double {
        guard let due = dueAt(state, context: context) else { return 0 }
        return max(0, now.days(since: due))
    }

    /// How much is at risk of being lost — but only for material that was actually
    /// learned. A concept never understood is a gap, not a forgetting risk, and
    /// conflating the two sends students to revise things they have never seen.
    public static func forgettingRisk(_ state: ConceptState, at now: Date) -> Double {
        guard state.lastReviewed != nil else { return 0 }
        let p = Mastery.predictedP(state)
        guard p >= Mastery.pPracticing else { return 0 }
        return (1.0 - Mastery.retrievability(of: state, at: now)) * p
    }
}
