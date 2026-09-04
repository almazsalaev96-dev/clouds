/**
 * Session building — which cards to show, in what order.
 *
 * Two ideas from the evidence base drive this file (MASTER-PROMPT.md §4):
 *
 *  - **Interleaving.** Mixing topics feels worse during practice and tests better
 *    later. So the queue deliberately avoids showing two cards from the same topic
 *    back to back whenever another topic is available.
 *  - **Load management.** New material is capped per session; overdue work comes
 *    first, because a card that is already leaking is worth more than a new one.
 */

import type { MemoryState } from './types';

export interface SchedulableCard {
  id: string;
  /** Topic / syllabus objective this card belongs to — the interleaving key. */
  topicId: string;
  memory: MemoryState;
  /**
   * Marks at stake for this card's objective, used to break ties.
   * Higher = more exam value. Optional; defaults to 1.
   */
  weight?: number;
}

export interface SessionOptions {
  now: number;
  /** Hard cap on the number of cards in this session. */
  limit: number;
  /** Maximum brand-new cards to introduce. Protects working memory. */
  newCardLimit?: number;
  /**
   * How strongly to interleave, 0..1. 1 = never repeat a topic while alternatives
   * remain; 0 = ignore topic entirely (blocked practice).
   */
  interleaving?: number;
}

export interface SessionPlan {
  cards: SchedulableCard[];
  counts: { due: number; new: number; total: number };
  /** Cards that are due but did not fit in this session. */
  backlog: number;
}

const isNew = (c: SchedulableCard) => c.memory.lastReview === null;

/**
 * Build an ordered study queue.
 *
 * Selection: overdue-first (most overdue relative to its own stability, so a
 * 2-day-late 3-day card outranks a 2-day-late 300-day card), then new cards up to
 * the new-card cap. Ordering: greedy interleave over the selected set.
 */
export function buildSession(
  cards: readonly SchedulableCard[],
  options: SessionOptions,
): SessionPlan {
  const { now, limit } = options;
  const newCardLimit = options.newCardLimit ?? Math.max(1, Math.floor(limit * 0.3));
  const interleaving = options.interleaving ?? 1;

  const due = cards.filter((c) => !isNew(c) && c.memory.due <= now);
  const fresh = cards.filter(isNew);

  // Overdue-ness scaled by stability: how far past its own half-life is this card?
  const urgency = (c: SchedulableCard) => {
    const lateMs = now - c.memory.due;
    const stabilityMs = Math.max(c.memory.stability ?? 1, 0.1) * 86_400_000;
    return lateMs / stabilityMs;
  };

  const sortedDue = [...due].sort(
    (a, b) => urgency(b) - urgency(a) || (b.weight ?? 1) - (a.weight ?? 1),
  );
  const sortedNew = [...fresh].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));

  const chosenDue = sortedDue.slice(0, limit);
  const chosenNew = sortedNew.slice(
    0,
    Math.min(newCardLimit, Math.max(0, limit - chosenDue.length)),
  );
  const selected = [...chosenDue, ...chosenNew];

  return {
    cards: interleave(selected, interleaving),
    counts: { due: chosenDue.length, new: chosenNew.length, total: selected.length },
    backlog: Math.max(0, sortedDue.length - chosenDue.length),
  };
}

/**
 * Greedy topic interleave that preserves priority as much as possible: at each
 * step take the highest-priority card whose topic differs from the previous one.
 */
export function interleave<T extends { topicId: string }>(
  items: readonly T[],
  strength = 1,
): T[] {
  if (strength <= 0 || items.length < 3) return [...items];
  const remaining = [...items];
  const out: T[] = [];
  let previousTopic: string | null = null;

  while (remaining.length > 0) {
    let index = remaining.findIndex((c) => c.topicId !== previousTopic);
    if (index === -1) index = 0;
    // strength < 1 relaxes the rule: only every 1/strength-th position gets to switch.
    if (strength < 1 && out.length > 0 && out.length % Math.ceil(1 / strength) !== 0) index = 0;
    out.push(remaining.splice(index, 1)[0] as T);
    previousTopic = out[out.length - 1]?.topicId ?? null;
  }
  return out;
}

/** How many cards from each topic sit back to back — 0 is perfectly interleaved. */
export function adjacentRepeats(items: readonly { topicId: string }[]): number {
  let n = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i]?.topicId === items[i - 1]?.topicId) n++;
  }
  return n;
}
