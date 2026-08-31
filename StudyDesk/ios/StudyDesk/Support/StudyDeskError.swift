import Foundation

/// Every error a student can see.
///
/// The rule from the spec, enforced by making it the only way to describe a
/// failure in the UI: no status codes, no stack traces, and every message says
/// what happened to their work.
enum StudyDeskError: LocalizedError, Equatable {
    case offline
    case tutorUnavailable
    case tutorTimedOut
    case tutorRefused(String)
    case voiceUnavailable
    case importFailed
    case notAPDF
    case exportFailed
    case saveFailed
    case scanUnavailable
    case rateLimited(retryAfter: Int?)

    var errorDescription: String? {
        switch self {
        case .offline:
            "You're offline. Your documents and notes are still here — your tutor needs a connection."
        case .tutorUnavailable:
            "I couldn't reach your tutor just now. Your work is safely saved. Try again in a moment."
        case .tutorTimedOut:
            "That took longer than expected, so I stopped waiting. Your work is safely saved."
        case .tutorRefused(let reason):
            reason
        case .voiceUnavailable:
            "I can't speak right now, but you can still read the explanation."
        case .importFailed:
            "That file couldn't be opened. Try importing it again."
        case .notAPDF:
            "Study Desk works with PDFs and images. That file is something else."
        case .exportFailed:
            "The finished PDF couldn't be created. Nothing was lost — your work is still on the page."
        case .saveFailed:
            "We couldn't finish saving that change. Keep Study Desk open while we retry."
        case .scanUnavailable:
            "Scanning isn't available on this device. You can import a PDF or photo instead."
        case .rateLimited(let retryAfter):
            if let retryAfter {
                "Your tutor needs a short break — try again in about \(retryAfter) seconds."
            } else {
                "Your tutor needs a short break. Try again shortly."
            }
        }
    }

    /// Whether offering a "Try again" button makes sense.
    var isRetryable: Bool {
        switch self {
        case .offline, .tutorUnavailable, .tutorTimedOut, .voiceUnavailable, .saveFailed, .rateLimited:
            true
        case .tutorRefused, .importFailed, .notAPDF, .exportFailed, .scanUnavailable:
            false
        }
    }
}
