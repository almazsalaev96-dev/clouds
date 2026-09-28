/**
 * Readiness: the expected share right if tested on everything now, and the
 * accuracy trend beside it.
 *
 *   npx tsx test-readiness.ts
 */
import { readiness, accuracyTrend, type Card, type Attempt } from "./lib/study";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 28);
const card = (over: Partial<Card>): Card => ({ id: Math.random().toString(36), deckId: "d", front: "q", back: "a", createdAt: now - 30 * DAY, updatedAt: now, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, state: "new", ...over } as Card);

console.log("\nReadiness");
{
  check(readiness([], now).score === null && readiness([], now).band === null, "no cards, no score");
  const allNew = readiness([card({}), card({})], now);
  check(allNew.score === 0 && allNew.fresh === 2 && allNew.band === "Starting", "never studied counts as marks not got", JSON.stringify(allNew));
  const fresh = card({ state: "review", reps: 3, interval: 10, due: now + 9 * DAY, stability: 10 });
  const r1 = readiness([fresh], now);
  check((r1.score ?? 0) > 0.95 && r1.known === 1 && r1.band === "Exam-ready", "a card reviewed yesterday with a ten-day memory is known", String(r1.score?.toFixed(3)));
  const old = card({ state: "review", reps: 3, interval: 10, due: now - 20 * DAY, stability: 10 });
  const r2 = readiness([old], now);
  check((r2.score ?? 1) < 0.85 && r2.shaky === 1, "one thirty days since review is shaky", String(r2.score?.toFixed(3)));
  const learning = card({ state: "learning", reps: 1 });
  check(readiness([learning], now).score === 0.5 && readiness([learning], now).shaky === 1, "a card still being learned counts half");
  const mixed = readiness([fresh, old, card({}), learning], now);
  check(mixed.total === 4 && mixed.known + mixed.shaky + mixed.fresh === 4, "every card is known, shaky or not started", JSON.stringify({ k: mixed.known, s: mixed.shaky, f: mixed.fresh }));
  check(mixed.band === "Building" || mixed.band === "Starting" || mixed.band === "Nearly there", "and the band follows the score", `${mixed.band} at ${Math.round((mixed.score ?? 0) * 100)}%`);
}

console.log("\nAccuracy trend");
{
  const at = (daysAgo: number, right: boolean): Attempt => ({ id: String(Math.random()), at: now - daysAgo * DAY, question: "q", given: "", expected: "", right } as Attempt);
  const log = [at(1, true), at(2, true), at(3, false), at(4, true), at(16, false), at(17, false), at(18, true), at(19, false), at(20, false)];
  const t = accuracyTrend(log, now);
  check(t.tried === 4 && t.rate === 0.75, "the last fourteen days: three of four", JSON.stringify(t));
  check(t.prev === 0.2, "the fourteen before: one of five", String(t.prev));
  check(accuracyTrend([at(1, true)], now).prev === null, "no trend without five answers before");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
