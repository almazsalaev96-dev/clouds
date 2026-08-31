import Foundation

/// What the app needs from *any* tutoring model.
///
/// Nothing above this protocol knows which model answers, or that a proxy
/// exists at all. Swapping providers means writing one new conformance and
/// changing one line in `AppEnvironment`.
protocol AIProvider: Sendable {

    /// Streams a tutor reply for a fully-formed study context.
    ///
    /// Streaming is not a nicety here: a student who has been staring at a
    /// question for two minutes should see words within a second, not a spinner
    /// for six. The stream yields text fragments in order.
    func streamReply(to context: StudyContext, attachments: [TutorAttachment]) -> AsyncThrowingStream<TutorStreamEvent, Error>

    /// Whether the provider currently believes it can answer. Used to grey out
    /// the tutor button rather than let a student ask into the void.
    var isAvailable: Bool { get async }
}

/// An image accompanying a request.
struct TutorAttachment: Sendable, Equatable {
    enum Kind: String, Sendable {
        /// The whole page as the student sees it, ink included.
        case page
        /// Just the region the student selected.
        case region
        /// A photo or screenshot the student added.
        case image
    }

    var kind: Kind
    var jpeg: Data
    /// Pixel size, so the proxy can reject anything absurd without decoding.
    var width: Int
    var height: Int
}

/// Events in a tutor reply stream.
enum TutorStreamEvent: Sendable, Equatable {
    /// A fragment of the reply. Concatenating these in order gives the message.
    case text(String)
    /// The model classified an answer check. Drives the coloured verdict chip
    /// so the student sees "Mostly correct" without reading three sentences
    /// first.
    case verdict(AnswerVerdict)
    /// The reply finished normally.
    case finished
}

/// The result of "check my work".
///
/// Four outcomes, never two. "Wrong" on its own teaches nothing, and a student
/// whose handwriting was misread deserves `unclear` rather than a red cross.
enum AnswerVerdict: String, Sendable, Codable, Equatable {
    case correct
    case mostlyCorrect
    case incorrect
    case unclear

    var title: String {
        switch self {
        case .correct: "Correct"
        case .mostlyCorrect: "Nearly there"
        case .incorrect: "Not yet"
        case .unclear: "Can't quite read it"
        }
    }

    var symbolName: String {
        switch self {
        case .correct: "checkmark.circle.fill"
        case .mostlyCorrect: "circle.lefthalf.filled"
        case .incorrect: "arrow.uturn.backward.circle.fill"
        case .unclear: "questionmark.circle.fill"
        }
    }
}
