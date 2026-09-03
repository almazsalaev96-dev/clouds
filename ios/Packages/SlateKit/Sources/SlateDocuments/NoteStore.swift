import Foundation
import SlateFoundation
import SlateModel

/// Where notes live.
///
/// One file, written atomically, with the same rule as everywhere else in the product:
/// nothing the student wrote is ever replaced by something they did not ask for. A
/// tutor draft is a *proposal* until `accept` is called, and accepting adds a note
/// rather than overwriting one.
public final class NoteStore: @unchecked Sendable {

    private let url: URL
    private let clock: Clock
    private let lock = NSLock()
    private var cache: [Note]?

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    /// A store nothing can be written to, so a failure to create the real one is a
    /// message on screen rather than a crash. Every save fails, which is the truth.
    public static let unavailable = NoteStore(unavailableAt: URL(fileURLWithPath: "/dev/null/notes"))

    private init(unavailableAt url: URL) {
        self.url = url
        self.clock = SystemClock()
    }

    public init(url: URL, clock: Clock = SystemClock()) throws {
        self.url = url
        self.clock = clock
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
    }

    public func all() -> [Note] {
        lock.lock(); defer { lock.unlock() }
        if let cache { return cache }
        let loaded = (try? Data(contentsOf: url))
            .flatMap { try? decoder.decode([Note].self, from: $0) } ?? []
        cache = loaded
        return loaded
    }

    /// Pinned first, then most recently changed. Notes are read far more often than
    /// they are written, so the order is the reading order.
    public func sorted() -> [Note] {
        all().sorted {
            $0.isPinned == $1.isPinned ? $0.updatedAt > $1.updatedAt : $0.isPinned
        }
    }

    public func note(_ id: NoteID) -> Note? {
        all().first { $0.id == id }
    }

    @discardableResult
    public func save(_ note: Note) throws -> Note {
        var updated = note
        updated.updatedAt = clock.now
        try mutate { notes in
            if let index = notes.firstIndex(where: { $0.id == note.id }) {
                notes[index] = updated
            } else {
                notes.append(updated)
            }
        }
        return updated
    }

    public func delete(_ id: NoteID) throws {
        try mutate { $0.removeAll { $0.id == id } }
    }

    /// Turn an accepted tutor draft into a note.
    ///
    /// Separate from `save` on purpose: it is the only place a draft becomes real, and
    /// having one named function for it makes "the tutor never silently writes into
    /// your notes" a property of the code rather than a habit.
    @discardableResult
    public func accept(draft: Note) throws -> Note {
        try save(draft)
    }

    public func notes(for document: DocumentID) -> [Note] {
        all().filter { $0.origin.documentID == document }
    }

    public func notes(about concept: ConceptID) -> [Note] {
        all().filter { $0.conceptIDs.contains(concept) }
    }

    /// Plain substring search across everything a note holds. Deliberately simple:
    /// ranked relevance on a few dozen notes is a solution to a problem nobody has.
    public func search(_ query: String) -> [Note] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return sorted() }
        return sorted().filter { $0.searchableText.lowercased().contains(needle) }
    }

    private func mutate(_ change: (inout [Note]) -> Void) throws {
        lock.lock(); defer { lock.unlock() }
        var notes = cache ?? ((try? Data(contentsOf: url))
            .flatMap { try? decoder.decode([Note].self, from: $0) } ?? [])
        change(&notes)
        try encoder.encode(notes).write(to: url, options: .atomic)
        cache = notes
    }
}
