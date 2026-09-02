import CryptoKit
import Foundation
import SlateFoundation
import SlateModel

/// Owns the document directory: import, open, snapshot, recover, trash.
///
/// Everything here works with no network. Import, writing, annotation, organisation and
/// export are the parts a student cannot afford to lose to a dead connection, so none
/// of them touch one.
public final class DocumentStore: @unchecked Sendable {

    public enum StoreError: Error, Sendable, LocalizedError {
        case notAPDF
        case originalMissing
        case originalModified(expected: String, found: String)
        case notFound(DocumentID)

        public var errorDescription: String? {
            switch self {
            case .notAPDF:
                "That file is not a PDF."
            case .originalMissing:
                "The original document is missing from this workspace."
            case .originalModified:
                // Said plainly, because the student's answers may no longer line up
                // with the pages underneath them.
                "The original document has changed since you imported it. Your writing is safe, but it may no longer line up with the page."
            case .notFound:
                "That document is not in your library."
            }
        }
    }

    private let root: URL
    private let clock: Clock
    private let fileManager = FileManager.default

    public init(root: URL, clock: Clock = SystemClock()) throws {
        self.root = root
        self.clock = clock
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
    }

    public func paths(for id: DocumentID) -> DocumentPaths {
        DocumentPaths(root: root.appendingPathComponent(id.rawValue, isDirectory: true))
    }

    // MARK: - Import

    /// Copy a file in and record its checksum. The source is never opened for writing.
    public func importDocument(from source: URL, title: String? = nil,
                               pageCount: Int, subject: String = "") throws -> DocumentMeta {
        guard source.pathExtension.lowercased() == "pdf" else { throw StoreError.notAPDF }

        let id = DocumentID.new()
        let p = paths(for: id)
        try fileManager.createDirectory(at: p.root, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: p.versions, withIntermediateDirectories: true)

        let needsScopedAccess = source.startAccessingSecurityScopedResource()
        defer { if needsScopedAccess { source.stopAccessingSecurityScopedResource() } }
        try fileManager.copyItem(at: source, to: p.original)

        let meta = DocumentMeta(
            id: id,
            title: title ?? source.deletingPathExtension().lastPathComponent,
            subject: subject,
            pageCount: pageCount,
            importedAt: clock.now,
            originalChecksum: try checksum(of: p.original)
        )
        try write(meta)
        return meta
    }

    // MARK: - Metadata

    public func write(_ meta: DocumentMeta) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(meta).write(to: paths(for: meta.id).meta, options: .atomic)
    }

    public func meta(_ id: DocumentID) throws -> DocumentMeta {
        let url = paths(for: id).meta
        guard let data = try? Data(contentsOf: url) else { throw StoreError.notFound(id) }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(DocumentMeta.self, from: data)
    }

    /// Everything not in the trash, most recently opened first, so "continue where you
    /// left off" needs no separate bookkeeping.
    public func allDocuments() throws -> [DocumentMeta] {
        let entries = (try? fileManager.contentsOfDirectory(at: root,
                                                            includingPropertiesForKeys: nil)) ?? []
        return entries
            .compactMap { try? meta(DocumentID(rawValue: $0.lastPathComponent)) }
            .filter { $0.trashedAt == nil }
            .sorted { ($0.lastOpenedAt ?? $0.importedAt) > ($1.lastOpenedAt ?? $1.importedAt) }
    }

    // MARK: - Integrity

    public func checksum(of url: URL) throws -> String {
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Verify before export or submission. Silence here would mean handing a teacher a
    /// document whose pages no longer match the answers written on them.
    public func verifyOriginal(_ id: DocumentID) throws {
        let p = paths(for: id)
        guard fileManager.fileExists(atPath: p.original.path) else { throw StoreError.originalMissing }
        let recorded = try meta(id).originalChecksum
        let found = try checksum(of: p.original)
        guard recorded == found else {
            throw StoreError.originalModified(expected: recorded, found: found)
        }
    }

    // MARK: - Versions

    @discardableResult
    public func snapshot(_ id: DocumentID, kind: DocumentVersion.Kind,
                         label: String, pdfData: Data) throws -> DocumentVersion {
        let p = paths(for: id)
        try fileManager.createDirectory(at: p.versions, withIntermediateDirectories: true)
        let now = clock.now
        let url = p.version(kind, at: now)
        try pdfData.write(to: url, options: .atomic)
        return DocumentVersion(kind: kind, createdAt: now, label: label,
                               fileURL: url, byteCount: pdfData.count)
    }

    public func versions(_ id: DocumentID) throws -> [DocumentVersion] {
        let p = paths(for: id)
        let entries = (try? fileManager.contentsOfDirectory(
            at: p.versions, includingPropertiesForKeys: [.creationDateKey, .fileSizeKey])) ?? []
        return entries.compactMap { url -> DocumentVersion? in
            let name = url.deletingPathExtension().lastPathComponent
            guard let dash = name.firstIndex(of: "-"),
                  let kind = DocumentVersion.Kind(rawValue: String(name[name.startIndex..<dash]))
            else { return nil }
            let values = try? url.resourceValues(forKeys: [.creationDateKey, .fileSizeKey])
            return DocumentVersion(
                kind: kind,
                createdAt: values?.creationDate ?? Date.distantPast,
                label: String(name[name.index(after: dash)...]),
                fileURL: url,
                byteCount: values?.fileSize ?? 0
            )
        }
        .sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: - Trash

    /// Deleting is reversible for thirty days, and it is a metadata change rather than
    /// a file operation, so a mistap can never destroy a term's work.
    public func trash(_ id: DocumentID) throws {
        var m = try meta(id)
        m.trashedAt = clock.now
        try write(m)
    }

    public func restore(_ id: DocumentID) throws {
        var m = try meta(id)
        m.trashedAt = nil
        try write(m)
    }

    public func emptyTrash(olderThanDays days: Double = 30) throws {
        let cutoff = clock.now.addingTimeInterval(-days * 86_400)
        let entries = (try? fileManager.contentsOfDirectory(at: root,
                                                            includingPropertiesForKeys: nil)) ?? []
        for entry in entries {
            guard let m = try? meta(DocumentID(rawValue: entry.lastPathComponent)),
                  let trashed = m.trashedAt, trashed < cutoff else { continue }
            try fileManager.removeItem(at: entry)
        }
    }
}
