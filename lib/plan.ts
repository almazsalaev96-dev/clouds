/**
 * What to do today, worked out from what is already known.
 *
 * The scheduler says what is due. This says where the trouble is: the deck
 * whose cards are most likely to be forgotten right now, from the same
 * memory model the scheduler runs on, so "practise this one" is a reading
 * of the person's own answers and not a guess. No model call; nothing
 * leaves the browser.
 *
 * Pure. Cards in, a reading out.
 */
import { DAY, retrievability, type Card } from "./study";

export interface DeckHealth {
  deckId: string;
  /** Cards that have graduated and can be judged. */
  reviewed: number;
  /** Mean chance of recalling one of them right now, 0–1. */
  mean: number;
  /** How many are below the line where a review is overdue in all but name. */
  shaky: number;
}

/** Where the shaky line sits. Below it the scheduler itself would ask. */
export const SHAKY = 0.8;

/**
 * How well each deck is held, right now.
 *
 * Only graduated cards with a stability count: a new card has no memory to
 * measure, and a learning card is measured by its steps. The last review is
 * read back from the due date and the interval, which is what the scheduler
 * set them from.
 */
export function deckHealth(cards: Card[], now: number): DeckHealth[] {
  const by = new Map<string, { sum: number; n: number; shaky: number }>();
  for (const c of cards) {
    if (c.state !== "review" || !c.stability || c.interval <= 0) continue;
    const last = c.due - c.interval * DAY;
    const days = Math.max(0, (now - last) / DAY);
    const r = retrievability(days, c.stability);
    const d = by.get(c.deckId) ?? { sum: 0, n: 0, shaky: 0 };
    d.sum += r;
    d.n += 1;
    if (r < SHAKY) d.shaky += 1;
    by.set(c.deckId, d);
  }
  return [...by.entries()]
    .map(([deckId, d]) => ({ deckId, reviewed: d.n, mean: d.sum / d.n, shaky: d.shaky }))
    .sort((a, b) => a.mean - b.mean);
}

/**
 * The deck most worth practising, or nothing.
 *
 * Nothing when no deck has enough graduated cards to judge (`min`), and
 * nothing when the weakest is still held well: a suggestion to practise a
 * deck at ninety-five per cent is noise, and noise is how a line like this
 * gets ignored on the day it matters.
 */
export function weakestDeck(cards: Card[], now: number, min = 5): DeckHealth | null {
  const [first] = deckHealth(cards, now).filter((d) => d.reviewed >= min);
  return first && first.shaky > 0 ? first : null;
}
