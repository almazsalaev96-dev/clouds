import Foundation
import SwiftData

/// What the app remembers about a student's difficulties.
///
/// The whole of it is: for each subject, which topics they've asked for help
/// with, and how often. That is enough to offer "you found completing the
/// square tricky last week — want a refresher?" and not enough to be a profile
/// of a child.
///
/// Three rules, enforced here rather than by policy:
/// - it never leaves the device except as a list of topic names, and only when
///   the student asks a question in that subject,
/// - it is off unless the student turns it on,
/// - `forgetEverything()` is one tap away in Settings and is immediate.
@MainActor
final class StudyMemory {

    private let context: ModelContext
    private let settings: AppSettings

    init(context: ModelContext, settings: AppSettings) {
        self.context = context
        self.settings = settings
    }

    /// Topics worth mentioning for a subject, most-needed first.
    func topics(for subject: Subject, limit: Int = 3) -> [String] {
        guard settings.remembersWeakTopics else { return [] }
        let name = subject.name
        let descriptor = FetchDescriptor<WeakTopic>(
            predicate: #Predicate { $0.subjectName == name && $0.requestCount >= 2 },
            sortBy: [SortDescriptor(\.requestCount, order: .reverse)]
        )
        guard let results = try? context.fetch(descriptor) else { return [] }
        return results.prefix(limit).map(\.topic)
    }

    /// Records that help was needed. Called with a short topic label the proxy
    /// returns alongside a reply — never with the student's own words, which
    /// could contain anything.
    func noteHelpRequested(topic: String, subject: Subject) {
        guard settings.remembersWeakTopics else { return }
        let cleaned = topic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleaned.count >= 3, cleaned.count <= 60 else { return }

        let name = subject.name
        let descriptor = FetchDescriptor<WeakTopic>(
            predicate: #Predicate { $0.subjectName == name && $0.topic == cleaned }
        )
        if let existing = try? context.fetch(descriptor).first {
            existing.requestCount += 1
            existing.lastSeenAt = Date()
        } else {
            context.insert(WeakTopic(topic: cleaned, subject: subject))
        }
        try? context.save()
    }

    /// Erases everything remembered. No confirmation delay, no soft delete.
    func forgetEverything() {
        try? context.delete(model: WeakTopic.self)
        try? context.save()
    }

    var storedTopicCount: Int {
        (try? context.fetchCount(FetchDescriptor<WeakTopic>())) ?? 0
    }
}
