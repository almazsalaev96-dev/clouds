import Foundation
import SwiftData

/// The private study record.
///
/// Everything here stays on the iPad. There is no server-side analytics, no
/// event pipeline, and nothing is reported anywhere. It exists so a student can
/// answer "what have I actually done this week?" — and it is deliberately dull:
/// no streaks, no badges, nothing engineered to pull someone back into the app.
@MainActor
final class StudyAnalytics {

    private let context: ModelContext
    private let memory: StudyMemory?
    private var session: StudySession?

    init(context: ModelContext, memory: StudyMemory?) {
        self.context = context
        self.memory = memory
    }

    // MARK: Sessions

    func beginSession(document: StudyDocument) {
        endSession()
        let session = StudySession(document: document)
        context.insert(session)
        self.session = session
    }

    func endSession() {
        guard let session else { return }
        session.endedAt = Date()
        // Sessions under half a minute are almost always "opened the wrong
        // file". Recording them makes the weekly total meaningless.
        if session.duration < 30 {
            context.delete(session)
        }
        self.session = nil
        try? context.save()
    }

    func recordPageVisit() {
        session?.pagesVisited += 1
    }

    func recordStroke() {
        session?.strokesAdded += 1
    }

    func recordTutorRequest(mode: TutorMode, subject: Subject) {
        session?.tutorRequests += 1
        if mode == .hint { session?.hintsTaken += 1 }
    }

    /// The topic label comes from the proxy, not from the student's text.
    func recordTopicHelp(topic: String, subject: Subject) {
        memory?.noteHelpRequested(topic: topic, subject: subject)
    }

    // MARK: Reading

    struct Summary {
        var totalTime: TimeInterval
        var sessionCount: Int
        var pagesWorked: Int
        var tutorRequests: Int
        var hintsTaken: Int
        var bySubject: [(subject: Subject, time: TimeInterval)]

        /// The share of tutor requests that were hints rather than answers.
        /// Presented as encouragement, never as a score.
        var hintRatio: Double {
            tutorRequests > 0 ? Double(hintsTaken) / Double(tutorRequests) : 0
        }
    }

    func summary(since date: Date) -> Summary {
        let descriptor = FetchDescriptor<StudySession>(
            predicate: #Predicate { $0.startedAt >= date }
        )
        let sessions = (try? context.fetch(descriptor)) ?? []

        var timeBySubject: [String: TimeInterval] = [:]
        for session in sessions {
            timeBySubject[session.subjectName, default: 0] += session.duration
        }

        return Summary(
            totalTime: sessions.reduce(0) { $0 + $1.duration },
            sessionCount: sessions.count,
            pagesWorked: sessions.reduce(0) { $0 + $1.pagesVisited },
            tutorRequests: sessions.reduce(0) { $0 + $1.tutorRequests },
            hintsTaken: sessions.reduce(0) { $0 + $1.hintsTaken },
            bySubject: timeBySubject
                .map { (Subject($0.key), $0.value) }
                .sorted { $0.1 > $1.1 }
        )
    }

    func eraseAll() {
        try? context.delete(model: StudySession.self)
        try? context.save()
    }
}
