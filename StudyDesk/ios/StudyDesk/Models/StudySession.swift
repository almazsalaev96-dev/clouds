import Foundation
import SwiftData

/// A stretch of studying. Recorded so the dashboard can answer "how much did I
/// actually work this week?" honestly.
///
/// Deliberately modest: no streaks, no badges, nothing designed to make a
/// student open the app when they don't need to.
@Model
final class StudySession {
    var id: UUID = UUID()
    var documentID: UUID?
    var documentTitle: String = ""
    var subjectName: String = Subject.unspecified.name
    var startedAt: Date = Date()
    var endedAt: Date?

    var pagesVisited: Int = 0
    var strokesAdded: Int = 0
    var tutorRequests: Int = 0
    /// Requests where the student took a hint rather than a full solution — the
    /// number worth being proud of.
    var hintsTaken: Int = 0

    init(document: StudyDocument?) {
        self.id = UUID()
        self.documentID = document?.id
        self.documentTitle = document?.title ?? ""
        self.subjectName = document?.subjectName ?? Subject.unspecified.name
        self.startedAt = Date()
    }

    var duration: TimeInterval {
        (endedAt ?? Date()).timeIntervalSince(startedAt)
    }
}

/// A topic the student has repeatedly needed help with.
///
/// This is the whole of "AI memory" in v1: a count of tutor requests per topic
/// per subject. It is deliberately not a profile of the student, it never leaves
/// the device, and Settings can erase it in one tap.
@Model
final class WeakTopic {
    var id: UUID = UUID()
    var topic: String = ""
    var subjectName: String = Subject.unspecified.name
    var requestCount: Int = 0
    var lastSeenAt: Date = Date()

    init(topic: String, subject: Subject) {
        self.id = UUID()
        self.topic = topic
        self.subjectName = subject.name
        self.requestCount = 1
    }
}
