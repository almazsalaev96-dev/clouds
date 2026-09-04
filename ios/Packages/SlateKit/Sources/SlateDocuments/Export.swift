#if canImport(PDFKit)
import PDFKit
import UIKit
#endif
import Foundation
import SlateFoundation
import SlateModel

/// Producing the file a teacher receives.
///
/// The original is opened read-only and composited onto a *copy*. Nothing here can
/// write to `original.pdf`, which is why "we never damage your source document" is a
/// property of the code rather than a claim in a settings screen.
public struct Exporter: Sendable {

    public struct Options: Sendable {
        /// Include the student's ink. Off only for producing a clean question paper.
        public var includeInk: Bool
        public var includeAnnotations: Bool
        public var includeTypedAnswers: Bool
        /// Flatten to images. Larger, but immune to a marker's PDF reader rendering
        /// annotations differently from ours.
        public var flatten: Bool
        public var pageOrder: [Int]?

        public init(includeInk: Bool = true, includeAnnotations: Bool = true,
                    includeTypedAnswers: Bool = true, flatten: Bool = false,
                    pageOrder: [Int]? = nil) {
            self.includeInk = includeInk
            self.includeAnnotations = includeAnnotations
            self.includeTypedAnswers = includeTypedAnswers
            self.flatten = flatten
            self.pageOrder = pageOrder
        }
    }

    public enum ExportError: Error, LocalizedError, Sendable {
        case cannotOpenOriginal
        case cannotRender
        case emptyDocument

        public var errorDescription: String? {
            switch self {
            case .cannotOpenOriginal: "The original document could not be opened."
            case .cannotRender: "The finished document could not be produced."
            case .emptyDocument: "There are no pages to export."
            }
        }
    }

    public init() {}

    /// A filename a teacher can file without renaming it.
    ///
    /// Subject, topic and student, in that order, because a teacher sorts by subject
    /// and then looks for a name. Punctuation is stripped rather than escaped: a
    /// filename with a slash in it fails in a mail client, silently.
    public static func suggestedFilename(subject: String, title: String,
                                         studentName: String?) -> String {
        let parts = [subject, title, studentName]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { part in
                part.components(separatedBy: CharacterSet.alphanumerics.inverted)
                    .filter { !$0.isEmpty }
                    .joined(separator: "_")
            }
        let name = parts.isEmpty ? "Document" : parts.joined(separator: "_")
        return "\(name).pdf"
    }

    #if canImport(PDFKit)

    /// Composite the layers onto a copy of the original.
    public func export(originalURL: URL,
                       inkByPage: [Int: PKDrawingData],
                       annotations: [Annotation],
                       typedAnswers: [(rect: NormalisedRect, page: Int, text: String)],
                       options: Options = Options()) throws -> Data {
        guard let source = PDFDocument(url: originalURL) else { throw ExportError.cannotOpenOriginal }
        guard source.pageCount > 0 else { throw ExportError.emptyDocument }

        let order = options.pageOrder ?? Array(0..<source.pageCount)
        let output = PDFDocument()
        var outputIndex = 0

        for pageIndex in order {
            guard let page = source.page(at: pageIndex)?.copy() as? PDFPage else { continue }
            let bounds = page.bounds(for: .mediaBox)

            let overlay = try renderOverlay(
                size: bounds.size,
                ink: options.includeInk ? inkByPage[pageIndex] : nil,
                annotations: options.includeAnnotations
                    ? annotations.filter { $0.page == pageIndex } : [],
                typed: options.includeTypedAnswers
                    ? typedAnswers.filter { $0.page == pageIndex } : []
            )

            if options.flatten {
                let flattened = try flatten(page: page, overlay: overlay, size: bounds.size)
                output.insert(flattened, at: outputIndex)
            } else {
                if let overlay {
                    // An image-backed stamp keeps the page's own text selectable while
                    // guaranteeing the handwriting appears exactly as it was drawn.
                    page.addAnnotation(ImageStampAnnotation(bounds: bounds, image: overlay))
                }
                output.insert(page, at: outputIndex)
            }
            outputIndex += 1
        }

        guard outputIndex > 0 else { throw ExportError.emptyDocument }
        guard let data = output.dataRepresentation() else { throw ExportError.cannotRender }
        return data
    }

    private func renderOverlay(size: CGSize,
                               ink: PKDrawingData?,
                               annotations: [Annotation],
                               typed: [(rect: NormalisedRect, page: Int, text: String)]) throws -> UIImage? {
        guard ink != nil || !annotations.isEmpty || !typed.isEmpty else { return nil }
        // 2x keeps handwriting crisp when a teacher zooms in, without the file size of 3x.
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 2
        format.opaque = false

        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            for annotation in annotations {
                draw(annotation, in: context.cgContext, size: size)
            }
            if let ink, let image = ink.image(in: CGRect(origin: .zero, size: size)) {
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            for answer in typed {
                draw(text: answer.text, in: answer.rect, size: size)
            }
        }
    }

    private func draw(_ annotation: Annotation, in context: CGContext, size: CGSize) {
        let rect = CGRect(
            x: annotation.rect.x * size.width,
            y: annotation.rect.y * size.height,
            width: annotation.rect.width * size.width,
            height: annotation.rect.height * size.height
        )
        let colour = UIColor(hex: annotation.colourHex) ?? .systemYellow
        context.saveGState()
        defer { context.restoreGState() }

        switch annotation.kind {
        case .highlight:
            context.setFillColor(colour.withAlphaComponent(0.35).cgColor)
            context.fill(rect)
        case .underline:
            context.setStrokeColor(colour.cgColor)
            context.setLineWidth(2)
            context.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            context.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            context.strokePath()
        case .strikethrough:
            context.setStrokeColor(colour.cgColor)
            context.setLineWidth(2)
            context.move(to: CGPoint(x: rect.minX, y: rect.midY))
            context.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            context.strokePath()
        case .box:
            context.setStrokeColor(colour.cgColor)
            context.setLineWidth(2)
            context.stroke(rect)
        case .ellipse:
            context.setStrokeColor(colour.cgColor)
            context.setLineWidth(2)
            context.strokeEllipse(in: rect)
        case .arrow:
            context.setStrokeColor(colour.cgColor)
            context.setLineWidth(2)
            context.move(to: CGPoint(x: rect.minX, y: rect.minY))
            context.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            context.strokePath()
        case .textBox, .sticker:
            if let text = annotation.text { draw(text: text, in: annotation.rect, size: size) }
        case .image:
            if let data = annotation.imageData, let image = UIImage(data: data) {
                image.draw(in: rect)
            }
        }
    }

    private func draw(text: String, in rect: NormalisedRect, size: CGSize) {
        let target = CGRect(
            x: rect.x * size.width, y: rect.y * size.height,
            width: rect.width * size.width, height: rect.height * size.height
        )
        let style = NSMutableParagraphStyle()
        style.lineBreakMode = .byWordWrapping
        (text as NSString).draw(in: target, withAttributes: [
            .font: UIFont.systemFont(ofSize: max(11, target.height * 0.5)),
            .foregroundColor: UIColor.label,
            .paragraphStyle: style,
        ])
    }

    private func flatten(page: PDFPage, overlay: UIImage?, size: CGSize) throws -> PDFPage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 2
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.saveGState()
            context.cgContext.translateBy(x: 0, y: size.height)
            context.cgContext.scaleBy(x: 1, y: -1)
            page.draw(with: .mediaBox, to: context.cgContext)
            context.cgContext.restoreGState()
            overlay?.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let flattened = PDFPage(image: image) else { throw ExportError.cannotRender }
        return flattened
    }
    #endif
}

#if canImport(PDFKit)
/// A stamp annotation that draws an image, which `PDFAnnotation` does not do on its own.
final class ImageStampAnnotation: PDFAnnotation {
    private let image: UIImage

    init(bounds: CGRect, image: UIImage) {
        self.image = image
        super.init(bounds: bounds, forType: .stamp, withProperties: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not supported") }

    override func draw(with box: PDFDisplayBox, in context: CGContext) {
        guard let cgImage = image.cgImage else { return }
        context.saveGState()
        context.draw(cgImage, in: bounds)
        context.restoreGState()
    }
}

/// The rendered form of a PencilKit drawing, kept behind a protocol so `SlateDocuments`
/// does not have to import PencilKit and `SlateInk` can supply the real thing.
public protocol PKDrawingData: Sendable {
    func image(in rect: CGRect) -> UIImage?
}

extension UIColor {
    convenience init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6 || value.count == 8, let number = UInt64(value, radix: 16) else {
            return nil
        }
        let hasAlpha = value.count == 8
        let r = CGFloat((number >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
        let g = CGFloat((number >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
        let b = CGFloat((number >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
        let a = hasAlpha ? CGFloat(number & 0xFF) / 255 : 1
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
#endif
