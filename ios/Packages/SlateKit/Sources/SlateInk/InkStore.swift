#if canImport(PencilKit)
import PencilKit
import UIKit
#endif
import Foundation
import SlateDocuments
import SlateFoundation
import SlateModel

/// Where handwriting lives between the pencil and the disk.
///
/// Every committed change is journalled before it is anything else. A snapshot follows
/// on a cadence, and the log is truncated only once the snapshot is safely in place, so
/// there is no moment at which a crash loses a stroke.
public final class InkStore: @unchecked Sendable {

    public struct Snapshot: Codable, Sendable {
        public var drawingsByPage: [Int: Data]
        public var savedAt: Date
        public init(drawingsByPage: [Int: Data] = [:], savedAt: Date) {
            self.drawingsByPage = drawingsByPage
            self.savedAt = savedAt
        }
    }

    public private(set) var drawingsByPage: [Int: Data] = [:]
    public private(set) var recovery: Journal<LayerDelta>.RecoveryReport?

    private let journal: Journal<LayerDelta>
    private let clock: Clock
    private let lock = NSLock()

    public init(paths: DocumentPaths, clock: Clock = SystemClock()) throws {
        self.clock = clock
        journal = try Journal<LayerDelta>(logURL: paths.inkLog, snapshotURL: paths.ink)
        try load()
    }

    /// Load the snapshot, then replay anything the last session did not get to save.
    private func load() throws {
        if let data = try journal.loadSnapshot() {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            if let snapshot = try? decoder.decode(Snapshot.self, from: data) {
                drawingsByPage = snapshot.drawingsByPage
            }
        }
        let (deltas, report) = try journal.replay()
        for delta in deltas {
            if case .inkReplaced(let page, let data, _) = delta {
                drawingsByPage[page] = data
            }
        }
        // Only reported when there was genuinely something to recover, so the message
        // the student sees is never a false alarm about work that was already saved.
        recovery = report.recoveredWork ? report : nil
        if report.recoveredWork {
            try saveSnapshot()
        }
    }

    /// Record a page's drawing. Returns once it is durable.
    public func setDrawing(_ data: Data, page: Int) throws {
        lock.lock()
        drawingsByPage[page] = data
        lock.unlock()

        try journal.append(.inkReplaced(page: page, drawingData: data, at: clock.now))
        if journal.needsSnapshot { try saveSnapshot() }
    }

    public func drawing(page: Int) -> Data? {
        lock.lock(); defer { lock.unlock() }
        return drawingsByPage[page]
    }

    public func saveSnapshot() throws {
        lock.lock()
        let snapshot = Snapshot(drawingsByPage: drawingsByPage, savedAt: clock.now)
        lock.unlock()

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try journal.writeSnapshot(try encoder.encode(snapshot))
    }

    /// Called when the app is backgrounded or a document closes. Cheap, and the last
    /// line of defence before the process is killed.
    public func flush() {
        try? saveSnapshot()
    }
}
