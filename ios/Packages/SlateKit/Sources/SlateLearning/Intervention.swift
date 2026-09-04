import Foundation
import SlateFoundation
import SlateModel

/// Turning a weakness into the shortest sequence that actually fixes it.
///
/// "Fix this" is the product's most-used promise, so what sits behind it is a plan
/// derived from the evidence rather than a fixed lesson template. Three rules shape it:
///
/// 1. Teach only what is not known. Re-explaining something merely forgotten wastes the
///    minutes a student was willing to give.
/// 2. Never repeat a teaching approach that already failed. A second explanation in
///    different words is not a second attempt.
/// 3. Always verify with a question they have not seen, and schedule the return visit.
///    An intervention that ends at "does that make sense?" has measured nothing.
public enum Intervention {

    public enum StepKind: String, Sendable, CaseIterable {
        case diagnose, teach, example, guided, practise, verify, transfer, prerequisite

        /// Written for a student watching a short plan appear on screen.
        public var label: String {
            switch self {
            case .diagnose: "Find out what is going wrong"
            case .prerequisite: "Go back one step"
            case .teach: "The idea"
            case .example: "A worked example"
            case .guided: "One together"
            case .practise: "One on your own"
            case .verify: "Check it stuck"
            case .transfer: "The same idea, different question"
            }
        }
    }

    public enum Strategy: String, Sendable, CaseIterable {
        case explanation, workedExample, guidedQuestion, analogy
        case visual, prerequisite, counterexample, retrievalPrompt

        var teaching: TeachingStrategy {
            switch self {
            case .explanation: .explanation
            case .workedExample: .workedExample
            case .guidedQuestion: .guidedQuestion
            case .analogy: .analogy
            case .visual: .visual
            case .prerequisite: .prerequisite
            case .counterexample: .counterexample
            case .retrievalPrompt: .retrievalPrompt
            }
        }
    }

    /// Deliberately moves from telling towards asking: a student who did not follow an
    /// explanation is more likely to be reached by a worked example than by the same
    /// explanation lengthened.
    public static let strategyOrder: [Strategy] = [
        .explanation, .workedExample, .guidedQuestion, .analogy,
        .visual, .prerequisite, .counterexample, .retrievalPrompt,
    ]

    public static let stepMinutes: [StepKind: Double] = [
        .diagnose: 2.0, .prerequisite: 3.0, .teach: 1.5, .example: 1.5,
        .guided: 2.0, .practise: 2.5, .verify: 2.0, .transfer: 2.5,
    ]

    /// Steps whose removal costs least, dropped first when time is short.
    ///
    /// `verify` is absent on purpose: an intervention that skips it has not been
    /// shortened, it has been abandoned.
    public static let dropOrder: [StepKind] = [
        .transfer, .example, .diagnose, .guided, .prerequisite, .practise,
    ]

    public static let minimumMinutes = 3.0

    public struct Step: Sendable, Hashable, Identifiable {
        public let kind: StepKind
        public let strategy: Strategy?
        public let difficulty: String
        public let assistance: Assistance
        public let minutes: Double
        public let detail: String

        public var id: String { "\(kind.rawValue):\(strategy?.rawValue ?? "")" }
    }

    public struct Plan: Sendable, Hashable {
        public let conceptID: ConceptID
        public var steps: [Step]
        /// Why this plan, in a sentence the student can check against their experience.
        public var rationale: String
        public var followUpDays: Double
        public var dropped: [StepKind]

        public var minutes: Double { steps.reduce(0) { $0 + $1.minutes } }
    }

    /// The next approach that has not already failed.
    public static func nextStrategy(after used: [Strategy]) -> Strategy {
        // Everything has been tried: go back to the prerequisite rather than round
        // again. If six approaches have failed, the problem is upstream of this concept.
        strategyOrder.first { !used.contains($0) } ?? .prerequisite
    }

    /// The shortest sequence that stands a chance of fixing this concept.
    public static func build(state: ConceptState,
                             at now: Date,
                             availableMinutes: Double = 12,
                             strategiesUsed: [Strategy] = [],
                             knownError: String? = nil,
                             hasWeakPrerequisite: Bool = false,
                             uncertain: Bool = false) -> Plan {
        let fresh = Mastery.freshState(state)
        let p = Mastery.predictedP(state)
        let r = Mastery.retrievability(of: state, at: now)
        var steps: [Step] = []

        func add(_ kind: StepKind, strategy: Strategy? = nil,
                 difficulty: String = "medium", assistance: Assistance = .none) {
            steps.append(Step(kind: kind, strategy: strategy, difficulty: difficulty,
                              assistance: assistance,
                              minutes: stepMinutes[kind] ?? 2.0, detail: ""))
        }

        // Known, but faded. A recall problem, not a teaching problem — and re-explaining
        // it would be slower and mildly insulting.
        if fresh >= .reliable && r < 0.7 {
            add(.practise)
            add(.verify)
            let percent = Int((r * 100).rounded())
            return fit(Plan(
                conceptID: state.conceptID, steps: steps,
                rationale: "You could do this before; recall has dropped to \(percent)%. "
                    + "No re-teaching, just bringing it back.",
                followUpDays: 0, dropped: []
            ), availableMinutes: availableMinutes, state: state)
        }

        // Solid and current, but never tested on unfamiliar ground.
        if fresh >= .reliable && state.transferCorrect == 0 {
            add(.transfer, difficulty: "hard")
            return fit(Plan(
                conceptID: state.conceptID, steps: steps,
                rationale: "You can do the standard version. This checks that you understand it.",
                followUpDays: 0, dropped: []
            ), availableMinutes: availableMinutes, state: state)
        }

        // We do not know what is wrong. Ask before teaching: teaching the wrong thing
        // costs more than the two minutes spent finding out.
        if uncertain || (state.attempts >= 3 && p > 0.25 && p < 0.55 && knownError == nil) {
            add(.diagnose)
        }

        // The weakness is upstream. Fixing the symptom leaves the cause.
        if hasWeakPrerequisite { add(.prerequisite) }

        let strategy = nextStrategy(after: strategiesUsed)
        add(.teach, strategy: strategy)

        // A worked example earns its place when there is little to go on, or when
        // explanation alone has been tried — but not when the teaching step is already
        // a worked example, which would be the same thing twice.
        let wantsExample = fresh <= .practicing || strategiesUsed.contains(.explanation)
        if wantsExample && strategy != .workedExample {
            add(.example, strategy: .workedExample)
        }

        add(.guided, difficulty: "easy", assistance: .guided)
        add(.practise, difficulty: p < 0.4 ? "easy" : "medium")
        add(.verify)

        let rationale: String
        if let knownError {
            rationale = "Your last attempts point at \(knownError). This goes straight at it."
        } else if fresh == .unseen || state.attempts == 0 {
            rationale = "New ground, so this starts from the idea itself."
        } else if let last = strategiesUsed.last {
            rationale = "The \(last.rawValue) approach did not land, so this one is "
                + "\(strategy.rawValue) instead."
        } else {
            rationale = "You are at \(Int((p * 100).rounded()))% unaided on this."
        }

        return fit(Plan(conceptID: state.conceptID, steps: steps,
                        rationale: rationale, followUpDays: 0, dropped: []),
                   availableMinutes: availableMinutes, state: state)
    }

    /// Trim to the time available, in a defined order, never dropping verification.
    private static func fit(_ plan: Plan, availableMinutes: Double,
                            state: ConceptState) -> Plan {
        var result = plan
        let budget = max(minimumMinutes, availableMinutes)

        for kind in dropOrder {
            if result.minutes <= budget { break }
            let remaining = result.steps.filter { $0.kind != kind }
            if remaining.count == result.steps.count { continue }
            guard remaining.contains(where: { $0.kind == .verify }) else { continue }
            result.dropped.append(kind)
            result.steps = remaining
        }

        result.followUpDays = projectedFollowUp(state)
        return result
    }

    /// When to come back, assuming it works.
    ///
    /// Projected from the stability the concept would have *after* one successful
    /// unaided review, so the first return visit is scheduled from where the student
    /// will be rather than from where they are now.
    public static func projectedFollowUp(_ state: ConceptState) -> Double {
        let projected = max(state.stability, Mastery.sMin)
        guard projected > Mastery.sMin else {
            // Nothing to project from: come back tomorrow, when a newly learned idea is
            // most at risk and most cheaply saved.
            return 1.0
        }
        let grown = Mastery.clamp(projected * 1.9, Mastery.sMin, Mastery.sMax)
        return Scheduling.intervalDays(stability: grown)
    }

    /// Did it work?
    ///
    /// Not "did they say yes when asked whether it made sense". The claim requires the
    /// unaided probability to have moved *and* an independent success to have been
    /// added, so getting it right after being shown the answer does not count.
    public static func verifyPassed(before: ConceptState, after: ConceptState) -> Bool {
        Mastery.predictedP(after) > Mastery.predictedP(before)
            && after.independentCorrect > before.independentCorrect
    }
}
