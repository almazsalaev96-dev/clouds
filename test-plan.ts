/* Where the trouble is, from the cards themselves.   npx jiti test-plan.ts */
import { deckHealth, weakestDeck } from "./lib/plan";
import { DAY, type Card } from "./lib/study";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const now = Date.parse("2026-09-16T10:00:00Z");
let n = 0;
const card = (deckId: string, stability: number, daysAgo: number, interval = 10, state: Card["state"] = "review"): Card =>
  ({ id: `c${n++}`, deckId, front: "q", back: "a", state, due: now - daysAgo * DAY + interval * DAY, interval, ease: 2.5, reps: 3, lapses: 0, step: 0, createdAt: now - 30 * DAY, stability } as Card);

console.log("\nA deck's health is the chance of recalling its cards now");
{
  const solid = Array.from({ length: 6 }, () => card("solid", 60, 2));
  const shaky = Array.from({ length: 6 }, () => card("shaky", 1, 20));
  const h = deckHealth([...solid, ...shaky], now);
  check(h[0].deckId === "shaky" && h[0].mean < 0.7, "the deck whose cards were learnt thinly and left long comes first", `${h[0].deckId} ${h[0].mean.toFixed(2)}`);
  check(h[1].deckId === "solid" && h[1].mean > 0.9, "and a well-held deck reads as well held", `${h[1].mean.toFixed(2)}`);
  check(h[0].shaky === 6 && h[1].shaky === 0, "with a count of the cards below the line", `${h[0].shaky} / ${h[1].shaky}`);
}

console.log("\nWhat is worth suggesting");
{
  const fresh = Array.from({ length: 6 }, () => card("fresh", 0, 0, 0, "new"));
  check(weakestDeck(fresh, now) === null, "nothing for a deck that has never been answered");
  const few = Array.from({ length: 3 }, () => card("few", 1, 20));
  check(weakestDeck(few, now) === null, "nothing for a deck with too few graduated cards to judge");
  const fine = Array.from({ length: 8 }, () => card("fine", 80, 1));
  check(weakestDeck(fine, now) === null, "nothing when the weakest deck is still held well");
  const weak = [...fine, ...Array.from({ length: 5 }, () => card("weak", 1, 20))];
  check(weakestDeck(weak, now)?.deckId === "weak", "and the shaky deck when there is one");
}

console.log("\nThe month, from the log");
{
  const { dayKey } = await import("./lib/study");
  const { recallRate, weeksOf } = await import("./lib/plan");
  const log = [
    { day: dayKey(now), answered: 10, right: 9 },
    { day: dayKey(now - 5 * DAY), answered: 20, right: 15 },
    { day: dayKey(now - 40 * DAY), answered: 50, right: 10 },
  ];
  const r = recallRate(log, now);
  check(r.answered === 30 && r.right === 24 && Math.abs((r.rate ?? 0) - 0.8) < 1e-9, "answers inside the window are counted and the old day is not", `${r.right}/${r.answered}`);
  check(recallRate([], now).rate === null, "and no rate is claimed from nothing");
  const old = recallRate([...log, { day: dayKey(now - DAY), answered: 93 } as never], now);
  check(old.answered === 30 && Math.abs((old.rate ?? 0) - 0.8) < 1e-9,
    "a day logged before right answers were kept is left out — not read as all wrong", `${old.right}/${old.answered}`);
  check(recallRate([{ day: dayKey(now), answered: 93 } as never], now).rate === null, "and a month of such days claims no rate at all");
  const grid = weeksOf(log, now);
  check(grid.length === 84 && grid[83].day === dayKey(now) && grid[83].answered === 10 && grid[78].answered === 20, "twelve weeks end today, one cell a day", `${grid.length} cells`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
