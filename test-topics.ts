/* Topics, leeches, calibration and the mistake queue.
 *
 * All of this is arithmetic over rows, which is exactly the kind of thing
 * that looks right in a screenshot and is wrong in the third case nobody
 * tried. The readings here decide what a person is told to spend an evening
 * on, so being wrong is not cosmetic.
 *
 *   npx jiti test-topics.ts */
import {
  DAY, LEECH_AT, isLeech, makeReverse, newCard, topicStats, weakestTopic,
  calibration, calibrationLine, mistakeQueue, schedule, retrievability,
  type Attempt, type Card,
} from "./lib/study";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const NOW = 1_800_000_000_000;
const card = (over: Partial<Card> = {}): Card => ({
  ...newCard({ id: over.id ?? "c" + Math.random().toString(36).slice(2), deckId: "d1", front: "f", back: "b", now: NOW }),
  ...over,
});
/** A graduated card, held at roughly `r` right now. */
const held = (topic: string, stability: number, ageDays: number, over: Partial<Card> = {}) =>
  card({ topic, state: "review", stability, difficulty: 5, interval: 10, due: NOW + (10 - ageDays) * DAY, ...over });
const att = (over: Partial<Attempt> = {}): Attempt => ({
  id: "a" + Math.random().toString(36).slice(2), at: NOW, question: "q", given: "g", expected: "e", right: true, ...over,
});

console.log("\nA topic is read across every deck it is in");
{
  /* Ten days on from a two-day stability is 0.76 — genuinely shaky. Six
     days is 0.81, which is *above* the line, and picking that by eye is how
     this test would have asserted the opposite of what it meant. */
  const cards = [
    held("osmosis", 2, 10, { deckId: "d1" }),
    held("osmosis", 2, 10, { deckId: "d2" }),
    held("respiration", 400, 1, { deckId: "d1" }),
  ];
  const stats = topicStats(cards, [], NOW);
  check(stats.length === 2, "one row per topic, not per deck", stats.map((s) => s.topic).join(", "));
  const osm = stats.find((s) => s.topic === "osmosis")!;
  check(osm.reviewed === 2, "and it counts the cards from both decks", String(osm.reviewed));
  check(stats[0].topic === "osmosis", "the shakiest is first",
    stats.map((s) => `${s.topic} ${s.mean.toFixed(2)}`).join(" · "));
  check(osm.mean < 0.8 && osm.shaky === 2, "a memory ten days past a two-day stability is counted shaky",
    `mean ${osm.mean.toFixed(2)}, ${osm.shaky} shaky`);

  /* A card with no topic is not a topic called "undefined". */
  const untagged = topicStats([...cards, held("", 2, 6), card()], [], NOW);
  check(untagged.length === 2, "and a card with no topic makes no row", String(untagged.length));
}

console.log("\nAnd the line it is all measured against is where it says it is");
{
  /* The definition of stability: the gap at which recall is nine in ten.
     Everything above reads `retrievability` and compares it to 0.8, so a
     wrong decay constant would not fail loudly — it would quietly move what
     "shaky" means, and every suggestion the room makes with it. */
  for (const s of [1, 4, 30, 365]) {
    check(Math.abs(retrievability(s, s) - 0.9) < 1e-9,
      `a card ${s} days past a ${s}-day stability sits at nine in ten`, retrievability(s, s).toFixed(6));
  }
  check(retrievability(0, 5) === 1, "and one seen just now is certain");
  check(retrievability(500, 1) < 0.5, "while one long past its stability is a coin toss at best",
    retrievability(500, 1).toFixed(3));
}

console.log("\nThe log is the second signal, and it counts on its own");
{
  /* A topic answered from buttons has no stability reading worth having,
     and is still something the log knows about. */
  const attempts = [
    att({ topic: "meiosis", right: false }),
    att({ topic: "meiosis", right: false }),
    att({ topic: "meiosis", right: true }),
  ];
  const [row] = topicStats([], attempts, NOW);
  check(row.topic === "meiosis" && row.tried === 3 && row.wrong === 2,
    "a topic with no cards still gets a row from the answers", `${row.wrong} of ${row.tried} wrong`);
  check(row.mean === 1 && row.reviewed === 0,
    "and its mean is not a division by nothing", String(row.mean));
}

console.log("\nThe weakest topic is named only when it is worth naming");
{
  const strong = [held("photosynthesis", 400, 1), held("photosynthesis", 400, 1),
                  held("photosynthesis", 400, 1), held("photosynthesis", 400, 1)];
  check(weakestTopic(strong, [], NOW) === null,
    "a topic held at ninety-odd per cent is not a suggestion, it is noise");
  const thin = [held("enzymes", 1, 9)];
  check(weakestTopic(thin, [], NOW) === null,
    "and one card is not enough to judge a topic on");
  const weak = [held("enzymes", 1, 9), held("enzymes", 1, 9), held("enzymes", 1, 9), held("enzymes", 1, 9)];
  const w = weakestTopic(weak, [], NOW);
  check(w?.topic === "enzymes", "but four shaky cards is", w?.topic ?? "none");
}

console.log("\nA card forgotten eight times is the card's fault");
{
  check(!isLeech(card({ lapses: LEECH_AT - 1 })), "seven is still the person's problem");
  check(isLeech(card({ lapses: LEECH_AT })), "eight is the card's");
  /* And the number is the one the tools that have watched this use. */
  check(LEECH_AT === 8, "which is eight", String(LEECH_AT));
}

console.log("\nThe two-by-two, and the quadrant that costs marks");
{
  const c = calibration([
    att({ sure: true, right: true }), att({ sure: true, right: false }),
    att({ sure: false, right: true }), att({ sure: false, right: false }),
    att({ right: true }),
  ]);
  check(c.n === 4, "an answer with no confidence on it is not in the table", String(c.n));
  check(c.sureRight === 1 && c.sureWrong === 1 && c.unsureRight === 1 && c.unsureWrong === 1,
    "and the four cells are the four cells");
  check(calibrationLine(c) === null, "nothing is said until there is enough to say it on");

  const over = calibration(Array.from({ length: 12 }, (_, i) => att({ sure: true, right: i % 3 !== 0 })));
  check(/costs marks/.test(calibrationLine(over) ?? ""), "sure-and-wrong a quarter of the time is called out",
    calibrationLine(over)?.slice(0, 60));
  const under = calibration(Array.from({ length: 12 }, (_, i) => att({ sure: false, right: i % 5 !== 0 })));
  check(/credit/.test(calibrationLine(under) ?? ""), "and so is knowing more than you think",
    calibrationLine(under)?.slice(0, 60));
}

console.log("\nThe mistake queue is ordered by what is not going in");
{
  const a = card({ id: "a" }), b = card({ id: "b" }), c = card({ id: "c" });
  const log = [
    att({ cardId: "a", right: false }), att({ cardId: "a", right: false }), att({ cardId: "a", right: false }),
    att({ cardId: "b", right: false }),
    att({ cardId: "c", right: true }),
    /* Got wrong, but months ago and not since: that is a mistake you have
       stopped making, and it does not belong at the top of a practice list. */
    att({ cardId: "c", right: false, at: NOW - 90 * DAY }),
  ];
  const q = mistakeQueue(log, [a, b, c], NOW);
  check(q.map((x) => x.id).join(",") === "a,b", "worst first, and only what is actually being missed",
    q.map((x) => x.id).join(",") || "empty");
  check(mistakeQueue([], [a, b, c], NOW).length === 0, "an empty log is an empty queue, not every card");
}

console.log("\nA reverse is a real second card");
{
  const front = card({ id: "f1", front: "mitochondrion", back: "the powerhouse of the cell", topic: "organelles" });
  const back = makeReverse(front, "r1", NOW)!;
  check(back.front === front.back && back.back === front.front, "the two columns swap");
  check(back.reverseOf === "f1", "and it knows which card it is the other way round of");
  check(back.topic === "organelles", "and carries the topic across, because it is the same fact");
  check(back.state === "new" && back.id !== front.id,
    "with its own schedule, because the two directions are learned at different rates");
  /* And the reverse must not inherit the original's progress. */
  const learned = schedule(front, "easy", NOW);
  check(makeReverse(learned, "r2", NOW)!.reps === 0, "a reverse of a known card still starts at nothing");
  check(makeReverse(card({ front: "The capital of {{France}} is Paris", back: "France" }), "r3", NOW) === null,
    "and a cloze has no other direction, so it is refused");
  check(makeReverse(card({ front: "x", back: "  " }), "r4", NOW) === null, "nor has a card with an empty side");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
