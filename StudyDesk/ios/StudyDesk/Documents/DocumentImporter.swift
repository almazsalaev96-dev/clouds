import Foundation
import PDFKit
import SwiftData
import UIKit
import UniformTypeIdentifiers

/// Brings files into the library.
///
/// Handles PDFs directly and wraps images (photos, screenshots, scans) into a
/// PDF so that from here on there is exactly one document type in the app. A
/// student who photographs a worksheet gets the same Pencil, tutor and export
/// behaviour as one who imported a PDF, with no second code path to keep in
/// step.
@MainActor
struct DocumentImporter {

    private let store: DocumentStore
    private let context: ModelContext
    private let settings: AppSettings

    init(store: DocumentStore, context: ModelContext, settings: AppSettings) {
        self.store = store
        self.context = context
        self.settings = settings
    }

    static let supportedTypes: [UTType] = [.pdf, .image, .jpeg, .png, .heic]

    // MARK: PDFs

    @discardableResult
    func importPDF(at url: URL) throws -> StudyDocument {
        let storageName = try store.importFile(at: url)
        guard let pdf = store.loadPDF(storageName) else {
            store.delete(storageName, in: .originals)
            throw StudyDeskError.notAPDF
        }
        return try makeDocument(pdf: pdf, storageName: storageName, originalFileName: url.lastPathComponent)
    }

    // MARK: Images and scans

    /// Builds a PDF from one or more images, at the images' own size so nothing
    /// is resampled on the way in.
    @discardableResult
    func importImages(_ images: [UIImage], title: String) throws -> StudyDocument {
        guard !images.isEmpty else { throw StudyDeskError.importFailed }

        let pdfData = NSMutableData()
        guard let consumer = CGDataConsumer(data: pdfData) else { throw StudyDeskError.importFailed }
        var mediaBox = CGRect(origin: .zero, size: images[0].size)
        guard let cgContext = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw StudyDeskError.importFailed
        }

        for image in images {
            guard let cgImage = image.cgImage else { continue }
            var box = CGRect(origin: .zero, size: image.size)
            cgContext.beginPage(mediaBox: &box)
            cgContext.draw(cgImage, in: box)
            cgContext.endPage()
        }
        cgContext.closePDF()

        let fileName = "\(DocumentStore.sanitize(title)).pdf"
        let storageName = try store.write(pdfData as Data, named: fileName, into: .originals)
        guard let pdf = store.loadPDF(storageName) else {
            store.delete(storageName, in: .originals)
            throw StudyDeskError.importFailed
        }
        return try makeDocument(pdf: pdf, storageName: storageName, originalFileName: fileName)
    }

    // MARK: Shared

    private func makeDocument(pdf: PDFDocument, storageName: String, originalFileName: String) throws -> StudyDocument {
        guard pdf.pageCount > 0 else {
            store.delete(storageName, in: .originals)
            throw StudyDeskError.notAPDF
        }

        let title = Self.title(from: pdf, fileName: originalFileName)
        let document = StudyDocument(
            title: title,
            subject: .unspecified,
            storageName: storageName,
            originalFileName: originalFileName,
            pageCount: pdf.pageCount
        )

        if let first = pdf.page(at: 0), let thumbnail = PDFPageRenderer.thumbnail(of: first) {
            document.thumbnailData = thumbnail.jpegData(compressionQuality: 0.7)
        }

        // Text extraction happens once, here, rather than every time the tutor
        // is asked something. Cheap on a text PDF; the OCR fallback for scans
        // is deferred to first use so importing stays instant.
        let pageText = Self.extractText(from: pdf)
        document.extractedText = pageText

        if settings.autoDetectSubject {
            document.subject = SubjectDetector.detect(title: title, pageText: pageText.first ?? "")
        }

        context.insert(document)
        try context.save()
        return document
    }

    /// Prefers the PDF's own title, then a heading from page one, then the file
    /// name. A worksheet called "scan_0043.pdf" should not stay called that.
    static func title(from pdf: PDFDocument, fileName: String) -> String {
        if let metaTitle = (pdf.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String)?.trimmedNonEmpty,
           metaTitle.count > 3, !metaTitle.lowercased().hasSuffix(".pdf") {
            return metaTitle
        }
        if let first = pdf.page(at: 0)?.string {
            let heading = first
                .components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .first { $0.count >= 6 && $0.count <= 70 }
            if let heading { return heading }
        }
        let base = (fileName as NSString).deletingPathExtension
        return base.isEmpty ? "Untitled worksheet" : base
    }

    static func extractText(from pdf: PDFDocument) -> [String] {
        (0..<pdf.pageCount).map { index in
            pdf.page(at: index)?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
    }
}

/// Guesses a subject from the worksheet's own words.
///
/// A keyword count, not a model call: it runs at import time on a device that
/// may be offline, it has to be instant, and the student can always correct it.
/// Being wrong costs one tap; being slow costs the whole import.
enum SubjectDetector {

    private static let signals: [(Subject, [String])] = [
        (.mathematics, ["equation", "solve for", "simplify", "factorise", "factorize", "quadratic", "algebra", "trigonometry", "differentiate", "integrate", "theorem", "hypotenuse"]),
        (.physics, ["velocity", "acceleration", "newton", "circuit", "voltage", "momentum", "wavelength", "friction", "joule", "kinetic energy"]),
        (.chemistry, ["mole", "reaction", "compound", "molecule", "ionic", "covalent", "titration", "periodic table", "catalyst", "electron shell"]),
        (.biology, ["cell", "enzyme", "photosynthesis", "chromosome", "respiration", "organism", "mitosis", "ecosystem", "protein synthesis"]),
        (.economics, ["demand", "supply", "elasticity", "inflation", "gdp", "opportunity cost", "monopoly", "fiscal"]),
        (.business, ["stakeholder", "cash flow", "marketing mix", "break-even", "profit margin", "shareholder", "recruitment"]),
        (.computerScience, ["algorithm", "binary", "compiler", "variable", "pseudocode", "database", "boolean"]),
        (.history, ["treaty", "revolution", "empire", "century", "wartime", "dynasty", "reformation"]),
        (.geography, ["erosion", "climate", "population density", "urbanisation", "tectonic", "river basin"]),
        (.english, ["metaphor", "stanza", "narrator", "protagonist", "imagery", "alliteration", "playwright"])
    ]

    static func detect(title: String, pageText: String) -> Subject {
        let haystack = (title + "\n" + pageText.prefix(3000)).lowercased()
        guard haystack.count > 20 else { return .unspecified }

        var best: (subject: Subject, score: Int) = (.unspecified, 0)
        for (subject, keywords) in signals {
            // The title is worth more than the body: "Quadratic Equations
            // Worksheet 3" is decisive, one stray "equation" in a physics
            // question is not.
            var score = 0
            for keyword in keywords {
                if title.lowercased().contains(keyword) { score += 3 }
                if haystack.contains(keyword) { score += 1 }
            }
            if score > best.score { best = (subject, score) }
        }
        return best.score >= 3 ? best.subject : .unspecified
    }
}
