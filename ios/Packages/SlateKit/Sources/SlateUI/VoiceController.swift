#if canImport(SwiftUI)
import Foundation
import SwiftUI
import SlateDesign
import SlateFoundation
import SlateVoice

/// Speaking, and stopping the instant it is interrupted.
///
/// The whole difference between a voice tutor and a recording is that you can talk over
/// it. Everything here serves that: one utterance at a time, a new one always replaces
/// the old, and tapping the control while it speaks stops rather than pauses — pausing
/// is what you want from a podcast, not from someone explaining a question you have
/// just understood.
@MainActor
public final class VoiceController: ObservableObject {

    public enum State: Equatable {
        case idle
        case fetching(String)
        case speaking(String)
        /// Speech is unavailable. The control hides rather than showing an error,
        /// because a written answer is already on screen and nothing has failed for
        /// the student.
        case unavailable
    }

    @Published public private(set) var state: State = .idle
    @Published public var speed: Double {
        didSet { defaults.set(speed, forKey: Self.speedKey) }
    }

    public static let speedOptions: [Double] = [0.8, 1.0, 1.2]
    private static let speedKey = "com.slate.voiceSpeed"

    private let provider: VoiceProvider
    private let defaults: UserDefaults
    private var current: Task<Void, Never>?

    public init(provider: VoiceProvider, defaults: UserDefaults = .standard) {
        self.provider = provider
        self.defaults = defaults
        let stored = defaults.double(forKey: Self.speedKey)
        speed = Self.speedOptions.contains(stored) ? stored : 1.0
    }

    public func isSpeaking(_ text: String) -> Bool {
        switch state {
        case .speaking(let spoken), .fetching(let spoken): spoken == text
        default: false
        }
    }

    /// One control, one behaviour: tap to hear it, tap again to stop.
    public func toggle(_ text: String) {
        if isSpeaking(text) {
            stop()
            return
        }
        speak(text)
    }

    public func speak(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        current?.cancel()
        state = .fetching(text)

        current = Task { [weak self] in
            guard let self else { return }
            do {
                // Barge-in lives in the provider: a new utterance always replaces the
                // one in flight, so a student who taps twice never hears two voices.
                try await self.provider.speak(trimmed, speed: self.speed)
                guard !Task.isCancelled else { return }
                await MainActor.run { self.state = .speaking(text) }
            } catch is CancellationError {
                return
            } catch {
                await MainActor.run {
                    // Silently, and once. Speech failing is not the student's problem
                    // to solve, and the words are already in front of them.
                    self.state = .unavailable
                }
            }
        }
    }

    public func stop() {
        current?.cancel()
        current = nil
        state = .idle
        Task { await provider.stop() }
    }

    /// Called when a screen goes away. Nothing should keep talking about a page the
    /// student has left.
    public func stopIfSpeaking() {
        if case .idle = state { return }
        stop()
    }
}

/// The listen control.
///
/// Quiet, small, and absent entirely when speech is unavailable — a permanently
/// disabled button is a promise the product keeps failing to keep.
public struct ListenButton: View {

    @ObservedObject var voice: VoiceController
    let text: String

    public init(voice: VoiceController, text: String) {
        self.voice = voice
        self.text = text
    }

    public var body: some View {
        if voice.state != .unavailable {
            Button { voice.toggle(text) } label: {
                HStack(spacing: Slate.Space.xs) {
                    if case .fetching(let pending) = voice.state, pending == text {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: voice.isSpeaking(text)
                            ? "stop.circle" : "speaker.wave.2")
                            .imageScale(.small)
                    }
                    Text(voice.isSpeaking(text) ? "Stop" : "Listen")
                }
                .font(Slate.Typography.footnote.weight(.medium))
                .slateTapTarget()
            }
            .buttonStyle(.plain)
            .foregroundStyle(Slate.Palette.tutor)
            .accessibilityLabel(voice.isSpeaking(text) ? "Stop reading" : "Read this aloud")
            .contextMenu {
                // Speed lives here rather than in Settings: the moment you want it is
                // the moment you are listening to something too fast.
                Picker("Speed", selection: $voice.speed) {
                    ForEach(VoiceController.speedOptions, id: \.self) { option in
                        Text(option == 1.0 ? "Normal" : "\(option, specifier: "%.1f")×")
                            .tag(option)
                    }
                }
            }
        }
    }
}

#endif
