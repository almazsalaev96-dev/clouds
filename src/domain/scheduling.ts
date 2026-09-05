/**
 * The memory scheduler.
 *
 * A two-component memory model (stability + difficulty) in the FSRS family,
 * with three departures that matter for exam preparation specifically:
 *
 *  1. **Exam-aware horizon.** A review scheduled for three days after the exam
 *     is worthless. Intervals are clipped so every item lands at least once
 *     inside the revision window, and the target retention rises as the exam
 *     approaches — you want 90% recall in the last fortnight, not the 85% that
 *     is optimal for long-term efficiency.
 *
 *  2. **Importance weighting.** Exam-heavy material earns tighter intervals
 *     than trivia. Stock SRS treats every card as equally worth remembering;
 *     an exam does not.
 *
 *  3. **Mistake-linked items.** An item created from a real lost mark starts
 *     with lower stability and is deliberately over-reviewed, because a
 *     repeated mistake costs marks twice.
 */

import { addDays, clamp, clamp01, daysBetween, type Timestamp, type Unit } from "./types";
import { retrievability } from "./mastery";

/** How the student rated their own recall. Four grades, as in FSRS. */
export type Grade = 1 | 2 | 3 | 4; // again | hard | good | easy

export const GRADE_LABELS: Record<Grade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export interface MemoryState {
  /** Days until retrievability falls to ~1/e. Higher = more durable. */
  stability: number;
  /** 1..10, intrinsic difficulty of this item for this student. */
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: Timestamp;
  dueAt: Timestamp;
  /** Consecutive successful reviews. */
  streak: number;
  /** Provenance: items born from a real lost mark are treated more severely. */
  origin?: "authored" | "mistake" | "note" | "generated";
}

export interface SchedulerConfig {
  /** Desired probability of recall at review time. Raised near the exam. */
  targetRetention: Unit;
  /** Cap on interval growth, in days. */
  maximumInterval: number;
  /** Exam date, if known — the scheduler's horizon. */
  examDate?: Timestamp;
  /** 0..1 exam importance of this item's topic. */
  importance?: Unit;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  targetRetention: 0.9,
  maximumInterval: 365,
};

export function newMemoryState(now: Timestamp, origin: MemoryState["origin"] = "authored"): MemoryState {
  return {
    stability: origin === "mistake" ? 0.6 : 1,
    difficulty: origin === "mistake" ? 6.5 : 5,
    reps: 0,
    lapses: 0,
    dueAt: now,
    streak: 0,
    origin,
  };
}

// --- FSRS-family parameter set --------------------------------------------
// Tuned to the published FSRS defaults, rounded for legibility. These are
// deliberately explicit rather than a magic vector, so they can be reasoned
// about and, later, fitted per student from real review logs.
const W = {
  initialStability: [0.4, 1.2, 3.2, 15.7] as const, // by grade
  initialDifficulty: 5.3,
  difficultyDecay: 0.32,
  stabilityGrowth: 1.62,
  hardPenalty: 0.85,
  easyBonus: 1.28,
  lapseFactor: 0.24,
  lapseMin: 0.2,
};

export function initialStability(grade: Grade): number {
  return W.initialStability[grade - 1] ?? 1;
}

function nextDifficulty(current: number, grade: Grade): number {
  // Grade 3 ("good") is neutral; below drags difficulty up, above drags it down.
  const delta = -W.difficultyDecay * (grade - 3);
  const next = current + delta;
  // Mean reversion toward the population prior stops difficulty running away.
  return clamp(next * 0.94 + W.initialDifficulty * 0.06, 1, 10);
}

function nextStability(state: MemoryState, grade: Grade, retrievabilityNow: Unit): number {
  if (grade === 1) {
    // A lapse does not reset to zero — some trace survives — but it collapses.
    return Math.max(W.lapseMin, state.stability * W.lapseFactor);
  }
  const difficultyFactor = 11 - state.difficulty; // easier items consolidate faster
  const retrievabilityFactor = Math.exp(1 - retrievabilityNow); // hard-won recall sticks
  const gradeFactor = grade === 2 ? W.hardPenalty : grade === 4 ? W.easyBonus : 1;
  const growth =
    1 +
    (W.stabilityGrowth * difficultyFactor * retrievabilityFactor * gradeFactor) /
      (10 + state.stability * 0.15);
  return state.stability * growth;
}

/**
 * The interval that lands the item at exactly the target retention.
 * From R = exp(-t/S)  ⇒  t = -S · ln(R).
 */
export function intervalForRetention(stability: number, targetRetention: Unit): number {
  return Math.max(1, Math.round(-stability * Math.log(clamp(targetRetention, 0.5, 0.99))));
}

/**
 * Target retention rises as the exam nears. Long-run efficiency wants ~0.85;
 * two weeks before an exam you want near-certainty, and you can afford the
 * extra reviews because the horizon is short.
 */
export function examAdjustedRetention(base: Unit, daysToExam: number | undefined): Unit {
  if (daysToExam === undefined) return base;
  if (daysToExam <= 3) return 0.97;
  if (daysToExam <= 7) return 0.95;
  if (daysToExam <= 21) return 0.93;
  if (daysToExam <= 60) return clamp01(Math.max(base, 0.9));
  return base;
}

export interface ReviewOutcome {
  state: MemoryState;
  intervalDays: number;
  /** Retrievability at the moment of review — how close to forgetting it was. */
  retrievabilityAtReview: Unit;
  because: string[];
}

export function review(
  state: MemoryState,
  grade: Grade,
  now: Timestamp,
  config: SchedulerConfig = DEFAULT_CONFIG,
): ReviewOutcome {
  const because: string[] = [];
  const daysSince = state.lastReviewedAt ? Math.max(0, daysBetween(state.lastReviewedAt, now)) : 0;
  const r = state.reps === 0 ? 1 : retrievability(state.stability, daysSince);

  const stability =
    state.reps === 0 ? initialStability(grade) : nextStability(state, grade, r);
  const difficulty =
    state.reps === 0
      ? clamp(W.initialDifficulty - 0.9 * (grade - 3), 1, 10)
      : nextDifficulty(state.difficulty, grade);

  const daysToExam = config.examDate ? daysBetween(now, config.examDate) : undefined;
  let target = examAdjustedRetention(config.targetRetention, daysToExam);

  // Exam-heavy material is reviewed more often than its raw memory profile
  // would justify, because the cost of forgetting it is higher.
  if (config.importance !== undefined && config.importance > 0.6) {
    target = clamp01(target + 0.02);
    because.push("Reviewed slightly more often because this carries heavy exam weight.");
  }
  if (state.origin === "mistake") {
    target = clamp01(target + 0.03);
    because.push("This came from a mark you actually lost, so it is over-reviewed on purpose.");
  }

  let interval = intervalForRetention(stability, target);
  interval = Math.min(interval, config.maximumInterval);

  // Never schedule past the exam. Compress so the item is seen at least once
  // more while it can still change the outcome.
  if (daysToExam !== undefined && daysToExam > 0 && interval > daysToExam) {
    const compressed = Math.max(1, Math.floor(daysToExam / 2));
    if (compressed < interval) {
      because.push(
        `Interval shortened from ${interval} to ${compressed} days so this is seen again before the exam.`,
      );
      interval = compressed;
    }
  }
  if (daysToExam !== undefined && daysToExam <= 0) {
    because.push("Exam date has passed; scheduling on the long-term curve.");
  }

  if (grade === 1) {
    because.push("Marked 'again', so stability collapsed and it returns tomorrow.");
    interval = 1;
  }

  return {
    state: {
      stability,
      difficulty,
      reps: state.reps + 1,
      lapses: state.lapses + (grade === 1 ? 1 : 0),
      lastReviewedAt: now,
      dueAt: addDays(now, interval),
      streak: grade === 1 ? 0 : state.streak + 1,
      origin: state.origin,
    },
    intervalDays: interval,
    retrievabilityAtReview: r,
    because,
  };
}

/** Preview every button's interval, so the student sees the consequence. */
export function previewIntervals(
  state: MemoryState,
  now: Timestamp,
  config: SchedulerConfig = DEFAULT_CONFIG,
): Record<Grade, number> {
  return {
    1: review(state, 1, now, config).intervalDays,
    2: review(state, 2, now, config).intervalDays,
    3: review(state, 3, now, config).intervalDays,
    4: review(state, 4, now, config).intervalDays,
  };
}

export interface DueItem<T> {
  item: T;
  state: MemoryState;
  retrievability: Unit;
  overdueDays: number;
}

/**
 * Select what is due. Ordering is by *marks at risk*, not by due date:
 * a heavily-weighted topic slipping to 60% recall matters more than a footnote
 * that went overdue yesterday.
 */
export function selectDue<T>(
  items: { item: T; state: MemoryState; importance?: Unit }[],
  now: Timestamp,
  limit: number,
): DueItem<T>[] {
  const scored = items.map(({ item, state, importance }) => {
    const daysSince = state.lastReviewedAt ? Math.max(0, daysBetween(state.lastReviewedAt, now)) : 999;
    const r = state.reps === 0 ? 0 : retrievability(state.stability, daysSince);
    const overdueDays = daysBetween(state.dueAt, now);
    const risk = (1 - r) * (0.5 + (importance ?? 0.5));
    return { item, state, retrievability: r, overdueDays, risk };
  });

  return scored
    .filter((s) => s.overdueDays >= 0 || s.state.reps === 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, limit)
    .map(({ item, state, retrievability: r, overdueDays }) => ({
      item,
      state,
      retrievability: r,
      overdueDays,
    }));
}

/**
 * Forecast review load for the coming days, so the planner can warn about a
 * pile-up before it happens rather than after.
 */
export function reviewLoadForecast(
  states: MemoryState[],
  now: Timestamp,
  days: number,
): { date: string; due: number }[] {
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    buckets.set(addDays(now, i).slice(0, 10), 0);
  }
  for (const s of states) {
    const key = s.dueAt.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    else if (new Date(s.dueAt) < new Date(now)) {
      const today = now.slice(0, 10);
      buckets.set(today, (buckets.get(today) ?? 0) + 1);
    }
  }
  return [...buckets].map(([date, due]) => ({ date, due }));
}
