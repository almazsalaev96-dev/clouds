import Foundation
import SwiftData

/// A note that can stand alone or hang off a specific page of a worksheet.
///
/// Notes carry both typed text and an optional ink layer, because revision
/// notes are usually both — a typed summary with a diagram sketched beside it.
@Model
final class StudyNote {
    var id: UUID = UUID()
    var title: String = ""
    var body: String = ""
    var subjectName: String = Subject.unspecified.name
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    var isFavorite: Bool = false

    /// Optional link back to where the note came from. Tapping the note in
    /// search returns the student to exactly this page.
    var linkedDocumentID: UUID?
    var linkedPageIndex: Int?

    @Attribute(.externalStorage) var drawingData: Data?

    init(title: String, body: String = "", subject: Subject = .unspecified) {
        self.id = UUID()
        self.title = title
        self.body = body
        self.subjectName = subject.name
    }

    var subject: Subject {
        get { Subject(subjectName) }
        set { subjectName = newValue.name }
    }
}
