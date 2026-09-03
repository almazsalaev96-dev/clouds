/**
 * Mistake detection (§23).
 *
 * A single wrong answer is a `LearningEvent`. A *mistake* is a recognised
 * pattern across several of them — which is what "you've made this mistake
 * three times, let's fix the underlying concept" actually requires. Collapsing
 * the two makes that message impossible to say truthfully.
 */

import type { Id, Mistake } from "../types/index.ts";
import type { Store } from "../store/index.ts";

/** Failures on one concept before we are willing to call it a pattern. */
export const PATTERN_THRESHOLD = 3;

/**
 * Recomputes mistake patterns for a concept from its graded events.
 * Idempotent: running it twice does not double-count.
 */
export function detectMistakes(store: Store, userId: Id, conceptId: Id): Mistake | null {
  const concept = store.concepts.get(userId, conceptId);
  if (!concept) return null;

  const failures = store.learningEvents.list(userId, {
    where: { conceptId } as never,
    filter: (e) => !e.correct,
    sort: (a, b) => a.createdAt - b.createdAt,
  });

  const existing = store.mistakes.list(userId, { where: { conceptId } as never })[0];

  if (failures.length < PATTERN_THRESHOLD) {
    // Not yet a pattern. If a previously-recorded pattern has been outgrown,
    // mark it resolved rather than deleting the history.
    if (existing && !existing.resolved) {
      return store.mistakes.update(userId, existing.id, { resolved: true } as never) ?? null;
    }
    return existing ?? null;
  }

  // A pattern is only "live" if it is still happening: check whether the most
  // recent attempts are still going wrong.
  const recent = store.learningEvents.list(userId, {
    where: { conceptId } as never,
    sort: (a, b) => b.createdAt - a.createdAt,
    limit: 3,
  });
  const stillFailing = recent.some((e) => !e.correct);

  const payload = {
    conceptId,
    description: `Recurring error on ${concept.name}`,
    eventIds: failures.map((e) => e.id),
    occurrences: failures.length,
    lastSeenAt: failures[failures.length - 1].createdAt,
    resolved: !stillFailing,
  };

  if (existing) {
    return store.mistakes.update(userId, existing.id, payload as never) ?? null;
  }
  const mistake = store.mistakes.insert(userId, payload as never);
  store.edges.insert(userId, {
    fromType: "mistake", fromId: mistake.id,
    toType: "concept", toId: conceptId,
    kind: "about", weight: 1,
    provenance: `${failures.length} incorrect attempts`,
  } as never);
  return mistake;
}

export function openMistakes(store: Store, userId: Id): Mistake[] {
  return store.mistakes.list(userId, {
    filter: (m) => !m.resolved,
    sort: (a, b) => b.occurrences - a.occurrences || b.lastSeenAt - a.lastSeenAt,
  });
}
