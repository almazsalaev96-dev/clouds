import Foundation
import SlateFoundation
import SlateModel

/// Highlights, boxes, text and typed answers.
///
/// Journalled exactly like the ink, for exactly the same reason: a student who spends
/// twenty minutes annotating a past paper has done twenty minutes of work, and losing
/// it to a force-quit is no more acceptable because it was not handwriting.
public final class AnnotationStore: @unchecked Sendable {

    public struct Snapshot: Codable, Sendable {
        public var annotations: [Annotation]
        public var typedAnswers: [String: String]
        public var savedAt: Date

        public init(annotations: [Annotation] = [], typedAnswers: [String: String] = [:],
                    savedAt: Date) {
            self.annotations = annotations
            self.typedAnswers = typedAnswers
            self.savedAt = savedAt
        }
    }

    public private(set) var annotations: [Annotation] = []
    public private(set) var typedAnswers: [QuestionID: String] = [:]
    public private(set) var recovery: Journal<LayerDelta>.RecoveryReport?

    private let journal: Journal<LayerDelta>
    private let clock: Clock
    private let lock = NSLock()

    public init(paths: DocumentPaths, clock: Clock = SystemClock()) throws {
        self.clock = clock
        journal = try Journal<LayerDelta>(
            logURL: paths.annotationsLog, snapshotURL: paths.annotations
        )
        try load()
    }

    private func load() throws {
        if let data = try journal.loadSnapshot() {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            if let snapshot = try? decoder.decode(Snapshot.self, from: data) {
                annotations = snapshot.annotations
                typedAnswers = Dictionary(uniqueKeysWithValues: snapshot.typedAnswers.map {
                    (QuestionID(rawValue: $0.key), $0.value)
                })
            }
        }
        let (deltas, report) = try journal.replay()
        for delta in deltas { apply(delta) }
        recovery = report.recoveredWork ? report : nil
        if report.recoveredWork { try saveSnapshot() }
    }

    /// Replay is the same function as live application, so a recovered session and a
    /// live one cannot diverge.
    private func apply(_ delta: LayerDelta) {
        switch delta {
        case .annotationAdded(let annotation):
            annotations.removeAll { $0.id == annotation.id }
            annotations.append(annotation)
        case .annotationRemoved(let id, _):
            annotations.removeAll { $0.id == id }
        case .typedAnswerSet(let questionID, let text, _):
            typedAnswers[questionID] = text
        case .typedAnswerCleared(let questionID, _):
            typedAnswers.removeValue(forKey: questionID)
        case .inkReplaced, .pageOrderChanged:
            break
        }
    }

    private func record(_ delta: LayerDelta) throws {
        lock.lock()
        apply(delta)
        lock.unlock()
        try journal.append(delta)
        if journal.needsSnapshot { try saveSnapshot() }
    }

    public func add(_ annotation: Annotation) throws {
        try record(.annotationAdded(annotation))
    }

    public func remove(_ id: String) throws {
        try record(.annotationRemoved(id: id, at: clock.now))
    }

    public func setTypedAnswer(_ text: String, for questionID: QuestionID) throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            try record(.typedAnswerCleared(questionID: questionID, at: clock.now))
        } else {
            try record(.typedAnswerSet(questionID: questionID, text: trimmed, at: clock.now))
        }
    }

    public func annotations(onPage page: Int) -> [Annotation] {
        lock.lock(); defer { lock.unlock() }
        return annotations.filter { $0.page == page }
    }

    /// Typed answers positioned for export, using each question's own answer region.
    ///
    /// A typed answer with nowhere to go is dropped rather than stamped at the origin:
    /// a teacher opening the PDF should not find an answer floating in the corner.
    public func placedTypedAnswers(using map: QuestionMap)
        -> [(rect: NormalisedRect, page: Int, text: String)] {
        lock.lock(); defer { lock.unlock() }
        return typedAnswers.compactMap { questionID, text in
            guard let question = map.question(id: questionID),
                  let region = question.answerRegion else { return nil }
            return (rect: region, page: question.page, text: text)
        }
    }

    public func saveSnapshot() throws {
        lock.lock()
        let snapshot = Snapshot(
            annotations: annotations,
            typedAnswers: Dictionary(uniqueKeysWithValues:
                typedAnswers.map { ($0.key.rawValue, $0.value) }),
            savedAt: clock.now
        )
        lock.unlock()

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try journal.writeSnapshot(try encoder.encode(snapshot))
    }

    public func flush() { try? saveSnapshot() }
}
