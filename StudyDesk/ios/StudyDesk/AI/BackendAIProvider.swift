import Foundation

/// `AIProvider` backed by the Study Desk proxy.
///
/// The proxy owns the model choice, the system prompt and the teaching policy.
/// This type owns exactly one thing: turning a `StudyContext` into a request,
/// and a server-sent event stream back into `TutorStreamEvent`s.
struct BackendAIProvider: AIProvider {

    private let client: BackendClient

    init(client: BackendClient) {
        self.client = client
    }

    var isAvailable: Bool {
        get async {
            do {
                _ = try await client.get("healthz")
                return true
            } catch {
                return false
            }
        }
    }

    func streamReply(to context: StudyContext, attachments: [TutorAttachment]) -> AsyncThrowingStream<TutorStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let body = RequestBody(context: context, attachments: attachments.map(Attachment.init))
                    let (bytes, _) = try await client.stream("v1/tutor/message", body: body, accept: "text/event-stream")

                    for try await event in SSEParser.events(from: bytes.lines) {
                        if Task.isCancelled { break }
                        switch event.name {
                        case "delta":
                            if let text = event.decode(Delta.self)?.text, !text.isEmpty {
                                continuation.yield(.text(text))
                            }
                        case "verdict":
                            if let raw = event.decode(VerdictPayload.self)?.verdict,
                               let verdict = AnswerVerdict(rawValue: raw) {
                                continuation.yield(.verdict(verdict))
                            }
                        case "error":
                            let message = event.decode(ErrorPayload.self)?.message
                            throw StudyDeskError.tutorRefused(message ?? StudyDeskError.tutorUnavailable.localizedDescription)
                        case "done":
                            continuation.yield(.finished)
                            continuation.finish()
                            return
                        default:
                            continue
                        }
                    }
                    // A stream that ends without `done` still produced text;
                    // treat it as finished rather than losing the reply.
                    continuation.yield(.finished)
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch let failure as BackendClient.Failure {
                    continuation.finish(throwing: failure.studentFacing)
                } catch let error as StudyDeskError {
                    continuation.finish(throwing: error)
                } catch let error as URLError where error.code == .timedOut {
                    continuation.finish(throwing: StudyDeskError.tutorTimedOut)
                } catch {
                    Log.tutor.error("Stream failed: \(error.localizedDescription, privacy: .public)")
                    continuation.finish(throwing: StudyDeskError.tutorUnavailable)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: Wire types

    private struct RequestBody: Encodable {
        var context: StudyContext
        var attachments: [Attachment]
    }

    private struct Attachment: Encodable {
        var kind: String
        var mediaType: String
        var data: String
        var width: Int
        var height: Int

        init(_ attachment: TutorAttachment) {
            kind = attachment.kind.rawValue
            mediaType = "image/jpeg"
            data = attachment.jpeg.base64EncodedString()
            width = attachment.width
            height = attachment.height
        }
    }

    private struct Delta: Decodable { var text: String }
    private struct VerdictPayload: Decodable { var verdict: String }
    private struct ErrorPayload: Decodable { var message: String }
}
