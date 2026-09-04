import Foundation
import SlateFoundation
import SlateModel

/// How much help to offer, and when to stop offering.
///
/// The default is the smallest useful nudge and the ladder only climbs when the student
/// asks it to. But nothing here withholds a solution from someone who wants one:
/// refusing twice does not teach a student anything except to use a different app.
public struct AssistanceLadder: Sendable {

    public private(set) var current: Assistance
    public private(set) var requestsForThisQuestion: Int
    private let startedAt: Assistance

    public init(startingAt: Assistance = .nudge) {
        current = startingAt
        startedAt = startingAt
        requestsForThisQuestion = 0
    }

    /// The rung to offer next.
    public mutating func advance() -> Assistance {
        requestsForThisQuestion += 1
        current = current.moreHelp
        return current
    }

    public mutating func reset() {
        current = startedAt
        requestsForThisQuestion = 0
    }

    /// Where to start on a new question, given what the student has shown before.
    ///
    /// Someone who has been solving this unaided gets a nudge; someone who has never
    /// met the idea gets a real explanation, because a nudge towards a concept you have
    /// not been taught is just a riddle.
    public static func startingRung(for state: MasteryState, independence: Double?) -> Assistance {
        switch state {
        case .unseen, .introduced: return .guided
        case .practicing: return .hint
        case .developing:
            // Falling independence at flat accuracy means the help is doing the work.
            if let independence, independence < 0.5 { return .nudge }
            return .hint
        case .reliable, .transferable, .mastered: return .nudge
        }
    }

    /// The modes to show, in the order they should appear.
    ///
    /// "Full solution" is always present. It is never the first button and never the
    /// hidden one.
    public static func offeredModes(at rung: Assistance,
                                    hasWork: Bool) -> [TutorReply.Mode] {
        var modes: [TutorReply.Mode] = []
        switch rung {
        case .none, .nudge: modes = [.nudge, .hint, .explain]
        case .hint: modes = [.hint, .explain, .steps]
        case .guided: modes = [.explain, .steps, .example]
        case .worked, .solution: modes = [.steps, .example, .teach]
        }
        if hasWork { modes.insert(.check, at: 0) }
        modes.append(.solve)
        var seen: Set<TutorReply.Mode> = []
        return modes.filter { seen.insert($0).inserted }
    }

    /// When the same explanation has already failed, changing the words is not a new
    /// attempt. Pick a different approach instead.
    public static func nextStrategy(after used: [TeachingStrategy]) -> TeachingStrategy {
        let order: [TeachingStrategy] = [
            .explanation, .workedExample, .guidedQuestion, .analogy,
            .visual, .prerequisite, .counterexample, .retrievalPrompt,
        ]
        return order.first { !used.contains($0) } ?? .prerequisite
    }
}
