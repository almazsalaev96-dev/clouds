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
import {
  newCard, schedule, dueNow, progressOf, whenDue, previewGaps, answeredToday, DAY, MINUTE, MIN_EASE,
  retrievability, intervalFor, adopt, DESIRED_RETENTION, W,
  isCloze, clozeQuestion, clozeAnswer, clozeHidden, makeCloze, NEW_PER_DAY, cramOrder, streakOf, dayKey,
  parseCards, exportCards, interleave, topicKey, dailyLoad, clampRetention, type Card,
} from "./lib/study";

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
  check(second.state === "review" && second.interval >= 1 && second.interval <= 4 && second.stability != null,
    "and the step after that graduates it to a few days, with a memory written down", `${second.interval}d`);
  const straight = schedule(card(), "easy", T0);
  check(straight.state === "review" && days(straight) > second.interval, "a card you already knew skips the steps and goes further", `${days(straight)}d`);
  const missed = schedule(card(), "again", T0);
  check(missed.state === "learning" && mins(missed) === 1, "and one you did not know comes back in a minute");
}

console.log("\nThe memory model underneath");
{
  /* FSRS's two promises, as properties rather than as numbers: the exact
     figures belong to the weights and the weights belong to the fit. */
  check(Math.abs(retrievability(10, 10) - 0.9) < 1e-9, "a card is 90% likely to be known when its stability has elapsed", retrievability(10, 10).toFixed(4));
  /* Flat on purpose: FSRS-6's curve has a fitted shape, and at ten times the
     stability recall is still about two in three. The claim is that it only
     ever goes down, not how fast. */
  check(retrievability(0, 10) === 1 && retrievability(100, 10) < retrievability(10, 10) && retrievability(1000, 10) < retrievability(100, 10),
    "certain the moment it was seen, and only ever fading after", retrievability(100, 10).toFixed(2));
  check(intervalFor(10) === 10 && intervalFor(30) === 30, "the gap at the desired retention is the stability itself", `${intervalFor(10)}d, ${intervalFor(30)}d`);
  check(intervalFor(10, 0.8) > 10 && intervalFor(10, 0.97) < 10, "asking for less certainty waits longer, and more waits less");
  check(W.length === 21 && DESIRED_RETENTION === 0.9, "twenty-one weights, and nine in ten");
}

console.log("\nThen the gaps grow, by how it is going");
{
  /* A card the schedule has known for ten days, asked on the day it was due. */
  const known = card({ state: "review", interval: 10, stability: 10, difficulty: 5, reps: 5, lastAnswered: T0 - 10 * DAY });
  const good = schedule(known, "good", T0);
  const hard = schedule(known, "hard", T0);
  const easy = schedule(known, "easy", T0);
  check(days(good) > 10 && days(good) < 60, "a good answer grows the gap, within reason", `10d → ${days(good)}d`);
  check(days(hard) > 10 && days(hard) < days(good), "hard grows it less", `→ ${days(hard)}d`);
  check(days(easy) > days(good), "and easy grows it more", `→ ${days(easy)}d`);
  check(good.stability! > known.stability! && good.due === T0 + good.interval * DAY, "the memory got stronger, and the due date is the interval");
  check(hard.difficulty! > known.difficulty! && easy.difficulty! < known.difficulty!, "hard makes the card harder from now on, easy easier");
  /* Being early or late matters: the same answer on a card you nearly
     forgot says more than one on a card you had just seen. */
  const late = schedule({ ...known, lastAnswered: T0 - 40 * DAY }, "good", T0);
  const early = schedule({ ...known, lastAnswered: T0 - 2 * DAY }, "good", T0);
  check(late.stability! > good.stability! && good.stability! > early.stability!,
    "a good answer after a long gap is worth more than one after a short one", `${early.stability!.toFixed(1)} < ${good.stability!.toFixed(1)} < ${late.stability!.toFixed(1)}`);
  const sameDay = schedule({ ...known, lastAnswered: T0 - MINUTE * 30 }, "good", T0);
  check(sameDay.stability! < good.stability! && sameDay.stability! >= known.stability!,
    "and a second look the same day teaches little — but a right answer never makes the memory weaker", `${known.stability} → ${sameDay.stability!.toFixed(1)}`);
  const sameDayAgain = schedule({ ...known, lastAnswered: T0 - MINUTE * 30 }, "again", T0);
  check(sameDayAgain.stability! < known.stability!, "while a wrong one the same day still does");
}

console.log("\nForgetting something you knew");
{
  const known = card({ state: "review", interval: 30, stability: 30, difficulty: 5, reps: 9, lapses: 0, lastAnswered: T0 - 30 * DAY });
  const lapsed = schedule(known, "again", T0);
  check(lapsed.state === "learning" && mins(lapsed) === 1, "it comes back in a minute, from the start");
  check(lapsed.lapses === 1, "the lapse is counted");
  check(lapsed.stability! < known.stability! && lapsed.difficulty! > known.difficulty!,
    "and the memory is written down as weaker, the card as harder", `S ${known.stability} → ${lapsed.stability!.toFixed(1)}`);
  /* What must not happen: a card you have forgotten once being treated as
     one you have never seen. That is how a deck fills with things you know. */
  check(lapsed.reps === 10, "but it is not a new card — everything it has been through is kept");
  const back = schedule(schedule(lapsed, "good", T0 + MINUTE), "good", T0 + 11 * MINUTE);
  check(back.state === "review" && back.interval >= 1 && back.stability === lapsed.stability, "and when it graduates again it starts from what is known, not from a blank",
    `${back.interval}d`);
  let punished = card({ state: "review", interval: 5, stability: 5, difficulty: 9.5, lastAnswered: T0 - 5 * DAY });
  for (let i = 0; i < 5; i++) punished = schedule(punished, "again", T0);
  check(punished.difficulty! <= 10 && punished.stability! > 0, "and however badly it goes, difficulty and stability stay on the scale", `D ${punished.difficulty!.toFixed(2)}`);
}

console.log("\nA card the old rule scheduled");
{
  /* Everything in people's browsers was scheduled by SM-2, which knew an
     interval and an ease. FSRS reads those once and carries on. */
  const old = card({ state: "review", interval: 30, ease: 2.5, reps: 9, lastAnswered: T0 - 30 * DAY });
  const seen = adopt(old);
  check(seen.stability === 30 && seen.difficulty === 5, "a month's gap is a month's memory, and the default ease is the middle of the scale", `S ${seen.stability} D ${seen.difficulty}`);
  check(adopt(card({ state: "review", interval: 5, ease: 1.3 })).difficulty === 10, "and the punishing floor is the top of it");
  const next = schedule(old, "good", T0);
  check(next.stability! > 30 && next.difficulty != null, "and it is scheduled on from there, with FSRS's numbers written down");
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

console.log("\nA day's work");
{
  const answered = schedule(card(), "good", T0);
  check(answered.lastAnswered === T0, "every answer is stamped");
  /* Not a rolling twenty-four hours: somebody who studies at nine at night
     and again at nine the next morning has had two days, and a window
     would tell them they had had one. */
  const midnight = new Date(T0); midnight.setHours(0, 0, 0, 0);
  const lateLastNight = midnight.getTime() - 2 * 60 * 60 * 1000;
  check(answeredToday([
    card({ lastAnswered: T0 - 60_000 }),
    card({ lastAnswered: lateLastNight }),
    card({}),
  ], T0) === 1, "and today means since midnight, not in the last day");
}

console.log("\nA sentence with a hole in it");
{
  const front = "The capital of {{France}} is Paris";
  check(isCloze(front) && !isCloze("What is the capital of France?"), "a front with braces is a cloze, and one without is not");
  check(clozeQuestion(front) === "The capital of […] is Paris", "asked with the hole shown", clozeQuestion(front));
  check(clozeAnswer(front) === "The capital of **France** is Paris", "answered with the word back and marked", clozeAnswer(front));
  check(clozeHidden("{{a}} and {{b}}") === "a · b", "and what was hidden can be listed");
  check(isCloze("The {{c1::mitochondria}} makes ATP") && clozeQuestion("The {{c1::mitochondria}} makes ATP") === "The […] makes ATP",
    "the numbered form other tools export reads the same");
  const made = makeCloze("Water boils at 100 degrees at sea level", "100 degrees");
  check(made?.front === "Water boils at {{100 degrees}} at sea level" && made.back === "100 degrees",
    "a sentence and a term make a card", made?.front);
  check(makeCloze("Water boils", "steam") === null, "and a term that is not in the sentence makes nothing");
  const cased = makeCloze("Paris is the capital", "paris");
  check(cased?.back === "Paris", "matched without regard to case, but kept as written", cased?.back);
}

console.log("\nNot two hundred new cards on the first day");
{
  const many = Array.from({ length: 50 }, (_, i) => card({ id: `n${i}`, createdAt: T0 - i }));
  check(dueNow(many, T0).length === NEW_PER_DAY, `a fresh deck of fifty offers ${NEW_PER_DAY} today, not fifty`, String(dueNow(many, T0).length));
  /* Reviews are debts and are never capped; only the borrowing is. */
  const owed = Array.from({ length: 30 }, (_, i) => card({ id: `r${i}`, state: "review", due: T0 - DAY, interval: 3 }));
  check(dueNow([...owed, ...many], T0).length === 30 + NEW_PER_DAY, "thirty overdue reviews all come, and the new ones after them");
  /* And the cap is the day's, not the session's. */
  const met = many.slice(0, NEW_PER_DAY).map((c) => schedule(c, "good", T0));
  const rest = many.slice(NEW_PER_DAY);
  const later = dueNow([...met, ...rest], T0 + 30 * MINUTE);
  check(later.every((c) => c.state !== "new"), "twenty started this morning means no new ones this afternoon",
    `${later.filter((c) => c.state === "new").length} new offered`);
  check(dueNow([...met, ...rest], T0 + DAY).filter((c) => c.state === "new").length === NEW_PER_DAY,
    "and tomorrow the next twenty");
  check(schedule(card(), "again", T0).introducedAt === T0 && schedule(schedule(card(), "good", T0), "again", T0 + DAY).introducedAt === T0,
    "a card is introduced once, and forgetting it does not make it new again");
}

console.log("\nThe night before");
{
  const a = card({ id: "a", lapses: 0, ease: 2.5, createdAt: T0 });
  const b = card({ id: "b", lapses: 3, ease: 2.1, createdAt: T0 + 1 });
  const c = card({ id: "c", lapses: 0, ease: 1.7, createdAt: T0 + 2, state: "review", due: T0 + 30 * DAY });
  const order = cramOrder([a, b, c]).map((x) => x.id);
  check(order.join("") === "bca", "everything is asked, the ones you have forgotten most first", order.join(" → "));
  check(cramOrder([c]).length === 1 && c.due > T0, "including a card not due for a month");
}

console.log("\nDays in a row");
{
  const d = (n: number) => dayKey(T0 - n * DAY);
  const days = [d(0), d(1), d(2)].map((day) => ({ day, answered: 5, right: 3 }));
  check(streakOf(days, T0) === 3, "three days ending today is three", String(streakOf(days, T0)));
  check(streakOf(days.slice(1), T0) === 2, "and a streak that ends yesterday still stands this morning");
  check(streakOf(days.slice(2), T0) === 0, "but one that ended the day before is over");
  check(streakOf([{ day: d(0), answered: 0, right: 0 }], T0) === 0, "a day with nothing answered is not a day studied");
}

console.log("\nCards from text, and back");
{
  const got = parseCards([
    "What is a debounce :: Waiting for silence",
    "throttle\ta floor between calls",
    "# a comment",
    "",
    "The {{mitochondria}} is the powerhouse",
    "just a line with nothing to split on",
    '"Who wrote Hamlet","Shakespeare"',
  ].join("\n"));
  check(got.cards.length === 4 && got.skipped === 1, "four shapes read, one line skipped and counted", `${got.cards.length} cards, ${got.skipped} skipped`);
  check(got.cards[0].front === "What is a debounce" && got.cards[0].back === "Waiting for silence", "double colon");
  check(got.cards[1].front === "throttle", "tab");
  check(isCloze(got.cards[2].front) && got.cards[2].back === "mitochondria", "a cloze line, with its answer taken from the hole");
  check(got.cards[3].front === "Who wrote Hamlet" && got.cards[3].back === "Shakespeare", "and a CSV line with quotes");
  const out = exportCards(got.cards);
  check(parseCards(out).cards.length === 4, "and what is written out reads back in whole");
}

console.log("\nMixed, not blocked");
{
  const rev = (id: string, topic: string, due: number) => card({ id, topic, state: "review", due, stability: 5, interval: 5 });
  const blocked = [rev("a1", "osmosis", 1), rev("a2", "osmosis", 2), rev("a3", "osmosis", 3), rev("b1", "enzymes", 4), rev("b2", "enzymes", 5), rev("b3", "enzymes", 6)];
  const order = dueNow(blocked, T0).map((c) => c.id).join(" ");
  check(order === "a1 b1 a2 b2 a3 b3", "cards on two topics that fell due in two blocks come mixed", order);
  const again = dueNow(blocked, T0, { after: "osmosis" })[0].id;
  check(again === "b1", "and the card after an osmosis answer is not osmosis, though osmosis is older", again);
  const one = interleave([rev("x1", "t", 1), rev("x2", "t", 2)]).map((c) => c.id).join(" ");
  check(one === "x1 x2", "one topic left comes in its own order", one);
  const far = interleave([...Array.from({ length: 12 }, (_, i) => rev(`o${i}`, "o", i)), rev("z", "z", 99)]);
  check(far[1].id === "o1", "the most overdue stay near the front — the mix looks a few cards ahead, not the whole pile", far.slice(0, 3).map((c) => c.id).join(" "));
  const withNew = dueNow([card({ id: "n1", topic: "a", due: 0 }), rev("r1", "a", 1), rev("r2", "b", 2)], T0).map((c) => c.id).join(" ");
  check(withNew.endsWith("n1"), "new cards still come after what is due", withNew);
  check(topicKey(card({ topic: " Osmosis " })) === "osmosis" && topicKey(card({})) === "deck:d1", "no topic is the deck's", topicKey(card({})));
}

console.log("\nHow much to remember, and what it costs");
{
  const known = Array.from({ length: 40 }, (_, i) => card({ id: `k${i}`, state: "review", stability: 10, interval: 10, due: T0 }));
  const at80 = dailyLoad(known, 0.8), at90 = dailyLoad(known, 0.9), at95 = dailyLoad(known, 0.95);
  check(at80 < at90 && at90 < at95, "aiming higher asks more reviews a day", `${at80.toFixed(1)} < ${at90.toFixed(1)} < ${at95.toFixed(1)}`);
  check(Math.abs(at90 - 40 / intervalFor(10)) < 1e-9, "each known card costs one over its gap", at90.toFixed(2));
  check(dailyLoad([card({})], 0.9) === 0, "a new card is not a review yet");
  const c = card({ state: "review", stability: 10, interval: 10, due: T0, lastAnswered: T0 - 10 * DAY });
  const g90 = schedule(c, "good", T0).interval, g80 = schedule(c, "good", T0, 0.8).interval, g95 = schedule(c, "good", T0, 0.95).interval;
  check(g80 > g90 && g90 > g95, "the aim moves the next gap: lower aims wait longer", `${g80} > ${g90} > ${g95} days`);
  check(schedule(c, "good", T0, DESIRED_RETENTION).interval === g90, "and ninety is the same as not choosing");
  check(clampRetention("x") === DESIRED_RETENTION && clampRetention(0.2) === 0.7 && clampRetention(1) === 0.97, "a stored aim out of range is pulled back in");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
