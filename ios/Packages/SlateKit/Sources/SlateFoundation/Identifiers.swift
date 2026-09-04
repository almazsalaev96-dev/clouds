import Foundation

/// Typed identifiers. A `DocumentID` and a `ConceptID` are both UUIDs underneath and
/// passing one where the other belongs is a bug the compiler should catch, not a bug a
/// student discovers when their worksheet opens someone else's mistake book.
public protocol TypedID: Hashable, Codable, Sendable, CustomStringConvertible {
    var rawValue: String { get }
    init(rawValue: String)
}

public extension TypedID {
    var description: String { rawValue }
    init(from decoder: Decoder) throws {
        self.init(rawValue: try decoder.singleValueContainer().decode(String.self))
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(rawValue)
    }
    static func new() -> Self { Self(rawValue: UUID().uuidString) }
}

public struct DocumentID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct PageID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct QuestionID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct AssignmentID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct AttemptID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct SessionID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct NoteID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct MistakeID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct EventID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }
public struct SubmissionID: TypedID { public let rawValue: String; public init(rawValue: String) { self.rawValue = rawValue } }

/// Concepts are named, not generated: "completing-the-square" is stable across devices,
/// across curricula, and across a rebuild of the concept graph.
public struct ConceptID: TypedID {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public init(_ slug: String) { self.rawValue = slug }
}
