import Foundation
import PDFKit
import PencilKit
import UIKit

/// Produces the PDF a student hands in.
///
/// ## Why the original page is drawn, not rasterised
///
/// The obvious implementation renders each page to a bitmap and stamps the ink
/// on top. It is also the wrong one: a teacher opening the result gets a fuzzy
/// image with no selectable text, no working links, and four times the file
/// size.
///
/// Instead each page is *drawn* into the new PDF context with
/// `PDFPage.draw(with:to:)`, which replays the original page's own drawing
/// operations — text stays text, vectors stay vectors. Only the student's ink
/// is rasterised, at high resolution, and only where they actually wrote.
///
/// The original file in the store is never touched by any of this.
enum PDFExporter {

    struct Options {
        /// Optional cover header printed at the top of page one.
        var studentName: String?
        var subject: String?
        var assignmentTitle: String?
        var date: Date?
        /// Ink is rendered at this multiple of page resolution. 3× keeps
        /// handwriting crisp when a teacher zooms in to read a working step.
        var inkScale: CGFloat = 3

        var hasHeader: Bool {
            studentName?.trimmedNonEmpty != nil
                || assignmentTitle?.trimmedNonEmpty != nil
                || subject?.trimmedNonEmpty != nil
        }
    }

    struct Result {
        var data: Data
        var pageCount: Int
    }

    /// Flattens a document plus its ink into a single shareable PDF.
    ///
    /// - Parameter drawings: ink by page index. Pages with no entry are copied
    ///   through untouched.
    static func export(
        pdf: PDFDocument,
        drawings: [Int: PKDrawing],
        options: Options = Options()
    ) throws -> Result {
        guard pdf.pageCount > 0 else { throw StudyDeskError.exportFailed }

        let output = NSMutableData()
        guard let consumer = CGDataConsumer(data: output) else { throw StudyDeskError.exportFailed }

        // The first page's box seeds the context; each page then declares its
        // own, so mixed-size documents (an A4 worksheet with an A3 map) survive.
        var seedBox = pdf.page(at: 0)?.bounds(for: .mediaBox) ?? CGRect(x: 0, y: 0, width: 595, height: 842)
        guard let context = CGContext(consumer: consumer, mediaBox: &seedBox, documentInfo(options)) else {
            throw StudyDeskError.exportFailed
        }

        for index in 0..<pdf.pageCount {
            guard let page = pdf.page(at: index) else { continue }
            var box = page.bounds(for: .mediaBox)
            guard box.width > 0, box.height > 0 else { continue }

            context.beginPage(mediaBox: &box)
            context.saveGState()

            // A rotated page reports an unrotated media box; PDFPage.draw
            // applies the rotation itself, so nothing extra is needed here —
            // but the origin must be honoured for pages whose box isn't at zero.
            context.translateBy(x: -box.minX, y: -box.minY)
            page.draw(with: .mediaBox, to: context)

            if let drawing = drawings[index], !drawing.strokes.isEmpty {
                drawInk(drawing, pageBox: box, scale: options.inkScale, into: context)
            }

            context.restoreGState()

            if index == 0, options.hasHeader {
                drawHeader(options, box: box, into: context)
            }

            context.endPage()
        }

        context.closePDF()

        guard output.length > 0 else { throw StudyDeskError.exportFailed }
        return Result(data: output as Data, pageCount: pdf.pageCount)
    }

    // MARK: Ink

    private static func drawInk(_ drawing: PKDrawing, pageBox: CGRect, scale: CGFloat, into context: CGContext) {
        // `PKDrawing.image(from:scale:)` gives a transparent-background image of
        // just the strokes, in a top-left coordinate space the size of the page.
        let inkRect = CGRect(origin: .zero, size: pageBox.size)
        let image = drawing.image(from: inkRect, scale: scale)
        guard let cgImage = image.cgImage else { return }

        context.saveGState()
        // PDF space has a bottom-left origin; the ink image is top-left.
        context.translateBy(x: pageBox.minX, y: pageBox.minY + pageBox.height)
        context.scaleBy(x: 1, y: -1)
        context.setBlendMode(.normal)
        context.draw(cgImage, in: CGRect(origin: .zero, size: pageBox.size))
        context.restoreGState()
    }

    // MARK: Header

    /// A restrained one-line header. Teachers asked for a name on the page;
    /// nobody asked for a title page, and a title page shifts every page number
    /// the teacher is marking against.
    private static func drawHeader(_ options: Options, box: CGRect, into context: CGContext) {
        var parts: [String] = []
        if let name = options.studentName?.trimmedNonEmpty { parts.append(name) }
        if let title = options.assignmentTitle?.trimmedNonEmpty { parts.append(title) }
        if let subject = options.subject?.trimmedNonEmpty { parts.append(subject) }
        if let date = options.date {
            parts.append(date.formatted(date: .abbreviated, time: .omitted))
        }
        guard !parts.isEmpty else { return }

        let text = parts.joined(separator: "  ·  ")
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8.5, weight: .medium),
            .foregroundColor: UIColor(white: 0.35, alpha: 1)
        ]
        let attributed = NSAttributedString(string: text, attributes: attributes)
        let size = attributed.size()

        context.saveGState()
        UIGraphicsPushContext(context)
        context.translateBy(x: 0, y: box.height)
        context.scaleBy(x: 1, y: -1)
        // Top-right, inside the margin, where a teacher looks for a name.
        let origin = CGPoint(x: max(12, box.width - size.width - 24), y: 14)
        attributed.draw(at: origin)
        UIGraphicsPopContext()
        context.restoreGState()
    }

    private static func documentInfo(_ options: Options) -> CFDictionary? {
        var info: [String: Any] = [kCGPDFContextCreator as String: "Study Desk"]
        if let title = options.assignmentTitle?.trimmedNonEmpty {
            info[kCGPDFContextTitle as String] = title
        }
        if let author = options.studentName?.trimmedNonEmpty {
            info[kCGPDFContextAuthor as String] = author
        }
        return info as CFDictionary
    }

    // MARK: File naming

    /// Suggests a file name a teacher can find in a folder of thirty.
    /// `Mathematics_Quadratic-Equations_Almaz.pdf`
    static func suggestedFileName(subject: String?, title: String, studentName: String?) -> String {
        func slug(_ value: String) -> String {
            value
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: " ", with: "-")
                .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
                .joined()
        }

        var parts: [String] = []
        if let subject = subject?.trimmedNonEmpty, subject != Subject.unspecified.name {
            parts.append(slug(subject))
        }
        parts.append(slug(title))
        if let studentName = studentName?.trimmedNonEmpty {
            parts.append(slug(studentName))
        }

        let joined = parts.filter { !$0.isEmpty }.joined(separator: "_")
        let name = joined.isEmpty ? "Assignment" : joined
        return "\(String(name.prefix(90))).pdf"
    }
}
