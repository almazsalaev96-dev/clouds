/**
 * FSRS-6 — the Free Spaced Repetition Scheduler.
 *
 * A faithful TypeScript port of the reference algorithm
 * (github.com/open-spaced-repetition). FSRS models each card with three values:
 *
 *   Difficulty     how hard this card is for this learner (1..10)
 *   Stability      days until recall probability decays to the retention target
 *   Retrievability probability of recalling the card right now
 *
 * It replaces SM-2's single "ease factor" and, fitted on hundreds of millions of
 * real reviews, reaches the same retention with materially fewer reviews. See
 * MASTER-PROMPT.md §4.1 for why this is the engine we build on.
 *
 * This module is pure: same inputs, same outputs, no clock reads, no randomness
 * unless a fuzz seed is supplied. That is what makes the schedule reproducible
 * across devices and lets the whole study history be replayed from the log.
 */

import { CardState, MS_PER_DAY, Rating, type MemoryState } from './types';

/** FSRS-6 default weights, w[0..20]. w[20] is the forgetting-curve decay. */
export const DEFAULT_PARAMETERS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

const LOWER_BOUNDS: readonly number[] = [
  0.001, 0.001, 0.001, 0.001, 1.0, 0.001, 0.001, 0.001, 0.0, 0.0, 0.001, 0.001, 0.001, 0.001, 0.0,
  0.0, 1.0, 0.0, 0.0, 0.0, 0.1,
];
const UPPER_BOUNDS: readonly number[] = [
  100.0, 100.0, 100.0, 100.0, 10.0, 4.0, 4.0, 0.75, 4.5, 0.8, 3.5, 5.0, 0.25, 0.9, 4.0, 1.0, 6.0,
  2.0, 2.0, 0.8, 0.8,
];

const STABILITY_MIN = 0.001;
const MIN_DIFFICULTY = 1.0;
const MAX_DIFFICULTY = 10.0;

export interface SchedulerOptions {
  /** FSRS weights. Defaults to the published FSRS-6 vector; optimise per learner later. */
  parameters?: readonly number[];
  /** Target probability of recall at review time. 0.9 is the sane default. */
  desiredRetention?: number;
  /** Minutes for each learning step, e.g. [1, 10]. Empty = graduate immediately. */
  learningStepsMinutes?: readonly number[];
  /** Minutes for each relearning step after a lapse, e.g. [10]. */
  relearningStepsMinutes?: readonly number[];
  /** Hard ceiling on any interval, in days. */
  maximumIntervalDays?: number;
  /**
   * Spread same-day-due cards over neighbouring days so reviews don't clump.
   * Deterministic: derived from the card id, never from Math.random.
   */
  enableFuzz?: boolean;
}

export interface ReviewResult {
  card: MemoryState;
  /** Milliseconds from the review until the card is due again. */
  intervalMs: number;
}

/** Clamp helper that keeps NaN out of the state. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic 0..1 hash of a string — used for interval fuzz so that two devices
 * replaying the same log land on the same due date.
 */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export class FsrsScheduler {
  readonly parameters: readonly number[];
  readonly desiredRetention: number;
  readonly learningSteps: readonly number[];
  readonly relearningSteps: readonly number[];
  readonly maximumIntervalDays: number;
  readonly enableFuzz: boolean;
  private readonly decay: number;
  private readonly factor: number;

  constructor(options: SchedulerOptions = {}) {
    this.parameters = options.parameters ?? DEFAULT_PARAMETERS;
    validateParameters(this.parameters);
    this.desiredRetention = options.desiredRetention ?? 0.9;
    if (this.desiredRetention <= 0 || this.desiredRetention >= 1) {
      throw new RangeError('desiredRetention must be strictly between 0 and 1');
    }
    this.learningSteps = options.learningStepsMinutes ?? [1, 10];
    this.relearningSteps = options.relearningStepsMinutes ?? [10];
    this.maximumIntervalDays = options.maximumIntervalDays ?? 36500;
    this.enableFuzz = options.enableFuzz ?? false;
    this.decay = -(this.parameters[20] as number);
    this.factor = Math.pow(0.9, 1 / this.decay) - 1;
  }

  /** A brand-new, never-reviewed card, due immediately. */
  newCard(now: number): MemoryState {
    return {
      state: CardState.Learning,
      step: 0,
      stability: null,
      difficulty: null,
      lastReview: null,
      due: now,
    };
  }

  /**
   * Probability the learner recalls this card at `now`.
   * Returns 0 for a card that has never been reviewed.
   */
  retrievability(card: MemoryState, now: number): number {
    if (card.lastReview === null || card.stability === null) return 0;
    const elapsedDays = Math.max(0, Math.floor((now - card.lastReview) / MS_PER_DAY));
    return Math.pow(1 + (this.factor * elapsedDays) / card.stability, this.decay);
  }

  /**
   * Apply a review and return the next memory state.
   *
   * `cardId` only seeds the deterministic fuzz; it is never stored on the state.
   */
  review(card: MemoryState, rating: Rating, now: number, cardId = ''): ReviewResult {
    const daysSinceLastReview =
      card.lastReview === null ? null : Math.floor((now - card.lastReview) / MS_PER_DAY);
    const sameDay = daysSinceLastReview !== null && daysSinceLastReview < 1;

    let stability = card.stability;
    let difficulty = card.difficulty;

    if (stability === null || difficulty === null) {
      // First ever review: seed the memory state from the grade alone.
      stability = this.initialStability(rating);
      difficulty = this.initialDifficulty(rating, true);
    } else if (sameDay) {
      stability = this.shortTermStability(stability, rating);
      difficulty = this.nextDifficulty(difficulty, rating);
    } else {
      stability = this.nextStability(
        difficulty,
        stability,
        this.retrievability(card, now),
        rating,
      );
      difficulty = this.nextDifficulty(difficulty, rating);
    }

    let state = card.state;
    let step = card.step;
    let intervalMs: number;

    if (state === CardState.Learning || state === CardState.Relearning) {
      const steps = state === CardState.Learning ? this.learningSteps : this.relearningSteps;
      const currentStep = step ?? 0;
      if (steps.length === 0 || (currentStep >= steps.length && rating !== Rating.Again)) {
        state = CardState.Review;
        step = null;
        intervalMs = this.nextIntervalDays(stability) * MS_PER_DAY;
      } else if (rating === Rating.Again) {
        step = 0;
        intervalMs = (steps[0] as number) * 60_000;
      } else if (rating === Rating.Hard) {
        let minutes: number;
        if (currentStep === 0 && steps.length === 1) minutes = (steps[0] as number) * 1.5;
        else if (currentStep === 0) minutes = ((steps[0] as number) + (steps[1] as number)) / 2;
        else minutes = steps[currentStep] as number;
        intervalMs = minutes * 60_000;
      } else if (rating === Rating.Good) {
        if (currentStep + 1 === steps.length) {
          state = CardState.Review;
          step = null;
          intervalMs = this.nextIntervalDays(stability) * MS_PER_DAY;
        } else {
          step = currentStep + 1;
          intervalMs = (steps[step] as number) * 60_000;
        }
      } else {
        // Easy always graduates.
        state = CardState.Review;
        step = null;
        intervalMs = this.nextIntervalDays(stability) * MS_PER_DAY;
      }
    } else {
      // Review state.
      if (rating === Rating.Again && this.relearningSteps.length > 0) {
        state = CardState.Relearning;
        step = 0;
        intervalMs = (this.relearningSteps[0] as number) * 60_000;
      } else {
        intervalMs = this.nextIntervalDays(stability) * MS_PER_DAY;
      }
    }

    if (this.enableFuzz && state === CardState.Review) {
      intervalMs = this.fuzz(intervalMs, cardId, now);
    }

    return {
      card: { state, step, stability, difficulty, lastReview: now, due: now + intervalMs },
      intervalMs,
    };
  }

  /** Days until the card should next be seen, given a stability. */
  nextIntervalDays(stability: number): number {
    const raw =
      (stability / this.factor) * (Math.pow(this.desiredRetention, 1 / this.decay) - 1);
    return clamp(Math.round(raw), 1, this.maximumIntervalDays);
  }

  private initialStability(rating: Rating): number {
    return Math.max(this.parameters[rating - 1] as number, STABILITY_MIN);
  }

  private initialDifficulty(rating: Rating, doClamp: boolean): number {
    const d =
      (this.parameters[4] as number) -
      Math.exp((this.parameters[5] as number) * (rating - 1)) +
      1;
    return doClamp ? clamp(d, MIN_DIFFICULTY, MAX_DIFFICULTY) : d;
  }

  /** Stability change for a second look at the same card on the same day. */
  private shortTermStability(stability: number, rating: Rating): number {
    let increase =
      Math.exp((this.parameters[17] as number) * (rating - 3 + (this.parameters[18] as number))) *
      Math.pow(stability, -(this.parameters[19] as number));
    if (rating !== Rating.Again) increase = Math.max(increase, 1.0);
    return Math.max(stability * increase, STABILITY_MIN);
  }

  /** Difficulty update: linear damping near the ceiling, then mean reversion. */
  private nextDifficulty(difficulty: number, rating: Rating): number {
    const deltaD = -((this.parameters[6] as number) * (rating - 3));
    const damped = difficulty + ((10.0 - difficulty) * deltaD) / 9.0;
    const reversionTarget = this.initialDifficulty(Rating.Easy, false);
    const w7 = this.parameters[7] as number;
    return clamp(w7 * reversionTarget + (1 - w7) * damped, MIN_DIFFICULTY, MAX_DIFFICULTY);
  }

  private nextStability(
    difficulty: number,
    stability: number,
    retrievability: number,
    rating: Rating,
  ): number {
    const next =
      rating === Rating.Again
        ? this.forgetStability(difficulty, stability, retrievability)
        : this.recallStability(difficulty, stability, retrievability, rating);
    return Math.max(next, STABILITY_MIN);
  }

  private recallStability(
    difficulty: number,
    stability: number,
    retrievability: number,
    rating: Rating,
  ): number {
    const hardPenalty = rating === Rating.Hard ? (this.parameters[15] as number) : 1;
    const easyBonus = rating === Rating.Easy ? (this.parameters[16] as number) : 1;
    return (
      stability *
      (1 +
        Math.exp(this.parameters[8] as number) *
          (11 - difficulty) *
          Math.pow(stability, -(this.parameters[9] as number)) *
          (Math.exp((1 - retrievability) * (this.parameters[10] as number)) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  private forgetStability(
    difficulty: number,
    stability: number,
    retrievability: number,
  ): number {
    const longTerm =
      (this.parameters[11] as number) *
      Math.pow(difficulty, -(this.parameters[12] as number)) *
      (Math.pow(stability + 1, this.parameters[13] as number) - 1) *
      Math.exp((1 - retrievability) * (this.parameters[14] as number));
    const shortTerm =
      stability / Math.exp((this.parameters[17] as number) * (this.parameters[18] as number));
    return Math.min(longTerm, shortTerm);
  }

  /** Spread reviews ±(up to 5%) of the interval, deterministically per card and day. */
  private fuzz(intervalMs: number, cardId: string, now: number): number {
    const days = intervalMs / MS_PER_DAY;
    if (days < 2.5) return intervalMs;
    const spread = Math.min(Math.max(days * 0.05, 1), 4);
    const offset = (hashUnit(`${cardId}:${Math.floor(now / MS_PER_DAY)}`) * 2 - 1) * spread;
    const fuzzed = clamp(Math.round(days + offset), 1, this.maximumIntervalDays);
    return fuzzed * MS_PER_DAY;
  }
}

function validateParameters(parameters: readonly number[]): void {
  if (parameters.length !== LOWER_BOUNDS.length) {
    throw new RangeError(`FSRS expects ${LOWER_BOUNDS.length} parameters, got ${parameters.length}`);
  }
  parameters.forEach((p, i) => {
    if (!Number.isFinite(p) || p < (LOWER_BOUNDS[i] as number) || p > (UPPER_BOUNDS[i] as number)) {
      throw new RangeError(
        `FSRS parameter w[${i}] = ${p} is outside [${LOWER_BOUNDS[i]}, ${UPPER_BOUNDS[i]}]`,
      );
    }
  });
}
