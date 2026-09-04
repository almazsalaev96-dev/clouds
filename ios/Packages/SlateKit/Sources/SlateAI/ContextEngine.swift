import Foundation
import SlateDocuments
import SlateFoundation
import SlateModel

/// Assembling the smallest set of facts that still makes the question answerable.
///
/// The tutor is useless if the student has to explain what "this" refers to, and
/// unaffordable if every question ships the whole PDF. Both are the same problem, and
/// this is where it is solved: parts are gathered in priority order, the student's own
/// identifying details are stripped, and the result is capped before it leaves.
public struct ContextEngine: Sendable {

    /// What the student is pointing at, if anything.
    public enum Focus: Sendable, Hashable {
        case question(QuestionID)
        case selection(page: Int, rect: NormalisedRect, text: String?)
        case wholePage(Int)
        /// They asked without selecting. The page and their working are the antecedent.
        case wherever
    }

    public struct Request: Sendable {
        public var ask: String
        public var mode: TutorReply.Mode?
        public var focus: Focus
        public var page: Int
        public var conversation: [String]
        public var previousAttempts: [String]
        /// Names to strip. The student's own, their teacher's, their school's.
        public var redactTerms: [String]

        public init(ask: String, mode: TutorReply.Mode? = nil, focus: Focus = .wherever,
                    page: Int = 0, conversation: [String] = [],
                    previousAttempts: [String] = [], redactTerms: [String] = []) {
            self.ask = ask; self.mode = mode; self.focus = focus; self.page = page
            self.conversation = conversation; self.previousAttempts = previousAttempts
            self.redactTerms = redactTerms
        }
    }

    /// What the gateway is sent. Every field is optional because the engine sends only
    /// what it actually has.
    public struct Payload: Codable, Sendable {
        public var ask: String
        public var mode: String?
        public var selection: String?
        public var questionText: String?
        public var workingText: String?
        public var pageText: String?
        public var neighbouringText: String?
        public var figures: String?
        public var conversation: [String]?
        public var previousAttempts: [String]?
        public var masteryHints: String?
        public var subject: String?
        public var redactTerms: [String]?
        public var images: [Image]?

        public struct Image: Codable, Sendable {
            public let mediaType: String
            public let data: String
            public init(mediaType: String, data: String) {
                self.mediaType = mediaType; self.data = data
            }
        }
    }

    /// The page's own text, supplied by whatever extracted it.
    public struct PageText: Sendable {
        public let page: Int
        public let text: String
        public init(page: Int, text: String) { self.page = page; self.text = text }
    }

    public struct Sources: Sendable {
        public var map: QuestionMap
        public var pages: [PageText]
        public var subject: String
        public var transcribedWorking: [QuestionID: String]
        public var projection: [ConceptID: MasteryState]
        public var conceptNames: [ConceptID: String]

        public init(map: QuestionMap, pages: [PageText] = [], subject: String = "",
                    transcribedWorking: [QuestionID: String] = [:],
                    projection: [ConceptID: MasteryState] = [:],
                    conceptNames: [ConceptID: String] = [:]) {
            self.map = map; self.pages = pages; self.subject = subject
            self.transcribedWorking = transcribedWorking
            self.projection = projection; self.conceptNames = conceptNames
        }
    }

    /// Hard cap on how much page text is worth sending. Beyond this the tutor is
    /// reading a book rather than answering a question, and the answer gets worse, not
    /// better.
    public static let maxPageTextCharacters = 6_000
    public static let maxNeighbourCharacters = 2_000
    public static let maxConversationTurns = 8

    public init() {}

    public func build(_ request: Request, from sources: Sources,
                      images: [Payload.Image] = []) -> Payload {
        var payload = Payload(ask: request.ask)
        payload.mode = request.mode?.rawValue
        payload.subject = sources.subject.isEmpty ? nil : sources.subject
        payload.redactTerms = request.redactTerms.isEmpty ? nil : request.redactTerms
        payload.images = images.isEmpty ? nil : images

        let question = resolveQuestion(request.focus, page: request.page, map: sources.map)

        if let question {
            payload.questionText = "\(question.number). \(question.text)"
                + (question.marks.map { " [\($0) marks]" } ?? "")
                + (question.commandWord.map { "\nCommand word: \($0)" } ?? "")
            payload.workingText = sources.transcribedWorking[question.id]
        }

        switch request.focus {
        case .selection(_, _, let text):
            payload.selection = text
        case .question, .wholePage, .wherever:
            break
        }

        if let page = sources.pages.first(where: { $0.page == request.page }) {
            payload.pageText = String(page.text.prefix(Self.maxPageTextCharacters))
        }

        // Neighbouring pages matter for a question whose diagram is overleaf, and cost
        // real money the rest of the time, so they go in last and small.
        let neighbours = sources.pages
            .filter { abs($0.page - request.page) == 1 }
            .map { "Page \($0.page + 1): \($0.text.prefix(Self.maxNeighbourCharacters / 2))" }
        if !neighbours.isEmpty {
            payload.neighbouringText = String(neighbours.joined(separator: "\n\n")
                .prefix(Self.maxNeighbourCharacters))
        }

        if !request.conversation.isEmpty {
            payload.conversation = Array(request.conversation.suffix(Self.maxConversationTurns))
        }
        if !request.previousAttempts.isEmpty {
            payload.previousAttempts = Array(request.previousAttempts.suffix(3))
        }

        payload.masteryHints = masteryHints(for: question, sources: sources)
        return payload
    }

    /// "Check this" with nothing selected still resolves, because the page knows which
    /// question the student is on.
    private func resolveQuestion(_ focus: Focus, page: Int, map: QuestionMap) -> MappedQuestion? {
        switch focus {
        case .question(let id):
            return map.question(id: id)
        case .selection(let page, let rect, _):
            return map.question(atPage: page, y: rect.midY)
        case .wholePage(let page):
            return map.questions.first { $0.page == page }
        case .wherever:
            return map.questions.first { $0.page == page && !$0.hasWork }
                ?? map.questions.first { $0.page == page }
        }
    }

    /// A short, de-identified note about what this student has already shown.
    ///
    /// Concept names and states only: no history, no dates, no scores, nothing that
    /// would let the text be reassembled into a profile of a child.
    private func masteryHints(for question: MappedQuestion?, sources: Sources) -> String? {
        guard let question, !question.conceptIDs.isEmpty else { return nil }
        let lines = question.conceptIDs.compactMap { id -> String? in
            guard let state = sources.projection[id], state != .unseen else { return nil }
            let name = sources.conceptNames[id] ?? id.rawValue
            return "\(name): \(state.studentFacingLabel.lowercased())"
        }
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }
}
