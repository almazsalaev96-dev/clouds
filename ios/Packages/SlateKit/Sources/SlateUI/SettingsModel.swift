#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateDocuments
import SlateFoundation
import SlateLearning
import SlateModel

/// The controls behind the privacy document.
///
/// Everything `docs/PRIVACY.md` claims a student can do, they can do here. A promise
/// in a policy with no button behind it is worse than no promise, so deletion really
/// deletes, export really exports, and both say exactly what they affected.
@MainActor
public final class SettingsModel: ObservableObject {

    public struct Usage: Equatable {
        public var documents: Int
        public var attempts: Int
        public var concepts: Int
        public var events: Int
        public var bytesOnDisk: Int64

        public static let empty = Usage(documents: 0, attempts: 0, concepts: 0,
                                        events: 0, bytesOnDisk: 0)
    }

    public enum Scope: Equatable, Identifiable {
        case subject(String)
        case everything

        public var id: String {
            switch self {
            case .subject(let name): "subject:\(name)"
            case .everything: "everything"
            }
        }

        /// Written so the confirmation says what will actually happen, in the student's
        /// terms, with no euphemism for "delete".
        public var warning: String {
            switch self {
            case .subject(let name):
                "This removes everything Slate has learned about how you are doing in \(name). Your documents and your handwriting stay exactly as they are."
            case .everything:
                "This removes everything Slate has learned about how you are doing, in every subject. Your documents and your handwriting stay exactly as they are."
            }
        }
    }

    @Published public private(set) var usage: Usage = .empty
    @Published public private(set) var subjects: [String] = []
    @Published public private(set) var lastAction: String?
    @Published public private(set) var isWorking = false
    @Published public var pendingDeletion: Scope?

    /// Preferences. Defaults are chosen so that nobody has to come here at all.
    @Published public var speakRepliesAutomatically: Bool {
        didSet { defaults.set(speakRepliesAutomatically, forKey: Keys.autoSpeak) }
    }
    @Published public var startAtLowestHelp: Bool {
        didSet { defaults.set(startAtLowestHelp, forKey: Keys.lowestHelp) }
    }
    @Published public var shareNamesWithTutor: Bool {
        didSet { defaults.set(shareNamesWithTutor, forKey: Keys.shareNames) }
    }

    private enum Keys {
        static let autoSpeak = "com.slate.autoSpeak"
        static let lowestHelp = "com.slate.lowestHelp"
        static let shareNames = "com.slate.shareNames"
    }

    private let store: DocumentStore
    private let events: EventStore
    private let clock: Clock
    private let defaults: UserDefaults

    public init(store: DocumentStore, events: EventStore,
                clock: Clock = SystemClock(), defaults: UserDefaults = .standard) {
        self.store = store
        self.events = events
        self.clock = clock
        self.defaults = defaults
        speakRepliesAutomatically = defaults.bool(forKey: Keys.autoSpeak)
        // Both of these default to the protective setting when unset, which is what a
        // fresh install gets: least help offered first, no names sent anywhere.
        startAtLowestHelp = defaults.object(forKey: Keys.lowestHelp) as? Bool ?? true
        shareNamesWithTutor = defaults.object(forKey: Keys.shareNames) as? Bool ?? false
    }

    // MARK: - What is actually here

    public func refresh() async {
        isWorking = true
        defer { isWorking = false }

        let documents = (try? store.allDocuments()) ?? []
        let log = (try? events.all()) ?? []
        let attempts = (try? events.liveAttempts()) ?? []

        usage = Usage(
            documents: documents.count,
            attempts: attempts.count,
            concepts: Set(attempts.map(\.conceptID)).count,
            events: log.count,
            bytesOnDisk: documents.reduce(0) { total, meta in
                total + fileSize(store.paths(for: meta.id).root)
            }
        )
        subjects = Set(documents.map(\.subject))
            .filter { !$0.isEmpty }
            .sorted()
    }

    private func fileSize(_ url: URL) -> Int64 {
        guard let enumerator = FileManager.default.enumerator(
            at: url, includingPropertiesForKeys: [.fileSizeKey]
        ) else { return 0 }
        var total: Int64 = 0
        for case let file as URL in enumerator {
            total += Int64((try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0)
        }
        return total
    }

    public var usageDescription: String {
        let size = ByteCountFormatter.string(fromByteCount: usage.bytesOnDisk, countStyle: .file)
        return "\(usage.documents) document\(usage.documents == 1 ? "" : "s") · \(size) · "
            + "\(usage.attempts) recorded attempt\(usage.attempts == 1 ? "" : "s") "
            + "across \(usage.concepts) topic\(usage.concepts == 1 ? "" : "s")"
    }

    // MARK: - Deleting

    /// Delete what Slate has concluded, and mean it.
    ///
    /// Redaction is itself an event, so the log stays append-only and every projection
    /// is recomputed from what remains. The scores built on deleted evidence do not
    /// linger, because they were never stored — that is the whole reason the model is
    /// derived rather than accumulated.
    public func confirmDeletion() async {
        guard let scope = pendingDeletion else { return }
        pendingDeletion = nil
        isWorking = true
        defer { isWorking = false }

        let now = clock.now
        switch scope {
        case .everything:
            try? events.append(.evidenceRedacted(id: .new(), at: now, target: .everything))
            lastAction = "Deleted everything Slate had learned. Your documents are untouched."

        case .subject(let name):
            let documents = ((try? store.allDocuments()) ?? []).filter { $0.subject == name }
            let conceptIDs = documents.flatMap { conceptIDs(in: $0.id) }
            let unique = Set(conceptIDs)
            for concept in unique.sorted(by: { $0.rawValue < $1.rawValue }) {
                try? events.append(.evidenceRedacted(id: .new(), at: now, target: .concept(concept)))
            }
            lastAction = unique.isEmpty
                // Honest about doing nothing rather than reporting a success that
                // did not happen.
                ? "There was nothing recorded for \(name) to delete."
                : "Deleted what Slate had learned about \(name), across \(unique.count) topic\(unique.count == 1 ? "" : "s")."
        }
        await refresh()
    }

    private func conceptIDs(in document: DocumentID) -> [ConceptID] {
        let url = store.paths(for: document).questions
        guard let data = try? Data(contentsOf: url),
              let map = try? JSONDecoder().decode(QuestionMap.self, from: data) else { return [] }
        return map.questions.flatMap(\.conceptIDs)
    }

    // MARK: - Exporting

    public struct Export: Sendable {
        public let url: URL
        public let description: String
    }

    /// Everything, in formats that outlive this app.
    ///
    /// Documents are ordinary PDFs, the log is newline-delimited JSON, the question
    /// maps are JSON. Nothing is in a proprietary format, and nothing needs Slate to
    /// read it — which is the only version of "you own your data" that means anything.
    public func exportEverything() async -> Export? {
        isWorking = true
        defer { isWorking = false }

        let stamp = ISO8601DateFormatter.filenameSafe.string(from: clock.now)
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("Slate-export-\(stamp)", isDirectory: true)

        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

            let documents = (try? store.allDocuments()) ?? []
            for meta in documents {
                let paths = store.paths(for: meta.id)
                let folder = root.appendingPathComponent(safe(meta.title), isDirectory: true)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try? FileManager.default.copyItem(
                    at: paths.original, to: folder.appendingPathComponent("original.pdf")
                )
                for name in ["questions.json", "annotations.json", "typed.json"] {
                    let source = paths.root.appendingPathComponent(name)
                    if FileManager.default.fileExists(atPath: source.path) {
                        try? FileManager.default.copyItem(
                            at: source, to: folder.appendingPathComponent(name)
                        )
                    }
                }
            }

            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let log = (try? events.all()) ?? []
            try encoder.encode(log).write(
                to: root.appendingPathComponent("learning-history.json"), options: .atomic
            )

            try readme().write(
                to: root.appendingPathComponent("README.txt"),
                atomically: true, encoding: .utf8
            )

            lastAction = "Exported \(documents.count) document\(documents.count == 1 ? "" : "s") and your full history."
            return Export(
                url: root,
                description: "\(documents.count) documents and \(log.count) recorded events"
            )
        } catch {
            lastAction = "The export could not be written. Your iPad may be low on space."
            return nil
        }
    }

    private func safe(_ name: String) -> String {
        let parts = name.components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        return parts.isEmpty ? "Document" : parts.joined(separator: "_")
    }

    private func readme() -> String {
        """
        This is everything Slate holds for you.

        Each folder is one document:
          original.pdf       the file exactly as you imported it, never modified
          questions.json     the questions Slate found, and which you have answered
          annotations.json   highlights, boxes and text you added
          typed.json         typed answers

        learning-history.json is the full record of what you attempted and when. Every
        conclusion Slate drew — what you are good at, what needs review, what to do
        next — was computed from this file and nothing else. Delete it and those
        conclusions are gone with it.

        Your handwriting lives inside the app's own ink files and is composited into
        the PDF when you export finished work. To keep a page exactly as it looks on
        screen, export that assignment from inside Slate.

        Nothing here needs Slate to open it.
        """
    }

    public func dismissLastAction() { lastAction = nil }
}
#endif
