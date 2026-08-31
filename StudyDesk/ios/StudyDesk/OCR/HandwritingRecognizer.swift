import Foundation
import PencilKit
import UIKit

/// Turns a `PKDrawing` into text, and reports where on the page the ink sits.
///
/// The trick that makes this reliable is rendering the drawing on its own, on
/// white, at a fixed resolution — not screenshotting the page. The recogniser
/// then sees only what the student wrote.
///
/// Results are approximate and the app says so. A misread digit must never
/// cause the tutor to mark a correct answer wrong, so `Reading.confidence` is
/// passed through to the proxy, which instructs the model to ask rather than
/// judge when confidence is low.
actor HandwritingRecognizer {

    struct Reading: Equatable, Sendable {
        var text: String
        var confidence: Float
        /// Where the ink sits vertically, 0 (top) to 1 (bottom). Used by
        /// `QuestionDetector` to work out which question is being answered.
        var verticalPosition: Double?
        var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

        static let empty = Reading(text: "", confidence: 0, verticalPosition: nil)
    }

    private let recognizer = TextRecognizer()
    /// Keyed by drawing data hash, so scrubbing back and forth between pages
    /// doesn't re-run Vision on unchanged ink.
    private var cache: [Int: Reading] = [:]

    /// Rendering wider than this wastes time without improving accuracy;
    /// narrower and small handwriting falls below the recogniser's floor.
    private static let renderWidth: CGFloat = 1400

    func read(_ drawing: PKDrawing, pageSize: CGSize) async -> Reading {
        guard !drawing.strokes.isEmpty, pageSize.width > 0, pageSize.height > 0 else { return .empty }

        let key = drawing.dataRepresentation().hashValue
        if let cached = cache[key] { return cached }

        guard let image = Self.render(drawing, pageSize: pageSize)?.cgImage else { return .empty }

        do {
            let lines = try await recognizer.recognize(image, kind: .handwriting)
            guard !lines.isEmpty else {
                cache[key] = .empty
                return .empty
            }
            let ordered = TextRecognizer.readingOrder(lines)
            let reading = Reading(
                text: ordered.map(\.text).joined(separator: "\n"),
                confidence: ordered.map(\.confidence).reduce(0, +) / Float(ordered.count),
                verticalPosition: Self.verticalPosition(of: drawing, pageSize: pageSize)
            )
            cache[key] = reading
            return reading
        } catch {
            Log.pencil.error("Handwriting recognition failed: \(error.localizedDescription, privacy: .public)")
            return .empty
        }
    }

    /// Vertical centre of the ink as a fraction of page height. Cheap — it uses
    /// the drawing's bounds, no rendering — so it can be called even when full
    /// recognition isn't wanted.
    nonisolated static func verticalPosition(of drawing: PKDrawing, pageSize: CGSize) -> Double? {
        guard !drawing.strokes.isEmpty, pageSize.height > 0 else { return nil }
        let bounds = drawing.bounds
        guard bounds.height.isFinite, bounds.midY.isFinite else { return nil }
        return min(1, max(0, Double(bounds.midY / pageSize.height)))
    }

    /// Draws the ink alone onto white at a resolution Vision is comfortable
    /// with. White rather than transparent: the recogniser expects a page.
    nonisolated static func render(_ drawing: PKDrawing, pageSize: CGSize) -> UIImage? {
        guard pageSize.width > 0 else { return nil }
        let scale = Self.renderWidth / pageSize.width
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true

        let target = CGSize(width: pageSize.width * scale, height: pageSize.height * scale)
        guard target.width >= 1, target.height >= 1 else { return nil }

        return UIGraphicsImageRenderer(size: target, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: target))
            // `image(from:scale:)` gives back exactly the ink, with no page
            // behind it, which is the whole point.
            let ink = drawing.image(from: CGRect(origin: .zero, size: pageSize), scale: scale)
            ink.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    func invalidateCache() {
        cache.removeAll()
    }
}
