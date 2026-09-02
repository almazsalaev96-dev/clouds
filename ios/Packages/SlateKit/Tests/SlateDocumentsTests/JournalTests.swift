import XCTest
import SlateFoundation
@testable import SlateDocuments

/// Durability, tested the only way that means anything: by damaging the file and
/// checking what survives.
final class JournalTests: XCTestCase {

    private struct Change: Codable, Sendable, Equatable {
        let page: Int
        let text: String
    }

    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeJournal() throws -> Journal<Change> {
        try Journal<Change>(
            logURL: directory.appendingPathComponent("test.wal"),
            snapshotURL: directory.appendingPathComponent("test.snapshot")
        )
    }

    func testAppendedChangesReplayInOrder() throws {
        let journal = try makeJournal()
        for i in 0..<5 { try journal.append(Change(page: i, text: "stroke \(i)")) }

        let (deltas, report) = try journal.replay()
        XCTAssertEqual(deltas.map(\.page), [0, 1, 2, 3, 4])
        XCTAssertEqual(report.replayed, 5)
        XCTAssertFalse(report.truncatedTail)
    }

    func testAnEmptyJournalRecoversNothingAndSaysSo() throws {
        let (deltas, report) = try makeJournal().replay()
        XCTAssertTrue(deltas.isEmpty)
        XCTAssertFalse(report.recoveredWork)
    }

    func testATornFinalRecordDoesNotDestroyTheOnesBeforeIt() throws {
        let journal = try makeJournal()
        for i in 0..<4 { try journal.append(Change(page: i, text: "stroke \(i)")) }

        // Simulate a crash mid-write: chop the tail off the file.
        let url = directory.appendingPathComponent("test.wal")
        let bytes = try Data(contentsOf: url)
        try bytes.prefix(bytes.count - 9).write(to: url)

        let (deltas, report) = try journal.replay()
        XCTAssertEqual(deltas.map(\.page), [0, 1, 2],
                       "everything before the torn record must survive")
        XCTAssertTrue(report.truncatedTail)
        XCTAssertTrue(report.recoveredWork)
    }

    func testACorruptedRecordStopsReplayRatherThanBeingSkipped() throws {
        let journal = try makeJournal()
        try journal.append(Change(page: 0, text: "first"))
        try journal.append(Change(page: 1, text: "second"))

        // Flip a byte inside the second record's payload.
        let url = directory.appendingPathComponent("test.wal")
        var bytes = try Data(contentsOf: url)
        bytes[bytes.count - 4] = bytes[bytes.count - 4] ^ 0xFF
        try bytes.write(to: url)

        let (deltas, report) = try journal.replay()
        XCTAssertEqual(deltas.map(\.page), [0],
                       "replaying past a checksum failure would apply changes out of order")
        XCTAssertTrue(report.truncatedTail)
    }

    func testSnapshotClearsTheLogWithoutLosingTheSnapshot() throws {
        let journal = try makeJournal()
        try journal.append(Change(page: 0, text: "a"))
        try journal.writeSnapshot(Data("snapshot".utf8))

        let (deltas, _) = try journal.replay()
        XCTAssertTrue(deltas.isEmpty, "the log is truncated once the snapshot holds the work")
        XCTAssertEqual(try journal.loadSnapshot(), Data("snapshot".utf8))
    }

    func testWorkAfterASnapshotIsStillJournalled() throws {
        let journal = try makeJournal()
        try journal.append(Change(page: 0, text: "before"))
        try journal.writeSnapshot(Data("snapshot".utf8))
        try journal.append(Change(page: 1, text: "after"))

        let (deltas, _) = try journal.replay()
        XCTAssertEqual(deltas.map(\.text), ["after"])
    }

    func testChecksumDetectsASingleFlippedBit() {
        let original = Data("the quick brown fox".utf8)
        var mutated = original
        mutated[3] = mutated[3] ^ 0x01
        XCTAssertNotEqual(CRC32.checksum(original), CRC32.checksum(mutated))
    }
}
