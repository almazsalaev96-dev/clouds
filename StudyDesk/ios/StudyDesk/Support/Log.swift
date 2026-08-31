import OSLog

/// Subsystem-wide logging.
///
/// Nothing here ever logs document text, handwriting, or tutor messages. A
/// student's worksheet can contain anything, and the console is not a private
/// place. Log identifiers and counts, never content.
enum Log {
    private static let subsystem = "com.studydesk.app"

    static let app = Logger(subsystem: subsystem, category: "app")
    static let persistence = Logger(subsystem: subsystem, category: "persistence")
    static let pdf = Logger(subsystem: subsystem, category: "pdf")
    static let pencil = Logger(subsystem: subsystem, category: "pencil")
    static let tutor = Logger(subsystem: subsystem, category: "tutor")
    static let voice = Logger(subsystem: subsystem, category: "voice")
    static let export = Logger(subsystem: subsystem, category: "export")
    static let network = Logger(subsystem: subsystem, category: "network")
}
