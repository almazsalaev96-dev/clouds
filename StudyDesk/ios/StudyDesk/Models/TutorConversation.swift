import Foundation
import SwiftData

enum TutorRole: String, Codable {
    case student
    case tutor
}

/// One thread of tutoring on one document. Kept per-document rather than
/// globally so "why is this wrong?" resolves against the right worksheet, and
/// so deleting a document takes its conversations with it.
@Model
final class TutorConversation {
    var id: UUID = UUID()
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    var document: StudyDocument?

    @Relationship(deleteRule: .cascade, inverse: \TutorMessage.conversation)
    var messages: [TutorMessage] = []

    init(document: StudyDocument?) {
        self.id = UUID()
        self.document = document
    }

    var orderedMessages: [TutorMessage] {
        messages.sorted { $0.createdAt < $1.createdAt }
    }

    /// The last few turns, which is all the model needs to resolve "make that
    /// easier" or "give me an example". Sending the whole history would cost
    /// tokens and latency for no gain.
    func recentTurns(limit: Int = 8) -> [TutorMessage] {
        Array(orderedMessages.suffix(limit))
    }
}

@Model
final class TutorMessage {
    var id: UUID = UUID()
    var roleRaw: String = TutorRole.student.rawValue
    var text: String = ""
    var createdAt: Date = Date()

    /// Which page the student was on. Lets search jump back to the right place.
    var pageIndex: Int = 0
    /// Which tutor mode produced this (`hint`, `check`, …), for the study report.
    var modeRaw: String?
    /// Whether the tutor was given an image of the page for this turn. Surfaced
    /// in the UI so the student always knows when a picture left the device.
    var includedPageImage: Bool = false

    var conversation: TutorConversation?

    init(role: TutorRole, text: String, pageIndex: Int, mode: TutorMode? = nil, includedPageImage: Bool = false) {
        self.id = UUID()
        self.roleRaw = role.rawValue
        self.text = text
        self.pageIndex = pageIndex
        self.modeRaw = mode?.rawValue
        self.includedPageImage = includedPageImage
        self.createdAt = Date()
    }

    var role: TutorRole {
        get { TutorRole(rawValue: roleRaw) ?? .student }
        set { roleRaw = newValue.rawValue }
    }

    var mode: TutorMode? {
        get { modeRaw.flatMap(TutorMode.init(rawValue:)) }
        set { modeRaw = newValue?.rawValue }
    }
}
