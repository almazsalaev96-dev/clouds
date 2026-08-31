import Foundation
import UIKit

/// The app's only route to the network.
///
/// It talks to the Study Desk proxy and nothing else. There is no API key in
/// this file, in the bundle, or in the keychain — the proxy holds those. What
/// the device holds is a token identifying *this install*, obtained on first
/// launch, which the proxy uses for rate limiting and revocation.
///
/// See `docs/security.md` for why a client-side key is not an option, however
/// well obfuscated.
actor BackendClient {

    struct Configuration: Sendable {
        var baseURL: URL
        var requestTimeout: TimeInterval = 30
        /// Streaming responses legitimately stay open longer than a request.
        var streamTimeout: TimeInterval = 120
    }

    enum Failure: Error, Equatable {
        case notConfigured
        case offline
        case unauthorised
        case rateLimited(retryAfter: Int?)
        case server(status: Int)
        case malformedResponse
        case refused(String)
    }

    private let configuration: Configuration
    private let session: URLSession
    private let tokenKey = "backend.deviceToken"
    private var cachedToken: String?

    init(configuration: Configuration) {
        self.configuration = configuration

        let sessionConfiguration = URLSessionConfiguration.default
        sessionConfiguration.timeoutIntervalForRequest = configuration.requestTimeout
        sessionConfiguration.timeoutIntervalForResource = configuration.streamTimeout
        sessionConfiguration.waitsForConnectivity = false
        sessionConfiguration.httpAdditionalHeaders = [
            "User-Agent": Self.userAgent
        ]
        self.session = URLSession(configuration: sessionConfiguration)
    }

    /// Reads the base URL from Info.plist, which the xcconfig fills in. A build
    /// with no backend configured still runs — the tutor simply reports itself
    /// unavailable, and every offline feature works.
    static func configurationFromBundle() -> Configuration? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "BackendBaseURL") as? String,
              let url = URL(string: raw.trimmingCharacters(in: .whitespaces)),
              url.host != nil else {
            Log.network.notice("No BackendBaseURL configured; tutor features are off")
            return nil
        }
        return Configuration(baseURL: url)
    }

    private static var userAgent: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "StudyDesk/\(version) (iPadOS)"
    }

    // MARK: - Device token

    /// Registers this install, once, and remembers the token in the keychain.
    ///
    /// The token is anonymous: no account, no email, no device identifier that
    /// survives a reinstall. It exists so the proxy can rate limit and revoke,
    /// not to identify a person.
    private func deviceToken() async throws -> String {
        if let cachedToken { return cachedToken }
        if let stored = Keychain.string(for: tokenKey) {
            cachedToken = stored
            return stored
        }

        var request = URLRequest(url: configuration.baseURL.appendingPathComponent("v1/session/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["platform": "ipados"])

        let (data, response) = try await perform(request)
        try Self.validate(response, data: data)

        struct RegisterResponse: Decodable { let token: String }
        guard let token = try? JSONDecoder().decode(RegisterResponse.self, from: data).token, !token.isEmpty else {
            throw Failure.malformedResponse
        }
        Keychain.set(token, for: tokenKey)
        cachedToken = token
        return token
    }

    /// Called when the proxy rejects the token, so the next request re-registers
    /// instead of failing forever.
    private func discardToken() {
        Keychain.remove(tokenKey)
        cachedToken = nil
    }

    // MARK: - Requests

    func postJSON<Body: Encodable>(_ path: String, body: Body) async throws -> Data {
        let request = try await authorizedRequest(path, body: body)
        let (data, response) = try await perform(request)
        do {
            try Self.validate(response, data: data)
        } catch Failure.unauthorised {
            discardToken()
            throw Failure.unauthorised
        }
        return data
    }

    /// Opens a byte stream (used for both SSE and audio).
    func stream<Body: Encodable>(_ path: String, body: Body, accept: String) async throws -> (URLSession.AsyncBytes, HTTPURLResponse) {
        var request = try await authorizedRequest(path, body: body)
        request.setValue(accept, forHTTPHeaderField: "Accept")
        request.timeoutInterval = configuration.streamTimeout

        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw Failure.malformedResponse }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 { discardToken() }
            throw Self.failure(for: http, data: nil)
        }
        return (bytes, http)
    }

    func get(_ path: String) async throws -> Data {
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent(path))
        request.httpMethod = "GET"
        let (data, response) = try await perform(request)
        try Self.validate(response, data: data)
        return data
    }

    private func authorizedRequest<Body: Encodable>(_ path: String, body: Body) async throws -> URLRequest {
        let token = try await deviceToken()
        var request = URLRequest(url: configuration.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .cannotConnectToHost, .cannotFindHost:
                throw Failure.offline
            default:
                throw error
            }
        }
    }

    // MARK: - Response handling

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw Failure.malformedResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw failure(for: http, data: data)
        }
    }

    private static func failure(for http: HTTPURLResponse, data: Data?) -> Failure {
        switch http.statusCode {
        case 401, 403:
            return .unauthorised
        case 429:
            let retryAfter = (http.value(forHTTPHeaderField: "Retry-After")).flatMap(Int.init)
            return .rateLimited(retryAfter: retryAfter)
        case 400..<500:
            // The proxy explains refusals in plain language; pass it through
            // rather than inventing our own wording.
            if let data,
               let payload = try? JSONDecoder().decode([String: String].self, from: data),
               let message = payload["message"], !message.isEmpty {
                return .refused(message)
            }
            return .server(status: http.statusCode)
        default:
            return .server(status: http.statusCode)
        }
    }
}

extension BackendClient.Failure {
    /// Maps a transport failure onto something a student should read.
    var studentFacing: StudyDeskError {
        switch self {
        case .offline: .offline
        case .rateLimited(let retryAfter): .rateLimited(retryAfter: retryAfter)
        case .refused(let message): .tutorRefused(message)
        case .notConfigured, .unauthorised, .server, .malformedResponse: .tutorUnavailable
        }
    }
}
