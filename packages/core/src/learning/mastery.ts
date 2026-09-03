/**
 * Mastery estimation (§10) — and the honest limit on it.
 *
 * Mastery moves on *graded retrieval events only*: a question with a known
 * answer, attempted, scored. A learner saying "oh, I get it now" is not
 * evidence and does not move the number.
 *
 * This is a deliberate departure from §10's "the intelligence should happen
 * behind the scenes". Estimating mastery from conversational tone would
 * produce a dense, confident, wrong model — exactly the "fake intelligence"
 * §50 forbids. Every estimate therefore ships with a `confidence`, and the
 * interface is required to show "not enough evidence yet" rather than a
 * number when confidence is low.
 *
 * Sparse honest data beats dense fabricated data.
 */

import type { Id, LearningEvent, Mastery } from "../types/index.ts";
import type { Store } from "../store/index.ts";

/** Practice decays; a correct answer from two months ago is weak evidence now. */
const RETENTION_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 14;

/** Attempts needed before an estimate is worth showing as a number. */
const CONFIDENCE_SCALE = 3;

export const MIN_REPORTABLE_CONFIDENCE = 0.3;

function retentionWeight(event: LearningEvent, now: number): number {
  const age = Math.max(0, now - event.createdAt);
  return Math.pow(0.5, age / RETENTION_HALF_LIFE_MS);
}

export function masteryFor(
  store: Store,
  userId: Id,
  conceptId: Id,
  now: number = Date.now(),
): Mastery {
  const events = store.learningEvents.list(userId, {
    where: { conceptId } as never,
    sort: (a, b) => a.createdAt - b.createdAt,
  });

  if (events.length === 0) {
    return { conceptId, estimate: 0, confidence: 0, attempts: 0, lastPracticedAt: null };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  for (const event of events) {
    const recency = retentionWeight(event, now);
    // Getting a hard item right is stronger evidence than getting an easy one
    // right; getting an easy item wrong is stronger evidence of a gap.
    const evidence = event.correct
      ? 0.5 + event.difficulty * 0.5
      : 0.5 + (1 - event.difficulty) * 0.5;
    const weight = recency * evidence;
    weightedScore += event.score * weight;
    totalWeight += weight;
  }

  const estimate = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Confidence rises with the number of attempts and falls as they age, so a
  // long-stale estimate correctly stops being trusted.
  const volume = 1 - Math.exp(-events.length / CONFIDENCE_SCALE);
  const freshness = Math.max(...events.map((e) => retentionWeight(e, now)));
  const confidence = Math.min(1, volume * (0.4 + 0.6 * freshness));

  return {
    conceptId,
    estimate: Math.max(0, Math.min(1, estimate)),
    confidence,
    attempts: events.length,
    lastPracticedAt: events[events.length - 1].createdAt,
  };
}

/** True when we genuinely do not know enough to report a number to the user. */
export const isInsufficientEvidence = (mastery: Mastery): boolean =>
  mastery.confidence < MIN_REPORTABLE_CONFIDENCE;

export function allMastery(store: Store, userId: Id, now = Date.now()): Mastery[] {
  return store.concepts
    .list(userId)
    .map((concept) => masteryFor(store, userId, concept.id, now))
    .filter((m) => m.attempts > 0)
    .sort((a, b) => a.estimate - b.estimate);
}
