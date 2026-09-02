#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateDocuments
import SlateFoundation
import SlateLearning
import SlateModel

/// State for the Desk.
///
/// Everything shown here is derived from the event log by `LearningEngine.project`, so
/// the recommendation on screen and the reason printed under it come from the same
/// computation. There is no separate "what to suggest" heuristic that could drift from
/// what the model actually believes.
@MainActor
public final class DeskModel: ObservableObject {

    public struct ContinueItem: Identifiable, Hashable {
        public let id: DocumentID
        public let title: String
        public let detail: String
        public let progress: (done: Int, total: Int)?

        public static func == (a: ContinueItem, b: ContinueItem) -> Bool { a.id == b.id }
        public func hash(into hasher: inout Hasher) { hasher.combine(id) }
    }

    public struct AssignmentItem: Identifiable, Hashable {
        public let id: AssignmentID
        public let title: String
        public let dueAt: Date?
        public let remaining: Int
        public let isUrgent: Bool
        public let dueDescription: String
    }

    @Published public private(set) var greeting: String = ""
    @Published public private(set) var subtitle: String?
    @Published public private(set) var nextAction: NextAction.Recommendation?
    @Published public private(set) var continueItems: [ContinueItem] = []
    @Published public private(set) var dueSoon: [AssignmentItem] = []
    @Published public private(set) var recentPattern: [Misconceptions.Pattern] = []
    @Published public private(set) var isLoading = false

    public var isEmpty: Bool {
        continueItems.isEmpty && dueSoon.isEmpty && nextAction == nil && !isLoading
    }

    private let store: DocumentStore
    private let events: EventStore
    private let clock: Clock
    private var concepts: [Concept]
    private var dismissed: Set<String> = []

    public var onOpenDocument: ((DocumentID) -> Void)?
    public var onOpenAssignment: ((AssignmentID) -> Void)?
    public var onStartAction: ((NextAction.Recommendation) -> Void)?
    public var onImport: (() -> Void)?

    public init(store: DocumentStore, events: EventStore, concepts: [Concept],
                clock: Clock = SystemClock()) {
        self.store = store
        self.events = events
        self.concepts = concepts
        self.clock = clock
    }

    public func refresh() async {
        isLoading = true
        defer { isLoading = false }

        let now = clock.now
        greeting = Self.greeting(at: now)

        let documents = (try? store.allDocuments()) ?? []
        continueItems = documents.prefix(3).map { meta in
            ContinueItem(
                id: meta.id,
                title: meta.title,
                detail: meta.subject.isEmpty
                    ? "Page \(meta.lastPage + 1) of \(meta.pageCount)"
                    : "\(meta.subject) · page \(meta.lastPage + 1) of \(meta.pageCount)",
                progress: nil
            )
        }

        let attempts = (try? events.liveAttempts()) ?? []
        let assignments = assignmentSnapshots(now: now)

        let projection = LearningEngine.project(
            attempts: attempts,
            concepts: concepts,
            assignments: assignments,
            context: .init(now: now,
                           availableMinutes: 30,
                           minutesWorkedContinuously: minutesWorkedToday(now: now))
        )

        nextAction = projection.recommendations.first { !dismissed.contains($0.id) }
        recentPattern = Array(projection.patterns.prefix(2))
        dueSoon = assignments
            .filter { $0.remaining > 0 }
            .sorted { ($0.dueAt ?? .distantFuture) < ($1.dueAt ?? .distantFuture) }
            .prefix(3)
            .map { snapshot in
                AssignmentItem(
                    id: snapshot.id,
                    title: snapshot.title,
                    dueAt: snapshot.dueAt,
                    remaining: snapshot.remaining,
                    isUrgent: Self.isUrgent(snapshot.dueAt, now: now),
                    dueDescription: Self.describeDue(snapshot.dueAt, now: now)
                )
            }

        subtitle = Self.subtitle(nextAction: nextAction, dueSoon: dueSoon)
    }

    // MARK: - Actions

    public func open(_ item: ContinueItem) { onOpenDocument?(item.id) }
    public func openAssignment(_ item: AssignmentItem) { onOpenAssignment?(item.id) }
    public func importDocument() { onImport?() }
    public func start(_ recommendation: NextAction.Recommendation) { onStartAction?(recommendation) }

    /// Dismissal is honoured for this session only, and never argued with. The system
    /// advises; the student decides.
    public func dismiss(_ recommendation: NextAction.Recommendation) {
        dismissed.insert(recommendation.id)
        Task { await refresh() }
    }

    public func practise(_ pattern: Misconceptions.Pattern) {
        guard let concept = pattern.conceptIDs.first else { return }
        onStartAction?(NextAction.Recommendation(
            kind: .fixWeakness,
            title: "Practise: \(concept.rawValue)",
            reason: pattern.headline,
            minutes: 6, value: 0, score: 0,
            conceptIDs: [concept], assignmentID: nil
        ))
    }

    // MARK: - Wording

    /// Time of day only. No name, no exclamation mark, and nothing that pretends to
    /// know how the student is feeling.
    static func greeting(at date: Date) -> String {
        switch Calendar.current.component(.hour, from: date) {
        case 5..<12: "Good morning"
        case 12..<18: "Good afternoon"
        case 18..<22: "Good evening"
        default: "Still up"
        }
    }

    static func subtitle(nextAction: NextAction.Recommendation?,
                         dueSoon: [AssignmentItem]) -> String? {
        if let urgent = dueSoon.first(where: \.isUrgent) {
            return "\(urgent.title) is \(urgent.dueDescription.lowercased()), with \(urgent.remaining) questions left."
        }
        if nextAction?.kind == .rest { return nil }
        return nil
    }

    static func isUrgent(_ due: Date?, now: Date) -> Bool {
        guard let due else { return false }
        return due.timeIntervalSince(now) < 36 * 3600
    }

    /// "Tomorrow", not "in 19 hours". Nobody plans their evening in hours.
    static func describeDue(_ due: Date?, now: Date) -> String {
        guard let due else { return "No due date" }
        let calendar = Calendar.current
        if due < now { return "Overdue" }
        if calendar.isDateInToday(due) { return "Due today" }
        if calendar.isDateInTomorrow(due) { return "Due tomorrow" }
        let days = calendar.dateComponents([.day], from: now, to: due).day ?? 0
        if days <= 7 {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return "Due \(formatter.string(from: due))"
        }
        return "Due in \(days) days"
    }

    // MARK: - Sources

    /// Assignments come from the documents that belong to one, so a student never has
    /// to enter an assignment twice.
    private func assignmentSnapshots(now: Date) -> [NextAction.AssignmentSnapshot] {
        let documents = (try? store.allDocuments()) ?? []
        return documents.compactMap { meta -> NextAction.AssignmentSnapshot? in
            guard let assignmentID = meta.assignmentID else { return nil }
            let map = (try? loadQuestionMap(meta.id)) ?? QuestionMap()
            let progress = map.progress
            return NextAction.AssignmentSnapshot(
                id: assignmentID,
                title: meta.title,
                subject: meta.subject,
                dueAt: nil,
                questionsTotal: max(progress.total, 1),
                questionsDone: progress.done,
                conceptIDs: map.questions.flatMap(\.conceptIDs)
            )
        }
    }

    private func loadQuestionMap(_ id: DocumentID) throws -> QuestionMap {
        let url = store.paths(for: id).questions
        guard let data = try? Data(contentsOf: url) else { return QuestionMap() }
        return try JSONDecoder().decode(QuestionMap.self, from: data)
    }

    /// Continuous working time, for the fatigue term. Derived from session events, not
    /// from how long the app has been open — a backgrounded app is not studying.
    private func minutesWorkedToday(now: Date) -> Double {
        guard let recent = try? events.events(since: now.addingTimeInterval(-6 * 3600)) else {
            return 0
        }
        var lastStart: Date?
        var minutes = 0.0
        for event in recent.sorted(by: { $0.at < $1.at }) {
            switch event {
            case .sessionStarted(_, let at, _):
                lastStart = at
            case .sessionEnded(_, _, _, let activeSeconds):
                minutes += activeSeconds / 60
                lastStart = nil
            default:
                break
            }
        }
        if let lastStart { minutes += now.timeIntervalSince(lastStart) / 60 }
        return minutes
    }
}
#endif
