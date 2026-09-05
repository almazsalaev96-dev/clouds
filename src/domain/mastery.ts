/**
 * The mastery model.
 *
 * A student who answers five easy recall questions correctly has not mastered a
 * topic. Percentage-correct is the metric almost every revision product shows
 * and it is close to worthless, because it is dominated by the difficulty of
 * whatever happened to be served and says nothing about whether the knowledge
 * will survive until the exam.
 *
 * Lodestar models mastery as six separate signals, then combines them. Each is
 * independently displayable, because a student whose problem is *retention*
 * needs completely different advice from one whose problem is *transfer*.
 *
 *   ability      latent skill, Elo-style, difficulty-aware
 *   retention    probability of recall right now, given decay since last success
 *   consistency  how stable recent performance is (variance penalty)
 *   coverage     how much of the topic's objectives have been evidenced at all
 *   transfer     performance on unfamiliar contexts and cross-topic questions
 *   fluency      speed relative to the exam's own minutes-per-mark budget
 *
 * Every field is derived from attempts. Nothing here is authored or guessed.
 */

import { overallDifficulty, type Attempt, type Difficulty, type Question } from "./question";
import { clamp01, daysBetween, estimate, type Estimate, type Timestamp, type Unit } from "./types";

export interface MasteryEvidence {
  attempt: Attempt;
  question: Pick<Question, "id" | "marks" | "difficulty" | "type" | "topicIds" | "objectiveIds">;
}

export interface MasterySignals {
  ability: Unit;
  retention: Unit;
  consistency: Unit;
  coverage: Unit;
  transfer: Unit;
  fluency: Unit;
}

export interface Mastery {
  /** Composite 0..1. */
  score: Unit;
  signals: MasterySignals;
  /** The weakest signal — what to actually work on. */
  limitingFactor: keyof MasterySignals;
  band: MasteryBand;
  observations: number;
  lastEvidenceAt?: Timestamp;
  confidence: Unit;
}

export type MasteryBand =
  | "untested"
  | "fragile"
  | "developing"
  | "competent"
  | "secure"
  | "exam-ready";

export const MASTERY_BANDS: { band: MasteryBand; min: number; label: string; meaning: string }[] = [
  { band: "untested", min: -1, label: "Untested", meaning: "No evidence yet — a diagnostic question would tell us a lot." },
  { band: "fragile", min: 0.0, label: "Fragile", meaning: "Evidence is mostly negative. Start from the mechanism, not from questions." },
  { band: "developing", min: 0.35, label: "Developing", meaning: "You can do it with support. Not yet reliable under exam pressure." },
  { band: "competent", min: 0.55, label: "Competent", meaning: "Reliable on familiar questions. Untested on unfamiliar framing." },
  { band: "secure", min: 0.72, label: "Secure", meaning: "Consistent across difficulty. Keep it alive with spaced review." },
  { band: "exam-ready", min: 0.86, label: "Exam-ready", meaning: "Consistent, fast, and holds up in unfamiliar contexts." },
];

export function bandFor(score: Unit, observations: number): MasteryBand {
  if (observations === 0) return "untested";
  let band: MasteryBand = "fragile";
  for (const b of MASTERY_BANDS) if (score >= b.min && b.band !== "untested") band = b.band;
  return band;
}

// ---------------------------------------------------------------------------
// Ability — difficulty-aware, recency-weighted
// ---------------------------------------------------------------------------

/**
 * Elo-style update. A correct answer on a hard question moves ability far more
 * than a correct answer on an easy one; a wrong answer on an easy question is
 * far more informative than a wrong answer on a hard one. This is the property
 * percentage-correct entirely lacks.
 */
export function updateAbility(prior: Unit, difficulty: Unit, outcome: Unit, weight = 1): Unit {
  const expected = 1 / (1 + Math.exp(-6 * (prior - difficulty)));
  const k = 0.18 * weight;
  return clamp01(prior + k * (outcome - expected));
}

const HALF_LIFE_WEIGHT_DAYS = 30;

/** Older evidence counts less: a student in March is not the student in June. */
function recencyWeight(at: Timestamp, now: Timestamp): number {
  const days = Math.max(0, daysBetween(at, now));
  return Math.pow(0.5, days / HALF_LIFE_WEIGHT_DAYS);
}

// ---------------------------------------------------------------------------
// Retention — the forgetting curve
// ---------------------------------------------------------------------------

/**
 * Probability the student can recall this *right now*.
 *
 * Uses the standard exponential forgetting curve R = exp(-t/S) where S is a
 * stability that grows with each successful, spaced retrieval. This is the same
 * family of model as SM-2/FSRS and is what makes "3 concepts are beginning to
 * fade" a real statement rather than a decorative notification.
 */
export function retrievability(stabilityDays: number, daysSince: number): Unit {
  if (stabilityDays <= 0) return 0;
  return clamp01(Math.exp(-daysSince / stabilityDays));
}

export type RetentionState = "secure" | "stable" | "fading" | "at-risk" | "forgotten";

export function retentionState(r: Unit): RetentionState {
  if (r >= 0.9) return "secure";
  if (r >= 0.75) return "stable";
  if (r >= 0.55) return "fading";
  if (r >= 0.3) return "at-risk";
  return "forgotten";
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export interface ComputeMasteryOptions {
  now: Timestamp;
  /** Objectives that exist in this topic, for the coverage signal. */
  totalObjectives?: number;
  /** Exam minutes-per-mark budget, for the fluency signal. */
  minutesPerMark?: number;
  /** Current stability estimate in days, from the scheduler. */
  stabilityDays?: number;
}

export function computeMastery(
  evidence: MasteryEvidence[],
  opts: ComputeMasteryOptions,
): Mastery {
  const now = opts.now;
  if (evidence.length === 0) {
    return {
      score: 0,
      signals: { ability: 0, retention: 0, consistency: 0, coverage: 0, transfer: 0, fluency: 0 },
      limitingFactor: "coverage",
      band: "untested",
      observations: 0,
      confidence: 0,
    };
  }

  const sorted = [...evidence].sort(
    (a, b) => new Date(a.attempt.submittedAt).getTime() - new Date(b.attempt.submittedAt).getTime(),
  );

  // --- ability -------------------------------------------------------------
  let ability: Unit = 0.35; // sceptical prior: assume not-yet-learned
  for (const e of sorted) {
    const d = overallDifficulty(e.question.difficulty);
    const outcome = e.attempt.maxScore > 0 ? e.attempt.score / e.attempt.maxScore : 0;
    ability = updateAbility(ability, d, outcome, recencyWeight(e.attempt.submittedAt, now));
  }

  // --- retention -----------------------------------------------------------
  const last = sorted[sorted.length - 1]!;
  const daysSince = Math.max(0, daysBetween(last.attempt.submittedAt, now));
  const stability = opts.stabilityDays ?? inferStability(sorted);
  const retention = retrievability(stability, daysSince);

  // --- consistency ---------------------------------------------------------
  const recent = sorted.slice(-8);
  const fractions = recent.map((e) => (e.attempt.maxScore ? e.attempt.score / e.attempt.maxScore : 0));
  const mean = fractions.reduce((s, f) => s + f, 0) / fractions.length;
  const variance = fractions.reduce((s, f) => s + (f - mean) ** 2, 0) / fractions.length;
  // sd of 0.5 is maximal inconsistency for a 0..1 variable
  const consistency = clamp01(1 - Math.sqrt(variance) / 0.5);

  // --- coverage ------------------------------------------------------------
  const seenObjectives = new Set<string>();
  for (const e of sorted) for (const o of e.question.objectiveIds ?? []) seenObjectives.add(o);
  const coverage =
    opts.totalObjectives && opts.totalObjectives > 0
      ? clamp01(seenObjectives.size / opts.totalObjectives)
      : clamp01(new Set(sorted.map((e) => e.question.id)).size / 8);

  // --- transfer ------------------------------------------------------------
  const transferEvidence = sorted.filter(
    (e) => e.question.difficulty.unfamiliarContext >= 0.6 || e.question.topicIds.length > 1,
  );
  const transfer = transferEvidence.length
    ? clamp01(
        transferEvidence.reduce(
          (s, e) => s + (e.attempt.maxScore ? e.attempt.score / e.attempt.maxScore : 0),
          0,
        ) / transferEvidence.length,
      )
    : 0; // never assume transfer that has not been demonstrated

  // --- fluency -------------------------------------------------------------
  const timed = sorted.filter((e) => e.attempt.timeSpent > 0 && e.question.marks > 0);
  let fluency = 0.5;
  if (timed.length && opts.minutesPerMark) {
    const budget = opts.minutesPerMark * 60;
    const ratios = timed.map((e) => e.attempt.timeSpent / (budget * e.question.marks));
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    // 1.0 = exactly on budget. Faster is good up to a point; 2x over is bad.
    fluency = clamp01(1 - Math.max(0, avg - 1) / 1.2);
  }

  const signals: MasterySignals = { ability, retention, consistency, coverage, transfer, fluency };

  // Weights: ability and retention dominate, because a topic you cannot do or
  // cannot recall is not mastered whatever else is true. Transfer is weighted
  // meaningfully because it is what separates a B from an A*.
  const score = clamp01(
    0.34 * ability +
      0.22 * retention +
      0.14 * consistency +
      0.1 * coverage +
      0.14 * transfer +
      0.06 * fluency,
  );

  const limitingFactor = (Object.keys(signals) as (keyof MasterySignals)[]).reduce((a, b) =>
    signals[a] <= signals[b] ? a : b,
  );

  const observations = sorted.length;
  const confidence = clamp01(observations / 12) * clamp01(0.4 + coverage * 0.6);

  return {
    score,
    signals,
    limitingFactor,
    band: bandFor(score, observations),
    observations,
    lastEvidenceAt: last.attempt.submittedAt,
    confidence,
  };
}

/**
 * Infer memory stability from spacing of past successes when the scheduler has
 * no record — e.g. for topics practised through questions rather than cards.
 */
function inferStability(evidence: MasteryEvidence[]): number {
  const successes = evidence.filter(
    (e) => e.attempt.maxScore > 0 && e.attempt.score / e.attempt.maxScore >= 0.6,
  );
  if (successes.length === 0) return 1;
  if (successes.length === 1) return 3;
  // Each additional spaced success roughly doubles stability, capped so we
  // never claim a topic is safe for a year on thin evidence.
  const span = Math.max(
    1,
    daysBetween(successes[0]!.attempt.submittedAt, successes[successes.length - 1]!.attempt.submittedAt),
  );
  return Math.min(120, Math.max(2, span / Math.max(1, successes.length - 1)) * successes.length);
}

/** A one-sentence, honest reading of a mastery record. */
export function explainMastery(m: Mastery): Estimate<Unit> {
  const because: string[] = [];
  if (m.observations === 0) {
    because.push("No questions attempted on this yet.");
    return estimate(0, 0, because, 0);
  }
  const s = m.signals;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  because.push(`Ability ${pct(s.ability)} from ${m.observations} attempt${m.observations === 1 ? "" : "s"}, weighted by question difficulty.`);
  if (s.retention < 0.7) because.push(`Recall is decaying — estimated ${pct(s.retention)} chance you could produce this cold today.`);
  if (s.consistency < 0.6) because.push("Performance swings between attempts, which usually means the method isn't stable yet.");
  if (s.transfer === 0) because.push("Never tested in an unfamiliar context, so transfer is unproven.");
  else if (s.transfer < 0.5) because.push(`Drops to ${pct(s.transfer)} on unfamiliar framing — recognition without understanding.`);
  if (s.coverage < 0.6) because.push(`Only ${pct(s.coverage)} of this topic's objectives have been tested at all.`);
  return estimate(m.score, m.confidence, because, m.observations);
}
