#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateDocuments
import SlateFoundation
import SlateLearning
import SlateModel

/// State for assignments, and the one place snapshots are built.
///
/// Everything that needs to reason about deadlines — the Desk's next action, the
/// recommender's urgency term — reads its snapshots from here, so there is exactly one
/// definition of "how much of this is left" rather than one per screen.
@MainActor
public final class AssignmentsModel: ObservableObject {

    public struct Group {
        public let title: String
        public let assignments: [Assignment]
    }

    @Published public private(set) var assignments: [Assignment] = []
    @Published public private(set) var documents: [DocumentMeta] = []
    @Published public private(set) var now: Date = .distantPast

    private let store: AssignmentStore
    private let documentStore: DocumentStore
    private let clock: Clock
    private var progressCache: [AssignmentID: (done: Int, total: Int)] = [:]

    public init(store: AssignmentStore, documentStore: DocumentStore,
                clock: Clock = SystemClock()) {
        self.store = store
        self.documentStore = documentStore
        self.clock = clock
        now = clock.now
    }

    public func refresh() {
        now = clock.now
        documents = (try? documentStore.allDocuments()) ?? []
        assignments = store.sorted(now: now)
        progressCache = [:]
        for assignment in assignments {
            progressCache[assignment.id] = countQuestions(assignment)
        }
    }

    public var groups: [Group] {
        let open = assignments.filter { $0.submissions.isEmpty && !($0.declaredStatus?.isDone ?? false) }
        let done = assignments.filter { !$0.submissions.isEmpty || ($0.declaredStatus?.isDone ?? false) }
        var out: [Group] = []
        let overdue = open.filter(\.isOverdue)
        let upcoming = open.filter { !$0.isOverdue }
        if !overdue.isEmpty { out.append(Group(title: "Overdue", assignments: overdue)) }
        if !upcoming.isEmpty { out.append(Group(title: "To do", assignments: upcoming)) }
        if !done.isEmpty { out.append(Group(title: "Done", assignments: done)) }
        return out
    }

    public var hasSubmissions: Bool { assignments.contains { !$0.submissions.isEmpty } }

    public var submissionHistory: [(assignment: Assignment, record: Assignment.SubmissionRecord)] {
        store.submissionHistory()
    }

    public func progress(for assignment: Assignment) -> (done: Int, total: Int) {
        progressCache[assignment.id] ?? (0, 0)
    }

    public func blank() -> Assignment {
        Assignment(title: "", createdAt: clock.now)
    }

    public func save(_ assignment: Assignment) {
        try? store.save(assignment)
        // Documents remember which assignment they belong to, so opening a page can
        // tell the student what it is for and when it is due.
        for document in documents {
            guard var meta = try? documentStore.meta(document.id) else { continue }
            let shouldBelong = assignment.documentIDs.contains(document.id)
            let alreadyBelongs = meta.assignmentID == assignment.id
            guard shouldBelong != alreadyBelongs else { continue }
            meta.assignmentID = shouldBelong ? assignment.id : nil
            try? documentStore.write(meta)
        }
        refresh()
    }

    public func delete(_ assignment: Assignment) {
        try? store.delete(assignment.id)
        for id in assignment.documentIDs {
            guard var meta = try? documentStore.meta(id), meta.assignmentID == assignment.id else {
                continue
            }
            meta.assignmentID = nil
            try? documentStore.write(meta)
        }
        refresh()
    }

    public func recordSubmission(_ record: Assignment.SubmissionRecord,
                                 for id: AssignmentID) {
        _ = try? store.recordSubmission(record, for: id)
        refresh()
    }

    /// The snapshots the recommender reasons about.
    ///
    /// This is the whole point of the assignment layer: without a real `dueAt` the
    /// urgency term is dead, and "finish the worksheet due tomorrow" can never outrank
    /// "revise quadratics" however close Friday is.
    public func snapshots() -> [NextAction.AssignmentSnapshot] {
        assignments.compactMap { assignment in
            guard assignment.submissions.isEmpty,
                  !(assignment.declaredStatus?.isDone ?? false) else { return nil }
            let counted = progressCache[assignment.id] ?? countQuestions(assignment)
            return NextAction.AssignmentSnapshot(
                id: assignment.id,
                title: assignment.title,
                subject: assignment.subject,
                dueAt: assignment.dueAt,
                // An assignment with no mapped questions still has work in it; one
                // question keeps it visible rather than reading as finished.
                questionsTotal: max(counted.total, 1),
                questionsDone: min(counted.done, max(counted.total, 1)),
                conceptIDs: conceptIDs(assignment)
            )
        }
    }

    private func countQuestions(_ assignment: Assignment) -> (done: Int, total: Int) {
        var done = 0
        var total = 0
        for id in assignment.documentIDs {
            let map = loadMap(id)
            let progress = map.progress
            done += progress.done
            total += progress.total
        }
        return (done, total)
    }

    private func conceptIDs(_ assignment: Assignment) -> [ConceptID] {
        Array(Set(assignment.documentIDs.flatMap { loadMap($0).questions.flatMap(\.conceptIDs) }))
            .sorted { $0.rawValue < $1.rawValue }
    }

    private func loadMap(_ id: DocumentID) -> QuestionMap {
        let url = documentStore.paths(for: id).questions
        guard let data = try? Data(contentsOf: url),
              let map = try? JSONDecoder().decode(QuestionMap.self, from: data) else {
            return QuestionMap()
        }
        return map
    }
}
#endif
