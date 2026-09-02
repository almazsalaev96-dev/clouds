import Foundation

/// Choosing the question that tells us the most.
///
/// Specification: `docs/LEARNING-MODEL.md` section 7. A diagnostic is not a small exam:
/// its job is to split hypotheses. Six questions chosen this way beat thirty chosen to
/// cover a syllabus, and a question every hypothesis answers identically scores exactly
/// zero bits and is never asked.
public enum InformationGain {
    static let epsilon = 1e-12

    public struct Hypothesis: Sendable, Hashable, Identifiable {
        public let id: String
        public let label: String
        public let prior: Double
        public init(id: String, label: String, prior: Double) {
            self.id = id; self.label = label; self.prior = prior
        }
    }

    /// A question we could ask, with how each hypothesis would answer it.
    ///
    /// Response categories are diagnostic *signatures*, not just right and wrong:
    /// "answered with the sign flipped" is its own category, and that is where the
    /// discriminating power comes from.
    public struct CandidateQuestion: Sendable, Hashable, Identifiable {
        public let id: String
        public let prompt: String
        public let likelihoods: [String: [String: Double]]
        public let estimatedMinutes: Double
        public let conceptID: String

        public init(id: String, prompt: String, likelihoods: [String: [String: Double]],
                    estimatedMinutes: Double = 1.5, conceptID: String = "") {
            self.id = id; self.prompt = prompt; self.likelihoods = likelihoods
            self.estimatedMinutes = estimatedMinutes; self.conceptID = conceptID
        }

        public var responses: [String] {
            Set(likelihoods.values.flatMap(\.keys)).sorted()
        }
    }

    /// Shannon entropy in bits.
    public static func entropy(_ distribution: [Double]) -> Double {
        var h = 0.0
        for p in distribution where p > epsilon { h -= p * log2(p) }
        return h
    }

    public static func normalise(_ weights: [String: Double]) -> [String: Double] {
        let total = weights.values.reduce(0, +)
        guard total > epsilon else {
            guard !weights.isEmpty else { return [:] }
            let even = 1.0 / Double(weights.count)
            return weights.mapValues { _ in even }
        }
        return weights.mapValues { $0 / total }
    }

    public static func priorMap(_ hypotheses: [Hypothesis]) -> [String: Double] {
        normalise(Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.id, max(0, $0.prior)) }))
    }

    public static func responseMarginal(prior: [String: Double],
                                        question: CandidateQuestion) -> [String: Double] {
        var out: [String: Double] = [:]
        for r in question.responses {
            out[r] = question.likelihoods.reduce(0.0) { sum, entry in
                sum + (prior[entry.key] ?? 0) * (entry.value[r] ?? 0)
            }
        }
        return out
    }

    public static func posterior(prior: [String: Double],
                                 question: CandidateQuestion,
                                 response: String) -> [String: Double] {
        var weights: [String: Double] = [:]
        for (h, p) in prior {
            weights[h] = p * (question.likelihoods[h]?[response] ?? 0)
        }
        // The observation is impossible under every hypothesis we hold. Refuse to
        // invent certainty: keep the prior and let the caller widen the hypothesis set.
        guard weights.values.reduce(0, +) > epsilon else { return prior }
        return normalise(weights)
    }

    /// Bits of uncertainty about the cause this question is expected to remove.
    public static func expectedInformationGain(prior: [String: Double],
                                               question: CandidateQuestion) -> Double {
        let hPrior = entropy(Array(prior.values))
        var hPost = 0.0
        for (r, pr) in responseMarginal(prior: prior, question: question) where pr > epsilon {
            hPost += pr * entropy(Array(posterior(prior: prior, question: question, response: r).values))
        }
        return max(0, hPrior - hPost)
    }

    public static func rank(prior: [String: Double],
                            candidates: [CandidateQuestion]) -> [(question: CandidateQuestion, score: Double)] {
        candidates
            .map { ($0, expectedInformationGain(prior: prior, question: $0) / max(0.25, $0.estimatedMinutes)) }
            .sorted {
                if $0.1 != $1.1 { return $0.1 > $1.1 }
                if $0.0.estimatedMinutes != $1.0.estimatedMinutes {
                    return $0.0.estimatedMinutes < $1.0.estimatedMinutes
                }
                return $0.0.id < $1.0.id
            }
            .map { (question: $0.0, score: $0.1) }
    }

    public static func selectNext(prior: [String: Double],
                                  candidates: [CandidateQuestion],
                                  asked: Set<String> = []) -> CandidateQuestion? {
        let remaining = candidates.filter { !asked.contains($0.id) }
        guard !remaining.isEmpty, let best = rank(prior: prior, candidates: remaining).first else {
            return nil
        }
        return best.score > epsilon ? best.question : nil
    }

    /// A diagnostic in progress. Stops as soon as it is confident enough, because
    /// asking a question whose answer you can already predict wastes a student's time.
    public struct Run: Sendable {
        public struct Answered: Sendable, Hashable {
            public let questionID: String
            public let response: String
        }

        public private(set) var prior: [String: Double]
        public private(set) var asked: [String] = []
        public private(set) var transcript: [Answered] = []

        public init(hypotheses: [Hypothesis]) {
            prior = priorMap(hypotheses)
        }

        public mutating func observe(_ question: CandidateQuestion, response: String) {
            prior = posterior(prior: prior, question: question, response: response)
            asked.append(question.id)
            transcript.append(Answered(questionID: question.id, response: response))
        }

        public var leading: (id: String, probability: Double) {
            let best = prior.max { a, b in
                a.value == b.value ? a.key < b.key : a.value < b.value
            }
            return (best?.key ?? "", best?.value ?? 0)
        }

        public func isConfident(threshold: Double = 0.80) -> Bool {
            leading.probability >= threshold
        }

        public var remainingUncertainty: Double { entropy(Array(prior.values)) }
    }

    public static func runAdaptive(hypotheses: [Hypothesis],
                                   candidates: [CandidateQuestion],
                                   maxQuestions: Int = 6,
                                   confidence: Double = 0.80,
                                   responder: (CandidateQuestion) -> String) -> Run {
        var run = Run(hypotheses: hypotheses)
        for _ in 0..<maxQuestions {
            if run.isConfident(threshold: confidence) { break }
            guard let q = selectNext(prior: run.prior, candidates: candidates,
                                     asked: Set(run.asked)) else { break }
            run.observe(q, response: responder(q))
        }
        return run
    }
}
