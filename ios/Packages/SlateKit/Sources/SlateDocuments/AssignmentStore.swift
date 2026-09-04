import Foundation
import SlateFoundation
import SlateModel

/// Where assignments live.
///
/// One file, atomic writes, same shape as `NoteStore`. Small enough that anything
/// cleverer would be a database bought before it was needed.
public final class AssignmentStore: @unchecked Sendable {

    private let url: URL
    private let clock: Clock
    private let lock = NSLock()
    private var cache: [Assignment]?

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    /// A store nothing can be written to, so a failure to create the real one is a
    /// message rather than a crash.
    public static let unavailable = AssignmentStore(
        unavailableAt: URL(fileURLWithPath: "/dev/null/assignments")
    )

    private init(unavailableAt url: URL) {
        self.url = url
        self.clock = SystemClock()
    }

    public init(url: URL, clock: Clock = SystemClock()) throws {
        self.url = url
        self.clock = clock
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
    }

    public func all() -> [Assignment] {
        lock.lock(); defer { lock.unlock() }
        if let cache { return cache }
        let loaded = (try? Data(contentsOf: url))
            .flatMap { try? decoder.decode([Assignment].self, from: $0) } ?? []
        cache = loaded
        return loaded
    }

    /// Overdue first, then soonest, then everything without a date.
    ///
    /// A list sorted by creation date makes a student scroll to find what is urgent,
    /// which is the one thing this screen exists to prevent.
    public func sorted(now: Date = Date()) -> [Assignment] {
        all().sorted { a, b in
            let aDone = !a.submissions.isEmpty || (a.declaredStatus?.isDone ?? false)
            let bDone = !b.submissions.isEmpty || (b.declaredStatus?.isDone ?? false)
            if aDone != bDone { return !aDone }
            switch (a.dueAt, b.dueAt) {
            case let (x?, y?): return x < y
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return a.createdAt > b.createdAt
            }
        }
    }

    public func assignment(_ id: AssignmentID) -> Assignment? {
        all().first { $0.id == id }
    }

    public func assignment(forDocument document: DocumentID) -> Assignment? {
        all().first { $0.documentIDs.contains(document) }
    }

    @discardableResult
    public func save(_ assignment: Assignment) throws -> Assignment {
        try mutate { assignments in
            if let index = assignments.firstIndex(where: { $0.id == assignment.id }) {
                assignments[index] = assignment
            } else {
                assignments.append(assignment)
            }
        }
        return assignment
    }

    public func delete(_ id: AssignmentID) throws {
        try mutate { $0.removeAll { $0.id == id } }
    }

    /// Record what was actually sent. Append-only: a resubmission adds a record rather
    /// than replacing one, because both were real and the teacher may have either.
    @discardableResult
    public func recordSubmission(_ record: Assignment.SubmissionRecord,
                                 for id: AssignmentID) throws -> Assignment? {
        var result: Assignment?
        try mutate { assignments in
            guard let index = assignments.firstIndex(where: { $0.id == id }) else { return }
            assignments[index].submissions.append(record)
            assignments[index].declaredStatus = .submitted
            result = assignments[index]
        }
        return result
    }

    /// Every submission ever made, newest first, with the assignment it belonged to.
    public func submissionHistory() -> [(assignment: Assignment, record: Assignment.SubmissionRecord)] {
        all()
            .flatMap { assignment in assignment.submissions.map { (assignment, $0) } }
            .sorted { $0.1.at > $1.1.at }
    }

    private func mutate(_ change: (inout [Assignment]) -> Void) throws {
        lock.lock(); defer { lock.unlock() }
        var assignments = cache ?? ((try? Data(contentsOf: url))
            .flatMap { try? decoder.decode([Assignment].self, from: $0) } ?? [])
        change(&assignments)
        try encoder.encode(assignments).write(to: url, options: .atomic)
        cache = assignments
    }
}
