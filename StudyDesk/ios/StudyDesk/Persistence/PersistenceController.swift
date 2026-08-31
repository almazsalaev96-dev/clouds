import Foundation
import SwiftData

/// Owns the SwiftData stack.
///
/// If the store fails to open — a corrupt file, a schema that can't migrate —
/// the app must still be usable. It falls back to an in-memory store and
/// surfaces a warning rather than crashing on launch with a student's work
/// inside. The original file is moved aside, never deleted, so it can be
/// recovered by support.
@MainActor
final class PersistenceController {
    let container: ModelContainer
    /// Non-nil when the on-disk store could not be opened.
    private(set) var recoveryWarning: String?

    static let schema = Schema([
        StudyDocument.self,
        PageAnnotation.self,
        Assignment.self,
        Submission.self,
        TutorConversation.self,
        TutorMessage.self,
        StudyNote.self,
        StudySession.self,
        WeakTopic.self
    ])

    init(inMemory: Bool = false) {
        let configuration = ModelConfiguration(
            schema: Self.schema,
            isStoredInMemoryOnly: inMemory
        )

        do {
            container = try ModelContainer(for: Self.schema, configurations: configuration)
        } catch {
            Log.persistence.error("Store failed to open: \(error.localizedDescription, privacy: .public)")
            Self.quarantineStore()
            do {
                container = try ModelContainer(for: Self.schema, configurations: configuration)
                recoveryWarning = "Your library needed repairing. Your PDFs and handwriting are safe on this iPad."
            } catch {
                let fallback = ModelConfiguration(schema: Self.schema, isStoredInMemoryOnly: true)
                // A container over an in-memory configuration with a valid
                // schema cannot fail; if it somehow does there is nothing left
                // to recover to.
                container = try! ModelContainer(for: Self.schema, configurations: fallback)
                recoveryWarning = "Study Desk couldn't open your library. Changes made now won't be kept — please reopen the app."
            }
        }
    }

    /// Moves a store that won't open out of the way instead of deleting it.
    private static func quarantineStore() {
        let fm = FileManager.default
        guard let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let quarantine = support.appendingPathComponent("Quarantine-\(stamp)", isDirectory: true)

        let storeNames = ["default.store", "default.store-shm", "default.store-wal"]
        var moved = false
        for name in storeNames {
            let source = support.appendingPathComponent(name)
            guard fm.fileExists(atPath: source.path) else { continue }
            if !moved {
                try? fm.createDirectory(at: quarantine, withIntermediateDirectories: true)
                moved = true
            }
            try? fm.moveItem(at: source, to: quarantine.appendingPathComponent(name))
        }
        if moved {
            Log.persistence.notice("Quarantined unreadable store at \(quarantine.lastPathComponent, privacy: .public)")
        }
    }
}
