/**
 * The one thing an assistant cannot do for you, and a database can.
 *
 * ChatGPT, Claude and Gemini will all write you a set of flashcards in
 * twenty seconds. None of them will remember, next Tuesday, that you got
 * the third one wrong twice — the cards scroll out of the conversation and
 * that is the end of them. Everything known about learning says the
 * opposite: what matters is not the explanation, it is being asked again,
 * later, at the point you are about to forget.
 *
 * That is a scheduling problem, not a language problem. It needs rows that
 * outlive the chat and arithmetic that nobody has to think about — which is
 * exactly what this app is and exactly what a chat window is not. So the
 * model writes the cards, and this decides when you see them.
 *
 * The algorithm is SM-2 with the corners knocked off: two learning steps
 * before a card counts as known, an ease factor that moves with how it
 * goes, and a lapse that sends a card back to the start without throwing
 * away what it learned about its difficulty. It is the same family Anki
 * and every other serious tool uses, and its whole virtue is that it is
 * boring and predictable.
 *
 * This file is pure. No database, no clock of its own: `now` is passed in,
 * so a test can sit on a Tuesday in March and watch a card come back.
 */

export type Rating = "again" | "hard" | "good" | "easy";

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** Where in its life it is. New cards have never been answered. */
  state: "new" | "learning" | "review";
  /** When it should next be asked. Milliseconds, like everything else here. */
  due: number;
  /** How long the last gap was, in days. Zero while it is still learning. */
  interval: number;
  /** How kindly it is treated: 1.3 is punishing, 2.5 is the default. */
  ease: number;
  /** How many times it has been answered at all. */
  reps: number;
  /** How many times it was known and then forgotten. */
  lapses: number;
  /**
   * Which learning step it is on, while it is learning.
   *
   * Stored rather than worked out from the due date, which was the first
   * attempt and was wrong: a card answered at or after the moment it was
   * due has no time left on the clock, so every learning card looked like
   * it was on the first step and nothing ever graduated. The test found
   * that in about a second, which is the argument for the test.
   */
  step: number;
  createdAt: number;
  /** When it was last answered, for "you have done thirty today". */
  lastAnswered?: number;
  /** When it was first answered, for the cap on new cards a day. */
  introducedAt?: number;
  /** Where it came from, so a card can point at the thing it was made from. */
  source?: string;
}

/* ---------------------------------------------------------------- cloze -- */

/**
 * A cloze card: the sentence with a hole in it.
 *
 * "The capital of {{France}} is Paris" asks for France. It is the card type
 * people who use these tools seriously make most of, because it tests the
 * fact *in its sentence* rather than as a quiz question about it — and a
 * sentence from your own notes with one word missing is the fastest card
 * there is to make.
 *
 * Kept in the same two columns as every other card: the front holds the
 * whole sentence with the answer in double braces, the back holds the
 * answer. So nothing in the table changes, every existing query still works,
 * and a cloze is simply a front that contains the marker. `{{c1::x}}`, the
 * form other tools export, is read as `{{x}}`.
 */
const CLOZE = /\{\{(?:c\d+::)?([^{}]+?)\}\}/g;

export function isCloze(front: string): boolean {
  CLOZE.lastIndex = 0;
  return CLOZE.test(front);
}

/** The question as it is asked: every hole shown as a blank. */
export function clozeQuestion(front: string): string {
  return front.replace(CLOZE, "[…]");
}

/** The answer as it is shown: the sentence whole, with what was hidden marked. */
export function clozeAnswer(front: string): string {
  return front.replace(CLOZE, (_, w: string) => `**${w}**`);
}

/** What was hidden, for the back of a card made from a sentence. */
export function clozeHidden(front: string): string {
  const out: string[] = [];
  front.replace(CLOZE, (_, w: string) => {
    out.push(w);
    return "";
  });
  return out.join(" · ");
}

/**
 * A sentence, with one term made into a hole.
 *
 * The move a highlighter makes: you have the notes open, a phrase in them is
 * the thing to remember, and the card is that sentence with the phrase taken
 * out. Case is kept and the first occurrence is used; a term that is not in
 * the sentence is not a card, and null says so rather than making one with
 * no hole.
 */
export function makeCloze(sentence: string, term: string): { front: string; back: string } | null {
  const s = sentence.trim();
  const t = term.trim();
  if (!s || !t) return null;
  const at = s.toLowerCase().indexOf(t.toLowerCase());
  if (at < 0) return null;
  const exact = s.slice(at, at + t.length);
  return { front: `${s.slice(0, at)}{{${exact}}}${s.slice(at + t.length)}`, back: exact };
}

export const MINUTE = 60_000;
export const DAY = 86_400_000;

/** Two steps before a card counts as learned, in minutes. */
export const LEARNING_STEPS = [1, 10];
/** The first real gap once it graduates. */
export const GRADUATING_DAYS = 1;
/** And the gap for a card that graduates straight away. */
export const EASY_DAYS = 4;
/** Below this, a card is asked so often it is not worth having. */
export const MIN_EASE = 1.3;

/**
 * The card, after an answer.
 *
 * Returns a new card rather than mutating, so the caller can write it and
 * the test can compare. Nothing here reads the clock.
 */
export function schedule(card: Card, rating: Rating, now: number): Card {
  const next: Card = { ...card, reps: card.reps + 1, lastAnswered: now };
  /* The day a card was first met, for the daily cap on new ones. Stamped
     once and never moved: a lapse sends a card back to the start of its
     steps, but it does not make it new again. */
  if (card.reps === 0) next.introducedAt = now;

  /* Ease moves on every review, and only on a review: a card still in its
     learning steps has not told you anything about how hard it is, it has
     told you that you saw it a minute ago. */
  if (card.state === "review") {
    const delta = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[rating];
    next.ease = Math.max(MIN_EASE, round2(card.ease + delta));
  }

  if (rating === "again") {
    /* Forgotten. Back to the first step — but the ease it earned stays,
       because a card you have forgotten once is not a card you have never
       seen, and treating it as new is how a deck fills up with things you
       already know. */
    next.state = "learning";
    next.interval = 0;
    next.step = 0;
    next.lapses = card.state === "review" ? card.lapses + 1 : card.lapses;
    next.due = now + LEARNING_STEPS[0] * MINUTE;
    return next;
  }

  if (card.state === "new" || card.state === "learning") {
    if (rating === "easy") {
      next.state = "review";
      next.interval = EASY_DAYS;
      next.step = 0;
      next.due = now + EASY_DAYS * DAY;
      return next;
    }
    /* Hard repeats the step you are on; good moves you along it. A card
       that has been through both steps graduates. */
    const nextStep = rating === "hard" ? card.step : card.step + 1;
    if (nextStep >= LEARNING_STEPS.length) {
      next.state = "review";
      next.interval = GRADUATING_DAYS;
      next.step = 0;
      next.due = now + GRADUATING_DAYS * DAY;
      return next;
    }
    next.state = "learning";
    next.interval = 0;
    next.step = nextStep;
    next.due = now + LEARNING_STEPS[nextStep] * MINUTE;
    return next;
  }

  /* A review. The gap grows by the ease, and "hard" grows it barely. */
  next.step = 0;
  const grow = rating === "hard" ? 1.2 : next.ease;
  const days = Math.max(1, Math.round(card.interval * grow * (rating === "easy" ? 1.3 : 1)));
  next.state = "review";
  next.interval = days;
  next.due = now + days * DAY;
  return next;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A card, before it has ever been answered. */
export function newCard(init: {
  id: string;
  deckId: string;
  front: string;
  back: string;
  now: number;
  source?: string;
}): Card {
  return {
    id: init.id,
    deckId: init.deckId,
    front: init.front,
    back: init.back,
    state: "new",
    /* Due immediately: a card you made two minutes ago and cannot study is
       a card you will not come back for. */
    due: init.now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    step: 0,
    createdAt: init.now,
    source: init.source,
  };
}

/**
 * How many never-seen cards a day is enough.
 *
 * A deck of two hundred, made in one go, used to be two hundred due at once
 * — and the first session of a new subject being a wall is the way every one
 * of these tools loses people in the first week. Twenty is what the tools
 * that have measured this settle on: enough to get somewhere, few enough
 * that tomorrow's reviews of them are not a second wall. The reviews are
 * never capped; those are debts, and the cap is about not borrowing more.
 */
export const NEW_PER_DAY = 20;

/** What is waiting, in the order it should be asked. */
export function dueNow(cards: Card[], now: number, opts: { newLimit?: number } = {}): Card[] {
  /* How many new ones have already been started today, so the cap is on the
     day and not on the session — a person who studies twice before lunch has
     not earned forty. */
  const limit = opts.newLimit ?? NEW_PER_DAY;
  const started = cards.filter((c) => c.introducedAt && c.introducedAt >= midnightOf(now)).length;
  let room = Math.max(0, limit - started);
  return cards
    .filter((c) => c.due <= now)
    /* New cards last. Somebody who opens a deck with forty overdue reviews
       and twenty new cards should clear the backlog first — adding new
       things on top of a pile you have already forgotten is how people
       abandon this. */
    .sort((a, b) => rank(a) - rank(b) || a.due - b.due)
    .filter((c) => (c.state !== "new" ? true : room-- > 0));
}

/**
 * Everything, for the night before.
 *
 * The scheduler is the whole point of the room and it is also the thing
 * that says "nothing due today" the evening before an exam. Practice asks
 * every card in the deck, the ones it has seen you get wrong first, and the
 * answers you give change nothing about when they come back: that is a
 * separate promise the schedule made, and a run-through the night before
 * does not get to break it.
 */
export function cramOrder(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.lapses - a.lapses || a.ease - b.ease || a.createdAt - b.createdAt);
}

const midnightOf = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const rank = (c: Card) => (c.state === "learning" ? 0 : c.state === "review" ? 1 : 2);

export interface Progress {
  /** Everything in the deck. */
  total: number;
  /** Never answered. */
  fresh: number;
  /** Answered, not yet graduated. */
  learning: number;
  /** Graduated: it has a real gap. */
  known: number;
  /** Waiting right now. */
  due: number;
  /** The next time anything is waiting, if nothing is now. */
  nextDue: number | null;
}

export function progressOf(cards: Card[], now: number): Progress {
  /* Through `dueNow`, so the number on the row is the number the session
     will actually ask. Counting every card whose time had come put "50 due"
     on a fresh deck that the session, rightly, opens twenty of. */
  const due = dueNow(cards, now).length;
  /* The next one waiting, whether or not something is waiting now: a deck
     with three due and the next in an hour is a different deck from one
     with three due and the next in a fortnight, and only the caller knows
     which of the two facts it wants to show. */
  const later = cards.filter((c) => c.due > now).map((c) => c.due).sort((a, b) => a - b);
  return {
    total: cards.length,
    fresh: cards.filter((c) => c.state === "new").length,
    learning: cards.filter((c) => c.state === "learning").length,
    known: cards.filter((c) => c.state === "review").length,
    due,
    nextDue: later.length ? later[0] : null,
  };
}

/**
 * How many were answered today, where today starts at midnight where the
 * person is. Not "in the last 24 hours": somebody studying at nine in the
 * evening and again at nine the next morning has had two days, and a
 * rolling window would tell them they had had one.
 */
export function answeredToday(cards: Card[], now: number): number {
  const from = midnightOf(now);
  return cards.filter((c) => (c.lastAnswered ?? 0) >= from).length;
}

/* --------------------------------------------------------------- streak -- */

/**
 * One row per day studied. The cards cannot say this on their own — a card
 * keeps only its *last* answer, so a card met on Monday and again on
 * Wednesday has forgotten Monday. A streak has to be written down as it
 * happens or it cannot be counted afterwards.
 */
export interface StudyDay {
  /** The calendar day, local, as YYYY-MM-DD. The key. */
  day: string;
  /** Cards answered that day. */
  answered: number;
  /** Of which were got right the first time (good or easy). */
  right: number;
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Days in a row ending today or yesterday.
 *
 * Yesterday counts: a streak that dies at midnight before you have had a
 * chance to study today is a streak that punishes going to bed, and the
 * point of it is the opposite.
 */
export function streakOf(days: StudyDay[], now: number): number {
  const have = new Set(days.filter((d) => d.answered > 0).map((d) => d.day));
  let n = 0;
  let at = now;
  if (!have.has(dayKey(at))) at -= DAY;
  while (have.has(dayKey(at))) {
    n += 1;
    at -= DAY;
  }
  return n;
}

/* --------------------------------------------------------- in and out -- */

/**
 * Cards from text, in the shapes people already have them in.
 *
 * One card per line. "Question :: Answer" is the form written by hand; a tab
 * between is what every one of these tools exports; a comma is a CSV. A line
 * with a cloze marker and nothing after it is a cloze card, with the answer
 * taken from the marker. Blank lines and lines with no divider are skipped,
 * and the count of what was skipped is returned so it can be said.
 */
export function parseCards(text: string): { cards: { front: string; back: string }[]; skipped: number } {
  const cards: { front: string; back: string }[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (isCloze(line) && !/::|\t/.test(line.replace(CLOZE, ""))) {
      cards.push({ front: line, back: clozeHidden(line) });
      continue;
    }
    const m = line.match(/^(.+?)\s*(?:::|\t)\s*(.+)$/) ?? line.match(/^"?([^",]+?)"?\s*,\s*"?(.+?)"?$/);
    if (m && m[1].trim() && m[2].trim()) cards.push({ front: m[1].trim(), back: m[2].trim() });
    else skipped += 1;
  }
  return { cards, skipped };
}

/** The deck as text, one card a line, in the form that reads back in. */
export function exportCards(cards: { front: string; back: string }[]): string {
  return cards.map((c) => `${c.front.replace(/\t/g, " ")}\t${c.back.replace(/\t/g, " ")}`).join("\n") + "\n";
}

/** "in 3 days", "in 2 hours", "now" — for the button that offers the next one. */
export function whenDue(at: number, now: number): string {
  const ms = at - now;
  if (ms <= 0) return "now";
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(ms / (60 * MINUTE));
  if (hours < 36) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(ms / DAY);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** What the next gap will be, said before you answer. Honest, not a promise. */
export function previewGaps(card: Card, now: number): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of ["again", "hard", "good", "easy"] as Rating[]) {
    out[r] = whenDue(schedule(card, r, now).due, now);
  }
  return out;
}
