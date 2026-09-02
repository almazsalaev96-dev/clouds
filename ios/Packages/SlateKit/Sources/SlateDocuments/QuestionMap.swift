import Foundation
import SlateFoundation
import SlateModel

/// Which question is the student answering?
///
/// This map is the backbone of everything intelligent in the product. Without it,
/// "check this" means nothing and every tutor request has to be explained by the
/// student. With it, a tap on a page resolves to a question, its printed text, the
/// region where the answer goes, and the strokes already inside that region.
public struct QuestionMap: Codable, Sendable, Hashable {
    public var questions: [MappedQuestion]

    public init(questions: [MappedQuestion] = []) { self.questions = questions }

    /// The question a point on a page belongs to.
    ///
    /// Answer regions are preferred over question regions: a student tapping their own
    /// working means "this question", and their working is usually below the prompt.
    public func question(atPage page: Int, y: Double) -> MappedQuestion? {
        let onPage = questions.filter { $0.page == page }
        if let containing = onPage.first(where: { $0.answerRegion?.contains(y: y) == true }) {
            return containing
        }
        if let containing = onPage.first(where: { $0.questionRegion.contains(y: y) }) {
            return containing
        }
        // Otherwise the nearest question whose prompt starts above the point: on a
        // worksheet, writing belongs to the question printed above it.
        return onPage
            .filter { $0.questionRegion.y <= y }
            .max { $0.questionRegion.y < $1.questionRegion.y }
    }

    public func question(id: QuestionID) -> MappedQuestion? {
        questions.first { $0.id == id }
    }

    public var unanswered: [MappedQuestion] { questions.filter { !$0.hasWork } }

    public var progress: (done: Int, total: Int) {
        (questions.filter(\.hasWork).count, questions.count)
    }
}

public struct MappedQuestion: Codable, Sendable, Hashable, Identifiable {
    public let id: QuestionID
    /// As printed: "3", "3(b)", "Q7 (ii)". Never renumbered.
    public var number: String
    public var text: String
    public var page: Int
    public var questionRegion: NormalisedRect
    /// Where the answer goes. Nil when the layout gives no clue and the student's own
    /// writing has not yet said.
    public var answerRegion: NormalisedRect?
    public var marks: Int?
    /// "explain", "evaluate", "state", "calculate" — it changes what a good answer is.
    public var commandWord: String?
    public var conceptIDs: [ConceptID]
    /// Set once the student has written inside the answer region.
    public var hasWork: Bool
    public var lastCheckedAt: Date?
    public var lastVerdict: Outcome?

    public init(id: QuestionID = .new(), number: String, text: String, page: Int,
                questionRegion: NormalisedRect, answerRegion: NormalisedRect? = nil,
                marks: Int? = nil, commandWord: String? = nil, conceptIDs: [ConceptID] = [],
                hasWork: Bool = false, lastCheckedAt: Date? = nil, lastVerdict: Outcome? = nil) {
        self.id = id; self.number = number; self.text = text; self.page = page
        self.questionRegion = questionRegion; self.answerRegion = answerRegion
        self.marks = marks; self.commandWord = commandWord; self.conceptIDs = conceptIDs
        self.hasWork = hasWork; self.lastCheckedAt = lastCheckedAt; self.lastVerdict = lastVerdict
    }
}

public extension NormalisedRect {
    func contains(y: Double) -> Bool { y >= self.y && y <= self.y + height }

    func contains(x: Double, y: Double) -> Bool {
        x >= self.x && x <= self.x + width && contains(y: y)
    }

    /// The gap between one question's prompt and the next, which is where the answer
    /// almost always goes on a printed worksheet.
    static func answerGap(after question: NormalisedRect, before next: NormalisedRect?) -> NormalisedRect {
        let top = question.y + question.height
        let bottom = next?.y ?? 1.0
        return NormalisedRect(x: 0.05, y: top, width: 0.90, height: max(0.02, bottom - top))
    }
}

/// Deciding what counts as an answer.
///
/// Not every pencil stroke is an answer. A doodle in the margin, a tick, an underline
/// under the question, and a crossed-out first attempt are all strokes, and treating
/// them as the student's answer produces confident nonsense.
public enum AnswerDetection {
    /// Strokes must cover at least this fraction of the answer region's width before
    /// they read as working rather than a mark.
    public static let minimumWidthCoverage = 0.06
    public static let minimumStrokes = 2

    public struct StrokeSummary: Sendable, Hashable {
        public let bounds: NormalisedRect
        public let strokeCount: Int
        public let page: Int

        public init(bounds: NormalisedRect, strokeCount: Int, page: Int) {
            self.bounds = bounds; self.strokeCount = strokeCount; self.page = page
        }
    }

    public static func looksLikeAnswer(_ summary: StrokeSummary, in region: NormalisedRect) -> Bool {
        guard summary.strokeCount >= minimumStrokes else { return false }
        guard summary.bounds.intersects(region) else { return false }
        return summary.bounds.width >= minimumWidthCoverage
    }

    /// Group strokes into per-question work, so "check this" can resolve without the
    /// student telling us which question they mean.
    public static func assign(summaries: [StrokeSummary],
                              to map: QuestionMap) -> [QuestionID: [StrokeSummary]] {
        var out: [QuestionID: [StrokeSummary]] = [:]
        for summary in summaries {
            guard let question = map.question(atPage: summary.page, y: summary.bounds.midY) else {
                continue
            }
            let region = question.answerRegion ?? question.questionRegion
            guard looksLikeAnswer(summary, in: region) else { continue }
            out[question.id, default: []].append(summary)
        }
        return out
    }
}
