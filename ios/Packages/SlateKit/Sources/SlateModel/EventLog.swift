import Foundation
import SlateFoundation

/// Everything that happened, in order, append-only.
///
/// This is the only authored state in the learning half of the product. Mastery,
/// weakness, recommendations and study plans are all *derived* from this log, which is
/// why "why am I being shown this?" has an answer and why deleting a document really
/// does delete the beliefs built on it.
public enum LearningEvent: Codable, Sendable, Hashable, Identifiable {
    case attempted(Attempt)
    case assistanceRequested(AssistanceRequested)
    case conceptTaught(ConceptTaught)
    case mistakeSaved(MistakeSaved)
    case mistakeResolved(id: EventID, at: Date, mistakeID: MistakeID)
    case sessionStarted(id: EventID, at: Date, sessionID: SessionID)
    case sessionEnded(id: EventID, at: Date, sessionID: SessionID, activeSeconds: Double)
    /// A deliberate tombstone. Redaction is an event too, so the log stays append-only
    /// and a rebuild of the projection produces the same answer it did before.
    case evidenceRedacted(id: EventID, at: Date, target: RedactionTarget)

    public var id: EventID {
        switch self {
        case .attempted(let a): EventID(rawValue: a.id.rawValue)
        case .assistanceRequested(let e): e.id
        case .conceptTaught(let e): e.id
        case .mistakeSaved(let e): e.id
        case .mistakeResolved(let id, _, _): id
        case .sessionStarted(let id, _, _): id
        case .sessionEnded(let id, _, _, _): id
        case .evidenceRedacted(let id, _, _): id
        }
    }

    public var at: Date {
        switch self {
        case .attempted(let a): a.at
        case .assistanceRequested(let e): e.at
        case .conceptTaught(let e): e.at
        case .mistakeSaved(let e): e.at
        case .mistakeResolved(_, let at, _): at
        case .sessionStarted(_, let at, _): at
        case .sessionEnded(_, let at, _, _): at
        case .evidenceRedacted(_, let at, _): at
        }
    }

    public struct AssistanceRequested: Codable, Sendable, Hashable {
        public let id: EventID
        public let at: Date
        public let conceptID: ConceptID
        public let questionID: QuestionID?
        public let level: Assistance
        public init(id: EventID = .new(), at: Date, conceptID: ConceptID,
                    questionID: QuestionID?, level: Assistance) {
            self.id = id; self.at = at; self.conceptID = conceptID
            self.questionID = questionID; self.level = level
        }
    }

    public struct ConceptTaught: Codable, Sendable, Hashable {
        public let id: EventID
        public let at: Date
        public let conceptID: ConceptID
        /// Which teaching approach was used, so a failed one is not repeated.
        public let strategy: TeachingStrategy
        public init(id: EventID = .new(), at: Date, conceptID: ConceptID,
                    strategy: TeachingStrategy) {
            self.id = id; self.at = at; self.conceptID = conceptID; self.strategy = strategy
        }
    }

    public struct MistakeSaved: Codable, Sendable, Hashable {
        public let id: EventID
        public let at: Date
        public let mistakeID: MistakeID
        public let conceptID: ConceptID
        public let errorType: ErrorType
        public init(id: EventID = .new(), at: Date, mistakeID: MistakeID,
                    conceptID: ConceptID, errorType: ErrorType) {
            self.id = id; self.at = at; self.mistakeID = mistakeID
            self.conceptID = conceptID; self.errorType = errorType
        }
    }

    public enum RedactionTarget: Codable, Sendable, Hashable {
        case document(DocumentID)
        case concept(ConceptID)
        case session(SessionID)
        case everything
    }
}

/// How something was taught. Recorded so that a second failure does not get the same
/// explanation in different words.
public enum TeachingStrategy: String, Codable, Sendable, CaseIterable {
    case explanation, workedExample, analogy, visual, guidedQuestion
    case prerequisite, counterexample, retrievalPrompt
}

/// An append-only store with one deliberate exception: redaction, which is itself
/// recorded as an event.
public protocol EventStore: Sendable {
    func append(_ event: LearningEvent) throws
    func append(contentsOf events: [LearningEvent]) throws
    func all() throws -> [LearningEvent]
    func events(since: Date) throws -> [LearningEvent]
}

public extension EventStore {
    /// Attempts that survive every redaction recorded in the log.
    ///
    /// Redactions are applied here rather than by deleting rows, so a projection built
    /// today and a projection rebuilt next year agree.
    func liveAttempts() throws -> [Attempt] {
        let events = try all().sorted { $0.at < $1.at }
        var attempts: [Attempt] = []
        var redactedConcepts: Set<ConceptID> = []
        var redactedSessions: Set<SessionID> = []

        for event in events {
            switch event {
            case .attempted(let a):
                attempts.append(a)
            case .evidenceRedacted(_, _, let target):
                switch target {
                case .everything:
                    attempts.removeAll()
                    redactedConcepts.removeAll()
                    redactedSessions.removeAll()
                case .concept(let c):
                    redactedConcepts.insert(c)
                    attempts.removeAll { $0.conceptID == c }
                case .session(let s):
                    redactedSessions.insert(s)
                    attempts.removeAll { $0.sessionID == s }
                case .document:
                    // Documents are redacted by the document store, which emits the
                    // per-concept and per-session redactions this log needs.
                    break
                }
            default:
                break
            }
        }
        return attempts.filter {
            !redactedConcepts.contains($0.conceptID)
                && !($0.sessionID.map { redactedSessions.contains($0) } ?? false)
        }
    }
}
