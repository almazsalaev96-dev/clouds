import Foundation
import SwiftData

/// A worksheet, past paper, textbook chapter or scanned page set.
///
/// The PDF bytes themselves are **not** stored in SwiftData. They live in the
/// document store on disk (see `DocumentStore`) and are referenced by
/// `storageName`. That keeps the database small enough to query instantly even
/// with a library of 500-page textbooks, and lets PDFKit memory-map the file
/// instead of holding it in RAM.
@Model
final class StudyDocument {
    var id: UUID = UUID()
    var title: String = ""
    var subjectName: String = Subject.unspecified.name

    /// File name inside the document store. The *original*, never modified.
    var storageName: String = ""
    /// The name the file had when it was imported, for display and export.
    var originalFileName: String = ""

    var createdAt: Date = Date()
    var lastOpenedAt: Date?
    var pageCount: Int = 0

    /// Restored on open so the student lands exactly where they left off.
    var lastPageIndex: Int = 0
    var lastZoomScale: Double = 1

    var isFavorite: Bool = false
    /// Soft delete. Recently Deleted keeps work recoverable for 30 days.
    var deletedAt: Date?

    @Attribute(.externalStorage) var thumbnailData: Data?

    /// Cached page text, extracted once on import. Powers search and lets the
    /// context engine answer "what is the question?" without an OCR round trip.
    @Attribute(.externalStorage) var extractedTextData: Data?

    @Relationship(deleteRule: .cascade, inverse: \PageAnnotation.document)
    var annotations: [PageAnnotation] = []

    @Relationship(deleteRule: .cascade, inverse: \TutorConversation.document)
    var conversations: [TutorConversation] = []

    @Relationship(deleteRule: .nullify, inverse: \Assignment.document)
    var assignment: Assignment?

    init(title: String, subject: Subject, storageName: String, originalFileName: String, pageCount: Int) {
        self.id = UUID()
        self.title = title
        self.subjectName = subject.name
        self.storageName = storageName
        self.originalFileName = originalFileName
        self.pageCount = pageCount
        self.createdAt = Date()
    }

    var subject: Subject {
        get { Subject(subjectName) }
        set { subjectName = newValue.name }
    }

    var isInTrash: Bool { deletedAt != nil }

    /// Pages the student has actually written on. This is the honest measure of
    /// progress — not "pages scrolled past".
    var pagesWorked: Int {
        annotations.filter { !$0.isEmpty }.count
    }

    var progress: Double {
        guard pageCount > 0 else { return 0 }
        return min(1, Double(pagesWorked) / Double(pageCount))
    }

    /// Per-page plain text, indexed by page. Empty for scanned PDFs with no
    /// text layer — those fall back to on-device OCR in `DocumentIndex`.
    var extractedText: [String] {
        get {
            guard let extractedTextData else { return [] }
            return (try? JSONDecoder().decode([String].self, from: extractedTextData)) ?? []
        }
        set {
            extractedTextData = try? JSONEncoder().encode(newValue)
        }
    }

    func text(onPage index: Int) -> String? {
        let pages = extractedText
        guard pages.indices.contains(index) else { return nil }
        let text = pages[index]
        return text.isEmpty ? nil : text
    }

    func annotation(forPage index: Int) -> PageAnnotation? {
        annotations.first { $0.pageIndex == index }
    }
}

/// The student's ink on one page, stored as a `PKDrawing` archive.
///
/// Ink is kept in its own layer, separate from the PDF, for three reasons:
/// the original worksheet is never modified, strokes stay vector at any zoom,
/// and the tutor can be told "this part is the student's handwriting" with
/// certainty rather than by guessing from pixels.
@Model
final class PageAnnotation {
    var pageIndex: Int = 0

    /// `PKDrawing.dataRepresentation()`. External storage: a page of dense
    /// notes is tens of kilobytes and has no business inside the store file.
    @Attribute(.externalStorage) var drawingData: Data = Data()

    var updatedAt: Date = Date()

    /// Cached handwriting OCR for this page, and the drawing revision it was
    /// computed from. Recognition is expensive, so it is only redone when the
    /// ink actually changed.
    var recognizedText: String?
    var recognizedRevision: Int = -1
    /// Bumped on every save; identifies the current ink state.
    var revision: Int = 0

    var document: StudyDocument?

    init(pageIndex: Int, drawingData: Data = Data()) {
        self.pageIndex = pageIndex
        self.drawingData = drawingData
    }

    var isEmpty: Bool { drawingData.isEmpty }

    var needsRecognition: Bool {
        !isEmpty && recognizedRevision != revision
    }
}
