import Foundation
import SwiftData

enum AssignmentStatus: String, Codable, CaseIterable, Identifiable {
    case notStarted
    case inProgress
    case almostDone
    case completed
    case submitted

    var id: String { rawValue }

    var title: String {
        switch self {
        case .notStarted: "Not Started"
        case .inProgress: "In Progress"
        case .almostDone: "Almost Done"
        case .completed: "Completed"
        case .submitted: "Submitted"
        }
    }

    var symbolName: String {
        switch self {
        case .notStarted: "circle"
        case .inProgress: "circle.lefthalf.filled"
        case .almostDone: "circle.righthalf.filled"
        case .completed: "checkmark.circle.fill"
        case .submitted: "paperplane.circle.fill"
        }
    }
}

/// A piece of work with a deadline attached to it. An assignment wraps a
/// document; the document is still usable on its own, so a student who just
/// wants to revise never has to create an assignment first.
@Model
final class Assignment {
    var id: UUID = UUID()
    var title: String = ""
    var subjectName: String = Subject.unspecified.name
    var teacherName: String?
    var dueDate: Date?
    var statusRaw: String = AssignmentStatus.notStarted.rawValue
    var notes: String = ""
    var createdAt: Date = Date()
    var completedAt: Date?

    var document: StudyDocument?

    @Relationship(deleteRule: .cascade, inverse: \Submission.assignment)
    var submissions: [Submission] = []

    init(title: String, subject: Subject, dueDate: Date? = nil, teacherName: String? = nil) {
        self.id = UUID()
        self.title = title
        self.subjectName = subject.name
        self.dueDate = dueDate
        self.teacherName = teacherName
        self.createdAt = Date()
    }

    var subject: Subject {
        get { Subject(subjectName) }
        set { subjectName = newValue.name }
    }

    var status: AssignmentStatus {
        get { AssignmentStatus(rawValue: statusRaw) ?? .notStarted }
        set { statusRaw = newValue.rawValue }
    }

    var isOverdue: Bool {
        guard let dueDate, status != .submitted, status != .completed else { return false }
        return dueDate < Date()
    }

    /// Derived from actual work done, so the badge on the card can never lie
    /// about how far along a student is. `submitted` is set explicitly by the
    /// submission flow and is never overwritten here.
    func refreshStatusFromWork() {
        guard status != .submitted else { return }
        let progress = document?.progress ?? 0
        switch progress {
        case 0: status = .notStarted
        case ..<0.7: status = .inProgress
        case ..<1: status = .almostDone
        default: status = .completed
        }
    }

    var latestSubmission: Submission? {
        submissions.max { $0.exportedAt < $1.exportedAt }
    }
}

/// A finished PDF the student produced from an assignment.
///
/// The exported file is kept, not just a record of it, so "what exactly did I
/// hand in?" always has an answer — even after the working copy moves on.
@Model
final class Submission {
    var id: UUID = UUID()
    /// File name in the document store's `Submissions` folder.
    var storageName: String = ""
    var displayName: String = ""
    var exportedAt: Date = Date()
    var pageCount: Int = 0
    var byteCount: Int = 0
    /// "Version 1", "Version 2", "Final" — shown in version history.
    var versionLabel: String = "Version 1"
    /// Set once the student actually completes the share sheet.
    var sharedAt: Date?

    var assignment: Assignment?

    init(storageName: String, displayName: String, pageCount: Int, byteCount: Int, versionLabel: String) {
        self.id = UUID()
        self.storageName = storageName
        self.displayName = displayName
        self.pageCount = pageCount
        self.byteCount = byteCount
        self.versionLabel = versionLabel
        self.exportedAt = Date()
    }

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: Int64(byteCount), countStyle: .file)
    }
}
