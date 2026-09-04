import Foundation
import SlateDocuments
import SlateFoundation
import SlateModel

/// Working out what an imported document is, and where its questions are.
///
/// Deliberately incremental and deliberately capped. A five-hundred-page past paper is
/// not sent anywhere; the first pages are, because that is where a document says what
/// it is, and the rest is analysed only if and when the student reaches it.
public struct DocumentAnalyser: Sendable {

    /// Pages read on the first pass. Enough to identify the document and map the work a
    /// student will actually start on, small enough to come back in a couple of seconds.
    public static let firstPassPages = 6
    /// Rendered pages sent when a document has no extractable text.
    public static let maxVisionPages = 3
    public static let maxCharactersPerPage = 6_000

    private let service: TutorService

    public init(service: TutorService) { self.service = service }

    public struct Result: Sendable {
        public let analysis: DocumentAnalysis
        public let map: QuestionMap
        /// True when only part of the document was read, so the caller knows the map is
        /// provisional rather than wrong.
        public let isPartial: Bool
    }

    #if canImport(PDFKit)
    public func analyse(url: URL, filename: String, pageCount: Int) async throws -> Result {
        let upperBound = min(pageCount, Self.firstPassPages)
        let pages = PDFText.pages(of: url, range: 0..<upperBound)

        var request = DocumentRequest(filename: filename)

        if PDFText.needsVision(pages) {
            // A scan. Send pictures, because there is no text to send.
            let images = (0..<min(upperBound, Self.maxVisionPages)).compactMap { index in
                PDFText.image(of: url, page: index).map {
                    ContextEngine.Payload.Image(mediaType: "image/jpeg",
                                                data: $0.base64EncodedString())
                }
            }
            request.images = images.isEmpty ? nil : images
        } else {
            request.text = pages
                .map { "--- Page \($0.index + 1) ---\n\($0.text.prefix(Self.maxCharactersPerPage))" }
                .joined(separator: "\n\n")
        }

        let analysis = try await service.analyseDocument(request)
        let detected = analysis.questions.map { question in
            QuestionMapBuilder.DetectedQuestion(
                number: question.number,
                text: question.text,
                marks: question.marks,
                commandWord: question.commandWord,
                conceptIDs: question.conceptIds.map(ConceptID.init),
                page: question.answerRegion?.page ?? 0,
                region: question.answerRegion.map {
                    NormalisedRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height)
                }
            )
        }

        return Result(
            analysis: analysis,
            map: QuestionMapBuilder.build(from: detected, pageCount: pageCount),
            isPartial: upperBound < pageCount
        )
    }
    #endif

    /// The concepts this document touches, so the learning engine has names to work
    /// with rather than opaque identifiers.
    public static func concepts(from analysis: DocumentAnalysis) -> [Concept] {
        analysis.concepts.map {
            Concept(conceptID: ConceptID($0.id), name: $0.name, subject: analysis.subject)
        }
    }
}
