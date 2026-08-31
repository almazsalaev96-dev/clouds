import Foundation
import AVFoundation

/// Plays streamed tutor speech.
///
/// ## Why the audio is buffered to a file rather than fed to an audio queue
///
/// MP3 from the provider arrives as a byte stream, and the frames only become
/// decodable in groups. Writing to a temporary file and letting `AVPlayer` play
/// it as it grows gets correct seeking, correct rate control, and interruption
/// handling for free — all of which a hand-rolled `AVAudioEngine` path would
/// have to reimplement badly. The cost is a few hundred milliseconds before the
/// first sound, which is why playback starts as soon as enough has arrived
/// rather than waiting for the stream to finish.
@MainActor
@Observable
final class VoicePlayer {

    private(set) var state: VoicePlaybackState = .idle
    /// The text currently being read, so the panel can highlight the message.
    private(set) var speakingMessageID: UUID?

    private let provider: VoiceProvider
    private let settings: AppSettings
    private var player: AVPlayer?
    private var streamTask: Task<Void, Never>?
    private var currentFile: URL?
    private var endObserver: NSObjectProtocol?

    /// Bytes before playback starts. Enough to have decodable frames; small
    /// enough not to add a noticeable wait.
    private let startThreshold = 24 * 1024

    init(provider: VoiceProvider, settings: AppSettings) {
        self.provider = provider
        self.settings = settings
    }

    func speak(_ text: String, messageID: UUID) {
        guard settings.voiceEnabled, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        stop()

        state = .preparing
        speakingMessageID = messageID

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("tutor-\(messageID.uuidString).mp3")
        currentFile = url
        FileManager.default.createFile(atPath: url.path, contents: nil)

        streamTask = Task { [weak self] in
            guard let self else { return }
            guard let handle = try? FileHandle(forWritingTo: url) else {
                self.state = .failed(.voiceUnavailable)
                return
            }
            defer { try? handle.close() }

            var written = 0
            var started = false

            do {
                try self.activateSession()
                for try await chunk in provider.speech(for: text, speed: settings.voiceSpeed) {
                    if Task.isCancelled { break }
                    try handle.write(contentsOf: chunk)
                    written += chunk.count

                    if !started, written >= self.startThreshold {
                        started = true
                        self.beginPlayback(of: url)
                    }
                }
                // A short reply may never reach the threshold.
                if !started, written > 0 {
                    self.beginPlayback(of: url)
                }
                if written == 0 {
                    self.state = .failed(.voiceUnavailable)
                }
            } catch is CancellationError {
                // stop() already tidied up.
            } catch let error as StudyDeskError {
                self.state = .failed(error)
            } catch {
                Log.voice.error("Voice playback failed: \(error.localizedDescription, privacy: .public)")
                self.state = .failed(.voiceUnavailable)
            }
        }
    }

    private func beginPlayback(of url: URL) {
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        // Speed is applied here as well as at synthesis: the provider changes
        // delivery, this changes playback, and together they cover the range a
        // student actually wants without making the voice sound synthetic.
        player.rate = Float(settings.voiceSpeed)
        player.play()
        self.player = player
        state = .playing

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.finish() }
        }
    }

    func pause() {
        player?.pause()
        if state == .playing { state = .paused }
    }

    func resume() {
        guard state == .paused else { return }
        player?.rate = Float(settings.voiceSpeed)
        state = .playing
    }

    func replay() {
        guard let player else { return }
        player.seek(to: .zero)
        player.rate = Float(settings.voiceSpeed)
        state = .playing
    }

    func stop() {
        streamTask?.cancel()
        streamTask = nil
        player?.pause()
        player = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        cleanUpFile()
        state = .idle
        speakingMessageID = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func finish() {
        state = .idle
        speakingMessageID = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func cleanUpFile() {
        if let currentFile { try? FileManager.default.removeItem(at: currentFile) }
        currentFile = nil
    }

    /// `.playback` with `.duckOthers`: a student listening to music while they
    /// work should hear the tutor over it, not instead of it.
    private func activateSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
    }
}
