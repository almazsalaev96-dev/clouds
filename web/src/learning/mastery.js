/**
 * Ability, memory, and the state derived from them.
 *
 * The third implementation of the model specified in docs/LEARNING-MODEL.md, after the
 * Python reference and the Swift that ships on device. All three are held to
 * fixtures/learning-golden.json, so this one is not a simplification for the web — it
 * is the same arithmetic, and `test/parity.test.js` proves it.
 */

// --- ability ---------------------------------------------------------------
export const ALPHA_0 = 0.8;
export const BETA_0 = 1.2;
export const EVIDENCE_HALF_LIFE = 120.0;

// --- memory ----------------------------------------------------------------
export const S_MIN = 0.4;
export const S_MAX = 3650.0;
export const STAB_A = 0.90;
export const STAB_B = 0.22;
export const STAB_C = 0.90;
export const LAPSE_K = 2.6;
export const LAPSE_D = -0.28;
export const LAPSE_S = 0.44;
export const LAPSE_R = 0.36;

// --- difficulty ------------------------------------------------------------
export const D_MIN = 1.0;
export const D_MAX = 10.0;
export const D_STEP = 0.9;
export const D_REVERT = 0.05;

// --- state thresholds ------------------------------------------------------
export const P_PRACTICING = 0.40;
export const P_DEVELOPING = 0.55;
export const P_RELIABLE = 0.75;
export const P_MASTERED = 0.85;
export const N_DEVELOPING = 3;
export const INDEPENDENT_FOR_RELIABLE = 2;
export const SESSIONS_FOR_RELIABLE = 2;
export const RETENTION_MIN_DAYS = 3.0;

// --- decay caps ------------------------------------------------------------
export const R_CAP_RELIABLE = 0.80;
export const R_CAP_DEVELOPING = 0.60;
export const R_CAP_PRACTICING = 0.35;

export const INDEPENDENCE_WINDOW = 20;

export const OUTCOME_SCORE = { correct: 1.0, partial: 0.5, incorrect: 0.0 };

export const CREDIT_WEIGHT = {
  none: 1.00, nudge: 0.85, hint: 0.70, guided: 0.50, worked: 0.25, solution: 0.00,
};

export const CONSOLIDATION = {
  none: 1.00, nudge: 1.00, hint: 0.60, guided: 0.60, worked: 0.30, solution: 0.15,
};

export const KIND_GAIN = {
  practice: 1.00, retrieval: 1.15, transfer: 1.30, exam: 1.20, diagnostic: 1.10,
};

/** A slip is not a knowledge claim, and work we could not read is not evidence. */
export const COUNTS_AGAINST_ABILITY = (errorType) =>
  errorType !== "careless" && errorType !== "unreadable";

export const STATES = [
  "unseen", "introduced", "practicing", "developing", "reliable", "transferable", "mastered",
];

export const rank = (state) => STATES.indexOf(state);
export const atRank = (r) => STATES[Math.min(Math.max(r, 0), STATES.length - 1)];

export const STATE_LABEL = {
  unseen: "Not started",
  introduced: "Just met this",
  practicing: "Practising",
  developing: "Getting there",
  reliable: "You can do this on your own",
  transferable: "You can use this in new situations",
  mastered: "Solid, and it has stuck",
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const daysBetween = (a, b) => (b - a) / 86_400_000;

export function newState(conceptId) {
  return {
    conceptId,
    alpha: ALPHA_0,
    beta: BETA_0,
    difficulty: 5.0,
    stability: 0.0,
    lastReviewed: null,
    attempts: 0,
    independentCorrect: 0,
    transferCorrect: 0,
    retentionCorrect: 0,
    carelessSlips: 0,
    sessions: [],
    recentCredit: [],
  };
}

/** FSRS power forgetting curve: P(successful unaided retrieval right now). */
export function retrievability(stability, elapsedDays) {
  if (stability <= 0) return 0;
  return Math.pow(1 + Math.max(0, elapsedDays) / (9 * stability), -1);
}

export function currentRetrievability(state, now) {
  if (state.lastReviewed === null) return 0;
  return retrievability(state.stability, daysBetween(state.lastReviewed, now));
}

function seedStability(outcome, difficulty) {
  const base = { correct: 3.2, partial: 1.6, incorrect: 0.8 }[outcome];
  return clamp((base * (11 - difficulty)) / 10, S_MIN, S_MAX);
}

function growStability(s, d, r, h) {
  const factor =
    Math.exp(STAB_A) * (11 - d) * Math.pow(s, -STAB_B) *
    (Math.exp(STAB_C * (1 - r)) - 1) * h;
  return clamp(s * (1 + factor), S_MIN, S_MAX);
}

function lapseStability(s, d, r) {
  const v = LAPSE_K * Math.pow(d, LAPSE_D) * Math.pow(s, LAPSE_S) * Math.exp(LAPSE_R * (1 - r));
  return clamp(v, S_MIN, Math.min(s, S_MAX));
}

/** P(unaided correct) when the memory is fresh: "can you do it today if reminded". */
export function predictedP(state) {
  const total = state.alpha + state.beta;
  return total > 0 ? state.alpha / total : ALPHA_0 / (ALPHA_0 + BETA_0);
}

export function evidenceStrength(state) {
  return Math.max(0, state.alpha + state.beta - (ALPHA_0 + BETA_0));
}

function ageEvidence(state, elapsedDays) {
  if (elapsedDays === null || elapsedDays <= 0) return;
  const d = Math.pow(0.5, elapsedDays / EVIDENCE_HALF_LIFE);
  state.alpha = ALPHA_0 + (state.alpha - ALPHA_0) * d;
  state.beta = BETA_0 + (state.beta - BETA_0) * d;
}

/**
 * Fold one attempt into a concept state. Pure: the input is not modified.
 *
 * `attempt` = { conceptId, at (ms), outcome, assistance, kind, errorType, sessionId }
 */
export function apply(state, attempt) {
  const s = { ...state, sessions: [...state.sessions], recentCredit: [...state.recentCredit] };
  const score = OUTCOME_SCORE[attempt.outcome];
  const w = CREDIT_WEIGHT[attempt.assistance ?? "none"];
  const g = KIND_GAIN[attempt.kind ?? "practice"];

  const elapsed = s.lastReviewed === null ? null : daysBetween(s.lastReviewed, attempt.at);
  const rBefore = elapsed === null ? 0 : retrievability(s.stability, elapsed);

  const errorType = attempt.errorType ?? null;
  const counts = errorType === null || COUNTS_AGAINST_ABILITY(errorType);
  const unreadable = errorType === "unreadable";

  // A solved-for answer carries no information about unaided ability, a careless slip
  // is not a knowledge claim, and work we could not read is not evidence of anything.
  if (w > 0 && counts && !unreadable) {
    ageEvidence(s, elapsed);
    const credit = score * w;
    s.alpha += g * credit;
    s.beta += g * (1 - credit);
  }

  if (!unreadable) {
    s.difficulty = clamp(
      s.difficulty + D_STEP * (0.5 - score) - D_REVERT * (s.difficulty - 5.0),
      D_MIN, D_MAX,
    );
  }

  if (!unreadable) {
    // A careless slip means retrieval of the method succeeded, so it consolidates
    // memory rather than counting as a lapse.
    const careless = errorType === "careless";
    const succeeded = score >= 0.5 || careless;
    let h = CONSOLIDATION[attempt.assistance ?? "none"];
    if (careless && score < 0.5) h = Math.min(h, 0.60);

    if (s.lastReviewed === null || s.stability <= 0) {
      s.stability = seedStability(attempt.outcome, s.difficulty);
    } else if (succeeded) {
      s.stability = growStability(s.stability, s.difficulty, rBefore, h);
    } else {
      s.stability = lapseStability(s.stability, s.difficulty, rBefore);
    }
    s.lastReviewed = attempt.at;
  }

  s.attempts += 1;
  if (attempt.sessionId && !s.sessions.includes(attempt.sessionId)) {
    s.sessions.push(attempt.sessionId);
  }
  const independent = attempt.assistance === "none" || attempt.assistance === "nudge"
    || attempt.assistance === undefined;
  if (attempt.outcome === "correct" && independent) {
    s.independentCorrect += 1;
    // One attempt supplies at most one of the two strong signals.
    if (attempt.kind === "transfer") {
      s.transferCorrect += 1;
    } else if (elapsed !== null && elapsed >= RETENTION_MIN_DAYS) {
      s.retentionCorrect += 1;
    }
  }
  if (errorType === "careless") s.carelessSlips += 1;

  s.recentCredit.push([w, score]);
  if (s.recentCredit.length > INDEPENDENCE_WINDOW) {
    s.recentCredit = s.recentCredit.slice(-INDEPENDENCE_WINDOW);
  }
  return s;
}

/** State ignoring forgetting: what the student could do today if reminded. */
export function freshState(state) {
  if (state.attempts === 0) return "unseen";
  // No ability evidence means no ability claim: a student who has only ever been shown
  // solutions sits at the prior, and the prior is not an achievement.
  if (evidenceStrength(state) <= 0) return "introduced";

  const p = predictedP(state);
  const reliable =
    p >= P_RELIABLE &&
    state.independentCorrect >= INDEPENDENT_FOR_RELIABLE &&
    state.sessions.length >= SESSIONS_FOR_RELIABLE;

  if (reliable && state.transferCorrect >= 1) {
    if (p >= P_MASTERED && state.retentionCorrect >= 1) return "mastered";
    return "transferable";
  }
  if (reliable) return "reliable";
  if (p >= P_DEVELOPING && state.attempts >= N_DEVELOPING) return "developing";
  if (p >= P_PRACTICING) return "practicing";
  return "introduced";
}

/** What the student can actually do *now*, after forgetting. `mastered` expires. */
export function effectiveState(state, now) {
  const base = freshState(state);
  if (base === "unseen") return base;
  const r = currentRetrievability(state, now);
  let cap = "mastered";
  if (r < R_CAP_RELIABLE) cap = "reliable";
  if (r < R_CAP_DEVELOPING) cap = "developing";
  if (r < R_CAP_PRACTICING) cap = "practicing";
  return atRank(Math.min(rank(base), rank(cap)));
}

/** Share of recent success earned unaided. Null when there is no success to attribute. */
export function independence(state) {
  const total = state.recentCredit.reduce((sum, [, score]) => sum + score, 0);
  if (total <= 0) return null;
  return state.recentCredit.reduce((sum, [w, score]) => sum + w * score, 0) / total;
}
