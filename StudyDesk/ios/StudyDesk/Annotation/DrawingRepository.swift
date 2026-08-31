import Foundation
import PencilKit
import SwiftData

/// Loads and saves the ink for one document's pages.
///
/// ## The autosave contract
///
/// `PKCanvasView` reports a change on every stroke. Writing to disk on every
/// stroke would be both wasteful and, on a big page, visible as a hitch. So:
///
/// - the in-memory drawing is updated **immediately** (nothing is ever waiting
///   in a queue to become true),
/// - the write to disk is coalesced to at most one per second per page,
/// - and any pending write is flushed on backgrounding, on page change, and on
///   document close.
///
/// The worst case for a crash is therefore under a second of ink, and in
/// practice zero, because the flush on background covers the ordinary way an
/// app goes away.
@MainActor
final class DrawingRepository {

    private let context: ModelContext
    private let document: StudyDocument

    /// Decoded drawings, keyed by page. Populated lazily and trimmed to a
    /// window around the current page so a 500-page document never holds 500
    /// drawings in memory.
    private var cache: [Int: PKDrawing] = [:]
    private var dirtyPages: Set<Int> = []
    private var flushTask: Task<Void, Never>?

    /// Pages kept in memory either side of the current one.
    private let cacheRadius = 3
    private let coalesceInterval: Duration = .milliseconds(900)

    init(document: StudyDocument, context: ModelContext) {
        self.document = document
        self.context = context
    }

    // MARK: Reading

    func drawing(forPage index: Int) -> PKDrawing {
        if let cached = cache[index] { return cached }

        let data = document.annotation(forPage: index)?.drawingData ?? Data()
        let drawing: PKDrawing
        if data.isEmpty {
            drawing = PKDrawing()
        } else {
            do {
                drawing = try PKDrawing(data: data)
            } catch {
                // Unreadable ink is a bug worth knowing about, but it must not
                // take the page down with it.
                Log.pencil.error("Could not decode ink on page \(index): \(error.localizedDescription, privacy: .public)")
                drawing = PKDrawing()
            }
        }
        cache[index] = drawing
        return drawing
    }

    /// Drops cached drawings far from the current page. Dirty pages are never
    /// evicted — they are flushed first.
    func trimCache(around index: Int) {
        let keep = (index - cacheRadius)...(index + cacheRadius)
        for page in cache.keys where !keep.contains(page) && !dirtyPages.contains(page) {
            cache.removeValue(forKey: page)
        }
    }

    // MARK: Writing

    /// Records a change. Cheap and synchronous — the expensive part is deferred.
    func record(_ drawing: PKDrawing, forPage index: Int) {
        cache[index] = drawing
        dirtyPages.insert(index)
        scheduleFlush()
    }

    private func scheduleFlush() {
        guard flushTask == nil else { return }
        flushTask = Task { [weak self] in
            try? await Task.sleep(for: self?.coalesceInterval ?? .milliseconds(900))
            guard let self else { return }
            self.flushTask = nil
            self.flush()
        }
    }

    /// Writes every pending page. Safe to call at any time; a no-op when clean.
    @discardableResult
    func flush() -> Bool {
        flushTask?.cancel()
        flushTask = nil
        guard !dirtyPages.isEmpty else { return true }

        for index in dirtyPages {
            guard let drawing = cache[index] else { continue }
            let annotation: PageAnnotation
            if let existing = document.annotation(forPage: index) {
                annotation = existing
            } else {
                let created = PageAnnotation(pageIndex: index)
                created.document = document
                context.insert(created)
                document.annotations.append(created)
                annotation = created
            }
            annotation.drawingData = drawing.strokes.isEmpty ? Data() : drawing.dataRepresentation()
            annotation.updatedAt = Date()
            annotation.revision &+= 1
        }
        dirtyPages.removeAll()

        do {
            try context.save()
            return true
        } catch {
            Log.persistence.error("Autosave failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    var hasUnsavedChanges: Bool { !dirtyPages.isEmpty }

    // MARK: Recognition cache

    /// The stored handwriting reading for a page, if it is still current.
    func cachedRecognition(forPage index: Int) -> String? {
        guard let annotation = document.annotation(forPage: index),
              !annotation.needsRecognition else { return nil }
        return annotation.recognizedText
    }

    func storeRecognition(_ text: String, forPage index: Int) {
        guard let annotation = document.annotation(forPage: index) else { return }
        annotation.recognizedText = text
        annotation.recognizedRevision = annotation.revision
    }
}
