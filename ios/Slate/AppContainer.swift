import Foundation
import SwiftUI
import SlateAI
import SlateDocuments
import SlateFoundation
import SlateModel
import SlateUI
import SlateVoice

/// Wiring, in one place.
///
/// Everything the app depends on is constructed here and injected downward, so a screen
/// never reaches for a singleton and a test can substitute any of it.
@MainActor
final class AppContainer: ObservableObject {

    let clock: Clock = SystemClock()
    let store: DocumentStore
    let events: EventStore
    let tutor: TutorService
    let voice: VoiceProvider
    let desk: DeskModel
    let library: LibraryModel
    let study: StudyModel
    let mistakes: MistakesModel

    init() {
        let documents = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Slate/Documents", isDirectory: true)

        // A store that cannot be created means the device is out of space or the
        // container is unwritable. Crashing here is honest: nothing below this line
        // could keep a student's work safe.
        store = try! DocumentStore(root: documents, clock: clock)
        events = FileEventStore(
            url: documents.deletingLastPathComponent().appendingPathComponent("events.jsonl")
        )

        let configuration = GatewayConfiguration.load()
        tutor = GatewayClient(
            baseURL: configuration.baseURL,
            token: configuration.token,
            deviceID: configuration.deviceID
        )
        voice = StreamingVoice(
            baseURL: configuration.baseURL,
            token: configuration.token,
            deviceID: configuration.deviceID
        )

        // The concept graph is empty until a document has been analysed; every engine
        // handles that by producing nothing rather than by guessing.
        let concepts: [Concept] = []
        desk = DeskModel(store: store, events: events, concepts: concepts, clock: clock)

        // Analysis is handed in as a closure so the library never learns what a
        // gateway is, and so a test can supply a map without a network.
        let analyser = DocumentAnalyser(service: tutor)
        let documentStore = store
        library = LibraryModel(store: store, tutorService: tutor) { meta in
            let paths = documentStore.paths(for: meta.id)
            let result = try await analyser.analyse(
                url: paths.original, filename: meta.title, pageCount: meta.pageCount
            )
            return result.map
        }
        study = StudyModel(events: events, concepts: concepts, clock: clock)
        mistakes = MistakesModel(events: events, concepts: concepts, clock: clock)
    }

    func start() async {
        await desk.refresh()
    }

    func flush() {
        // Nothing here should ever be the reason work is lost, so failures are
        // swallowed rather than allowed to take the app down on the way out.
        try? store.emptyTrash()
    }
}

/// Where the gateway is, and the token to present.
///
/// Read from the bundle's Info.plist so a build can be pointed at a local server
/// without a code change, and so no credential is ever compiled into a source file.
struct GatewayConfiguration {
    let baseURL: URL
    let token: String?
    let deviceID: String

    static func load(bundle: Bundle = .main,
                     defaults: UserDefaults = .standard) -> GatewayConfiguration {
        let urlString = bundle.object(forInfoDictionaryKey: "SlateGatewayURL") as? String
        let url = urlString.flatMap(URL.init(string:))
            ?? URL(string: "http://localhost:8787")!
        let token = bundle.object(forInfoDictionaryKey: "SlateGatewayToken") as? String

        // A stable per-install identifier, used only so the gateway can rate limit one
        // iPad without affecting another. Not a person, not an account, not synced.
        let key = "com.slate.deviceIdentifier"
        let deviceID: String
        if let existing = defaults.string(forKey: key) {
            deviceID = existing
        } else {
            deviceID = UUID().uuidString
            defaults.set(deviceID, forKey: key)
        }

        return GatewayConfiguration(
            baseURL: url,
            token: (token?.isEmpty ?? true) ? nil : token,
            deviceID: deviceID
        )
    }
}

/// A newline-delimited JSON event log on disk. Append-only, and cheap to append to.
final class FileEventStore: EventStore, @unchecked Sendable {
    private let url: URL
    private let lock = NSLock()
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(url: URL) {
        self.url = url
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        try? FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        if !FileManager.default.fileExists(atPath: url.path) {
            FileManager.default.createFile(atPath: url.path, contents: nil)
        }
    }

    func append(_ event: LearningEvent) throws { try append(contentsOf: [event]) }

    func append(contentsOf events: [LearningEvent]) throws {
        guard !events.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        var payload = Data()
        for event in events {
            payload.append(try encoder.encode(event))
            payload.append(0x0A)
        }
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: payload)
        try handle.synchronize()
    }

    func all() throws -> [LearningEvent] {
        lock.lock()
        defer { lock.unlock() }
        guard let data = try? Data(contentsOf: url) else { return [] }
        return data.split(separator: 0x0A)
            // A truncated final line after a crash is skipped rather than fatal: one
            // lost event must never make the whole history unreadable.
            .compactMap { try? decoder.decode(LearningEvent.self, from: Data($0)) }
    }

    func events(since date: Date) throws -> [LearningEvent] {
        try all().filter { $0.at >= date }
    }
}
