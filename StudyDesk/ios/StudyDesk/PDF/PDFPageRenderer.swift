import UIKit
import PDFKit
import PencilKit

/// Renders pages — and parts of pages — to images.
///
/// Three callers with different needs:
/// - thumbnails for the desk (small, cheap, cached as `Data` on the document)
/// - images for the tutor (as small as can still be read; see `TutorImage`)
/// - the export pipeline (which does *not* use this: it draws vector, see
///   `PDFExporter`)
///
/// Sizing matters more than it looks. A full-resolution A4 page is ~2400px
/// wide; sending that to a vision model costs latency and tokens for detail no
/// model needs. 1280px on the long edge reads printed 10pt text reliably and is
/// roughly a quarter of the bytes.
enum PDFPageRenderer {

    /// Long-edge target for images that go to the tutor.
    static let tutorImageLongEdge: CGFloat = 1280
    /// A cropped region is smaller on screen but wants *more* relative detail —
    /// it is usually a diagram or a line of algebra.
    static let tutorRegionLongEdge: CGFloat = 1100
    static let thumbnailLongEdge: CGFloat = 320

    /// Draws a page, plus the student's ink, into an image.
    ///
    /// - Parameters:
    ///   - region: normalised (0...1, top-left origin) crop, or nil for the
    ///     whole page.
    ///   - drawing: the student's ink, composited on top so the tutor sees the
    ///     page as the student sees it.
    static func image(
        of page: PDFPage,
        region: CGRect? = nil,
        drawing: PKDrawing? = nil,
        longEdge: CGFloat
    ) -> UIImage? {
        let pageBounds = page.bounds(for: .mediaBox)
        guard pageBounds.width > 0, pageBounds.height > 0 else { return nil }

        // Work out the crop in page space (bottom-left origin), from a
        // normalised top-left rect.
        let crop: CGRect
        if let region, region.width > 0, region.height > 0 {
            let clamped = region.intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
            guard !clamped.isNull, clamped.width > 0, clamped.height > 0 else { return nil }
            crop = CGRect(
                x: pageBounds.minX + clamped.minX * pageBounds.width,
                y: pageBounds.minY + (1 - clamped.maxY) * pageBounds.height,
                width: clamped.width * pageBounds.width,
                height: clamped.height * pageBounds.height
            )
        } else {
            crop = pageBounds
        }

        let scale = longEdge / max(crop.width, crop.height)
        let target = CGSize(width: (crop.width * scale).rounded(), height: (crop.height * scale).rounded())
        guard target.width >= 1, target.height >= 1 else { return nil }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true

        return UIGraphicsImageRenderer(size: target, format: format).image { context in
            let cgContext = context.cgContext
            UIColor.white.setFill()
            cgContext.fill(CGRect(origin: .zero, size: target))

            cgContext.saveGState()
            // Flip into PDF space, then translate so the crop's corner is at
            // the origin.
            cgContext.translateBy(x: 0, y: target.height)
            cgContext.scaleBy(x: scale, y: -scale)
            cgContext.translateBy(x: -crop.minX, y: -crop.minY)
            page.draw(with: .mediaBox, to: cgContext)
            cgContext.restoreGState()

            if let drawing, !drawing.strokes.isEmpty {
                // PKDrawing works in a top-left space matching the page size in
                // points, so crop it in those terms.
                let inkCrop = CGRect(
                    x: crop.minX - pageBounds.minX,
                    y: pageBounds.maxY - crop.maxY,
                    width: crop.width,
                    height: crop.height
                )
                let ink = drawing.image(from: inkCrop, scale: scale)
                ink.draw(in: CGRect(origin: .zero, size: target))
            }
        }
    }

    static func thumbnail(of page: PDFPage) -> UIImage? {
        image(of: page, longEdge: thumbnailLongEdge)
    }

    /// JPEG for the network. Photographic compression on a page of text is a
    /// bad trade below about 0.7; above 0.85 the bytes buy nothing.
    static func jpegData(_ image: UIImage, quality: CGFloat = 0.78) -> Data? {
        image.jpegData(compressionQuality: quality)
    }
}
