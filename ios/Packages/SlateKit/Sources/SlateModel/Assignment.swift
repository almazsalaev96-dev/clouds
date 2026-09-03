import Foundation
import SlateFoundation

/// A piece of work with a deadline.
///
/// The reason this exists is not organisation for its own sake — it is that the
/// recommender's urgency term is meaningless without a due date, so until something
/// can carry one, "finish the physics worksheet" can never outrank "revise quadratics"
/// no matter how close Friday is.
public struct Assignment: Codable, Sendable, Hashable, Identifiable {

    /// Inferred from the work, and overridable.
    ///
    /// The inference is a convenience, never a verdict: a student who says they are
    /// done is done, whatever the question map counts.
    public enum Status: String, Codable, Sendable, CaseIterable {
        case notStarted, inProgress, almostDone, completed, submitted

        public var label: String {
            switch self {
            case .notStarted: "Not started"
            case .inProgress: "In progress"
            case .almostDone: "Almost done"
            case .completed: "Finished"
            case .submitted: "Sent"
            }
        }

        public var isDone: Bool { self == .completed || self == .submitted }
    }

    public let id: AssignmentID
    public var title: String
    public var subject: String
    public var teacher: String?
    public var dueAt: Date?
    public var documentIDs: [DocumentID]
    public var notes: String
    /// Set only when the student says so. Nil means "work it out from the pages".
    public var declaredStatus: Status?
    public var submissions: [SubmissionRecord]
    public let createdAt: Date

    public init(id: AssignmentID = .new(), title: String, subject: String = "",
                teacher: String? = nil, dueAt: Date? = nil,
                documentIDs: [DocumentID] = [], notes: String = "",
                declaredStatus: Status? = nil, submissions: [SubmissionRecord] = [],
                createdAt: Date) {
        self.id = id
        self.title = title
        self.subject = subject
        self.teacher = teacher
        self.dueAt = dueAt
        self.documentIDs = documentIDs
        self.notes = notes
        self.declaredStatus = declaredStatus
        self.submissions = submissions
        self.createdAt = createdAt
    }

    /// What was actually sent, and when.
    ///
    /// Kept so "what did I hand in?" is answerable months later without regenerating
    /// anything — the file it points at is the exact bytes that left the device.
    public struct SubmissionRecord: Codable, Sendable, Hashable, Identifiable {
        public let id: SubmissionID
        public let at: Date
        public let filename: String
        public let byteCount: Int
        public let pageCount: Int
        /// Where it went, when the share sheet told us. Often nil, and that is fine —
        /// claiming to know would be worse than admitting we do not.
        public let destination: String?
        public let fileURL: URL

        public init(id: SubmissionID = .new(), at: Date, filename: String,
                    byteCount: Int, pageCount: Int, destination: String? = nil,
                    fileURL: URL) {
            self.id = id; self.at = at; self.filename = filename
            self.byteCount = byteCount; self.pageCount = pageCount
            self.destination = destination; self.fileURL = fileURL
        }
    }

    /// The status to show: what the student said, or what the work suggests.
    public func status(questionsDone: Int, questionsTotal: Int) -> Status {
        if let declaredStatus { return declaredStatus }
        if !submissions.isEmpty { return .submitted }
        guard questionsTotal > 0 else { return documentIDs.isEmpty ? .notStarted : .inProgress }
        let fraction = Double(questionsDone) / Double(questionsTotal)
        if fraction <= 0 { return .notStarted }
        if fraction >= 1 { return .completed }
        return fraction >= 0.8 ? .almostDone : .inProgress
    }

    public var isOverdue: Bool {
        guard let dueAt, !(declaredStatus?.isDone ?? false), submissions.isEmpty else {
            return false
        }
        return dueAt < Date()
    }

    /// "Tomorrow", not "in 19 hours". Nobody plans their evening in hours.
    public func dueDescription(now: Date, calendar: Calendar = .current) -> String {
        guard let dueAt else { return "No due date" }
        if !submissions.isEmpty { return "Sent" }
        if dueAt < now { return "Overdue" }
        if calendar.isDateInToday(dueAt) { return "Due today" }
        if calendar.isDateInTomorrow(dueAt) { return "Due tomorrow" }
        let days = calendar.dateComponents([.day], from: now, to: dueAt).day ?? 0
        if days <= 7 {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return "Due \(formatter.string(from: dueAt))"
        }
        return "Due in \(days) days"
    }
}
