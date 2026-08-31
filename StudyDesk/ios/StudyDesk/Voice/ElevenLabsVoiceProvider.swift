import Foundation

/// ElevenLabs speech, via the Study Desk proxy.
///
/// The ElevenLabs key lives on the server, exactly like the model key. The app
/// posts text and receives audio bytes; it never sees a credential and cannot
/// leak one. The voice id and model are chosen server-side too, so the tutor's
/// voice can be changed without an App Store release.
struct ElevenLabsVoiceProvider: VoiceProvider {

    private let client: BackendClient

    init(client: BackendClient) {
        self.client = client
    }

    var isAvailable: Bool {
        get async {
            (try? await client.get("healthz")) != nil
        }
    }

    func speech(for text: String, speed: Double) -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // Reading a whole page aloud is neither useful nor cheap.
                    // Explanations that run long are cut at a sentence
                    // boundary, and the student still has the full text.
                    let body = Body(text: Self.trim(text), speed: speed)
                    let (bytes, _) = try await client.stream("v1/voice/speak", body: body, accept: "audio/mpeg")

                    // Hand the player reasonably sized chunks: too small and
                    // the audio queue thrashes, too large and the first sound
                    // is late.
                    var buffer = Data()
                    buffer.reserveCapacity(Self.chunkSize)
                    for try await byte in bytes {
                        buffer.append(byte)
                        if buffer.count >= Self.chunkSize {
                            continuation.yield(buffer)
                            buffer.removeAll(keepingCapacity: true)
                        }
                    }
                    if !buffer.isEmpty { continuation.yield(buffer) }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch let failure as BackendClient.Failure {
                    continuation.finish(throwing: failure == .offline ? StudyDeskError.offline : StudyDeskError.voiceUnavailable)
                } catch {
                    Log.voice.error("Speech stream failed: \(error.localizedDescription, privacy: .public)")
                    continuation.finish(throwing: StudyDeskError.voiceUnavailable)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static let chunkSize = 16 * 1024
    private static let characterLimit = 1800

    /// Cuts at the last sentence end before the limit, so speech never stops
    /// mid-word.
    static func trim(_ text: String) -> String {
        guard text.count > characterLimit else { return text }
        let clipped = String(text.prefix(characterLimit))
        if let lastStop = clipped.lastIndex(where: { ".!?".contains($0) }) {
            return String(clipped[...lastStop])
        }
        return clipped
    }

    private struct Body: Encodable {
        var text: String
        var speed: Double
    }
}
