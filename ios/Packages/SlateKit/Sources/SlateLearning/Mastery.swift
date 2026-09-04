import Foundation
import SlateFoundation
import SlateModel

/// Ability, memory, and the state derived from them.
///
/// Normative specification: `docs/LEARNING-MODEL.md` sections 1-4. Every constant here
/// is checked against `fixtures/learning-golden.json`, which the Python reference
/// emits, so this file and that one cannot drift apart unnoticed.
public enum Mastery {

    // MARK: - Ability

    /// Prior successes and failures. `p0 = 0.4`: an unseen concept is assumed not yet
    /// known, so the first unaided success moves the needle and the first failure
    /// barely does.
    public static let alpha0 = 0.8
    public static let beta0 = 1.2
    /// Days over which old evidence halves in weight.
    public static let evidenceHalfLife = 120.0

    // MARK: - Memory

    public static let sMin = 0.4
    public static let sMax = 3650.0
    public static let stabA = 0.90
    public static let stabB = 0.22
    public static let stabC = 0.90
    public static let lapseK = 2.6
    public static let lapseD = -0.28
    public static let lapseS = 0.44
    public static let lapseR = 0.36

    // MARK: - Difficulty

    public static let dMin = 1.0
    public static let dMax = 10.0
    public static let dStep = 0.9
    public static let dRevert = 0.05

    // MARK: - State thresholds

    public static let pPracticing = 0.40
    public static let pDeveloping = 0.55
    public static let pReliable = 0.75
    public static let pMastered = 0.85
    public static let nDeveloping = 3
    public static let independentForReliable = 2
    public static let sessionsForReliable = 2
    public static let retentionMinDays = 3.0

    // MARK: - Decay caps

    public static let rCapReliable = 0.80
    public static let rCapDeveloping = 0.60
    public static let rCapPracticing = 0.35

    public static let independenceWindow = 20

    // MARK: - Helpers

    public static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
        v < lo ? lo : (v > hi ? hi : v)
    }

    // MARK: - Memory model

    /// FSRS power forgetting curve: the probability of unaided retrieval right now.
    public static func retrievability(stability: Double, elapsedDays: Double) -> Double {
        guard stability > 0 else { return 0 }
        let t = max(0, elapsedDays)
        return pow(1.0 + t / (9.0 * stability), -1.0)
    }

    public static func retrievability(of state: ConceptState, at now: Date) -> Double {
        guard let last = state.lastReviewed else { return 0 }
        return retrievability(stability: state.stability, elapsedDays: now.days(since: last))
    }

    private static func seedStability(outcome: Outcome, difficulty: Double) -> Double {
        let base: Double = switch outcome {
        case .correct: 3.2
        case .partial: 1.6
        case .incorrect: 0.8
        }
        return clamp(base * (11.0 - difficulty) / 10.0, sMin, sMax)
    }

    private static func growStability(_ s: Double, _ d: Double, _ r: Double, _ h: Double) -> Double {
        let factor = exp(stabA) * (11.0 - d) * pow(s, -stabB) * (exp(stabC * (1.0 - r)) - 1.0) * h
        return clamp(s * (1.0 + factor), sMin, sMax)
    }

    private static func lapseStability(_ s: Double, _ d: Double, _ r: Double) -> Double {
        let v = lapseK * pow(d, lapseD) * pow(s, lapseS) * exp(lapseR * (1.0 - r))
        return clamp(v, sMin, min(s, sMax))
    }

    // MARK: - Ability model

    /// Probability of an unaided correct answer when the memory is fresh: "can you do
    /// it today if reminded", separate from whether you would remember it unprompted.
    public static func predictedP(_ state: ConceptState) -> Double {
        let total = state.alpha + state.beta
        return total > 0 ? state.alpha / total : alpha0 / (alpha0 + beta0)
    }

    /// Effective observations behind `predictedP`, excluding the prior.
    public static func evidenceStrength(_ state: ConceptState) -> Double {
        max(0, state.alpha + state.beta - (alpha0 + beta0))
    }

    public static func abilityVariance(_ state: ConceptState) -> Double {
        let a = state.alpha, b = state.beta, n = a + b
        return (a * b) / (n * n * (n + 1.0))
    }

    private static func ageEvidence(_ state: inout ConceptState, elapsedDays: Double?) {
        guard let elapsed = elapsedDays, elapsed > 0 else { return }
        let d = pow(0.5, elapsed / evidenceHalfLife)
        state.alpha = alpha0 + (state.alpha - alpha0) * d
        state.beta = beta0 + (state.beta - beta0) * d
    }

    // MARK: - The fold

    /// Fold one attempt into a concept state. Pure: the input is not modified.
    public static func apply(_ state: ConceptState, _ attempt: Attempt) -> ConceptState {
        var s = state
        let score = attempt.outcome.score
        let w = attempt.assistance.creditWeight
        let g = attempt.kind.gain

        let elapsed: Double? = s.lastReviewed.map { attempt.at.days(since: $0) }
        let rBefore = elapsed.map { retrievability(stability: s.stability, elapsedDays: $0) } ?? 0

        let counts = attempt.errorType?.countsAgainstAbility ?? true
        let unreadable = attempt.errorType == .unreadable

        // Ability. A solved-for answer carries no information about unaided ability, a
        // careless slip is not a knowledge claim, and work we could not read is not
        // evidence of anything.
        if w > 0, counts, !unreadable {
            ageEvidence(&s, elapsedDays: elapsed)
            let credit = score * w
            s.alpha += g * credit
            s.beta += g * (1.0 - credit)
        }

        // Difficulty, mean-reverting so one bad session cannot mark a concept as
        // permanently hard.
        if !unreadable {
            s.difficulty = clamp(
                s.difficulty + dStep * (0.5 - score) - dRevert * (s.difficulty - 5.0),
                dMin, dMax
            )
        }

        // Memory. A careless slip means retrieval of the method succeeded, so it
        // consolidates rather than counting as a lapse.
        if !unreadable {
            let careless = attempt.errorType == .careless
            let succeeded = score >= 0.5 || careless
            var h = attempt.assistance.consolidation
            if careless && score < 0.5 { h = min(h, 0.60) }

            if s.lastReviewed == nil || s.stability <= 0 {
                s.stability = seedStability(outcome: attempt.outcome, difficulty: s.difficulty)
            } else if succeeded {
                s.stability = growStability(s.stability, s.difficulty, rBefore, h)
            } else {
                s.stability = lapseStability(s.stability, s.difficulty, rBefore)
            }
            s.lastReviewed = attempt.at
        }

        // Counters.
        s.attempts += 1
        if let session = attempt.sessionID { s.sessions.insert(session.rawValue) }
        if attempt.outcome == .correct && attempt.assistance.isIndependent {
            s.independentCorrect += 1
            // One attempt supplies at most one of the two strong signals. An unaided
            // transfer success days later is impressive, but it is a single
            // observation and must not satisfy both requirements for mastery alone.
            if attempt.kind == .transfer {
                s.transferCorrect += 1
            } else if let elapsed, elapsed >= retentionMinDays {
                s.retentionCorrect += 1
            }
        }
        if attempt.errorType == .careless { s.carelessSlips += 1 }

        s.recentCredit.append(.init(weight: w, score: score))
        if s.recentCredit.count > independenceWindow {
            s.recentCredit.removeFirst(s.recentCredit.count - independenceWindow)
        }
        return s
    }

    // MARK: - Derived state

    /// What the student could do today if reminded, ignoring forgetting.
    public static func freshState(_ state: ConceptState) -> MasteryState {
        guard state.attempts > 0 else { return .unseen }
        // No ability evidence means no ability claim. A student who has only ever been
        // shown solutions sits at the prior, and the prior is not an achievement.
        guard evidenceStrength(state) > 0 else { return .introduced }

        let p = predictedP(state)
        let reliable = p >= pReliable
            && state.independentCorrect >= independentForReliable
            && state.sessions.count >= sessionsForReliable

        if reliable && state.transferCorrect >= 1 {
            if p >= pMastered && state.retentionCorrect >= 1 { return .mastered }
            return .transferable
        }
        if reliable { return .reliable }
        if p >= pDeveloping && state.attempts >= nDeveloping { return .developing }
        if p >= pPracticing { return .practicing }
        return .introduced
    }

    /// What the student can actually do *now*, after forgetting. `mastered` expires.
    public static func effectiveState(_ state: ConceptState, at now: Date) -> MasteryState {
        let base = freshState(state)
        guard base != .unseen else { return base }
        let r = retrievability(of: state, at: now)
        var cap = MasteryState.mastered
        if r < rCapReliable { cap = .reliable }
        if r < rCapDeveloping { cap = .developing }
        if r < rCapPracticing { cap = .practicing }
        return MasteryState.atRank(min(base.rank, cap.rank))
    }

    /// Share of recent success that was earned unaided. `nil` when there is no success
    /// to attribute — reporting zero independence for someone who has not got anything
    /// right yet would be both wrong and unkind.
    public static func independence(_ state: ConceptState) -> Double? {
        let total = state.recentCredit.reduce(0) { $0 + $1.score }
        guard total > 0 else { return nil }
        return state.recentCredit.reduce(0) { $0 + $1.weight * $1.score } / total
    }
}
