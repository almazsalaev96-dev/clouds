/* When a card comes back.
 *
 * Every assistant will write you flashcards. None of them will remember
 * next Tuesday that you got the third one wrong twice — the cards scroll
 * out of the conversation and that is the end of them. This is the part
 * that makes a deck worth having, and it is arithmetic rather than
 * language: two learning steps, an ease that moves with how it goes, and a
 * lapse that starts a card over without forgetting how hard it was.
 *
 *   npx jiti test-study.ts */
import { newCard, schedule, dueNow, progressOf, whenDue, previewGaps, DAY, MINUTE, MIN_EASE, type Card } from "./lib/study";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const T0 = 1_700_000_000_000;
const card = (over: Partial<Card> = {}): Card => ({ ...newCard({ id: "c1", deckId: "d1", front: "f", back: "b", now: T0 }), ...over });
const days = (c: Card, from = T0) => Math.round((c.due - from) / DAY);
const mins = (c: Card, from = T0) => Math.round((c.due - from) / MINUTE);

console.log("\nA new card walks before it runs");
{
  const first = schedule(card(), "good", T0);
  check(first.state === "learning" && mins(first) === 10, "a new card answered well comes back in ten minutes", `${mins(first)}m`);
  const second = schedule(first, "good", T0 + 10 * MINUTE);
  check(second.state === "review" && second.interval === 1, "and the step after that graduates it to a day", `${second.interval}d`);
  const straight = schedule(card(), "easy", T0);
  check(straight.state === "review" && days(straight) === 4, "a card you already knew skips the steps", `${days(straight)}d`);
  const missed = schedule(card(), "again", T0);
  check(missed.state === "learning" && mins(missed) === 1, "and one you did not know comes back in a minute");
}

console.log("\nThen the gaps grow, by how it is going");
{
  const known = card({ state: "review", interval: 10, ease: 2.5, reps: 5 });
  check(days(schedule(known, "good", T0)) === 25, "a good answer multiplies the gap by the ease", `10d → ${days(schedule(known, "good", T0))}d`);
  check(days(schedule(known, "hard", T0)) === 12, "hard barely grows it", `→ ${days(schedule(known, "hard", T0))}d`);
  check(days(schedule(known, "easy", T0)) > days(schedule(known, "good", T0)), "and easy grows it further than good");
  check(schedule(known, "hard", T0).ease < known.ease, "hard makes the card harder from now on");
  check(schedule(known, "easy", T0).ease > known.ease, "easy makes it easier");
  check(schedule(known, "good", T0).ease === known.ease, "and good leaves it where it was");
}

console.log("\nForgetting something you knew");
{
  const known = card({ state: "review", interval: 30, ease: 2.5, reps: 9, lapses: 0 });
  const lapsed = schedule(known, "again", T0);
  check(lapsed.state === "learning" && mins(lapsed) === 1, "it comes back in a minute, from the start");
  check(lapsed.lapses === 1, "the lapse is counted");
  check(lapsed.ease === 2.3, "and the card is treated as harder from now on", String(lapsed.ease));
  /* What must not happen: a card you have forgotten once being treated as
     one you have never seen. That is how a deck fills with things you know. */
  check(lapsed.reps === 10, "but it is not a new card — everything it has been through is kept");
  let punished = card({ state: "review", interval: 5, ease: MIN_EASE });
  for (let i = 0; i < 5; i++) punished = schedule(punished, "again", T0);
  check(punished.ease >= MIN_EASE, "and however badly it goes, the ease has a floor", String(punished.ease));
}

console.log("\nWhat is asked first");
{
  const cards = [
    card({ id: "new", state: "new", due: T0 - 1000 }),
    card({ id: "review", state: "review", due: T0 - 5000, interval: 3 }),
    card({ id: "learning", state: "learning", due: T0 - 2000 }),
    card({ id: "later", state: "review", due: T0 + DAY, interval: 3 }),
  ];
  const order = dueNow(cards, T0).map((c) => c.id);
  check(order.join(",") === "learning,review,new", "what you are mid-way through, then what is overdue, then what is new", order.join(","));
  check(!order.includes("later"), "and nothing that is not due yet");
}

console.log("\nWhat the deck says about itself");
{
  const p = progressOf([
    card({ state: "new", due: T0 }),
    card({ state: "learning", due: T0 + 5 * MINUTE }),
    card({ state: "review", due: T0 + 2 * DAY, interval: 2 }),
  ], T0);
  check(p.total === 3 && p.due === 1 && p.fresh === 1 && p.known === 1, "counted by where each card is", JSON.stringify(p));
  check(p.nextDue === T0 + 5 * MINUTE, "and when the next one is waiting, if none is now");
  const none = progressOf([card({ state: "review", due: T0 + DAY, interval: 1 })], T0);
  check(whenDue(none.nextDue ?? 0, T0) === "in 24 hours", "said in words somebody would use", whenDue(none.nextDue ?? 0, T0));
}

console.log("\nAnd it says what each answer will cost before you give it");
{
  const gaps = previewGaps(card({ state: "review", interval: 10, ease: 2.5 }), T0);
  check(gaps.again === "in 1 minute" && /day/.test(gaps.good), "each button says when the card would come back", JSON.stringify(gaps));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
