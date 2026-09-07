/**
 * FSRS-6 scheduling, anchored to the exam date (spec §04.12).
 *
 * This is the real FSRS-6 update, not SM-2 wearing its name: a power forgetting curve
 * with a fitted decay, difficulty with linear damping and mean reversion, separate
 * stability updates for recall, lapse and same-day review, and intervals solved from a
 * desired retention rather than multiplied by a fixed factor.
 *
 * Two things are ours rather than FSRS's, and both come from the exam:
 *   - desired retention ramps with the phase of the paper (04-FSRS-002);
 *   - no card is ever scheduled past the paper that assesses it (04-FSRS-003), and new
 *     material inside eight weeks takes the Cepeda first interval (04-FSRS-004).
 *
 * Grading is two-button by default (04-FSRS-007): 'again' and 'good'.
 */

/** @typedef {{stability:number, difficulty:number, due:string, reps:number, lapses:number, last_review:string|null}} CardState */

/**
 * The FSRS-6 default parameter vector: 21 weights, the values shipped as defaults by
 * the open-spaced-repetition project (py-fsrs / ts-fsrs v5, FSRS-6) and fitted on the
 * public Anki review dataset. w[0..3] are the initial stabilities for Again/Hard/Good/
 * Easy, w[4..5] set initial difficulty, w[6..7] its update, w[8..16] the stability
 * updates, w[17..19] the same-day update, w[20] the forgetting-curve decay.
 * They stand in until a per-user fit is available (04-FSRS-005).
 * @type {ReadonlyArray<number>}
 */
export const FSRS_6_DEFAULT_PARAMETERS = Object.freeze([
  0.2172, 1.1771, 3.2602, 16.1507, 7.0114, 0.57, 2.0966, 0.0069, 1.5261, 0.112,
  1.0178, 1.849, 0.1133, 0.3127, 2.2934, 0.2191, 3.0004, 0.7536, 0.3332, 0.1437,
  0.2,
])

const DAY_MS = 86400000
const S_MIN = 0.01
const S_MAX = 36500

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const clampS = (s) => clamp(Number.isFinite(s) ? s : S_MIN, S_MIN, S_MAX)

/** Grade names to FSRS grades. Two buttons by default; hard/easy accepted if opted in. */
const GRADES = { again: 1, hard: 2, good: 3, easy: 4 }

/** @param {'again'|'good'|'hard'|'easy'|number} grade @returns {1|2|3|4} */
export function gradeValue(grade) {
  if (typeof grade === 'number') return /** @type {1|2|3|4} */ (clamp(Math.round(grade), 1, 4))
  return /** @type {1|2|3|4} */ (GRADES[String(grade).toLowerCase()] ?? 3)
}

/** The curve's decay exponent, negative. @param {ReadonlyArray<number>} w */
export const decayOf = (w = FSRS_6_DEFAULT_PARAMETERS) => -w[20]

/** The curve's factor, chosen so R = 0.9 at t = S. @param {ReadonlyArray<number>} w */
export const factorOf = (w = FSRS_6_DEFAULT_PARAMETERS) => Math.pow(0.9, 1 / decayOf(w)) - 1

/**
 * Retrievability: the probability of recall t days after the last review.
 * R(t, S) = (1 + FACTOR · t / S) ^ DECAY.
 * @param {number} elapsedDays
 * @param {number} stability
 * @param {ReadonlyArray<number>} [w]
 * @returns {number} 0-1
 */
export function retrievability(elapsedDays, stability, w = FSRS_6_DEFAULT_PARAMETERS) {
  const s = clampS(stability)
  const t = Math.max(0, Number(elapsedDays) || 0)
  return clamp(Math.pow(1 + factorOf(w) * (t / s), decayOf(w)), 0, 1)
}

/**
 * The interval, in days, at which a card of this stability sits at the desired
 * retention. I(r, S) = (S / FACTOR) · (r ^ (1 / DECAY) − 1).
 * @param {number} stability
 * @param {number} retention 0-1, exclusive
 * @param {ReadonlyArray<number>} [w]
 * @returns {number} whole days, at least 1
 */
export function intervalFor(stability, retention, w = FSRS_6_DEFAULT_PARAMETERS) {
  const s = clampS(stability)
  const r = clamp(Number(retention) || 0.9, 0.5, 0.995)
  const days = (s / factorOf(w)) * (Math.pow(r, 1 / decayOf(w)) - 1)
  return clamp(Math.round(days), 1, S_MAX)
}

/** Initial stability for a first review at this grade. */
export function initialStability(grade, w = FSRS_6_DEFAULT_PARAMETERS) {
  return clampS(w[gradeValue(grade) - 1])
}

/** Initial difficulty, 1-10. D0(G) = w4 − e^(w5·(G−1)) + 1. */
export function initialDifficulty(grade, w = FSRS_6_DEFAULT_PARAMETERS) {
  return clamp(w[4] - Math.exp(w[5] * (gradeValue(grade) - 1)) + 1, 1, 10)
}

/**
 * Difficulty update with linear damping and mean reversion toward D0(Easy), so
 * difficulty neither ratchets to 10 on a bad week nor drifts free of the material.
 */
export function nextDifficulty(difficulty, grade, w = FSRS_6_DEFAULT_PARAMETERS) {
  const d = clamp(Number(difficulty) || 5, 1, 10)
  const g = gradeValue(grade)
  const delta = -w[6] * (g - 3)
  const damped = d + delta * ((10 - d) / 9)
  return clamp(w[7] * initialDifficulty(4, w) + (1 - w[7]) * damped, 1, 10)
}

/**
 * Stability after a successful recall. The (e^(w10·(1−R)) − 1) term is the spacing
 * effect: a review that was nearly forgotten buys far more stability than one that was
 * fresh, which is why the scheduler waits.
 */
export function nextStabilityRecall(difficulty, stability, r, grade, w = FSRS_6_DEFAULT_PARAMETERS) {
  const d = clamp(Number(difficulty) || 5, 1, 10)
  const s = clampS(stability)
  const g = gradeValue(grade)
  const hard = g === 2 ? w[15] : 1
  const easy = g === 4 ? w[16] : 1
  const gain = 1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy
  return clampS(s * Math.max(1, gain))
}

/** Stability after a lapse. Never above the stability the card already had. */
export function nextStabilityForget(difficulty, stability, r, w = FSRS_6_DEFAULT_PARAMETERS) {
  const d = clamp(Number(difficulty) || 5, 1, 10)
  const s = clampS(stability)
  const f = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))
  return clampS(Math.min(f, s))
}

/** Stability after a same-day review: small, and monotone in the grade. */
export function nextStabilityShortTerm(stability, grade, w = FSRS_6_DEFAULT_PARAMETERS) {
  const s = clampS(stability)
  const g = gradeValue(grade)
  const next = s * Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19])
  return clampS(g >= 3 ? Math.max(next, s) : Math.min(next, s))
}

/**
 * Which phase of revision the student is in, relative to the paper that assesses this
 * card (§04.13). A: more than eight weeks out. B: three to eight weeks. C: inside three
 * weeks — the last fortnight sits inside C.
 * @param {number} daysToExam use Infinity when no exam date is set
 * @returns {'A'|'B'|'C'}
 */
export function phaseFor(daysToExam) {
  if (daysToExam == null || daysToExam === '') return 'A'
  const d = Number(daysToExam)
  if (!Number.isFinite(d)) return 'A'
  if (d > 56) return 'A'
  if (d >= 21) return 'B'
  return 'C'
}

/** Desired retention by phase (04-FSRS-002). */
export const PHASE_RETENTION = Object.freeze({ A: 0.85, B: 0.9, C: 0.95 })

/**
 * The retention the scheduler aims at, which ramps as the paper approaches: 0.85 far
 * out, 0.90 from eight to three weeks, 0.95 inside three weeks. A higher target means
 * shorter intervals and more reviews a day, which is why it is not the target all year.
 *
 * @param {number} daysToExam days until the paper, Infinity when none is set
 * @param {'A'|'B'|'C'} [phase] override, when the caller already knows the phase
 * @returns {number} 0.85 | 0.90 | 0.95
 */
export function desiredRetention(daysToExam, phase) {
  const p = phase || phaseFor(daysToExam)
  return PHASE_RETENTION[p] ?? PHASE_RETENTION.A
}

/**
 * The first interval for new material. Inside eight weeks the Cepeda prior beats FSRS's
 * learning steps: the optimal first gap is 10-20% of the time to the paper, so 35 days
 * out the first review lands on day 4-7 (04-FSRS-004). Outside eight weeks, FSRS.
 * @param {number} daysToExam
 * @param {number} stability
 * @param {number} retention
 * @param {ReadonlyArray<number>} [w]
 * @returns {number} whole days, at least 1
 */
export function firstInterval(daysToExam, stability, retention, w = FSRS_6_DEFAULT_PARAMETERS) {
  const d = Number(daysToExam)
  if (Number.isFinite(d) && d <= 56 && d > 0) return clamp(Math.round(0.15 * d), 1, Math.max(1, Math.floor(d)))
  return intervalFor(stability, retention, w)
}

const toMs = (value) => {
  if (value == null || value === '') return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Review a card and return its next state.
 *
 * @param {Partial<CardState>} card the row as stored: stability, difficulty, due, reps,
 *   lapses, last_review. A card with no reps or no stability is treated as new.
 * @param {'again'|'good'} grade two buttons; 'hard' and 'easy' are honoured if the
 *   student has opted into the four-button set.
 * @param {Object} [opts]
 * @param {string|Date} [opts.now] the review time; defaults to the current time
 * @param {string|Date|null} [opts.examDate] the paper this card is assessed by
 * @param {'A'|'B'|'C'} [opts.phase] override the phase the retention target comes from
 * @param {number} [opts.retention] override the retention target outright
 * @param {boolean} [opts.seenSolution] the answer was handed over: force a retest inside
 *   24-72 hours regardless of stability (04-FSRS-006)
 * @param {boolean} [opts.overconfident] answered "Sure" and wrong: halve the interval
 * @param {ReadonlyArray<number>} [opts.parameters] a fitted parameter vector
 * @returns {CardState & {interval:number, retrievability:number, retention:number, phase:'A'|'B'|'C', cappedToExam:boolean}}
 */
export function review(card = {}, grade = 'good', opts = {}) {
  const w = opts.parameters && opts.parameters.length === 21 ? opts.parameters : FSRS_6_DEFAULT_PARAMETERS
  const g = gradeValue(grade)
  const nowMs = toMs(opts.now) ?? Date.now()
  const lastMs = toMs(card.last_review ?? card.lastReview)
  const reps = Math.max(0, Number(card.reps) || 0)
  const lapses = Math.max(0, Number(card.lapses) || 0)
  const priorS = Number(card.stability) || 0
  const isNew = reps === 0 || lastMs == null || priorS <= 0

  const examMs = toMs(opts.examDate)
  const daysToExam = examMs == null ? Infinity : (examMs - nowMs) / DAY_MS
  const phase = opts.phase || phaseFor(daysToExam)
  const retention = clamp(Number(opts.retention) || desiredRetention(daysToExam, phase), 0.7, 0.99)

  const elapsedDays = isNew ? 0 : Math.max(0, (nowMs - lastMs) / DAY_MS)
  let stability
  let difficulty
  let r = 0

  if (isNew) {
    stability = initialStability(g, w)
    difficulty = initialDifficulty(g, w)
  } else {
    r = retrievability(elapsedDays, priorS, w)
    difficulty = nextDifficulty(card.difficulty, g, w)
    if (elapsedDays < 1) stability = nextStabilityShortTerm(priorS, g, w)
    else if (g === 1) stability = nextStabilityForget(difficulty, priorS, r, w)
    else stability = nextStabilityRecall(difficulty, priorS, r, w)
  }

  let interval = isNew
    ? firstInterval(daysToExam, stability, retention, w)
    : intervalFor(stability, retention, w)

  if (opts.overconfident) interval = Math.max(1, Math.round(interval * 0.5))
  if (opts.seenSolution) interval = clamp(interval, 1, 3)

  // 04-FSRS-003: nothing is scheduled past the paper. A card that would land after it is
  // pulled to the last day it can still be useful.
  let dueMs = nowMs + interval * DAY_MS
  let cappedToExam = false
  if (examMs != null) {
    const lastUseful = examMs - DAY_MS
    if (dueMs > lastUseful) {
      dueMs = Math.max(nowMs, lastUseful)
      interval = Math.max(0, Math.round((dueMs - nowMs) / DAY_MS))
      cappedToExam = true
    }
  }

  return {
    stability: Number(stability.toFixed(4)),
    difficulty: Number(difficulty.toFixed(4)),
    due: new Date(dueMs).toISOString(),
    reps: reps + 1,
    lapses: lapses + (g === 1 ? 1 : 0),
    last_review: new Date(nowMs).toISOString(),
    interval,
    retrievability: Number(r.toFixed(4)),
    retention,
    phase,
    cappedToExam,
  }
}

/**
 * Days between now and the exam date, for callers that hold ISO strings.
 * @param {string|Date|null} examDate
 * @param {string|Date} [now]
 * @returns {number} Infinity when there is no exam date
 */
export function daysToExam(examDate, now) {
  const examMs = toMs(examDate)
  if (examMs == null) return Infinity
  return (examMs - (toMs(now) ?? Date.now())) / DAY_MS
}
