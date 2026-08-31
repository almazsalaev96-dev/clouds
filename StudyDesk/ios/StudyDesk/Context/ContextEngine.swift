import Foundation
import PDFKit
import PencilKit
import UIKit

/// Assembles what the tutor is told, and — just as importantly — what it isn't.
///
/// ## The budget
///
/// A 150-page textbook must never be uploaded to answer one question about
/// page 12. The engine sends, in order of preference:
///
/// 1. the current page's printed text (usually a few hundred characters),
/// 2. the student's handwriting on that page, read on-device,
/// 3. one image — of the selected region if there is one, otherwise the page,
/// 4. neighbouring page text, and only when the current page's text looks like
///    a continuation or the page has no question on it at all,
/// 5. the last few conversation turns.
///
/// Everything else stays on the iPad. That is a privacy property and a latency
/// property at the same time.
@MainActor
final class ContextEngine {

    struct Input {
        var document: StudyDocument
        var pdf: PDFDocument
        var pageIndex: Int
        var drawing: PKDrawing
        var selectedText: String?
        var region: CGRect?
        var mode: TutorMode?
        var studentMessage: String?
        var conversation: TutorConversation?
        var examMode: Bool = false
        var allowFullSolutions: Bool = true
        var includeImage: Bool = true
    }

    struct Output {
        var context: StudyContext
        var attachments: [TutorAttachment]
    }

    private let handwriting: HandwritingRecognizer
    private let recognizer = TextRecognizer()
    private let questionDetector = QuestionDetector()
    private let repository: DrawingRepository?
    private let memory: StudyMemory?

    /// Above this, printed text is trimmed to the active question. Roughly a
    /// dense A4 page of prose; beyond it the extra text is nearly always a
    /// second question the student isn't asking about.
    private let printedTextBudget = 2600

    init(handwriting: HandwritingRecognizer, repository: DrawingRepository?, memory: StudyMemory?) {
        self.handwriting = handwriting
        self.repository = repository
        self.memory = memory
    }

    func build(_ input: Input) async -> Output {
        let page = input.pdf.page(at: input.pageIndex)
        let pageSize = page?.bounds(for: .mediaBox).size ?? .zero

        // 1. Printed text. From the PDF text layer where there is one; OCR of
        //    the rendered page where there isn't (a scan or a photo).
        var printedText = input.document.text(onPage: input.pageIndex)
        if printedText == nil, let page {
            printedText = await ocrPrintedText(page: page)
        }

        // 2. The student's own work, read from the ink layer alone.
        let reading = await studentReading(input: input, pageSize: pageSize)

        // 3. Which question is being answered.
        let question = printedText.flatMap {
            questionDetector.activeQuestion(in: $0, inkVerticalPosition: reading.verticalPosition)
        }

        // Trim the page down to the active question when the page is long.
        var trimmedPrinted = printedText
        if let printedText, printedText.count > printedTextBudget, let question, !question.text.isEmpty {
            trimmedPrinted = question.text
        } else if let printedText, printedText.count > printedTextBudget {
            trimmedPrinted = String(printedText.prefix(printedTextBudget))
        }

        // 4. Neighbouring pages, only when this page can't stand alone.
        let neighbouring = needsNeighbouringPages(printedText: trimmedPrinted, question: question)
            ? neighbouringText(document: input.document, pageIndex: input.pageIndex)
            : nil

        // 5. The image, if one is wanted.
        var attachments: [TutorAttachment] = []
        if input.includeImage, let page {
            if let attachment = renderAttachment(page: page, region: input.region, drawing: input.drawing) {
                attachments.append(attachment)
            }
        }

        var context = StudyContext(
            document: .init(
                title: input.document.title,
                subject: input.document.subject.name,
                pageNumber: input.pageIndex + 1,
                pageCount: max(input.document.pageCount, 1)
            ),
            printedText: trimmedPrinted?.trimmedNonEmpty,
            selectedText: input.selectedText?.trimmedNonEmpty,
            studentWork: reading.isEmpty ? nil : annotatedReading(reading),
            detectedQuestion: question?.label,
            neighbouringText: neighbouring,
            region: input.region.map(StudyContext.Region.init(normalisedRect:)),
            includesImage: !attachments.isEmpty,
            recentTurns: turns(from: input.conversation),
            mode: input.mode,
            studentMessage: input.studentMessage?.trimmedNonEmpty,
            examMode: input.examMode,
            allowFullSolutions: input.allowFullSolutions,
            strugglingWith: memory?.topics(for: input.document.subject) ?? []
        )

        // A last guard against a pathological page. If the assembled context is
        // still enormous, the neighbouring text is the first thing to go.
        if context.approximateCharacterCount > 12_000 {
            context.neighbouringText = nil
        }

        return Output(context: context, attachments: attachments)
    }

    // MARK: Student work

    private func studentReading(input: Input, pageSize: CGSize) async -> HandwritingRecognizer.Reading {
        guard !input.drawing.strokes.isEmpty else { return .empty }

        // A page whose ink hasn't changed since it was last read comes back
        // instantly from the annotation record.
        if let cached = repository?.cachedRecognition(forPage: input.pageIndex), !cached.isEmpty {
            return .init(
                text: cached,
                confidence: 0.8,
                verticalPosition: HandwritingRecognizer.verticalPosition(of: input.drawing, pageSize: pageSize)
            )
        }

        // When a region is selected, read only the ink inside it — otherwise
        // "check this line" gets checked against the whole page of working.
        let drawing = input.region.map { region in
            Self.crop(input.drawing, to: region, pageSize: pageSize)
        } ?? input.drawing

        let reading = await handwriting.read(drawing, pageSize: pageSize)
        if input.region == nil, !reading.isEmpty {
            repository?.storeRecognition(reading.text, forPage: input.pageIndex)
        }
        return reading
    }

    /// Tells the model how much to trust the reading. A misread digit must
    /// produce a question, not a wrong verdict.
    private func annotatedReading(_ reading: HandwritingRecognizer.Reading) -> String {
        reading.confidence < 0.45
            ? "\(reading.text)\n\n[Handwriting was hard to read — confirm with the student before judging it wrong.]"
            : reading.text
    }

    private static func crop(_ drawing: PKDrawing, to normalisedRegion: CGRect, pageSize: CGSize) -> PKDrawing {
        guard pageSize.width > 0, pageSize.height > 0 else { return drawing }
        let rect = CGRect(
            x: normalisedRegion.minX * pageSize.width,
            y: normalisedRegion.minY * pageSize.height,
            width: normalisedRegion.width * pageSize.width,
            height: normalisedRegion.height * pageSize.height
        )
        // Keep any stroke that meaningfully overlaps the box, rather than only
        // strokes wholly inside it — a descender crossing the edge is still
        // part of the answer.
        let kept = drawing.strokes.filter { $0.renderBounds.intersects(rect) }
        return PKDrawing(strokes: kept)
    }

    // MARK: Printed text

    private func ocrPrintedText(page: PDFPage) async -> String? {
        guard let image = PDFPageRenderer.image(of: page, longEdge: 1600)?.cgImage else { return nil }
        do {
            let text = try await recognizer.recognizeText(image, kind: .printed)
            return text.trimmedNonEmpty
        } catch {
            Log.tutor.error("Page OCR failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    /// A page needs its neighbours when it has no question label on it (the
    /// question started on the previous page) or almost no text at all (a page
    /// of blank answer lines, or a diagram referenced from elsewhere).
    private func needsNeighbouringPages(printedText: String?, question: QuestionDetector.DetectedQuestion?) -> Bool {
        guard let printedText, !printedText.isEmpty else { return true }
        if question == nil && printedText.count < 400 { return true }
        return printedText.count < 120
    }

    private func neighbouringText(document: StudyDocument, pageIndex: Int) -> String? {
        var parts: [String] = []
        for offset in [-1, 1] {
            let index = pageIndex + offset
            guard let text = document.text(onPage: index)?.trimmedNonEmpty else { continue }
            parts.append("[Page \(index + 1)]\n\(String(text.prefix(1200)))")
        }
        return parts.isEmpty ? nil : parts.joined(separator: "\n\n")
    }

    // MARK: Attachments

    private func renderAttachment(page: PDFPage, region: CGRect?, drawing: PKDrawing) -> TutorAttachment? {
        let longEdge = region == nil ? PDFPageRenderer.tutorImageLongEdge : PDFPageRenderer.tutorRegionLongEdge
        guard let image = PDFPageRenderer.image(of: page, region: region, drawing: drawing, longEdge: longEdge),
              let jpeg = PDFPageRenderer.jpegData(image) else { return nil }
        return TutorAttachment(
            kind: region == nil ? .page : .region,
            jpeg: jpeg,
            width: Int(image.size.width),
            height: Int(image.size.height)
        )
    }

    private func turns(from conversation: TutorConversation?) -> [StudyContext.Turn] {
        guard let conversation else { return [] }
        return conversation.recentTurns().map {
            StudyContext.Turn(role: $0.role.rawValue, text: String($0.text.prefix(1200)))
        }
    }
}

extension String {
    /// Nil rather than an empty or whitespace-only string, so optional-chained
    /// context fields are honest about being absent.
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
