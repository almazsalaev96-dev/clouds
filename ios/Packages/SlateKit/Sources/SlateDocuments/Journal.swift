import Foundation
import SlateFoundation

/// A write-ahead log for student work.
///
/// Losing Apple Pencil strokes is unforgivable, so saving is journalled rather than
/// periodic. Every committed change appends one framed record here; a snapshot is
/// written atomically at intervals and the log is then truncated. After a crash the
/// records beyond the snapshot are replayed.
///
/// Each record carries a length and a checksum. A crash *during* a write leaves a torn
/// record at the tail, which replay detects and stops at, so a half-written stroke can
/// never corrupt the strokes before it.
public final class Journal<Delta: Codable & Sendable>: @unchecked Sendable {

    public struct RecoveryReport: Sendable {
        public let replayed: Int
        /// True when the tail was torn — the app crashed mid-write. Expected, not alarming.
        public let truncatedTail: Bool
        public var recoveredWork: Bool { replayed > 0 }
    }

    public enum JournalError: Error, Sendable {
        case cannotOpen(String)
        case cannotWrite(String)
    }

    private let logURL: URL
    private let snapshotURL: URL
    private let queue = DispatchQueue(label: "com.slate.journal", qos: .utility)
    private var handle: FileHandle?
    private var appendsSinceSnapshot = 0

    /// A snapshot is taken after this many appends. Chosen so that replay after a crash
    /// is bounded by a fraction of a second, not by how long the student has been working.
    public static var snapshotEveryAppends: Int { 200 }

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.withoutEscapingSlashes]
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    public init(logURL: URL, snapshotURL: URL) throws {
        self.logURL = logURL
        self.snapshotURL = snapshotURL
        let directory = logURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: logURL.path) {
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
        }
    }

    deinit { try? handle?.close() }

    // MARK: - Writing

    /// Append one change. Returns once the bytes have reached the file system.
    public func append(_ delta: Delta) throws {
        try queue.sync {
            let payload = try encoder.encode(delta)
            var frame = Data()
            frame.append(bigEndian(UInt32(payload.count)))
            frame.append(bigEndian(CRC32.checksum(payload)))
            frame.append(payload)

            let h = try openHandle()
            try h.seekToEnd()
            try h.write(contentsOf: frame)
            // Durability is the entire point of this file; buffering it would defeat it.
            try h.synchronize()
            appendsSinceSnapshot += 1
        }
    }

    public var needsSnapshot: Bool {
        queue.sync { appendsSinceSnapshot >= Self.snapshotEveryAppends }
    }

    /// Replace the snapshot atomically, then drop the log.
    ///
    /// Order matters: the snapshot is fully on disk and renamed into place *before* the
    /// log is truncated, so there is no instant at which neither holds the work.
    public func writeSnapshot(_ data: Data) throws {
        try queue.sync {
            let fileManager = FileManager.default
            let temporary = snapshotURL.appendingPathExtension("writing")
            try data.write(to: temporary, options: .atomic)
            if fileManager.fileExists(atPath: snapshotURL.path) {
                _ = try fileManager.replaceItemAt(snapshotURL, withItemAt: temporary)
            } else {
                try fileManager.moveItem(at: temporary, to: snapshotURL)
            }
            let h = try openHandle()
            try h.truncate(atOffset: 0)
            try h.synchronize()
            appendsSinceSnapshot = 0
        }
    }

    // MARK: - Reading

    public func loadSnapshot() throws -> Data? {
        guard FileManager.default.fileExists(atPath: snapshotURL.path) else { return nil }
        return try Data(contentsOf: snapshotURL)
    }

    /// Every intact record in the log, oldest first.
    ///
    /// Stops at the first record that does not check out rather than skipping it: after
    /// a torn write the remaining bytes are not trustworthy, and replaying past the
    /// tear would apply changes out of order.
    public func replay() throws -> (deltas: [Delta], report: RecoveryReport) {
        guard let bytes = try? Data(contentsOf: logURL), !bytes.isEmpty else {
            return ([], RecoveryReport(replayed: 0, truncatedTail: false))
        }

        var deltas: [Delta] = []
        var offset = 0
        var torn = false

        while offset + 8 <= bytes.count {
            let length = Int(readUInt32(bytes, at: offset))
            let checksum = readUInt32(bytes, at: offset + 4)
            let start = offset + 8
            guard length > 0, start + length <= bytes.count else { torn = true; break }

            let payload = bytes.subdata(in: start ..< (start + length))
            guard CRC32.checksum(payload) == checksum else { torn = true; break }
            guard let delta = try? decoder.decode(Delta.self, from: payload) else { torn = true; break }

            deltas.append(delta)
            offset = start + length
        }

        if offset < bytes.count { torn = true }
        return (deltas, RecoveryReport(replayed: deltas.count, truncatedTail: torn))
    }

    /// Drop the log without touching the snapshot. Used after a successful replay has
    /// been folded into a fresh snapshot.
    public func reset() throws {
        try queue.sync {
            let h = try openHandle()
            try h.truncate(atOffset: 0)
            try h.synchronize()
            appendsSinceSnapshot = 0
        }
    }

    // MARK: - Internals

    private func openHandle() throws -> FileHandle {
        if let handle { return handle }
        guard let h = FileHandle(forWritingAtPath: logURL.path) else {
            throw JournalError.cannotOpen(logURL.path)
        }
        handle = h
        return h
    }

    private func bigEndian(_ value: UInt32) -> Data {
        withUnsafeBytes(of: value.bigEndian) { Data($0) }
    }

    private func readUInt32(_ data: Data, at offset: Int) -> UInt32 {
        var value: UInt32 = 0
        for i in 0..<4 { value = (value << 8) | UInt32(data[data.startIndex + offset + i]) }
        return value
    }
}

/// CRC-32 (IEEE). Small enough to own, and owning it avoids a dependency for the sake
/// of eight lines in the one place durability depends on.
public enum CRC32 {
    private static let table: [UInt32] = (0..<256).map { i -> UInt32 in
        var c = UInt32(i)
        for _ in 0..<8 { c = (c & 1) == 1 ? (0xEDB8_8320 ^ (c >> 1)) : (c >> 1) }
        return c
    }

    public static func checksum(_ data: Data) -> UInt32 {
        var c: UInt32 = 0xFFFF_FFFF
        for byte in data { c = table[Int((c ^ UInt32(byte)) & 0xFF)] ^ (c >> 8) }
        return c ^ 0xFFFF_FFFF
    }
}
