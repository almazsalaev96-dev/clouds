#if canImport(PDFKit)
import PDFKit
#endif
import Foundation
import SlateFoundation

/// Reading a PDF without loading all of it.
///
/// A five-hundred-page past paper must not be fully rendered to answer "how many pages
/// is this?", and the student must be able to start writing before any of it has been
/// analysed. Everything here is incremental for that reason.
public enum PDFText {

    public struct Page: Sendable, Hashable {
        public let index: Int
        public let text: String
        public let size: CGSize
        public var isMostlyEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).count < 40 }
    }

    #if canImport(PDFKit)
    public static func pageCount(of url: URL) -> Int {
        PDFDocument(url: url)?.pageCount ?? 0
    }

    /// Text for a range of pages. Called page by page as the student moves, never for
    /// the whole document at once.
    public static func pages(of url: URL, range: Range<Int>) -> [Page] {
        guard let document = PDFDocument(url: url) else { return [] }
        let clamped = range.clamped(to: 0..<document.pageCount)
        return clamped.compactMap { index in
            guard let page = document.page(at: index) else { return nil }
            return Page(index: index,
                        text: page.string ?? "",
                        size: page.bounds(for: .mediaBox).size)
        }
    }

    /// A page rendered for the model to look at.
    ///
    /// Capped in both dimensions: a full-resolution scan of a worksheet is several
    /// megabytes and tells the model nothing a 1,600-point render does not.
    public static func image(of url: URL, page index: Int,
                             maxDimension: CGFloat = 1600) -> Data? {
        guard let document = PDFDocument(url: url), let page = document.page(at: index) else {
            return nil
        }
        let bounds = page.bounds(for: .mediaBox)
        let scale = min(maxDimension / max(bounds.width, bounds.height), 2.0)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        #if canImport(UIKit)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.translateBy(x: 0, y: size.height)
            context.cgContext.scaleBy(x: scale, y: -scale)
            page.draw(with: .mediaBox, to: context.cgContext)
        }
        // JPEG rather than PNG: a scanned page is a photograph, and the difference in
        // payload size is several-fold on exactly the documents students import most.
        return image.jpegData(compressionQuality: 0.72)
        #else
        return nil
        #endif
    }

    /// A document with no extractable text is a scan, and needs the model to look at
    /// pictures of it rather than at nothing.
    public static func needsVision(_ pages: [Page]) -> Bool {
        guard !pages.isEmpty else { return true }
        let empty = pages.filter(\.isMostlyEmpty).count
        return Double(empty) / Double(pages.count) > 0.6
    }
    #endif
}

#if canImport(UIKit)
import UIKit
#endif
