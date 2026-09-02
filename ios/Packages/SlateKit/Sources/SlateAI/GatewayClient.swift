import Foundation
import SlateFoundation
import SlateModel

/// The one network peer.
///
/// The app holds no provider credentials and knows nothing about which model answered.
/// Everything crosses this boundary as a typed request and a typed reply, so swapping
/// what runs behind the gateway changes nothing above it.
public protocol TutorService: Sendable {
    func tutor(_ payload: ContextEngine.Payload) async throws -> TutorReply
    func check(_ request: CheckRequest) async throws -> CheckReply
    /// Deterministic marking only. No model, no cost, and fast enough to show a verdict
    /// while the explanation is still being written.
    func gradeOnly(submitted: String, expected: [ExpectedAnswer]) async throws -> GradeOnlyReply
    func readHandwriting(_ request: HandwritingRequest) async throws -> HandwritingReading
    func generate(_ request: GenerateRequest) async throws -> [GeneratedQuestion]
}

public struct ExpectedAnswer: Codable, Sendable, Hashable {
    public var text: String
    public var shape: String?
    public var unit: String?
    public var significantFigures: Int?

    public init(text: String, shape: String? = nil, unit: String? = nil,
                significantFigures: Int? = nil) {
        self.text = text; self.shape = shape; self.unit = unit
        self.significantFigures = significantFigures
    }
}

public struct CheckRequest: Codable, Sendable {
    public var submitted: String
    public var expected: [ExpectedAnswer]
    public var questionText: String?
    public var workingText: String?
    public var previousAttempts: [String]?
    public var subject: String?
    public var redactTerms: [String]?
    public var images: [ContextEngine.Payload.Image]?

    public init(submitted: String, expected: [ExpectedAnswer], questionText: String? = nil,
                workingText: String? = nil, previousAttempts: [String]? = nil,
                subject: String? = nil, redactTerms: [String]? = nil,
                images: [ContextEngine.Payload.Image]? = nil) {
        self.submitted = submitted; self.expected = expected; self.questionText = questionText
        self.workingText = workingText; self.previousAttempts = previousAttempts
        self.subject = subject; self.redactTerms = redactTerms; self.images = images
    }
}

public struct HandwritingRequest: Codable, Sendable {
    public var images: [ContextEngine.Payload.Image]
    public var questionText: String?
    public var subject: String?
    public init(images: [ContextEngine.Payload.Image], questionText: String? = nil,
                subject: String? = nil) {
        self.images = images; self.questionText = questionText; self.subject = subject
    }
}

public struct GenerateRequest: Codable, Sendable {
    public var conceptIds: [String]
    public var subject: String?
    public var count: Int
    public var difficulty: String?
    public var basedOn: String?
    public var purpose: String?

    public init(conceptIDs: [ConceptID], subject: String? = nil, count: Int = 3,
                difficulty: String? = nil, basedOn: String? = nil, purpose: String? = nil) {
        self.conceptIds = conceptIDs.map(\.rawValue)
        self.subject = subject; self.count = count; self.difficulty = difficulty
        self.basedOn = basedOn; self.purpose = purpose
    }
}

/// Failures the student might actually see, already worded for them.
public enum TutorError: Error, LocalizedError, Sendable {
    case offline
    case busy(retryAfter: TimeInterval)
    case unavailable(String)
    case declined
    case tooMuchContext
    case notConfigured

    public var errorDescription: String? {
        switch self {
        case .offline:
            "You are offline. Writing, marking up and exporting still work."
        case .busy:
            "The tutor is busy. Try again in a moment. Your work is saved."
        case .unavailable(let message):
            message
        case .declined:
            "The tutor could not answer this one. Your work is saved."
        case .tooMuchContext:
            "That is more of the page than the tutor can look at in one go. Try selecting a smaller area."
        case .notConfigured:
            "This copy of the app is not set up to reach the tutor."
        }
    }

    public var isRetryable: Bool {
        switch self {
        case .busy, .offline: true
        default: false
        }
    }
}

public actor GatewayClient: TutorService {

    private let baseURL: URL
    private let token: String?
    private let deviceID: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(baseURL: URL, token: String?, deviceID: String,
                session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.deviceID = deviceID
        self.session = session

        decoder = JSONDecoder()
        encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
    }

    // MARK: - Endpoints

    public func tutor(_ payload: ContextEngine.Payload) async throws -> TutorReply {
        try await post("/v1/tutor", payload, as: Envelope<TutorReply>.self).reply
    }

    public func check(_ request: CheckRequest) async throws -> CheckReply {
        try await post("/v1/check", request, as: CheckEnvelope.self).check
    }

    public func gradeOnly(submitted: String, expected: [ExpectedAnswer]) async throws -> GradeOnlyReply {
        struct Body: Codable { let submitted: String; let expected: [ExpectedAnswer] }
        return try await post("/v1/grade", Body(submitted: submitted, expected: expected),
                              as: GradeEnvelope.self).grade
    }

    public func readHandwriting(_ request: HandwritingRequest) async throws -> HandwritingReading {
        try await post("/v1/handwriting", request, as: ReadingEnvelope.self).reading
    }

    public func generate(_ request: GenerateRequest) async throws -> [GeneratedQuestion] {
        try await post("/v1/generate", request, as: QuestionsEnvelope.self).questions
    }

    // MARK: - Transport

    private struct Envelope<T: Decodable>: Decodable { let reply: T }
    private struct CheckEnvelope: Decodable { let check: CheckReply }
    private struct GradeEnvelope: Decodable { let grade: GradeOnlyReply }
    private struct ReadingEnvelope: Decodable { let reading: HandwritingReading }
    private struct QuestionsEnvelope: Decodable { let questions: [GeneratedQuestion] }
    private struct ErrorEnvelope: Decodable {
        struct Body: Decodable { let code: String; let message: String; let retryable: Bool }
        let error: Body
    }

    private func post<Body: Encodable, Reply: Decodable>(
        _ path: String, _ body: Body, as: Reply.Type
    ) async throws -> Reply {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(deviceID, forHTTPHeaderField: "x-slate-device")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization") }
        request.httpBody = try encoder.encode(body)
        // Long enough for a considered answer, short enough that a student is not left
        // watching a spinner wondering whether the app has died.
        request.timeoutInterval = 60

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .notConnectedToInternet
            || error.code == .networkConnectionLost {
            throw TutorError.offline
        } catch {
            throw TutorError.unavailable("Could not reach the tutor.")
        }

        guard let http = response as? HTTPURLResponse else {
            throw TutorError.unavailable("The tutor sent something unexpected.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapFailure(status: http.statusCode, data: data, response: http)
        }
        do {
            return try decoder.decode(Reply.self, from: data)
        } catch {
            throw TutorError.unavailable("The tutor's answer could not be read.")
        }
    }

    private func mapFailure(status: Int, data: Data, response: HTTPURLResponse) -> TutorError {
        let body = try? decoder.decode(ErrorEnvelope.self, from: data)
        switch status {
        case 401, 403: return .notConfigured
        case 413: return .tooMuchContext
        case 422: return .declined
        case 429, 503:
            let header = response.value(forHTTPHeaderField: "retry-after").flatMap(Double.init)
            return .busy(retryAfter: header ?? 5)
        default:
            // The gateway already wrote something a student can read; prefer it to
            // anything invented here.
            return .unavailable(body?.error.message
                ?? "The tutor could not answer right now. Your work is saved.")
        }
    }
}
