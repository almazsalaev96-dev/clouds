import Foundation
import SlateFoundation
import SlateModel

/// The typed replies the gateway returns.
///
/// Nothing arrives as prose. A hint and a full solution are different objects, so the
/// interface can render them differently and can show uncertainty honestly instead of
/// burying it in a paragraph.
public struct TutorReply: Codable, Sendable, Hashable {
    public enum Mode: String, Codable, Sendable, CaseIterable {
        case nudge, hint, explain, steps, check, solve, teach, simplify, example, quiz

        public var label: String {
            switch self {
            case .nudge: "Nudge"
            case .hint: "Hint"
            case .explain: "Explain"
            case .steps: "Show steps"
            case .check: "Check"
            case .solve: "Full solution"
            case .teach: "Teach me"
            case .simplify: "Simpler"
            case .example: "Example"
            case .quiz: "Quiz me"
            }
        }

        public var assistance: Assistance {
            switch self {
            case .nudge: .nudge
            case .hint, .example, .simplify: .hint
            case .explain, .teach, .quiz, .check: .guided
            case .steps: .worked
            case .solve: .solution
            }
        }
    }

    public struct Step: Codable, Sendable, Hashable, Identifiable {
        public let text: String
        public let isHidden: Bool
        public var id: String { text }
    }

    public struct NextAction: Codable, Sendable, Hashable {
        public enum Kind: String, Codable, Sendable {
            case tryAgain, tryTheFirstStep, askAQuestion, showWorkedExample
            case practiseSimilar, moveOn, reviewPrerequisite, none
        }
        public let kind: Kind
        public let label: String
        public let conceptId: String?
    }

    public let mode: Mode
    public let message: String
    public let steps: [Step]?
    public let confidence: Double
    /// What could not be determined, in the tutor's own words. Shown rather than
    /// hidden: a tutor that admits it cannot read a digit is more useful than one that
    /// guesses.
    public let uncertainty: String?
    public let conceptIds: [String]
    public let nextAction: NextAction

    public var conceptIDs: [ConceptID] { conceptIds.map(ConceptID.init) }
    public var isUncertain: Bool { confidence < 0.7 || !(uncertainty ?? "").isEmpty }
}

public struct CheckReply: Codable, Sendable, Hashable {
    public let verdict: String
    public let firstProblemStep: Int?
    public let whatIsRight: String
    public let whatToFix: String
    public let errorType: String
    public let errorConfidence: Double
    public let conceptIds: [String]
    public let suggestedAssistance: String
    public let nextAction: TutorReply.NextAction
    /// Which component decided: the deterministic marker, the model, or both agreeing.
    public let decidedBy: String
    public let modelOverruled: Bool
    public let graderReason: String?
    public let confidence: Double

    public var outcome: Outcome {
        switch verdict {
        case "correct": .correct
        case "partiallyCorrect": .partial
        default: .incorrect
        }
    }

    public var error: ErrorType? {
        verdict == "correct" ? nil : ErrorType(rawValue: errorType)
    }

    public var assistance: Assistance {
        Assistance(rawValue: suggestedAssistance) ?? .hint
    }

    public var conceptIDs: [ConceptID] { conceptIds.map(ConceptID.init) }

    /// True when arithmetic settled it. The interface says "checked" rather than
    /// "the tutor thinks", because the difference matters to a student deciding
    /// whether to argue with it.
    public var isCertain: Bool { decidedBy != "model" }
}

public struct GradeOnlyReply: Codable, Sendable, Hashable {
    public struct NearMiss: Codable, Sendable, Hashable {
        public let kind: String
        public let detail: String
        public let suggestedErrorType: String
    }
    public let verdict: String
    public let confidence: Double
    public let reason: String
    public let nearMiss: NearMiss?
    public let parsed: Bool

    public var outcome: Outcome? {
        switch verdict {
        case "correct": .correct
        case "partiallyCorrect": .partial
        case "incorrect": .incorrect
        default: nil
        }
    }
}

public struct HandwritingReading: Codable, Sendable, Hashable {
    public struct Line: Codable, Sendable, Hashable, Identifiable {
        public let text: String
        public let confidence: Double
        public let isCrossedOut: Bool
        public var id: String { text }
    }
    public let text: String
    public let confidence: Double
    public let lines: [Line]
    /// Named rather than guessed at. Reading an ambiguous 3 as an 8 because 8 makes the
    /// answer right is the most damaging thing this feature could do.
    public let unreadable: [String]
    public let finalAnswer: String?

    public var isReliable: Bool { confidence >= 0.65 && unreadable.isEmpty }
}

public struct GeneratedQuestion: Codable, Sendable, Hashable, Identifiable {
    public let prompt: String
    public let answerShape: String
    public let acceptableAnswers: [String]
    public let unit: String?
    public let significantFigures: Int?
    public let workedSolution: [String]
    public let conceptIds: [String]
    public let difficulty: String
    public let marks: Int
    public var id: String { prompt }
    public var conceptIDs: [ConceptID] { conceptIds.map(ConceptID.init) }
}
