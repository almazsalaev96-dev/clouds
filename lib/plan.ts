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

/* ------------------------------------------------------------ the record -- */

import { DAY as A_DAY, dayKey, type StudyDay } from "./study";

/**
 * How often a card was known when it came up, over the last `span` days.
 *
 * The scheduler aims for ninety per cent; this is the number to hold
 * against it. Read from the day log rather than the cards, because a card
 * keeps only its last answer and the question is about the month.
 */
export function recallRate(days: StudyDay[], now: number, span = 30): { answered: number; right: number; rate: number | null } {
  const from = dayKey(now - (span - 1) * A_DAY);
  let answered = 0, right = 0;
  for (const d of days) {
    if (d.day < from) continue;
    /* A row written before `right` existed has no `right`. Summing it as
       NaN put "NaN% of 93" on the screen; counting it as zero put "0% of
       93" there instead, and told a student who knew nine cards in ten to
       shorten their gaps. A day that never recorded what was right is left
       out of the rate altogether. */
    if (typeof d.right !== "number" || !Number.isFinite(d.right)) continue;
    answered += d.answered || 0;
    right += d.right;
  }
  const rate = answered ? right / answered : null;
  return { answered, right, rate: rate !== null && Number.isFinite(rate) ? rate : null };
}

/**
 * The last `weeks` weeks as a grid, oldest first, ending today: one entry a
 * day, with how much was answered, so a calendar can be drawn from it.
 */
export function weeksOf(days: StudyDay[], now: number, weeks = 12): { day: string; answered: number }[] {
  const by = new Map(days.map((d) => [d.day, d.answered]));
  const total = weeks * 7;
  const out: { day: string; answered: number }[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const key = dayKey(now - i * A_DAY);
    out.push({ day: key, answered: by.get(key) ?? 0 });
  }
  return out;
}


/* ------------------------------------------------------------ the day -- */

/**
 * Today's plan, worked out here from what is already known. No model call.
 *
 * What is due, where the trouble is, one page worth reading again, and how
 * far off the exam is — each a press that opens the thing. The reading list
 * picks the page least recently touched among those with something on
 * them: the one most likely to have slipped, by the same reasoning the
 * scheduler uses for cards.
 */
export interface DayPlan {
  /** Cards due now, across every deck. */
  due: number;
  weakTopic: { topic: string; rate: number } | null;
  reread: { id: string; title: string } | null;
  /** Whole days until the exam, negative once it has passed; null with none set. */
  examDays: number | null;
  examName: string | null;
  /** Minutes sat in timed sessions today. */
  minutesToday: number;
  /** Cards answered today. */
  answeredToday: number;
}

export function todaysPlan(args: {
  due: number;
  weakTopic: { topic: string; rate: number } | null;
  notes: { id: string; title: string; content: string; updatedAt: number }[];
  days: StudyDay[];
  now: number;
  exam?: { name: string; date: string } | null;
}): DayPlan {
  const today = args.days.find((d) => d.day === dayKey(args.now));
  const worth = args.notes.filter((n) => n.title.trim() && n.content.trim().length >= 80);
  const reread = worth.length ? [...worth].sort((a, b) => a.updatedAt - b.updatedAt)[0] : null;
  /* Calendar days, not hours: an exam the day after tomorrow is "in 2
     days" at breakfast and at bedtime alike. */
  let examDays: number | null = null;
  if (args.exam?.date) {
    const at = new Date(`${args.exam.date}T00:00:00`);
    const today = new Date(args.now);
    today.setHours(0, 0, 0, 0);
    if (Number.isFinite(at.getTime())) examDays = Math.round((at.getTime() - today.getTime()) / A_DAY);
  }
  return {
    due: args.due,
    weakTopic: args.weakTopic,
    reread: reread ? { id: reread.id, title: reread.title } : null,
    examDays,
    examName: args.exam?.name?.trim() || null,
    minutesToday: today?.minutes ?? 0,
    answeredToday: today?.answered ?? 0,
  };
}

/** "in 12 days", "tomorrow", "today", "3 days ago". */
export function examLine(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  return days === -1 ? "yesterday" : `${-days} days ago`;
}
