import Foundation
import Vision
import UIKit

/// On-device text recognition.
///
/// Two callers, two very different jobs:
///
/// - `recognizePrinted(in:)` runs on a rendered PDF page when the PDF has no
///   text layer (a scan or a photo). Accurate mode, language correction on.
/// - `recognizeHandwriting(in:)` runs on an image of the **ink layer alone** —
///   transparent everywhere the student didn't write. Because the printed
///   worksheet isn't in that image, nothing printed can be misread as the
///   student's answer.
///
/// Everything here stays on the iPad. Handwriting is never uploaded for
/// recognition; only the resulting short string is, and only when the student
/// asks a question.
struct TextRecognizer {

    struct Line: Equatable {
        var text: String
        /// Normalised, origin top-left, matching how the rest of the app talks
        /// about page coordinates.
        var boundingBox: CGRect
        var confidence: Float
    }

    enum Kind {
        case printed
        case handwriting

        var recognitionLevel: VNRequestTextRecognitionLevel { .accurate }

        /// Language correction helps printed prose and actively hurts
        /// handwritten algebra — it will happily turn "x2" into "x2" but also
        /// "3n" into "3m". Off for handwriting.
        var usesLanguageCorrection: Bool {
            switch self {
            case .printed: true
            case .handwriting: false
            }
        }

        /// Ignore specks. A stray dot recognised as "l" would be reported to
        /// the tutor as part of the student's answer.
        var minimumConfidence: Float {
            switch self {
            case .printed: 0.3
            case .handwriting: 0.25
            }
        }
    }

    func recognize(_ image: CGImage, kind: Kind) async throws -> [Line] {
        try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let observations = request.results as? [VNRecognizedTextObservation] ?? []
                let lines: [Line] = observations.compactMap { observation in
                    guard let candidate = observation.topCandidates(1).first,
                          candidate.confidence >= kind.minimumConfidence else { return nil }
                    return Line(
                        text: candidate.string,
                        boundingBox: Self.flip(observation.boundingBox),
                        confidence: candidate.confidence
                    )
                }
                continuation.resume(returning: lines)
            }

            request.recognitionLevel = kind.recognitionLevel
            request.usesLanguageCorrection = kind.usesLanguageCorrection
            request.recognitionLanguages = ["en-GB", "en-US"]
            // Mathematical symbols students write constantly. Vision won't
            // invent them, but it will prefer them over lookalikes when told
            // they're plausible.
            request.customWords = ["=", "≈", "≤", "≥", "√", "π", "θ", "Δ", "∴", "×", "÷", "cm", "mm", "kg", "ms", "°"]

            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    /// Reading-order text, one line per row.
    func recognizeText(_ image: CGImage, kind: Kind) async throws -> String {
        let lines = try await recognize(image, kind: kind)
        return Self.readingOrder(lines)
            .map(\.text)
            .joined(separator: "\n")
    }

    /// Vision returns a bottom-left origin; the rest of Study Desk uses
    /// top-left like UIKit and PDF page space.
    private static func flip(_ box: CGRect) -> CGRect {
        CGRect(x: box.origin.x, y: 1 - box.origin.y - box.height, width: box.width, height: box.height)
    }

    /// Sorts top-to-bottom, then left-to-right, treating lines whose vertical
    /// centres are close as being on the same row. Without this, a worksheet
    /// with two answer columns comes out interleaved nonsense.
    static func readingOrder(_ lines: [Line]) -> [Line] {
        let rowTolerance: CGFloat = 0.015
        return lines.sorted { a, b in
            let aMid = a.boundingBox.midY
            let bMid = b.boundingBox.midY
            if abs(aMid - bMid) <= rowTolerance {
                return a.boundingBox.minX < b.boundingBox.minX
            }
            return aMid < bMid
        }
    }
}
