import Foundation
import SlateFoundation
import SlateModel

/// The check before submission.
///
/// It reports and changes nothing. This is the student's assignment and their
/// handwriting, and silently tidying either would be a betrayal of the whole product —
/// so every finding is a sentence and a location, and applying any of it is a separate,
/// explicit act.
public struct FinalReview: Sendable {

    public struct Finding: Sendable, Hashable, Identifiable {
        public enum Kind: String, Sendable, CaseIterable {
            case blankAnswer, partialAnswer, unreadable, strayMark
            case pageOutOfOrder, missingPage, workingOffPage, duplicatePage
        }

        public let id: String
        public let kind: Kind
        public let page: Int
        public let questionNumber: String?
        public let detail: String
        /// Findings we are sure of come first; a false alarm before submission is
        /// expensive, so uncertain ones say so.
        public let certain: Bool

        public init(id: String = UUID().uuidString, kind: Kind, page: Int,
                    questionNumber: String? = nil, detail: String, certain: Bool = true) {
            self.id = id; self.kind = kind; self.page = page
            self.questionNumber = questionNumber; self.detail = detail; self.certain = certain
        }
    }

    public let findings: [Finding]

    public var isClear: Bool { findings.isEmpty }

    /// Deliberately not "everything is perfect". We checked some things and found
    /// nothing; that is a different claim, and the smaller one is the true one.
    public var headline: String {
        if findings.isEmpty { return "Nothing stood out. Have a last look yourself before you send it." }
        let count = findings.count
        return "\(count) thing\(count == 1 ? "" : "s") you may want to look at."
    }

    /// The half of the review that needs no model: what the question map already knows.
    public static func local(map: QuestionMap,
                             strokeSummaries: [AnswerDetection.StrokeSummary],
                             pageCount: Int) -> FinalReview {
        var findings: [Finding] = []

        for question in map.questions where !question.hasWork {
            findings.append(Finding(
                kind: .blankAnswer,
                page: question.page,
                questionNumber: question.number,
                detail: "Question \(question.number) has nothing written in the answer space."
            ))
        }

        // Strokes that fall outside every answer region are usually working the student
        // meant to keep, occasionally a slip of the hand. We say which page, and let
        // them decide.
        for summary in strokeSummaries {
            let onPage = map.questions.filter { $0.page == summary.page }
            let insideSomething = onPage.contains { question in
                (question.answerRegion ?? question.questionRegion).intersects(summary.bounds)
            }
            guard !insideSomething, summary.strokeCount <= 2 else { continue }
            findings.append(Finding(
                kind: .strayMark,
                page: summary.page,
                detail: "A small mark on page \(summary.page + 1) is not inside any answer space.",
                certain: false
            ))
        }

        let pagesWithWork = Set(strokeSummaries.map(\.page))
        for page in 0..<pageCount where !pagesWithWork.contains(page) {
            let questionsHere = map.questions.filter { $0.page == page }
            guard !questionsHere.isEmpty else { continue }
            findings.append(Finding(
                kind: .blankAnswer,
                page: page,
                detail: "Page \(page + 1) has questions on it but nothing written.",
                certain: questionsHere.allSatisfy { !$0.hasWork }
            ))
        }

        return FinalReview(findings: dedupe(findings))
    }

    public init(findings: [Finding]) { self.findings = findings }

    /// Merge the local pass with whatever the model noticed, without reporting the same
    /// thing twice in different words.
    public func merging(_ other: FinalReview) -> FinalReview {
        FinalReview(findings: FinalReview.dedupe(findings + other.findings))
    }

    private static func dedupe(_ findings: [Finding]) -> [Finding] {
        var seen: Set<String> = []
        var out: [Finding] = []
        for finding in findings {
            let key = "\(finding.kind.rawValue)|\(finding.page)|\(finding.questionNumber ?? "")"
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            out.append(finding)
        }
        return out.sorted {
            if $0.certain != $1.certain { return $0.certain && !$1.certain }
            if $0.page != $1.page { return $0.page < $1.page }
            return $0.kind.rawValue < $1.kind.rawValue
        }
    }
}
