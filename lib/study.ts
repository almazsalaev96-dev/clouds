import type { Card, Grade, SM2 } from "./types";

/**
 * SM-2, the algorithm behind Anki and SuperMemo, kept close to the original.
 *
 * The whole idea: reviewing something just before you would have forgotten it
 * is far more effective than reviewing it often. So each success stretches the
 * interval by the card's own ease factor, and a lapse sends it back to the
 * start — because a card you just failed is not a card you nearly knew.
 */

export const GRADES: { grade: Grade; label: string; hint: string; keys: string }[] = [
  { grade: "again", label: "Again", hint: "No idea", keys: "1" },
  { grade: "hard", label: "Hard", hint: "Struggled", keys: "2" },
  { grade: "good", label: "Good", hint: "Got it", keys: "3" },
  { grade: "easy", label: "Easy", hint: "Instant", keys: "4" },
];

const DAY = 86_400_000;

export function schedule<T extends SM2>(card: T, grade: Grade, now = Date.now()): T {
  let { ease, interval, reps, lapses } = card;

  if (grade === "again") {
    // A lapse resets the interval but only dents the ease: a card you forget
    // once is not permanently harder than one you have never seen.
    lapses += 1;
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (grade === "hard") ease = Math.max(1.3, ease - 0.15);
    if (grade === "easy") ease = Math.min(2.8, ease + 0.15);

    if (reps === 1) interval = grade === "easy" ? 3 : 1;
    else if (reps === 2) interval = grade === "hard" ? 3 : 6;
    else {
      const factor = grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease;
      interval = Math.round(interval * factor);
    }
    interval = Math.min(interval, 365);
  }

  return {
    ...card,
    ease,
    interval,
    reps,
    lapses,
    lastReviewed: now,
    // A lapsed card comes back in ten minutes, not tomorrow — the point of
    // failing it is to see it again this session.
    due: grade === "again" ? now + 10 * 60_000 : now + interval * DAY,
  };
}

export function isDue(card: SM2, now = Date.now()): boolean {
  return card.due <= now;
}

export function dueCount(cards: SM2[], now = Date.now()): number {
  return cards.filter((c) => isDue(c, now)).length;
}

/** New cards first, then the most overdue: the ones you are closest to losing. */
export function orderForReview<T extends SM2>(cards: T[], now = Date.now()): T[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => {
      if (a.reps === 0 && b.reps !== 0) return -1;
      if (b.reps === 0 && a.reps !== 0) return 1;
      return a.due - b.due;
    });
}

export function formatDue(due: number, now = Date.now()): string {
  const diff = due - now;
  if (diff <= 0) return "due now";
  if (diff < 3600_000) return `in ${Math.round(diff / 60_000)}m`;
  if (diff < DAY) return `in ${Math.round(diff / 3600_000)}h`;
  const days = Math.round(diff / DAY);
  if (days < 31) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}

/** A fresh SM-2 record, for anything that will be scheduled. */
export function newSchedule(now = Date.now()): SM2 {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

export function newCard(deckId: string, front: string, back: string): Card {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    deckId,
    front,
    back,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: Date.now(),
    createdAt: Date.now(),
  };
}
