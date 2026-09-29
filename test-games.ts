/**
 * The games' rules and the points: pairs from a deck, a Match table, four
 * answers for Quick-fire, Gravity's fall, the combo, points into levels,
 * and a best score kept the right way round for each game.
 *
 *   npx jiti test-games.ts
 */
import { newCard, streakOf, dayKey } from "./lib/study";
import {
  GAMES, pairsOf, matchRound, isMatch, choicesFor, comboOf, blitzPoints, fallMs, gravityPoints,
  reviewXp, gameXp, levelOf, totalXp, isBest, clock, hintFor, goalStreak, xpOn, GOALS,
} from "./lib/games";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const now = Date.now();
const card = (id: string, front: string, back: string) => newCard({ id, deckId: "d", front, back, now });
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const deck = [
  card("1", "Osmosis", "Water moving across a membrane"),
  card("2", "Diffusion", "Particles spreading from high to low"),
  card("3", "The {{mitochondria}} releases energy", ""),
  card("4", "Enzyme", "A biological catalyst"),
  card("5", "Catalyst", "a biological catalyst"),
  card("6", "", "nothing asked"),
  card("7", "Active transport", "Moving against the gradient, using energy"),
  card("8", "Long", "x".repeat(200)),
  card("9", "Plasmolysis", "A plant cell shrinking from its wall"),
];

console.log("\nPairs from a deck");
{
  const p = pairsOf(deck);
  check(p.find((x) => x.id === "3")?.q === "The […] releases energy" && p.find((x) => x.id === "3")?.a === "mitochondria", "a cloze card asks with a blank and answers with the hidden word");
  check(!p.some((x) => x.id === "5"), "a second card with the same answer (any case) is left out");
  check(!p.some((x) => x.id === "6"), "a card with nothing asked is not a pair");
}

console.log("\nMatch");
{
  const { pairs, tiles } = matchRound(deck, 6, rand);
  check(pairs.length === 6 && tiles.length === 12, "six pairs, twelve tiles", `${pairs.length}/${tiles.length}`);
  check(!pairs.some((p) => p.id === "8"), "a card too long for a tile sits Match out");
  const a = tiles.find((t) => t.side === "q")!;
  const b = tiles.find((t) => t.pairId === a.pairId && t.side === "a")!;
  const c = tiles.find((t) => t.pairId !== a.pairId && t.side === "a")!;
  check(isMatch(a, b) && isMatch(b, a) && !isMatch(a, c) && !isMatch(a, a), "a term matches its own answer and nothing else");
  const small = matchRound(deck.slice(0, 2), 6, rand);
  check(small.tiles.length === 4, "a small deck plays with what it has");
}

console.log("\nQuick-fire");
{
  const pool = pairsOf(deck);
  const q = pool[0];
  const ch = choicesFor(q, pool, rand);
  check(ch.length === 4 && ch.includes(q.a) && new Set(ch.map((x) => x.toLowerCase())).size === 4, "four different answers, the right one among them", ch.join(" | ").slice(0, 80));
  check(choicesFor(pool[0], pool.slice(0, 2), rand).length === 2, "a deck of two gives two");
  check(comboOf(0) === 1 && comboOf(2) === 1 && comboOf(3) === 2 && comboOf(6) === 3 && comboOf(40) === 4, "the combo grows every three in a row, to four");
  check(blitzPoints(0) === 10 && blitzPoints(9) === 40, "and multiplies the points");
}

console.log("\nGravity");
{
  check(fallMs(0) === 12_000, "the first question takes twelve seconds to fall");
  check(fallMs(5) < fallMs(4) && fallMs(100) === 5_000, "each cleared one falls a little faster, never under five seconds");
  check(gravityPoints(0) === 10 && gravityPoints(8) === 20, "points rise with the speed");
}

console.log("\nPoints and levels");
{
  check(reviewXp("again") === 2 && reviewXp("hard") === 6 && reviewXp("good") === 10 && reviewXp("easy") === 10, "a review pays for effort, a miss not nothing");
  check(gameXp("match", { score: 12_000, pairs: 6, ms: 12_000 }) === 60 + 24, "Match pays per pair, with a bonus for speed");
  check(gameXp("match", { score: 90_000, pairs: 6, ms: 90_000 }) === 60, "and never less than the pairs");
  check(gameXp("blitz", { score: 200 }) === 160, "the others pay most of their score");
  check(levelOf(0).level === 1 && levelOf(99).level === 1 && levelOf(100).level === 2 && levelOf(299).level === 2 && levelOf(300).level === 3 && levelOf(600).level === 4, "levels at 100, 300, 600");
  const l = levelOf(340);
  check(l.level === 3 && l.into === 40 && l.need === 300 && l.next === 600, "and how far into the next", JSON.stringify(l));
  check(totalXp([{ day: "a", answered: 1, right: 1, xp: 30 }, { day: "b", answered: 2, right: 0 }, { day: "c", answered: 0, right: 0, xp: 12 }]) === 42, "points add up across days, old days without any count as none");
}

console.log("\nBest scores");
{
  check(GAMES.length === 3 && GAMES.map((g) => g.name).join() === "Match,Quick-fire,Gravity", "three games");
  check(isBest("match", 9_000, undefined) && isBest("match", 9_000, 10_000) && !isBest("match", 11_000, 10_000), "Match: a faster time is better");
  check(isBest("blitz", 120, 100) && !isBest("gravity", 80, 100), "the rest: more points is better");
  check(clock(12_345) === "12.3s", "a clock in tenths");
}

console.log("\nQuick-fire's wrong answers are plausible");
{
  const pool = [
    { id: "a", q: "Year the war ended", a: "1945" },
    { id: "b", q: "x", a: "1918" },
    { id: "c", q: "x", a: "1066" },
    { id: "d", q: "x", a: "2001" },
    { id: "e", q: "x", a: "A biological catalyst that speeds up reactions" },
    { id: "f", q: "x", a: "The powerhouse of the cell, where respiration happens" },
    { id: "g", q: "x", a: "Water moving across a partially permeable membrane" },
  ];
  let all = true;
  for (let i = 0; i < 20; i++) {
    const ch = choicesFor(pool[0], pool, rand);
    if (!ch.every((c) => /^\d+$/.test(c))) all = false;
  }
  check(all, "a year is asked against years, not against sentences");
  const long = choicesFor(pool[4], pool, rand);
  check(long.filter((c) => c.length > 20).length === 3, "a sentence against sentences where the deck has them", long.join(" | ").slice(0, 90));
}

console.log("\nGravity's hint");
{
  check(hintFor("Plasmolysis") === "Starts with “P” · 11 letters", "one word: its first letter and its length", hintFor("Plasmolysis"));
  check(hintFor("  active transport ") === "Starts with “A” · 2 words", "several: the first letter and how many words");
  check(gravityPoints(0, true) === 5 && gravityPoints(8, true) === 10, "and taking it halves the points");
}

console.log("\nThe daily goal");
{
  const DAY = 86_400_000;
  const d = (ago: number, xp: number) => ({ day: dayKey(now - ago * DAY), answered: 1, right: 1, xp });
  check(GOALS.map((g) => g.xp).join() === "20,50,100,200", "four goals, a few minutes to an evening");
  check(xpOn([d(0, 35), d(1, 80)], dayKey(now)) === 35 && xpOn([], dayKey(now)) === 0, "points today");
  check(goalStreak([d(0, 60), d(1, 50), d(2, 70), d(3, 10)], 50, now) === 3, "days in a row the goal was met");
  check(goalStreak([d(1, 60), d(2, 90)], 50, now) === 2, "today not met yet does not break it");
  check(goalStreak([d(0, 49)], 50, now) === 0, "a point short is not met");
}

console.log("\nAcross the clocks changing");
{
  /* 30 March 2025, 03:00 in London is 02:00+1: a day of 23 hours. Midnight-ish after it, a 24-hour step lands two days back. */
  process.env.TZ = process.env.TZ || "";
  const days = ["2025-03-28", "2025-03-29", "2025-03-30", "2025-03-31"].map((day) => ({ day, answered: 3, right: 3, xp: 60 }));
  const t = new Date(2025, 2, 31, 0, 30).getTime();
  check(streakOf(days, t) === 4 && goalStreak(days, 50, t) === 4, "a streak counts calendar days, whatever the length of the day", `${streakOf(days, t)} / ${goalStreak(days, 50, t)}`);
}

console.log("\nA game keeps the streak");
{
  check(streakOf([{ day: dayKey(now), answered: 6, right: 5, xp: 40 }], now) === 1, "a day with a game on it is a day studied");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
