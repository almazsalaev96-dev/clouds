import Foundation
import CoreGraphics

/// Everything the tutor is told about what the student is looking at.
///
/// This type is the contract between the app and the model. Two properties
/// matter more than the rest:
///
/// - `printedText` comes from the PDF's text layer — it is the *question*.
/// - `studentWork` comes from OCR of the Pencil layer only — it is the
///   student's *answer*.
///
/// Because the two arrive from physically separate layers, the tutor is never
/// guessing which marks on the page belong to whom. That is what makes
/// "check my work" and "find my mistake" produce real feedback instead of a
/// description of the picture.
struct StudyContext: Codable, Sendable, Equatable {

    // MARK: Document

    struct DocumentInfo: Codable, Sendable, Equatable {
        var title: String
        var subject: String
        var pageNumber: Int          // 1-based, as a human would say it
        var pageCount: Int
    }

    // MARK: Region

    /// A rectangle the student lassoed or dragged, in normalised page
    /// coordinates (0...1, origin top-left) so it survives any zoom level.
    struct Region: Codable, Sendable, Equatable {
        var x: Double
        var y: Double
        var width: Double
        var height: Double

        init(normalisedRect: CGRect) {
            x = normalisedRect.origin.x
            y = normalisedRect.origin.y
            width = normalisedRect.width
            height = normalisedRect.height
        }

        var rect: CGRect { CGRect(x: x, y: y, width: width, height: height) }
    }

    // MARK: Conversation

    struct Turn: Codable, Sendable, Equatable {
        var role: String   // "student" | "tutor"
        var text: String
    }

    var document: DocumentInfo

    /// The printed content of the current page, trimmed to what's useful.
    var printedText: String?
    /// Text the student selected with the text tool, if any.
    var selectedText: String?
    /// Handwriting recognised from the ink layer of this page. May be rough —
    /// the proxy is told to treat it as approximate and to say so if the
    /// reading is ambiguous rather than mark a correct answer wrong.
    var studentWork: String?
    /// The question the app believes is active, e.g. "Question 4(b)".
    var detectedQuestion: String?
    /// Printed text from the page before/after, included only when the current
    /// page alone doesn't contain the question (a continued question, a table
    /// of data on the facing page).
    var neighbouringText: String?

    var region: Region?
    /// True when a rendered image of the page or region accompanies this
    /// request. The UI shows this to the student before anything is sent.
    var includesImage: Bool = false

    var recentTurns: [Turn] = []
    var mode: TutorMode?
    /// Free text the student typed. Nil when they only tapped a mode chip.
    var studentMessage: String?

    /// Exam Mode withholds full solutions unless the student allowed them.
    var examMode: Bool = false
    var allowFullSolutions: Bool = true

    /// Topics this student has needed help with before, on this subject only.
    /// Used to offer a refresher, never to profile them. Empty when memory is
    /// switched off in Settings.
    var strugglingWith: [String] = []
}

extension StudyContext {
    /// A rough size estimate used to decide whether to include neighbouring
    /// pages. Cheaper than tokenising and accurate enough for a budget check.
    var approximateCharacterCount: Int {
        [printedText, selectedText, studentWork, neighbouringText, studentMessage]
            .compactMap { $0?.count }
            .reduce(0, +)
            + recentTurns.reduce(0) { $0 + $1.text.count }
    }

    /// What the student is shown before a request leaves the device, so
    /// "what gets sent?" is answerable at the moment it matters.
    var privacySummary: [String] {
        var lines: [String] = []
        lines.append("Page \(document.pageNumber) of \(document.title)")
        if includesImage {
            lines.append(region == nil ? "A picture of this page" : "A picture of the part you selected")
        }
        if printedText?.isEmpty == false { lines.append("The printed text on this page") }
        if studentWork?.isEmpty == false { lines.append("A reading of your handwriting") }
        if !recentTurns.isEmpty { lines.append("Your last few messages in this chat") }
        return lines
    }
}
