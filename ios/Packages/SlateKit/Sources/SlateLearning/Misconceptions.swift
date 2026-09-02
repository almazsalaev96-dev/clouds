import Foundation
import SlateFoundation
import SlateModel

/// Turning repeated wrong answers into one named pattern.
///
/// This is the difference between a marking app and a teacher. Four unrelated
/// "incorrect" marks are noise; "you have dropped a negative sign four times across
/// three topics" is a lesson.
public enum Misconceptions {
    public static let minOccurrences = 3
    public static let minDistinctQuestions = 2
    public static let recencyHalfLifeDays = 14.0

    public struct Pattern: Sendable, Hashable, Identifiable {
        public let errorType: ErrorType
        public let occurrences: Int
        public let distinctConcepts: Int
        public let distinctQuestions: Int
        public let conceptIDs: [ConceptID]
        public let lastSeen: Date?
        public let strength: Double

        public var id: String { errorType.rawValue }

        /// Plain wording. No blame, no exclamation marks, no "unfortunately".
        public var headline: String {
            let what = switch errorType {
            case .calculation: "arithmetic slips"
            case .misconception: "the same misunderstanding"
            case .procedural: "steps applied in the wrong order"
            case .reading: "misread questions"
            case .interpretation: "misreadings of what the question asked for"
            case .application: "trouble applying a method you know"
            case .reasoningGap: "missing steps in your reasoning"
            case .examTechnique: "marks lost to how the answer was written"
            case .knowledgeGap: "a gap in the underlying idea"
            case .careless: "avoidable slips"
            case .timeManagement: "running out of time"
            default: "the same kind of mistake"
            }
            let scope = distinctConcepts > 1 ? "across \(distinctConcepts) topics" : "in this topic"
            return "\(occurrences) \(what) \(scope)."
        }
    }

    public static func recencyWeight(_ at: Date, now: Date) -> Double {
        pow(0.5, max(0, now.days(since: at)) / recencyHalfLifeDays)
    }

    /// Patterns worth telling the student about, strongest first.
    public static func detect(in attempts: [Attempt], now: Date) -> [Pattern] {
        var buckets: [ErrorType: [Attempt]] = [:]
        for a in attempts {
            guard a.outcome != .correct, let type = a.errorType else { continue }
            guard type != .unknown, type != .unreadable else { continue }
            buckets[type, default: []].append(a)
        }

        var out: [Pattern] = []
        for (type, group) in buckets {
            let concepts = Set(group.map(\.conceptID))
            let questions = Set(group.compactMap(\.questionID))
            guard group.count >= minOccurrences else { continue }
            guard max(questions.count, 1) >= minDistinctQuestions else { continue }

            let recency = group.reduce(0.0) { $0 + recencyWeight($1.at, now: now) }
            out.append(Pattern(
                errorType: type,
                occurrences: group.count,
                distinctConcepts: concepts.count,
                distinctQuestions: questions.count,
                conceptIDs: concepts.sorted { $0.rawValue < $1.rawValue },
                lastSeen: group.map(\.at).max(),
                strength: Double(group.count) * Double(concepts.count).squareRoot() * recency
            ))
        }
        return out.sorted {
            $0.strength == $1.strength
                ? $0.errorType.rawValue < $1.errorType.rawValue
                : $0.strength > $1.strength
        }
    }
}
