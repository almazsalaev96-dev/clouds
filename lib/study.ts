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
 * The algorithm is FSRS for the gaps and two learning steps before a card
 * counts as known. FSRS — the Free Spaced Repetition Scheduler — is what
 * Anki has scheduled with by default since 2023, and it was fitted to half a
 * billion real reviews: it models each card as a memory with a *stability*
 * (how long it lasts) and a *difficulty*, predicts the chance you still know
 * it, and asks again at the point that chance falls to nine in ten. The
 * benchmark that matters is that it needs twenty to thirty per cent fewer
 * reviews than the SM-2 rule this file used to run for the same retention.
 * The learning steps are kept from that rule, because a card seen a minute
 * ago has not told you anything about its memory yet and FSRS has nothing
 * to say until it has. The weights are FSRS-6's published defaults, which
 * the benchmark finds better than SM-2 for all but half a per cent of
 * people; fitting them to one person's history is a later step.
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
  /**
   * How long the memory lasts, in days — the gap after which there is a 90%
   * chance of still knowing it. FSRS's own number; grows with every good
   * answer and shrinks with a lapse. Absent on a card scheduled before FSRS
   * arrived, and worked out from what SM-2 knew the first time it is asked.
   */
  stability?: number;
  /** How hard this card is for this person, 1 (easy) to 10 (hard). */
  difficulty?: number;
  /** Where it came from, so a card can point at the thing it was made from. */
  source?: string;
  /**
   * What this card is *about*, which is not the same as which deck it is in.
   *
   * A deck is a box somebody made; a topic is the thing being learned. They
   * come apart the moment a deck is made from a chapter — "Biology paper 2"
   * holds osmosis and respiration and the light reaction, and knowing that
   * the deck as a whole sits at 78% tells you nothing about which of the
   * three to spend Tuesday on. Every reading that matters (what is shaky,
   * what to practise, what keeps being got wrong) is per topic; the deck
   * stays the box.
   */
  topic?: string;
  /** Free labels, for a view across decks. */
  tags?: string[];
  /** The card this one is the other way round of, where it has a twin. */
  reverseOf?: string;
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
/** Below this, a card is asked so often it is not worth having. */
export const MIN_EASE = 1.3;

/* ----------------------------------------------------------------- FSRS -- */

/**
 * FSRS-6's default weights, in the order the papers number them.
 *
 * Not to be tuned by hand. The right way to change how this schedules is
 * `DESIRED_RETENTION` below; the weights are what the fit found, and they
 * are better than any hand-chosen set for almost everybody.
 */
export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

/**
 * How sure you want to be before a card comes back.
 *
 * Nine in ten is the figure everybody who has measured this settles on:
 * higher means many more reviews for a little more recall, lower means
 * forgetting things you paid to learn. It is the one knob FSRS offers, and
 * the whole reason the weights above are not one.
 */
export const DESIRED_RETENTION = 0.9;

const GRADE: Record<Rating, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** The chance of still knowing a card `days` after it was last seen. */
export function retrievability(days: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, days)) / Math.max(0.01, stability), DECAY);
}

/**
 * How much of what comes up you mean to know, as a choice.
 *
 * Ninety per cent is FSRS's default and the right one for most people, but
 * it is a trade and the student is the one paying: aiming for ninety-five
 * roughly doubles the reviews for five points of recall, and eighty halves
 * them for a revision season that has more subjects than evenings. Anki
 * exposes the same dial as "desired retention". Outside this range the
 * arithmetic still works and the advice stops being sensible.
 */
export const RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.95] as const;
export const clampRetention = (r: unknown): number =>
  typeof r === "number" && Number.isFinite(r) ? Math.min(0.97, Math.max(0.7, r)) : DESIRED_RETENTION;

/**
 * Roughly how many reviews a day the cards you already know will ask for,
 * once they settle, at a given aim.
 *
 * Each review card comes back about once every `intervalFor(stability)`
 * days, so it costs one over that a day; the sum is the steady load. It is
 * a forecast from what the cards are now — it cannot know about the cards
 * you have not made yet, or the ones you are about to get wrong — so it is
 * said as "about", and it is what makes the dial above an informed choice
 * rather than a percentage somebody picks because it sounds diligent.
 */
export function dailyLoad(cards: Card[], retention = DESIRED_RETENTION): number {
  let load = 0;
  for (const c of cards) {
    if (c.state !== "review") continue;
    load += 1 / intervalFor(adopt(c).stability, retention);
  }
  return load;
}

/** The gap that brings a card back at the desired retention, in whole days. */
export function intervalFor(stability: number, retention = DESIRED_RETENTION): number {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(days));
}

const initialStability = (g: 1 | 2 | 3 | 4) => W[g - 1];
const initialDifficulty = (g: 1 | 2 | 3 | 4) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);

/** Difficulty after an answer: nudged by the grade, pulled back toward the mean. */
function nextDifficulty(d: number, g: 1 | 2 | 3 | 4): number {
  const nudged = d + -W[6] * (g - 3) * ((10 - d) / 9);
  return clampD(W[7] * initialDifficulty(4) + (1 - W[7]) * nudged);
}

/** Stability after a successful review. */
function stabilityAfterSuccess(d: number, s: number, r: number, g: 2 | 3 | 4): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
}

/** Stability after forgetting: never more than it was. */
function stabilityAfterLapse(d: number, s: number, r: number): number {
  const fresh = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(fresh, s);
}

/**
 * Stability after a second look on the same day, which teaches little — and
 * never *un*-teaches. FSRS-6 clamps the multiplier at one for a good or easy
 * answer, and a port that left that out made a card seen again half an hour
 * later come back sooner than it was already due: a right answer shrinking
 * the memory it confirmed.
 */
function stabilitySameDay(s: number, g: 1 | 2 | 3 | 4): number {
  const m = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(s, -W[19]);
  return s * (g >= 3 ? Math.max(1, m) : m);
}

/**
 * What a card scheduled by the old rule looks like to the new one.
 *
 * Stability is the gap it was on: a card the old rule was asking every
 * thirty days had, by that rule's lights, a month of memory in it. Difficulty
 * from the ease it earned — 2.5 was the old default and lands in the middle
 * of FSRS's scale, and the punishing floor of 1.3 lands at the top.
 */
export function adopt(card: Card): { stability: number; difficulty: number } {
  if (card.stability != null && card.difficulty != null) return { stability: card.stability, difficulty: card.difficulty };
  const stability = Math.max(0.1, card.interval || initialStability(3));
  const difficulty = clampD(5 + (2.5 - card.ease) * 4.5);
  return { stability, difficulty };
}

/**
 * The card, after an answer.
 *
 * Returns a new card rather than mutating, so the caller can write it and
 * the test can compare. Nothing here reads the clock.
 */
export function schedule(card: Card, rating: Rating, now: number, retention = DESIRED_RETENTION): Card {
  const next: Card = { ...card, reps: card.reps + 1, lastAnswered: now };
  /* The day a card was first met, for the daily cap on new ones. Stamped
     once and never moved: a lapse sends a card back to the start of its
     steps, but it does not make it new again. */
  if (card.reps === 0) next.introducedAt = now;

  const g = GRADE[rating];

  /* Ease is kept up to date for the row that still reads it, and for a
     backup restored into an older build. It no longer decides anything. */
  if (card.state === "review") {
    const delta = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[rating];
    next.ease = Math.max(MIN_EASE, round2(card.ease + delta));
  }

  if (rating === "again") {
    /* Forgotten. Back to the first step — with what FSRS learned kept: the
       memory is weaker now and the card is harder, and both are written
       down, so that when it graduates again the gap starts from what is
       actually known about it rather than from a blank. A card you have
       forgotten once is not a card you have never seen, and treating it as
       new is how a deck fills up with things you already know. */
    if (card.state === "review") {
      const { stability, difficulty } = adopt(card);
      const r = retrievability(daysSince(card, now), stability);
      next.stability = stabilityAfterLapse(difficulty, stability, r);
      next.difficulty = nextDifficulty(difficulty, 1);
      next.lapses = card.lapses + 1;
    } else if (card.stability != null) {
      next.difficulty = nextDifficulty(card.difficulty ?? initialDifficulty(1), 1);
    }
    next.state = "learning";
    next.interval = 0;
    next.step = 0;
    next.due = now + LEARNING_STEPS[0] * MINUTE;
    return next;
  }

  if (card.state === "new" || card.state === "learning") {
    /* The first real gap is FSRS's initial stability for the grade — what
       the fit found a card first answered "good" is worth — unless the card
       has been round before and knows better. Easy skips the steps. */
    const known = card.stability != null ? adopt(card) : null;
    const graduate = (grade: 3 | 4) => {
      const stability = known ? stabilityAfterSuccess(known.difficulty, known.stability, 1, grade) : initialStability(grade);
      const difficulty = known ? nextDifficulty(known.difficulty, grade) : initialDifficulty(grade);
      const days = intervalFor(stability, retention);
      next.state = "review";
      next.stability = stability;
      next.difficulty = difficulty;
      next.interval = days;
      next.step = 0;
      next.due = now + days * DAY;
      return next;
    };
    if (rating === "easy") return graduate(4);
    /* Hard repeats the step you are on; good moves you along it. A card
       that has been through both steps graduates. */
    const nextStep = rating === "hard" ? card.step : card.step + 1;
    if (nextStep >= LEARNING_STEPS.length) return graduate(3);
    next.state = "learning";
    next.interval = 0;
    next.step = nextStep;
    next.due = now + LEARNING_STEPS[nextStep] * MINUTE;
    return next;
  }

  /* A review. FSRS: how likely you were to still know it, given how long it
     has been, and how much that answer says about the memory. A second look
     on the same day is a different, smaller thing. */
  const { stability, difficulty } = adopt(card);
  const elapsed = daysSince(card, now);
  const r = retrievability(elapsed, stability);
  const s2 = elapsed < 1 ? stabilitySameDay(stability, g) : stabilityAfterSuccess(difficulty, stability, r, g as 2 | 3 | 4);
  const days = intervalFor(s2, retention);
  next.step = 0;
  next.state = "review";
  next.stability = s2;
  next.difficulty = nextDifficulty(difficulty, g);
  next.interval = days;
  next.due = now + days * DAY;
  return next;
}

/** Days since the card was last answered — or, for one never answered, none. */
const daysSince = (card: Card, now: number) =>
  card.lastAnswered ? Math.max(0, (now - card.lastAnswered) / DAY) : 0;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A card, before it has ever been answered. */
export function newCard(init: {
  id: string;
  deckId: string;
  front: string;
  back: string;
  now: number;
  source?: string;
  topic?: string;
  tags?: string[];
  reverseOf?: string;
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
    topic: init.topic,
    tags: init.tags,
    reverseOf: init.reverseOf,
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
export function dueNow(cards: Card[], now: number, opts: { newLimit?: number; after?: string } = {}): Card[] {
  /* How many new ones have already been started today, so the cap is on the
     day and not on the session — a person who studies twice before lunch has
     not earned forty. */
  const limit = opts.newLimit ?? NEW_PER_DAY;
  const started = cards.filter((c) => c.introducedAt && c.introducedAt >= midnightOf(now)).length;
  let room = Math.max(0, limit - started);
  const due = cards
    .filter((c) => c.due <= now)
    /* New cards last. Somebody who opens a deck with forty overdue reviews
       and twenty new cards should clear the backlog first — adding new
       things on top of a pile you have already forgotten is how people
       abandon this. */
    .sort((a, b) => rank(a) - rank(b) || a.due - b.due)
    .filter((c) => (c.state !== "new" ? true : room-- > 0));
  /* Mixed, within each kind: cards made together fall due together, so an
     order by due time alone asked ten osmosis cards in a row and then ten
     on respiration. */
  const seen = due.filter((c) => c.state !== "new");
  const fresh = due.filter((c) => c.state === "new");
  const mixed = interleave(seen, opts.after);
  return [...mixed, ...interleave(fresh, mixed.length ? topicKey(mixed[mixed.length - 1]) : opts.after)];
}

/** What counts as "the same thing" for mixing: the topic, else the deck. */
export const topicKey = (c: Card): string => c.topic?.trim().toLowerCase() || `deck:${c.deckId}`;

/**
 * The same cards, with neighbours on different topics wherever the queue
 * allows it.
 *
 * Interleaving — mixing kinds of problem instead of practising one kind in a
 * block — is one of the few study habits with large, replicated effects: in
 * a preregistered classroom trial (Rohrer et al., 2020, 787 students) a
 * mixed schedule scored 61% to the blocked schedule's 38% a month later. It
 * works because a block tells you which method the next question needs
 * before you have read it; a mix makes you notice.
 *
 * Greedy and close to the original order: each place takes the earliest
 * card, within a short look-ahead, whose topic differs from the one before.
 * The look-ahead keeps the most overdue cards near the front; where every
 * card left is on one topic, they come in their own order. `after` is the
 * topic of the card just answered, which has already left the list.
 */
export function interleave(cards: Card[], after?: string, ahead = 8): Card[] {
  const left = [...cards];
  const out: Card[] = [];
  let last = after;
  while (left.length) {
    let i = left.slice(0, ahead).findIndex((c) => topicKey(c) !== last);
    if (i < 0) i = 0;
    const [c] = left.splice(i, 1);
    out.push(c);
    last = topicKey(c);
  }
  return out;
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
  /** Minutes sat in a timed session that day, where any were. */
  minutes?: number;
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

/* --------------------------------------------------------------- leeches -- */

/**
 * How many times a card may be forgotten before it is the card's fault.
 *
 * Eight is the number the tools that have watched this for decades settle
 * on, and the reason to have it at all is that a card you have forgotten
 * eight times is not going to be learned by being shown a ninth: either it
 * is two facts pretending to be one, or the front does not actually ask for
 * the back, or you have never understood the thing underneath it. All three
 * are fixed by rewriting or explaining it, and none by repetition — so the
 * card comes out of the queue and gets offered to the tutor instead of
 * quietly costing a slot every day for a month.
 */
export const LEECH_AT = 8;

export function isLeech(card: Card): boolean {
  return card.lapses >= LEECH_AT;
}

/* -------------------------------------------------------------- attempts -- */

/**
 * One answer, written down.
 *
 * A card remembers only its last answer, which is enough to schedule it and
 * not nearly enough to learn anything *about* the learning. "You keep
 * confusing mitosis with meiosis" cannot be seen from a card's state at all
 * — it needs the wrong answers themselves, kept, with what was given beside
 * what was wanted.
 *
 * Written on every marked answer, right ones included: a log of only the
 * failures cannot tell you a rate, and a rate is what makes "six of these
 * eight" mean something.
 */
export interface Attempt {
  id: string;
  at: number;
  /** The card, where there was one. A tutor question has none. */
  cardId?: string;
  deckId?: string;
  topic?: string;
  /** What was asked, kept in full so the log reads without the card. */
  question: string;
  /** What the person wrote. Empty where they pressed a button instead. */
  given: string;
  /** What was wanted. */
  expected: string;
  right: boolean;
  /** Whether they said they were sure, where they were asked. */
  sure?: boolean;
  /** The misconception, where one was named. */
  missed?: string;
}

/* ---------------------------------------------------------------- topics -- */

export interface TopicStat {
  topic: string;
  /** Graduated cards in this topic, across every deck. */
  reviewed: number;
  /** Mean chance of recalling one right now. */
  mean: number;
  /** How many are below the line. */
  shaky: number;
  /** Marked answers in the log, and how many were right. */
  tried: number;
  wrong: number;
}

/**
 * How each topic is actually held, across every deck it appears in.
 *
 * Two signals, because neither is enough alone: the memory model says what
 * is *likely* forgotten (it can say so about a card never got wrong, which
 * is its whole point), and the attempts log says what has *actually* been
 * got wrong (which the model cannot know about a card answered from a
 * button). A topic that is shaky on both is the one to spend Tuesday on.
 */
export function topicStats(cards: Card[], attempts: Attempt[], now: number): TopicStat[] {
  const by = new Map<string, TopicStat>();
  const row = (topic: string) => {
    let r = by.get(topic);
    if (!r) by.set(topic, (r = { topic, reviewed: 0, mean: 0, shaky: 0, tried: 0, wrong: 0 }));
    return r;
  };
  /* `mean` is accumulated as a sum here and divided at the end, so the row
     never carries a half-finished average anybody could read by mistake. */
  for (const c of cards) {
    if (!c.topic) continue;
    if (c.state !== "review" || !c.stability || c.interval <= 0) continue;
    const last = c.due - c.interval * DAY;
    const r = retrievability(Math.max(0, (now - last) / DAY), c.stability);
    const t = row(c.topic);
    t.reviewed += 1;
    t.mean += r;
    if (r < 0.8) t.shaky += 1;
  }
  for (const a of attempts) {
    if (!a.topic) continue;
    const t = row(a.topic);
    t.tried += 1;
    if (!a.right) t.wrong += 1;
  }
  return [...by.values()]
    .map((t) => ({ ...t, mean: t.reviewed ? t.mean / t.reviewed : 1 }))
    .sort((a, b) => a.mean - b.mean || b.wrong - a.wrong);
}

/**
 * The topic most worth an hour, or nothing.
 *
 * Nothing when there is not enough to judge, and nothing when the weakest is
 * held well — a nudge to practise something you know at ninety-five per cent
 * is noise, and noise is how a line like this gets ignored on the day it
 * matters.
 */
export function weakestTopic(cards: Card[], attempts: Attempt[], now: number, min = 4): TopicStat | null {
  const [first] = topicStats(cards, attempts, now)
    .filter((t) => t.reviewed >= min || t.tried >= min);
  if (!first) return null;
  return first.shaky > 0 || first.wrong > 0 ? first : null;
}

/* ----------------------------------------------------------- calibration -- */

export interface Calibration {
  sureRight: number;
  sureWrong: number;
  unsureRight: number;
  unsureWrong: number;
  /** Answers that carried a confidence at all. */
  n: number;
}

/**
 * The two-by-two, and the one quadrant that matters.
 *
 * Sure-and-wrong is the dangerous cell: it is the answer you will not
 * check, the working you will not redo, and the question you will lose the
 * marks on without ever feeling it coming. Not-sure-and-right is only a
 * confidence problem. The other two are working as intended.
 */
export function calibration(attempts: Attempt[]): Calibration {
  const c: Calibration = { sureRight: 0, sureWrong: 0, unsureRight: 0, unsureWrong: 0, n: 0 };
  for (const a of attempts) {
    if (a.sure === undefined) continue;
    c.n += 1;
    if (a.sure && a.right) c.sureRight += 1;
    else if (a.sure && !a.right) c.sureWrong += 1;
    else if (!a.sure && a.right) c.unsureRight += 1;
    else c.unsureWrong += 1;
  }
  return c;
}

/** What the two-by-two is telling you, in a sentence, or nothing. */
export function calibrationLine(c: Calibration): string | null {
  if (c.n < 8) return null;
  const overs = c.sureWrong / Math.max(1, c.sureWrong + c.sureRight);
  const unders = c.unsureRight / Math.max(1, c.unsureRight + c.unsureWrong);
  if (overs >= 0.25) {
    return `Sure and wrong ${c.sureWrong} times of ${c.sureWrong + c.sureRight}. That is the quadrant that costs marks, because it is the answer you do not check.`;
  }
  if (unders >= 0.7) {
    return `You were right ${c.unsureRight} of the ${c.unsureRight + c.unsureWrong} times you were not sure. You know more than you are giving yourself credit for.`;
  }
  return "Your sense of what you know matches what you know. That is worth as much as the knowing.";
}

/* -------------------------------------------------------------- mistakes -- */

/**
 * The cards you keep getting wrong, worst first.
 *
 * Ordered by how many times each has been missed rather than by when it is
 * next due, because this queue answers a different question from the
 * schedule's: not "what is owed today" but "what is not going in". A card
 * got wrong four times outranks one got wrong once, however either is
 * scheduled — and a card last got wrong months ago sinks, because a mistake
 * you have since stopped making is not a mistake.
 */
export function mistakeQueue(attempts: Attempt[], cards: Card[], now: number, span = 30): Card[] {
  const since = now - span * DAY;
  const misses = new Map<string, number>();
  for (const a of attempts) {
    if (a.right || !a.cardId || a.at < since) continue;
    misses.set(a.cardId, (misses.get(a.cardId) ?? 0) + 1);
  }
  return cards
    .filter((c) => misses.has(c.id))
    .sort((a, b) => (misses.get(b.id) ?? 0) - (misses.get(a.id) ?? 0));
}

/* ------------------------------------------------------- reverse cards -- */

/**
 * The same fact asked the other way.
 *
 * Knowing that "mitochondrion → the powerhouse" does not mean you can go
 * from the description back to the word, and an exam asks in whichever
 * direction it likes. A reverse is a real second card with its own
 * schedule, because the two directions are genuinely learned at different
 * rates — not a display toggle on one card, which would let the easy
 * direction carry the hard one.
 *
 * Refused for a cloze: a sentence with a hole reversed is a hole with a
 * sentence, which is not a question.
 */
export function makeReverse(card: Card, id: string, now: number): Card | null {
  if (isCloze(card.front) || !card.front.trim() || !card.back.trim()) return null;
  return newCard({
    id,
    deckId: card.deckId,
    front: card.back,
    back: card.front,
    now,
    source: card.source,
    topic: card.topic,
    tags: card.tags,
    reverseOf: card.id,
  });
}
