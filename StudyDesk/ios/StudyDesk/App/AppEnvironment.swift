import SwiftUI
import SwiftData

/// Wires the app together.
///
/// Every service is created once, here, and handed down through the SwiftUI
/// environment. Views never construct a provider, open the store, or reach for
/// a singleton — which is what makes it possible to swap the AI or voice
/// provider by editing this file alone.
@MainActor
@Observable
final class AppEnvironment {

    let persistence: PersistenceController
    let store: DocumentStore
    let settings: AppSettings
    let toolState: PencilToolState

    let handwriting = HandwritingRecognizer()
    let memory: StudyMemory
    let analytics: StudyAnalytics

    /// Nil when no backend is configured. Everything offline still works; the
    /// tutor button explains itself instead of failing on tap.
    let aiProvider: AIProvider?
    let voiceProvider: VoiceProvider?
    let voicePlayer: VoicePlayer?

    /// Surfaced on the desk when the store had to be repaired on launch.
    private(set) var launchWarning: String?

    var modelContext: ModelContext { persistence.container.mainContext }

    init(inMemory: Bool = false) {
        persistence = PersistenceController(inMemory: inMemory)
        store = DocumentStore()
        settings = AppSettings()
        toolState = PencilToolState()
        launchWarning = persistence.recoveryWarning

        let context = persistence.container.mainContext
        memory = StudyMemory(context: context, settings: settings)
        analytics = StudyAnalytics(context: context, memory: memory)

        if let configuration = BackendClient.configurationFromBundle() {
            let client = BackendClient(configuration: configuration)
            let ai = BackendAIProvider(client: client)
            let voice = ElevenLabsVoiceProvider(client: client)
            aiProvider = ai
            voiceProvider = voice
            voicePlayer = VoicePlayer(provider: voice, settings: settings)
        } else {
            aiProvider = nil
            voiceProvider = nil
            voicePlayer = nil
        }

        // Share-sheet scratch files from a previous run are never wanted.
        store.purgeExports()
        purgeExpiredTrash()
    }

    func importer() -> DocumentImporter {
        DocumentImporter(store: store, context: modelContext, settings: settings)
    }

    func contextEngine(repository: DrawingRepository?) -> ContextEngine {
        ContextEngine(handwriting: handwriting, repository: repository, memory: memory)
    }

    func dismissLaunchWarning() {
        launchWarning = nil
    }

    /// Recently Deleted holds work for 30 days, then lets it go. Documents are
    /// removed with their file, so the disk doesn't quietly fill with
    /// worksheets a student threw away last term.
    private func purgeExpiredTrash() {
        let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        let descriptor = FetchDescriptor<StudyDocument>(
            predicate: #Predicate { $0.deletedAt != nil }
        )
        guard let expired = try? modelContext.fetch(descriptor) else { return }
        var removed = 0
        for document in expired {
            guard let deletedAt = document.deletedAt, deletedAt < cutoff else { continue }
            store.delete(document.storageName, in: .originals)
            modelContext.delete(document)
            removed += 1
        }
        if removed > 0 {
            try? modelContext.save()
            Log.persistence.notice("Purged \(removed) expired documents from Recently Deleted")
        }
    }
}

// Views reach this with `@Environment(AppEnvironment.self)`, which `@Observable`
// supports directly. No `EnvironmentKey` — a key would need a default value,
// and a default `AppEnvironment` means a second database opening itself behind
// the app's back.
