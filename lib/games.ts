/**
 * Games made from a deck, and the points they give.
 *
 * Three games, each a different kind of remembering:
 *
 *  - Match: every term and its answer on the table at once, joined in
 *    pairs against the clock. Recognition, but fast, and the whole deck in
 *    view is a way of seeing how it fits together.
 *  - Quick-fire: a minute, a question, four answers. Recognition under
 *    time, with a combo for a run of right ones.
 *  - Gravity: a question falls; type the answer before it lands. Recall,
 *    which is the one the exam asks for, and a missed one has to be typed
 *    out correctly before the game goes on, so the miss teaches.
 *
 * None of them moves the schedule: a game is practice, like the "Practise"
 * run, and a card got right in a game is not a card remembered in a week.
 * What a game misses is offered back as a study session of exactly those.
 *
 * Points (XP) come from studying of every kind — a review, a game — and add
 * up to a level. Everything here is pure, so the tests can play it.
 */
import { clozeHidden, clozeQuestion, dayKey, isCloze, type Card, type Rating, type StudyDay } from "./study";

export type GameId = "match" | "blitz" | "gravity";

export const GAMES: { id: GameId; name: string; line: string; lowerIsBetter: boolean }[] = [
  { id: "match", name: "Match", line: "Join each term to its answer, against the clock.", lowerIsBetter: true },
  { id: "blitz", name: "Quick-fire", line: "One minute. Pick the right answer from four.", lowerIsBetter: false },
  { id: "gravity", name: "Gravity", line: "Type the answer before the question lands.", lowerIsBetter: false },
];

/** A card as a game uses it: what is asked, and the answer expected. */
export interface Pair {
  id: string;
  q: string;
  a: string;
}

export function pairOf(card: Card): Pair {
  const cloze = isCloze(card.front);
  return {
    id: card.id,
    q: (cloze ? clozeQuestion(card.front) : card.front).trim(),
    a: (cloze ? clozeHidden(card.front) : card.back).trim(),
  };
}

/**
 * The cards a game can use. Two with the same answer would make a tile
 * that matches either, so the second is left out; a card with nothing on
 * one side is not a pair at all.
 */
export function pairsOf(cards: Card[]): Pair[] {
  const seen = new Set<string>();
  const out: Pair[] = [];
  for (const c of cards) {
    const p = pairOf(c);
    const key = p.a.toLowerCase();
    if (!p.q || !p.a || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function shuffle<T>(xs: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------------------------------------------- match -- */

export interface Tile {
  key: string;
  pairId: string;
  side: "q" | "a";
  text: string;
}

/** Tiles longer than this do not fit a tile; those cards sit Match out. */
const TILE_MAX = 110;
export const MATCH_PAIRS = 6;

/**
 * A table of tiles: `n` pairs, each as two tiles, all shuffled. The pairs
 * are drawn at random, so a deck of forty is not the same six every time.
 */
export function matchRound(cards: Card[], n = MATCH_PAIRS, rand: () => number = Math.random): { pairs: Pair[]; tiles: Tile[] } {
  const fits = pairsOf(cards).filter((p) => p.q.length <= TILE_MAX && p.a.length <= TILE_MAX);
  const pairs = shuffle(fits, rand).slice(0, n);
  const tiles = shuffle(
    pairs.flatMap((p) => [
      { key: `${p.id}:q`, pairId: p.id, side: "q" as const, text: p.q },
      { key: `${p.id}:a`, pairId: p.id, side: "a" as const, text: p.a },
    ]),
    rand,
  );
  return { pairs, tiles };
}

/** Two tiles are a match when they are the two sides of one card. */
export function isMatch(a: Tile, b: Tile): boolean {
  return a.pairId === b.pairId && a.side !== b.side;
}

/** A wrong pairing costs a second, the way it does in every Match. */
export const MATCH_PENALTY_MS = 1_000;

/* ---------------------------------------------------------------- blitz -- */

export const BLITZ_MS = 60_000;

/**
 * Four answers for one question: the right one and three from the rest of
 * the deck, none repeating it in other letter-case. The wrong ones are the
 * most plausible the deck has: answers of about the same length, and a
 * number against numbers, because "a biological catalyst" beside "1945",
 * "Paris" and "yes" is answered by elimination, not by knowing. A little
 * chance among the closest keeps the same three from coming back every
 * time. A deck of three gives three choices; that is still a question.
 */
export function choicesFor(pair: Pair, pool: Pair[], rand: () => number = Math.random, n = 4): string[] {
  const right = pair.a.toLowerCase();
  const numeric = (t: string) => /^[\d\s.,%°+−-]+[a-zµ°%/²³]*$/i.test(t.trim());
  const seen = new Set([right]);
  const candidates: { a: string; far: number }[] = [];
  for (const p of shuffle(pool, rand)) {
    const k = p.a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const lengths = Math.abs(p.a.length - pair.a.length) / Math.max(p.a.length, pair.a.length, 1);
    const kind = numeric(p.a) === numeric(pair.a) ? 0 : 1;
    candidates.push({ a: p.a, far: lengths + kind + rand() * 0.25 });
  }
  const others = candidates.sort((x, y) => x.far - y.far).slice(0, n - 1).map((c) => c.a);
  return shuffle([pair.a, ...others], rand);
}

/** Points for one right answer in a run: ×2 after three, ×3 after six, ×4 after nine. */
export function comboOf(run: number): number {
  return Math.min(4, 1 + Math.floor(run / 3));
}

export function blitzPoints(run: number): number {
  return 10 * comboOf(run);
}

/* -------------------------------------------------------------- gravity -- */

export const GRAVITY_LIVES = 3;

/** How long a question takes to fall: twelve seconds, a little quicker for each one cleared, never under five. */
export function fallMs(cleared: number): number {
  return Math.max(5_000, Math.round(12_000 * Math.pow(0.93, cleared)));
}

/** Points for a question cleared: more the faster it is falling, half with the hint taken. */
export function gravityPoints(cleared: number, hinted = false): number {
  const p = 10 + Math.floor(cleared / 4) * 5;
  return hinted ? Math.ceil(p / 2) : p;
}

/**
 * The hint after a wrong try: the first letter and how long the answer
 * is, the way a teacher prompts — enough to bring it back, not enough to
 * copy it out.
 */
export function hintFor(answer: string): string {
  const a = answer.trim();
  const words = a.split(/\s+/).length;
  const first = a.match(/[\p{L}\p{N}]/u)?.[0] ?? a[0] ?? "";
  return `Starts with “${first.toUpperCase()}” · ${words === 1 ? `${a.length} letters` : `${words} words`}`;
}

/* ------------------------------------------------------------ xp, level -- */

/** Points for a review answer: effort counts, so a miss is not nothing. */
export function reviewXp(rating: Rating): number {
  return rating === "again" ? 2 : rating === "hard" ? 6 : 10;
}

/**
 * Points from a finished game. Match pays for pairs, with a bonus for
 * finishing under four seconds a pair; the others pay their score, less a
 * little so a game is never worth more than studying the same cards.
 */
export function gameXp(game: GameId, r: { score: number; pairs?: number; ms?: number }): number {
  if (game === "match") {
    const pairs = r.pairs ?? 0;
    const seconds = (r.ms ?? 0) / 1000;
    return pairs * 10 + Math.max(0, Math.round(pairs * 4 - seconds)) * 2;
  }
  return Math.round(r.score * 0.8);
}

/**
 * Level from total points. Level n starts at 50·n·(n−1): 100 for level 2,
 * 300 for 3, 600 for 4 — each a little further than the last, and never so
 * far that a week of study does not show.
 */
export function levelOf(xp: number): { level: number; into: number; need: number; next: number } {
  const x = Math.max(0, Math.floor(xp));
  let level = 1;
  while (50 * (level + 1) * level <= x) level++;
  const start = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, into: x - start, need: next - start, next };
}

/** The daily goals on offer, in points a day. */
export const GOALS: { xp: number; name: string }[] = [
  { xp: 20, name: "Casual" },
  { xp: 50, name: "Regular" },
  { xp: 100, name: "Serious" },
  { xp: 200, name: "Intense" },
];

/** Points earned on one day. */
export function xpOn(days: StudyDay[], day: string): number {
  return days.find((d) => d.day === day)?.xp ?? 0;
}

/**
 * Days in a row the goal was met, ending today or yesterday — the same
 * forgiveness the streak has, so going to bed does not break it.
 */
export function goalStreak(days: StudyDay[], goal: number, now: number): number {
  const met = new Set(days.filter((d) => (d.xp ?? 0) >= goal).map((d) => d.day));
  let at = now;
  if (!met.has(dayKey(at))) at -= 86_400_000;
  let n = 0;
  while (met.has(dayKey(at))) { n++; at -= 86_400_000; }
  return n;
}

export function totalXp(days: StudyDay[]): number {
  return days.reduce((n, d) => n + (d.xp ?? 0), 0);
}

/** A better score than the one kept, for that game — lower for Match's time, higher for the rest. */
export function isBest(game: GameId, value: number, kept: number | undefined): boolean {
  if (kept === undefined) return true;
  return GAMES.find((g) => g.id === game)!.lowerIsBetter ? value < kept : value > kept;
}

/** Tenths of a second, the way a clock in a game reads. */
export function clock(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}
