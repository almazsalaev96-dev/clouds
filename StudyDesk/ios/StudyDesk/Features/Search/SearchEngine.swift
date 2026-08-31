import Foundation
import SwiftData

/// Library-wide search.
///
/// A straightforward case-insensitive scan over cached text, not a vector
/// index. The reason is honest scale: a heavy user has a few hundred documents
/// and a few thousand pages of extracted text, which is milliseconds to scan.
/// Semantic search is on the roadmap for when a library gets big enough to
/// justify the index and the battery it costs to build.
@MainActor
struct SearchEngine {

    let context: ModelContext

    struct Result: Identifiable {
        enum Kind {
            case worksheet
            case handwriting
            case note
            case tutorAnswer

            var label: String {
                switch self {
                case .worksheet: "Worksheet"
                case .handwriting: "Your writing"
                case .note: "Note"
                case .tutorAnswer: "Tutor"
                }
            }

            var symbolName: String {
                switch self {
                case .worksheet: "doc.text"
                case .handwriting: "hand.draw"
                case .note: "note.text"
                case .tutorAnswer: "sparkles"
                }
            }
        }

        let id = UUID()
        let kind: Kind
        let title: String
        let snippet: String
        let document: StudyDocument?
        let pageIndex: Int?
        /// Higher sorts first.
        let score: Int
    }

    func search(_ rawQuery: String, limit: Int = 60) -> [Result] {
        guard let query = rawQuery.trimmedNonEmpty?.lowercased(), query.count >= 2 else { return [] }

        var results: [Result] = []
        results.append(contentsOf: searchDocuments(query))
        results.append(contentsOf: searchNotes(query))
        results.append(contentsOf: searchTutorAnswers(query))

        return results
            .sorted { $0.score > $1.score }
            .prefix(limit)
            .map { $0 }
    }

    // MARK: Documents

    private func searchDocuments(_ query: String) -> [Result] {
        let descriptor = FetchDescriptor<StudyDocument>(
            predicate: #Predicate { $0.deletedAt == nil }
        )
        guard let documents = try? context.fetch(descriptor) else { return [] }

        var results: [Result] = []
        for document in documents {
            // A title match is what the student most often means.
            if document.title.lowercased().contains(query) {
                results.append(Result(
                    kind: .worksheet,
                    title: document.title,
                    snippet: "\(document.subject.name) · \(document.pageCount) pages",
                    document: document,
                    pageIndex: nil,
                    score: 100
                ))
            }

            for (index, text) in document.extractedText.enumerated() {
                guard let range = Self.match(query, in: text) else { continue }
                results.append(Result(
                    kind: .worksheet,
                    title: "\(document.title) — page \(index + 1)",
                    snippet: Self.snippet(from: text, around: range),
                    document: document,
                    pageIndex: index,
                    score: 60
                ))
            }

            for annotation in document.annotations {
                guard let original = annotation.recognizedText,
                      let range = Self.match(query, in: original) else { continue }
                results.append(Result(
                    kind: .handwriting,
                    title: "\(document.title) — page \(annotation.pageIndex + 1)",
                    snippet: Self.snippet(from: original, around: range),
                    document: document,
                    pageIndex: annotation.pageIndex,
                    score: 70
                ))
            }
        }
        return results
    }

    // MARK: Notes and tutor answers

    private func searchNotes(_ query: String) -> [Result] {
        guard let notes = try? context.fetch(FetchDescriptor<StudyNote>()) else { return [] }
        return notes.compactMap { note in
            let haystack = note.title + "\n" + note.body
            guard let range = Self.match(query, in: haystack) else { return nil }
            return Result(
                kind: .note,
                title: note.title.isEmpty ? "Untitled note" : note.title,
                snippet: Self.snippet(from: haystack, around: range),
                document: nil,
                pageIndex: note.linkedPageIndex,
                score: note.title.lowercased().contains(query) ? 90 : 50
            )
        }
    }

    private func searchTutorAnswers(_ query: String) -> [Result] {
        let descriptor = FetchDescriptor<TutorMessage>(
            predicate: #Predicate { $0.roleRaw == "tutor" },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        guard let messages = try? context.fetch(descriptor) else { return [] }

        return messages.prefix(400).compactMap { message in
            guard let range = Self.match(query, in: message.text) else { return nil }
            let document = message.conversation?.document
            return Result(
                kind: .tutorAnswer,
                title: document.map { "\($0.title) — page \(message.pageIndex + 1)" } ?? "Tutor answer",
                snippet: Self.snippet(from: message.text, around: range),
                document: document,
                pageIndex: message.pageIndex,
                score: 40
            )
        }
    }

    // MARK: Matching

    /// Matches against the original string rather than a lowercased copy.
    /// Lowercasing can change a string's length in some locales, which would
    /// make the returned range unsafe to index back into the original.
    static func match(_ query: String, in text: String) -> Range<String.Index>? {
        text.range(of: query, options: [.caseInsensitive, .diacriticInsensitive])
    }

    // MARK: Snippets

    /// A window of text around the match, so the student can tell which of
    /// eight hits is the one they meant without opening each.
    static func snippet(from text: String, around range: Range<String.Index>, radius: Int = 60) -> String {
        let start = text.index(range.lowerBound, offsetBy: -radius, limitedBy: text.startIndex) ?? text.startIndex
        let end = text.index(range.upperBound, offsetBy: radius, limitedBy: text.endIndex) ?? text.endIndex
        var snippet = String(text[start..<end])
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        if start != text.startIndex { snippet = "…" + snippet }
        if end != text.endIndex { snippet += "…" }
        return snippet
    }
}
