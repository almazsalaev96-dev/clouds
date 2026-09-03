import Foundation
import SlateFoundation

/// A note.
///
/// Notes are for later, when the page is not in front of you, so a note that cannot say
/// where it came from is half a note. Every one carries its source, and opening it can
/// take you back to the page it was made from.
public struct Note: Codable, Sendable, Hashable, Identifiable {

    /// Where a note came from, and what made it.
    public enum Origin: Codable, Sendable, Hashable {
        /// Written by the student, from nothing.
        case written
        /// Written by the student while looking at a page.
        case fromPage(document: DocumentID, page: Int)
        /// Drafted by the tutor from material, and **accepted** by the student.
        ///
        /// The distinction matters: a draft is never a note until someone said so.
        case draftedFrom(document: DocumentID?, title: String)
        /// Made from a mistake, so the correction outlives the question.
        case fromMistake(concept: ConceptID)

        public var documentID: DocumentID? {
            switch self {
            case .fromPage(let document, _): document
            case .draftedFrom(let document, _): document
            case .written, .fromMistake: nil
            }
        }

        public var label: String {
            switch self {
            case .written: "Yours"
            case .fromPage: "From a page"
            case .draftedFrom: "Drafted by the tutor, kept by you"
            case .fromMistake: "From a mistake"
            }
        }
    }

    public struct Section: Codable, Sendable, Hashable, Identifiable {
        public var heading: String
        public var points: [String]
        public var id: String { heading }

        public init(heading: String, points: [String]) {
            self.heading = heading
            self.points = points
        }
    }

    public let id: NoteID
    public var title: String
    public var sections: [Section]
    /// Free text the student typed themselves, kept separate from structured sections
    /// so that editing one never reformats the other.
    public var body: String
    /// Handwritten pages, as PencilKit data. A note can be typed, drawn, or both.
    public var inkPages: [Data]
    public var conceptIDs: [ConceptID]
    public var origin: Origin
    /// Anything the tutor added that the source did not say. Shown, always, so a
    /// student revising from these knows which lines came from their worksheet.
    public var addedByTutor: [String]
    public let createdAt: Date
    public var updatedAt: Date
    public var isPinned: Bool

    public init(id: NoteID = .new(), title: String, sections: [Section] = [],
                body: String = "", inkPages: [Data] = [], conceptIDs: [ConceptID] = [],
                origin: Origin = .written, addedByTutor: [String] = [],
                createdAt: Date, updatedAt: Date? = nil, isPinned: Bool = false) {
        self.id = id
        self.title = title
        self.sections = sections
        self.body = body
        self.inkPages = inkPages
        self.conceptIDs = conceptIDs
        self.origin = origin
        self.addedByTutor = addedByTutor
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
        self.isPinned = isPinned
    }

    public var isEmpty: Bool {
        sections.isEmpty && body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && inkPages.isEmpty
    }

    /// One line for a list, drawn from whatever the note actually has.
    public var preview: String {
        if let first = sections.first?.points.first { return first }
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return String(trimmed.prefix(140)) }
        if !inkPages.isEmpty { return "Handwritten" }
        return "Empty"
    }

    /// Everything searchable about this note, flattened once.
    public var searchableText: String {
        ([title, body]
            + sections.flatMap { [$0.heading] + $0.points }
            + conceptIDs.map(\.rawValue))
            .joined(separator: " ")
    }
}
