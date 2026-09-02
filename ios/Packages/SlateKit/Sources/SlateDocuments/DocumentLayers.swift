import Foundation
import SlateFoundation

/// The non-destructive document model.
///
/// An imported PDF is copied once and then never written to again. Everything the
/// student does lives in a separate layer, composited only at export. This is what
/// makes "never destroy the original" a property of the file layout rather than a
/// promise in a review checklist.
///
/// ```
/// Documents/<id>/
///   original.pdf          immutable, checksummed at import
///   meta.json             title, subject, page count, checksum
///   ink.slateink          PencilKit drawings, one per page
///   ink.wal               write-ahead log for strokes since the last snapshot
///   annotations.json      highlights, shapes, text boxes, images
///   annotations.wal
///   typed.json            typed answers bound to question regions
///   questions.json        the question map
///   versions/             working / final / submitted snapshots
/// ```
public struct DocumentPaths: Sendable {
    public let root: URL

    public init(root: URL) { self.root = root }

    public var original: URL { root.appendingPathComponent("original.pdf") }
    public var meta: URL { root.appendingPathComponent("meta.json") }
    public var ink: URL { root.appendingPathComponent("ink.slateink") }
    public var inkLog: URL { root.appendingPathComponent("ink.wal") }
    public var annotations: URL { root.appendingPathComponent("annotations.json") }
    public var annotationsLog: URL { root.appendingPathComponent("annotations.wal") }
    public var typed: URL { root.appendingPathComponent("typed.json") }
    public var questions: URL { root.appendingPathComponent("questions.json") }
    public var versions: URL { root.appendingPathComponent("versions", isDirectory: true) }

    public func version(_ kind: DocumentVersion.Kind, at date: Date) -> URL {
        let stamp = ISO8601DateFormatter.filenameSafe.string(from: date)
        return versions.appendingPathComponent("\(kind.rawValue)-\(stamp).pdf")
    }
}

public extension ISO8601DateFormatter {
    /// No colons: they are legal on APFS and a nuisance everywhere a file goes
    /// afterwards — mail attachments, shared drives, and anything a teacher opens on
    /// Windows.
    static let filenameSafe: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withYear, .withMonth, .withDay, .withTime]
        return f
    }()
}

public struct DocumentMeta: Codable, Sendable, Hashable, Identifiable {
    public let id: DocumentID
    public var title: String
    public var subject: String
    public var pageCount: Int
    public var importedAt: Date
    public var lastOpenedAt: Date?
    public var lastPage: Int
    /// SHA-256 of `original.pdf`, recorded at import.
    ///
    /// Checked before export. If it has changed, something outside the app has
    /// modified the source, and the student is told rather than handed a document that
    /// no longer matches what they answered.
    public var originalChecksum: String
    public var assignmentID: AssignmentID?
    public var isFavourite: Bool
    public var trashedAt: Date?

    public init(id: DocumentID, title: String, subject: String = "", pageCount: Int,
                importedAt: Date, lastOpenedAt: Date? = nil, lastPage: Int = 0,
                originalChecksum: String, assignmentID: AssignmentID? = nil,
                isFavourite: Bool = false, trashedAt: Date? = nil) {
        self.id = id; self.title = title; self.subject = subject
        self.pageCount = pageCount; self.importedAt = importedAt
        self.lastOpenedAt = lastOpenedAt; self.lastPage = lastPage
        self.originalChecksum = originalChecksum; self.assignmentID = assignmentID
        self.isFavourite = isFavourite; self.trashedAt = trashedAt
    }
}

/// Four versions, and the reason each exists.
public struct DocumentVersion: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable, CaseIterable {
        /// The source, untouched. Recoverable at any point.
        case original
        /// A snapshot the student took before a big change.
        case working
        /// What they declared finished.
        case final
        /// The exact bytes that were sent. Answering "what did I actually submit?"
        /// requires keeping them, not regenerating them.
        case submitted
    }

    public let id: String
    public let kind: Kind
    public let createdAt: Date
    public let label: String
    public let fileURL: URL
    public let byteCount: Int

    public init(id: String = UUID().uuidString, kind: Kind, createdAt: Date,
                label: String, fileURL: URL, byteCount: Int) {
        self.id = id; self.kind = kind; self.createdAt = createdAt
        self.label = label; self.fileURL = fileURL; self.byteCount = byteCount
    }
}

/// One change to a layer. These are what the journal stores.
public enum LayerDelta: Codable, Sendable, Hashable {
    case inkReplaced(page: Int, drawingData: Data, at: Date)
    case annotationAdded(Annotation)
    case annotationRemoved(id: String, at: Date)
    case typedAnswerSet(questionID: QuestionID, text: String, at: Date)
    case typedAnswerCleared(questionID: QuestionID, at: Date)
    case pageOrderChanged(order: [Int], at: Date)

    public var at: Date {
        switch self {
        case .inkReplaced(_, _, let at): at
        case .annotationAdded(let a): a.createdAt
        case .annotationRemoved(_, let at): at
        case .typedAnswerSet(_, _, let at): at
        case .typedAnswerCleared(_, let at): at
        case .pageOrderChanged(_, let at): at
        }
    }
}

public struct Annotation: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case highlight, underline, strikethrough, box, arrow, ellipse, textBox, image, sticker
    }

    public let id: String
    public let kind: Kind
    public let page: Int
    /// Normalised to the page box so annotations survive rotation and zoom.
    public var rect: NormalisedRect
    public var colourHex: String
    public var text: String?
    public var imageData: Data?
    public let createdAt: Date

    public init(id: String = UUID().uuidString, kind: Kind, page: Int, rect: NormalisedRect,
                colourHex: String, text: String? = nil, imageData: Data? = nil, createdAt: Date) {
        self.id = id; self.kind = kind; self.page = page; self.rect = rect
        self.colourHex = colourHex; self.text = text; self.imageData = imageData
        self.createdAt = createdAt
    }
}

/// A rectangle in page space, 0...1 on both axes with the origin at the top left.
public struct NormalisedRect: Codable, Sendable, Hashable {
    public var x: Double, y: Double, width: Double, height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }

    public func intersects(_ other: NormalisedRect) -> Bool {
        x < other.x + other.width && other.x < x + width
            && y < other.y + other.height && other.y < y + height
    }

    public var midY: Double { y + height / 2 }
}
