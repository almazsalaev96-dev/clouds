import Foundation
import SlateFoundation
import SlateModel

/// Turning a document analysis into a question map.
///
/// The model supplies the questions it found; this decides where the answers go. That
/// division matters: a model asked to invent pixel coordinates will happily do so, and
/// a wrong answer region silently attaches a student's working to the wrong question.
public enum QuestionMapBuilder {

    /// What the analysis endpoint returns for one question.
    public struct DetectedQuestion: Sendable, Hashable {
        public let number: String
        public let text: String
        public let marks: Int?
        public let commandWord: String?
        public let conceptIDs: [ConceptID]
        public let page: Int
        /// Supplied only when the layout genuinely gave one away.
        public let region: NormalisedRect?

        public init(number: String, text: String, marks: Int? = nil,
                    commandWord: String? = nil, conceptIDs: [ConceptID] = [],
                    page: Int, region: NormalisedRect? = nil) {
            self.number = number; self.text = text; self.marks = marks
            self.commandWord = commandWord; self.conceptIDs = conceptIDs
            self.page = page; self.region = region
        }
    }

    /// Vertical space assumed for a question's prompt when the layout gives no clue.
    static let assumedPromptHeight = 0.06
    /// Below this, a gap is a line break rather than an answer space.
    static let minimumAnswerHeight = 0.03

    public static func build(from detected: [DetectedQuestion], pageCount: Int) -> QuestionMap {
        var questions: [MappedQuestion] = []

        for page in 0..<max(pageCount, 1) {
            let onPage = detected.filter { $0.page == page }
            guard !onPage.isEmpty else { continue }

            // Where the model gave no region, questions are laid out evenly down the
            // page in the order they were found. That is a guess, and it is a good one
            // on a worksheet — but the student's own strokes override it the moment
            // they write, which is why answer detection reads writing rather than
            // trusting this.
            let prompts: [NormalisedRect] = onPage.enumerated().map { index, question in
                if let region = question.region { return region }
                let slot = 1.0 / Double(onPage.count)
                return NormalisedRect(x: 0.05, y: Double(index) * slot + 0.02,
                                      width: 0.9, height: assumedPromptHeight)
            }

            for (index, question) in onPage.enumerated() {
                let prompt = prompts[index]
                let next = index + 1 < prompts.count ? prompts[index + 1] : nil
                let gap = NormalisedRect.answerGap(after: prompt, before: next)
                questions.append(MappedQuestion(
                    number: question.number,
                    text: question.text,
                    page: page,
                    questionRegion: prompt,
                    answerRegion: gap.height >= minimumAnswerHeight ? gap : nil,
                    marks: question.marks,
                    commandWord: question.commandWord,
                    conceptIDs: question.conceptIDs
                ))
            }
        }

        return QuestionMap(questions: questions)
    }

    /// Merge a fresh analysis into an existing map without losing the student's work.
    ///
    /// Re-analysing a document the student has already answered must not reset
    /// `hasWork` or forget what was marked. Questions are matched on their printed
    /// number, which is stable, rather than on identity, which is not.
    public static func merge(_ fresh: QuestionMap, into existing: QuestionMap) -> QuestionMap {
        guard !existing.questions.isEmpty else { return fresh }
        var merged = fresh.questions

        for index in merged.indices {
            guard let previous = existing.questions.first(where: {
                $0.number == merged[index].number && $0.page == merged[index].page
            }) else { continue }
            merged[index].id = previous.id
            merged[index].hasWork = previous.hasWork
            merged[index].lastCheckedAt = previous.lastCheckedAt
            merged[index].lastVerdict = previous.lastVerdict
            // A region the student's writing has already confirmed beats a fresh guess.
            if previous.hasWork, let region = previous.answerRegion {
                merged[index].answerRegion = region
            }
        }

        // Questions the new analysis missed but which have work against them are kept:
        // losing a marked answer because a re-analysis read the page differently would
        // be indefensible.
        let keptNumbers = Set(merged.map { "\($0.page)|\($0.number)" })
        for previous in existing.questions where previous.hasWork {
            if !keptNumbers.contains("\(previous.page)|\(previous.number)") {
                merged.append(previous)
            }
        }

        return QuestionMap(questions: merged.sorted {
            $0.page == $1.page
                ? $0.questionRegion.y < $1.questionRegion.y
                : $0.page < $1.page
        })
    }
}
