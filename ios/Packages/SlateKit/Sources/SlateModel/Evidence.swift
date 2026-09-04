import Foundation
import SlateFoundation

/// Whether the answer was right. Three states, not two: half marks are real.
public enum Outcome: String, Codable, Sendable, CaseIterable {
    case correct, partial, incorrect

    public var score: Double {
        switch self {
        case .correct: 1.0
        case .partial: 0.5
        case .incorrect: 0.0
        }
    }
}

/// How much help was actually consumed *before* the answer was given.
///
/// Conflating this with the outcome is the classic mistake in study software: it is why
/// so many apps congratulate a student for copying a solution.
public enum Assistance: String, Codable, Sendable, CaseIterable {
    case none, nudge, hint, guided, worked, solution

    /// Share of the outcome that counts as evidence of unaided ability.
    public var creditWeight: Double {
        switch self {
        case .none: 1.00
        case .nudge: 0.85
        case .hint: 0.70
        case .guided: 0.50
        case .worked: 0.25
        case .solution: 0.00
        }
    }

    /// How much a review at this assistance level consolidates memory.
    public var consolidation: Double {
        switch self {
        case .none, .nudge: 1.00
        case .hint, .guided: 0.60
        case .worked: 0.30
        case .solution: 0.15
        }
    }

    public var isIndependent: Bool { self == .none || self == .nudge }

    /// The next rung down, for when a student asks for more help.
    public var moreHelp: Assistance {
        switch self {
        case .none: .nudge
        case .nudge: .hint
        case .hint: .guided
        case .guided: .worked
        case .worked: .solution
        case .solution: .solution
        }
    }
}

/// What kind of evidence this attempt is. A cold recall a week later says more about
/// understanding than the fifth repetition in one sitting.
public enum AttemptKind: String, Codable, Sendable, CaseIterable {
    case practice, retrieval, transfer, exam, diagnostic

    public var gain: Double {
        switch self {
        case .practice: 1.00
        case .retrieval: 1.15
        case .transfer: 1.30
        case .exam: 1.20
        case .diagnostic: 1.10
        }
    }
}

public enum ErrorType: String, Codable, Sendable, CaseIterable {
    case knowledgeGap, misconception, procedural, calculation, reading
    case interpretation, application, reasoningGap, examTechnique, careless
    case timeManagement, unreadable, unknown

    /// A slip is not a knowledge claim, and work we could not read is not evidence.
    public var countsAgainstAbility: Bool {
        self != .careless && self != .unreadable
    }

    public var studentFacingName: String {
        switch self {
        case .knowledgeGap: "a gap in the underlying idea"
        case .misconception: "a misunderstanding"
        case .procedural: "steps in the wrong order"
        case .calculation: "an arithmetic slip"
        case .reading: "a misread question"
        case .interpretation: "a different reading of what was asked"
        case .application: "trouble applying a method you know"
        case .reasoningGap: "a missing step"
        case .examTechnique: "how the answer was written"
        case .careless: "an avoidable slip"
        case .timeManagement: "running out of time"
        case .unreadable: "handwriting we could not read"
        case .unknown: "something we could not pin down"
        }
    }
}

/// Seven states, ordered. `mastered` is not a trophy: it expires without review.
public enum MasteryState: String, Codable, Sendable, CaseIterable, Comparable {
    case unseen, introduced, practicing, developing, reliable, transferable, mastered

    public var rank: Int { MasteryState.allCases.firstIndex(of: self)! }

    public static func < (a: MasteryState, b: MasteryState) -> Bool { a.rank < b.rank }

    public static func atRank(_ r: Int) -> MasteryState {
        allCases[min(max(r, 0), allCases.count - 1)]
    }

    /// Written to be read by a student, in the second person, without jargon.
    public var studentFacingLabel: String {
        switch self {
        case .unseen: "Not started"
        case .introduced: "Just met this"
        case .practicing: "Practising"
        case .developing: "Getting there"
        case .reliable: "You can do this on your own"
        case .transferable: "You can use this in new situations"
        case .mastered: "Solid, and it has stuck"
        }
    }
}

/// One recorded try at a question, attributed to exactly one concept.
///
/// A question tagged with several concepts produces one `Attempt` per concept. The
/// engine never blurs evidence across concepts, because "you are weak at quadratics"
/// is useless next to "you are weak at completing the square".
public struct Attempt: Codable, Sendable, Hashable, Identifiable {
    public let id: AttemptID
    public let conceptID: ConceptID
    public let at: Date
    public let outcome: Outcome
    public let assistance: Assistance
    public let kind: AttemptKind
    public let errorType: ErrorType?
    public let sessionID: SessionID?
    public let questionID: QuestionID?
    public let confidence: Double?
    public let secondsSpent: Double?

    public init(
        id: AttemptID = .new(),
        conceptID: ConceptID,
        at: Date,
        outcome: Outcome,
        assistance: Assistance = .none,
        kind: AttemptKind = .practice,
        errorType: ErrorType? = nil,
        sessionID: SessionID? = nil,
        questionID: QuestionID? = nil,
        confidence: Double? = nil,
        secondsSpent: Double? = nil
    ) {
        self.id = id
        self.conceptID = conceptID
        self.at = at
        self.outcome = outcome
        self.assistance = assistance
        self.kind = kind
        self.errorType = errorType
        self.sessionID = sessionID
        self.questionID = questionID
        self.confidence = confidence
        self.secondsSpent = secondsSpent
    }
}

/// Derived state for one concept. Never authored directly, always folded from attempts.
public struct ConceptState: Codable, Sendable, Hashable {
    public let conceptID: ConceptID
    public var alpha: Double = 0.8
    public var beta: Double = 1.2
    public var difficulty: Double = 5.0
    public var stability: Double = 0.0
    public var lastReviewed: Date?
    public var attempts: Int = 0
    public var independentCorrect: Int = 0
    public var transferCorrect: Int = 0
    public var retentionCorrect: Int = 0
    public var carelessSlips: Int = 0
    public var sessions: Set<String> = []
    /// Rolling window of (creditWeight, score) used for the independence signal.
    public var recentCredit: [RecentCredit] = []

    public init(conceptID: ConceptID) { self.conceptID = conceptID }

    public struct RecentCredit: Codable, Sendable, Hashable {
        public let weight: Double
        public let score: Double
        public init(weight: Double, score: Double) {
            self.weight = weight
            self.score = score
        }
    }
}

public struct Concept: Codable, Sendable, Hashable, Identifiable {
    public var id: ConceptID { conceptID }
    public let conceptID: ConceptID
    public var name: String
    public var subject: String
    public var prerequisites: [ConceptID]
    public var examWeight: Double
    public var upcomingUses: Int

    public init(
        conceptID: ConceptID, name: String, subject: String = "",
        prerequisites: [ConceptID] = [], examWeight: Double = 1.0, upcomingUses: Int = 0
    ) {
        self.conceptID = conceptID
        self.name = name
        self.subject = subject
        self.prerequisites = prerequisites
        self.examWeight = examWeight
        self.upcomingUses = upcomingUses
    }
}
