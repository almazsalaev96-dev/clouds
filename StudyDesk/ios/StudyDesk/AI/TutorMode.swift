import Foundation

/// What the student is asking the tutor to do.
///
/// Modes are not prompt templates the app pastes together — they are an
/// instruction the proxy turns into a system prompt, so the teaching policy
/// lives in one auditable place on the server and can be improved without
/// shipping an app update.
enum TutorMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case explain
    case hint
    case check
    case solve
    case teach
    case simplify
    case stepByStep
    case mistakeFinder
    case examAnswer
    case summarize
    case quizMe
    case planAnswer

    var id: String { rawValue }

    var title: String {
        switch self {
        case .explain: "Explain"
        case .hint: "Hint"
        case .check: "Check my work"
        case .solve: "Full solution"
        case .teach: "Teach me this"
        case .simplify: "Simpler"
        case .stepByStep: "Step by step"
        case .mistakeFinder: "Find my mistake"
        case .examAnswer: "Exam answer"
        case .summarize: "Summarise"
        case .quizMe: "Quiz me"
        case .planAnswer: "Plan my answer"
        }
    }

    var symbolName: String {
        switch self {
        case .explain: "text.bubble"
        case .hint: "lightbulb"
        case .check: "checkmark.circle"
        case .solve: "equal.square"
        case .teach: "graduationcap"
        case .simplify: "arrow.down.right.and.arrow.up.left"
        case .stepByStep: "list.number"
        case .mistakeFinder: "magnifyingglass"
        case .examAnswer: "doc.text.magnifyingglass"
        case .summarize: "text.alignleft"
        case .quizMe: "questionmark.circle"
        case .planAnswer: "list.bullet.rectangle"
        }
    }

    /// The phrasing sent as the student's turn when they tap a mode chip
    /// instead of typing. Written as the student would say it so the transcript
    /// reads like a conversation, not a log of button presses.
    var spokenIntent: String {
        switch self {
        case .explain: "Explain this."
        case .hint: "Give me a hint."
        case .check: "Check my work."
        case .solve: "Show me the full solution."
        case .teach: "Teach me this topic."
        case .simplify: "Explain that more simply."
        case .stepByStep: "Walk me through this step by step."
        case .mistakeFinder: "Find where I went wrong."
        case .examAnswer: "How should I answer this in an exam?"
        case .summarize: "Summarise this page."
        case .quizMe: "Quiz me on this."
        case .planAnswer: "Help me plan my answer."
        }
    }

    /// Modes that hand over an answer. Exam Mode blocks these unless the
    /// student has explicitly allowed solutions.
    var revealsAnswer: Bool {
        switch self {
        case .solve, .examAnswer: true
        default: false
        }
    }

    /// Modes that only make sense once there is handwriting to look at.
    var requiresStudentWork: Bool {
        switch self {
        case .check, .mistakeFinder: true
        default: false
        }
    }

    /// The chips offered by default for a subject. Keeps the panel to four
    /// useful buttons instead of a menu of twelve.
    static func suggested(for subject: Subject, hasStudentWork: Bool) -> [TutorMode] {
        var modes: [TutorMode]
        switch subject.id {
        case Subject.mathematics.id, Subject.physics.id, Subject.chemistry.id:
            modes = [.hint, .stepByStep, .check, .explain]
        case Subject.biology.id, Subject.geography.id, Subject.history.id:
            modes = [.explain, .summarize, .quizMe, .teach]
        case Subject.economics.id, Subject.business.id, Subject.english.id:
            modes = [.planAnswer, .explain, .examAnswer, .check]
        case Subject.computerScience.id:
            modes = [.explain, .stepByStep, .check, .hint]
        default:
            modes = [.explain, .hint, .check, .summarize]
        }
        if !hasStudentWork {
            modes.removeAll { $0.requiresStudentWork }
            if !modes.contains(.explain) { modes.append(.explain) }
        }
        return Array(modes.prefix(4))
    }
}
