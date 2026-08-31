import Foundation

/// Finds question boundaries in worksheet text.
///
/// This is deliberately a small, fast, on-device heuristic rather than a model
/// call. Worksheets are formatted conventionally — "3.", "Question 4", "(b)",
/// "[6 marks]" — and matching those patterns costs microseconds. Spending a
/// network round trip to learn that "4(b)" starts a question would make the
/// tutor slower for no accuracy gain.
///
/// It is allowed to be wrong. The active question is a *hint* in the context,
/// never a claim, and the tutor is instructed to fall back to the page as a
/// whole if the label doesn't fit what it sees.
struct QuestionDetector {

    struct DetectedQuestion: Equatable {
        /// Human label, e.g. "Question 4(b)".
        var label: String
        /// Character range within the page text.
        var range: Range<String.Index>
        /// Marks available, when the paper states them.
        var marks: Int?

        var text: String = ""
    }

    /// Matches:  "4." | "4)" | "Question 4" | "Q4" | "(b)" | "4(b)"
    private static let pattern = #"(?m)^\s*(?:(?:Question|Q)\s*)?(\d{1,2})\s*[.)]?\s*(\([a-z]\))?(?=\s|$)|^\s*(\([a-z]\))\s"#
    private static let marksPattern = #"\[\s*(\d{1,2})\s*(?:marks?|m)\s*\]"#

    private static let regex = try? NSRegularExpression(pattern: pattern)
    private static let marksRegex = try? NSRegularExpression(pattern: marksPattern, options: .caseInsensitive)

    /// All questions found on a page, in reading order.
    func questions(in text: String) -> [DetectedQuestion] {
        guard let regex = Self.regex, !text.isEmpty else { return [] }

        let ns = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        guard !matches.isEmpty else { return [] }

        var results: [DetectedQuestion] = []
        for (index, match) in matches.enumerated() {
            let number = capture(match, at: 1, in: ns)
            let subpart = capture(match, at: 2, in: ns) ?? capture(match, at: 3, in: ns)

            let label: String
            switch (number, subpart) {
            case let (num?, part?): label = "Question \(num)\(part)"
            case let (num?, nil): label = "Question \(num)"
            case let (nil, part?): label = "Part \(part.trimmingCharacters(in: CharacterSet(charactersIn: "()")))"
            default: continue
            }

            // A question runs until the next one starts.
            let start = match.range.location
            let end = index + 1 < matches.count ? matches[index + 1].range.location : ns.length
            guard end > start else { continue }
            let body = ns.substring(with: NSRange(location: start, length: end - start))

            guard let swiftRange = Range(NSRange(location: start, length: end - start), in: text) else { continue }
            results.append(
                DetectedQuestion(
                    label: label,
                    range: swiftRange,
                    marks: Self.marks(in: body),
                    text: body.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
        }
        return results
    }

    /// The question the student is most likely working on.
    ///
    /// Ink position decides it: whichever question's text sits nearest the
    /// student's most recent strokes. Falls back to the first question on the
    /// page when there is no ink yet.
    ///
    /// - Parameter inkVerticalPosition: 0...1 down the page, or nil if the page
    ///   has no handwriting.
    func activeQuestion(in text: String, inkVerticalPosition: Double?) -> DetectedQuestion? {
        let found = questions(in: text)
        guard !found.isEmpty else { return nil }
        guard let inkVerticalPosition, found.count > 1 else { return found.first }

        // Approximate each question's position by where its text starts,
        // relative to the whole page. Worksheets read top to bottom, so this
        // tracks the visual layout closely enough to pick the right one.
        let total = Double(text.count)
        guard total > 0 else { return found.first }

        var best = found[0]
        var bestDistance = Double.greatestFiniteMagnitude
        for question in found {
            let offset = Double(text.distance(from: text.startIndex, to: question.range.lowerBound)) / total
            // Students write *below* a question, so bias toward questions that
            // start above the ink.
            let distance = inkVerticalPosition >= offset
                ? inkVerticalPosition - offset
                : (offset - inkVerticalPosition) * 2.5
            if distance < bestDistance {
                bestDistance = distance
                best = question
            }
        }
        return best
    }

    private func capture(_ match: NSTextCheckingResult, at index: Int, in ns: NSString) -> String? {
        guard index < match.numberOfRanges else { return nil }
        let range = match.range(at: index)
        guard range.location != NSNotFound else { return nil }
        return ns.substring(with: range)
    }

    private static func marks(in text: String) -> Int? {
        guard let marksRegex else { return nil }
        let ns = text as NSString
        guard let match = marksRegex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)),
              match.numberOfRanges > 1 else { return nil }
        return Int(ns.substring(with: match.range(at: 1)))
    }
}
