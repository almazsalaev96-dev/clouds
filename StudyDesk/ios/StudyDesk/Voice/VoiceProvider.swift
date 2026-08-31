import Foundation

/// What the app needs from any speech provider.
///
/// ElevenLabs is one implementation. Nothing above this protocol knows that —
/// the panel asks for speech and gets audio, and a future on-device voice would
/// slot in without touching a view.
protocol VoiceProvider: Sendable {
    /// Streams spoken audio for a passage of text.
    ///
    /// Streaming rather than a single file because a four-sentence explanation
    /// takes a couple of seconds to synthesise in full and a few hundred
    /// milliseconds to *start*. Waiting for the whole file makes the tutor feel
    /// slow in exactly the moment it should feel present.
    func speech(for text: String, speed: Double) -> AsyncThrowingStream<Data, Error>

    var isAvailable: Bool { get async }
}

/// Playback state, mirrored into the UI.
enum VoicePlaybackState: Equatable {
    case idle
    case preparing
    case playing
    case paused
    case failed(StudyDeskError)

    var isActive: Bool {
        switch self {
        case .preparing, .playing, .paused: true
        case .idle, .failed: false
        }
    }
}
