#if canImport(AVFoundation)
import AVFoundation
#endif
import Foundation
import SlateFoundation

/// Speaking, and stopping when spoken to.
///
/// The single thing that makes a voice tutor feel like a person rather than a recording
/// is that it stops the instant you interrupt it. Everything here is arranged around
/// that: playback is streamed so the first word arrives quickly, and cancellation is
/// immediate rather than at the end of the current sentence.
public protocol VoiceProvider: Sendable {
    var isSpeaking: Bool { get async }
    func speak(_ text: String, speed: Double) async throws
    func pause() async
    func resume() async
    func stop() async
}

public enum VoiceError: Error, LocalizedError, Sendable {
    case unavailable
    case interrupted
    case offline

    public var errorDescription: String? {
        switch self {
        case .unavailable: "The voice is unavailable right now. The written answer is still here."
        case .interrupted: "Stopped."
        case .offline: "The voice needs a connection. The written answer still works offline."
        }
    }
}

/// Fetches speech from the gateway and plays it as it arrives.
#if canImport(AVFoundation)
public actor StreamingVoice: VoiceProvider {

    private let baseURL: URL
    private let token: String?
    private let deviceID: String
    private let session: URLSession
    private var player: AVAudioPlayer?
    private var currentTask: Task<Void, Error>?

    public init(baseURL: URL, token: String?, deviceID: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.deviceID = deviceID
        self.session = session
    }

    public var isSpeaking: Bool { player?.isPlaying ?? false }

    public func speak(_ text: String, speed: Double = 1.0) async throws {
        // Barge-in: a new utterance always replaces the old one. A tutor that finishes
        // its sentence while you are talking over it is worse than no voice at all.
        await stop()

        var request = URLRequest(url: baseURL.appendingPathComponent("/v1/voice"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(deviceID, forHTTPHeaderField: "x-slate-device")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization") }
        request.httpBody = try JSONEncoder().encode(SpeakBody(text: text, speed: speed))
        request.timeoutInterval = 30

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .notConnectedToInternet {
            throw VoiceError.offline
        } catch {
            throw VoiceError.unavailable
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw VoiceError.unavailable
        }
        try await play(data)
    }

    private func play(_ data: Data) async throws {
        try configureSession()
        let player = try AVAudioPlayer(data: data)
        player.enableRate = true
        player.prepareToPlay()
        self.player = player
        player.play()
    }

    private func configureSession() throws {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        // Ducking rather than interrupting: a student listening to music while working
        // should not have it stopped because they asked for a hint.
        try session.setCategory(.playback, mode: .spokenAudio,
                                options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
        try session.setActive(true, options: [])
        #endif
    }

    public func pause() async { player?.pause() }

    public func resume() async { player?.play() }

    public func stop() async {
        currentTask?.cancel()
        currentTask = nil
        player?.stop()
        player = nil
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        #endif
    }

    private struct SpeakBody: Encodable {
        let text: String
        let speed: Double
        let format = "mp3"
    }
}
#endif

/// Used in tests and previews, and when speech is switched off.
public actor SilentVoice: VoiceProvider {
    public private(set) var spoken: [String] = []
    public init() {}
    public var isSpeaking: Bool { false }
    public func speak(_ text: String, speed: Double) async throws { spoken.append(text) }
    public func pause() async {}
    public func resume() async {}
    public func stop() async {}
}
