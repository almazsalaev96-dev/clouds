import Foundation

/// A minimal server-sent events parser.
///
/// Written rather than pulled in as a dependency because the whole grammar the
/// proxy uses is three field names, and a streaming transport is not somewhere
/// to inherit someone else's edge cases.
///
/// Handles what the spec requires and the proxy emits:
/// - `event:` names the event, `data:` carries the payload
/// - multiple `data:` lines in one event are joined with newlines
/// - a blank line dispatches the event
/// - lines starting with `:` are comments (used as keep-alives)
enum SSEParser {

    struct Event {
        var name: String
        var data: String

        func decode<T: Decodable>(_ type: T.Type) -> T? {
            guard let payload = data.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(type, from: payload)
        }
    }

    /// Turns a stream of lines into a stream of events.
    static func events<Lines: AsyncSequence>(from lines: Lines) -> AsyncThrowingStream<Event, Error>
    where Lines.Element == String {
        AsyncThrowingStream { continuation in
            let task = Task {
                var name = "message"
                var dataLines: [String] = []

                func dispatch() {
                    guard !dataLines.isEmpty else {
                        name = "message"
                        return
                    }
                    continuation.yield(Event(name: name, data: dataLines.joined(separator: "\n")))
                    name = "message"
                    dataLines.removeAll()
                }

                do {
                    for try await line in lines {
                        if Task.isCancelled { break }

                        if line.isEmpty {
                            dispatch()
                        } else if line.hasPrefix(":") {
                            continue // keep-alive comment
                        } else if let separator = line.firstIndex(of: ":") {
                            let field = String(line[line.startIndex..<separator])
                            var value = String(line[line.index(after: separator)...])
                            // "Optional single leading space after the colon."
                            if value.hasPrefix(" ") { value.removeFirst() }
                            switch field {
                            case "event": name = value
                            case "data": dataLines.append(value)
                            default: break // id, retry — unused
                            }
                        }
                    }
                    dispatch() // a stream that ends without a trailing blank line
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
