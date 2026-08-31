import Foundation
import PDFKit

/// On-disk home for PDF bytes.
///
/// Layout inside the app container:
/// ```
/// Documents/
///   Originals/     the imported file, byte-for-byte, never written to again
///   Submissions/   exported PDFs the student produced (flattened, shareable)
///   Exports/       scratch space for share sheets; safe to purge
/// ```
///
/// The separation between `Originals` and `Submissions` is what makes the
/// promise "we never modify your worksheet" real rather than aspirational.
struct DocumentStore {
    enum Folder: String {
        case originals = "Originals"
        case submissions = "Submissions"
        case exports = "Exports"
    }

    let root: URL

    init(root: URL? = nil) {
        if let root {
            self.root = root
        } else {
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            self.root = documents
        }
        for folder in [Folder.originals, .submissions, .exports] {
            try? FileManager.default.createDirectory(at: url(for: folder), withIntermediateDirectories: true)
        }
    }

    func url(for folder: Folder) -> URL {
        root.appendingPathComponent(folder.rawValue, isDirectory: true)
    }

    func url(_ name: String, in folder: Folder) -> URL {
        url(for: folder).appendingPathComponent(name)
    }

    // MARK: - Writing

    /// Copies an incoming file into the store under a collision-free name.
    /// Returns the storage name (not a path), which is what the model records —
    /// absolute paths change between app launches and must never be persisted.
    @discardableResult
    func importFile(at source: URL, into folder: Folder = .originals) throws -> String {
        let needsScope = source.startAccessingSecurityScopedResource()
        defer { if needsScope { source.stopAccessingSecurityScopedResource() } }

        let name = uniqueName(for: source.lastPathComponent, in: folder)
        let destination = url(name, in: folder)
        try FileManager.default.copyItem(at: source, to: destination)
        try excludeFromBackupIfNeeded(destination, folder: folder)
        return name
    }

    @discardableResult
    func write(_ data: Data, named preferredName: String, into folder: Folder) throws -> String {
        let name = uniqueName(for: preferredName, in: folder)
        let destination = url(name, in: folder)
        try data.write(to: destination, options: .atomic)
        try excludeFromBackupIfNeeded(destination, folder: folder)
        return name
    }

    func delete(_ name: String, in folder: Folder) {
        try? FileManager.default.removeItem(at: url(name, in: folder))
    }

    /// Clears the share-sheet scratch folder. Called on launch: those files
    /// exist only for the duration of a share.
    func purgeExports() {
        let exports = url(for: .exports)
        guard let contents = try? FileManager.default.contentsOfDirectory(at: exports, includingPropertiesForKeys: nil) else { return }
        for file in contents { try? FileManager.default.removeItem(at: file) }
    }

    // MARK: - Reading

    func exists(_ name: String, in folder: Folder) -> Bool {
        FileManager.default.fileExists(atPath: url(name, in: folder).path)
    }

    func byteCount(of name: String, in folder: Folder) -> Int {
        let attributes = try? FileManager.default.attributesOfItem(atPath: url(name, in: folder).path)
        return (attributes?[.size] as? NSNumber)?.intValue ?? 0
    }

    /// Opens a PDF from the store. PDFKit memory-maps the file, so this is
    /// cheap even for a 500-page textbook.
    func loadPDF(_ name: String, in folder: Folder = .originals) -> PDFDocument? {
        PDFDocument(url: url(name, in: folder))
    }

    // MARK: - Helpers

    private func uniqueName(for preferred: String, in folder: Folder) -> String {
        let sanitized = Self.sanitize(preferred)
        let base = (sanitized as NSString).deletingPathExtension
        let ext = (sanitized as NSString).pathExtension
        var candidate = sanitized
        var counter = 2
        while FileManager.default.fileExists(atPath: url(candidate, in: folder).path) {
            candidate = ext.isEmpty ? "\(base) \(counter)" : "\(base) \(counter).\(ext)"
            counter += 1
        }
        return candidate
    }

    /// Strips anything that would break a file name or let a crafted name
    /// escape the store directory.
    static func sanitize(_ name: String) -> String {
        let illegal = CharacterSet(charactersIn: "/\\:?%*|\"<>\0")
        let cleaned = name
            .components(separatedBy: illegal)
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "..", with: "-")
        let trimmed = String(cleaned.prefix(120))
        return trimmed.isEmpty ? "Document.pdf" : trimmed
    }

    /// Exports are scratch; keeping them out of backups saves the student's
    /// iCloud quota. Originals and submissions are their work and are backed up.
    private func excludeFromBackupIfNeeded(_ url: URL, folder: Folder) throws {
        guard folder == .exports else { return }
        var mutable = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutable.setResourceValues(values)
    }
}
