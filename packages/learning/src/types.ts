/**
 * Core types for the Atlas learning engine.
 *
 * Everything here is plain data: no IO, no dates-as-strings ambiguity (all times are
 * epoch milliseconds), no framework types. The engine must run identically on a
 * phone, in a browser worker, and on a server.
 */

/** How well the learner recalled the item. Matches FSRS's 1..4 grades. */
export const Rating = {
  /** Failed to recall. */
  Again: 1,
  /** Recalled with serious difficulty. */
  Hard: 2,
  /** Recalled correctly with normal effort. */
  Good: 3,
  /** Recalled instantly and effortlessly. */
  Easy: 4,
} as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

export const RATINGS: readonly Rating[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

/** Lifecycle state of a card in the scheduler. */
export const CardState = {
  Learning: 'learning',
  Review: 'review',
  Relearning: 'relearning',
} as const;
export type CardState = (typeof CardState)[keyof typeof CardState];

/**
 * The scheduler's memory state for one card.
 *
 * `stability` and `difficulty` are null only before the very first review.
 * `step` is the index into the learning/relearning step list, null in the Review state.
 */
export interface MemoryState {
  state: CardState;
  step: number | null;
  /** Days until recall probability falls to the target retention. */
  stability: number | null;
  /** 1..10, higher = harder for this learner. */
  difficulty: number | null;
  /** Epoch ms of the last review, null if never reviewed. */
  lastReview: number | null;
  /** Epoch ms this card is next due. */
  due: number;
}

/** An immutable record of one review. The study log is append-only. */
export interface ReviewLog {
  cardId: string;
  rating: Rating;
  /** Epoch ms the review happened. */
  reviewedAt: number;
  /** Milliseconds between showing the question and the learner grading it. */
  latencyMs?: number;
  /** Learner's stated probability of being right, 0..1, collected before the answer. */
  confidence?: number;
  /** Memory state *before* this review, so the log alone can rebuild everything. */
  before: MemoryState;
  /** Memory state *after* this review. */
  after: MemoryState;
}

export const MS_PER_DAY = 86_400_000;
