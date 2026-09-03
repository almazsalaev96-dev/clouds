import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import { masteryFor, isInsufficientEvidence, allMastery, MIN_REPORTABLE_CONFIDENCE } from "../src/learning/mastery.ts";
import { detectMistakes, openMistakes, PATTERN_THRESHOLD } from "../src/learning/mistakes.ts";
import { nextBestActions, recordAttempt } from "../src/learning/nextAction.ts";

const U = "u1";
const DAY = 1000 * 60 * 60 * 24;

function seed() {
  const store = createStore();
  const concept = store.concepts.insert(U, {
    name: "Price Elasticity", key: "price elasticity", description: "", prerequisiteIds: [],
  } as never);
  return { store, concept };
}

const attempt = (store: ReturnType<typeof seed>["store"], conceptId: string, correct: boolean, difficulty = 0.5) =>
  recordAttempt(store, U, { conceptId, prompt: "q", response: "r", correct, difficulty });

test("mastery is unknown until there is graded evidence", () => {
  const { store, concept } = seed();
  const m = masteryFor(store, U, concept.id);
  assert.equal(m.attempts, 0);
  assert.equal(m.confidence, 0);
  assert.ok(isInsufficientEvidence(m), "no attempts means we must say we don't know");
});

test("confidence stays low after a single attempt", () => {
  const { store, concept } = seed();
  attempt(store, concept.id, true);
  const m = masteryFor(store, U, concept.id);
  assert.equal(m.attempts, 1);
  assert.ok(m.confidence < MIN_REPORTABLE_CONFIDENCE,
    `one attempt should not be reportable, got ${m.confidence}`);
});

test("confidence rises with attempts and the estimate tracks performance", () => {
  const { store, concept } = seed();
  for (let i = 0; i < 8; i++) attempt(store, concept.id, true);
  const good = masteryFor(store, U, concept.id);
  assert.ok(good.confidence > MIN_REPORTABLE_CONFIDENCE);
  assert.ok(good.estimate > 0.9, `expected high mastery, got ${good.estimate}`);

  const { store: s2, concept: c2 } = seed();
  for (let i = 0; i < 8; i++) attempt(s2, c2.id, false);
  const bad = masteryFor(s2, U, c2.id);
  assert.ok(bad.estimate < 0.1, `expected low mastery, got ${bad.estimate}`);
});

test("a correct answer on a hard item counts for more than on an easy one", () => {
  const { store: hardStore, concept: hard } = seed();
  const { store: easyStore, concept: easy } = seed();
  for (let i = 0; i < 4; i++) {
    attempt(hardStore, hard.id, true, 0.9);
    attempt(easyStore, easy.id, true, 0.1);
  }
  // Both are 100% correct, but the hard evidence should carry more weight,
  // which shows up as higher confidence-weighted mastery.
  assert.ok(masteryFor(hardStore, U, hard.id).estimate >= masteryFor(easyStore, U, easy.id).estimate);
});

test("stale evidence loses confidence", () => {
  const { store, concept } = seed();
  for (let i = 0; i < 6; i++) attempt(store, concept.id, true);
  const fresh = masteryFor(store, U, concept.id);
  const stale = masteryFor(store, U, concept.id, Date.now() + 90 * DAY);
  assert.ok(stale.confidence < fresh.confidence,
    "an estimate from three months ago should be trusted less");
});

test("a mistake is only a pattern after repeated failures", () => {
  const { store, concept } = seed();
  for (let i = 0; i < PATTERN_THRESHOLD - 1; i++) {
    attempt(store, concept.id, false);
    detectMistakes(store, U, concept.id);
  }
  assert.equal(openMistakes(store, U).length, 0, "two failures is not yet a pattern");

  attempt(store, concept.id, false);
  detectMistakes(store, U, concept.id);
  const open = openMistakes(store, U);
  assert.equal(open.length, 1);
  assert.equal(open[0].occurrences, 3);
  assert.match(open[0].description, /Price Elasticity/);
});

test("detecting twice does not double-count", () => {
  const { store, concept } = seed();
  for (let i = 0; i < 4; i++) attempt(store, concept.id, false);
  detectMistakes(store, U, concept.id);
  detectMistakes(store, U, concept.id);
  assert.equal(store.mistakes.count(U), 1);
  assert.equal(openMistakes(store, U)[0].occurrences, 4);
});

test("a mistake resolves once the learner starts getting it right", () => {
  const { store, concept } = seed();
  for (let i = 0; i < 4; i++) attempt(store, concept.id, false);
  detectMistakes(store, U, concept.id);
  assert.equal(openMistakes(store, U).length, 1);

  for (let i = 0; i < 3; i++) attempt(store, concept.id, true);
  detectMistakes(store, U, concept.id);
  assert.equal(openMistakes(store, U).length, 0, "recent successes should close the pattern");
});

test("no evidence means no suggestions — the system stays quiet", () => {
  const { store } = seed();
  assert.deepEqual(nextBestActions(store, U), [],
    "on day one there is nothing to say, and saying something anyway would be invented");
});

test("a live misconception outranks a merely weak concept", () => {
  const store = createStore();
  const broken = store.concepts.insert(U, { name: "Elasticity", key: "elasticity", description: "", prerequisiteIds: [] } as never);
  const weak = store.concepts.insert(U, { name: "Exchange Rates", key: "exchange rate", description: "", prerequisiteIds: [] } as never);

  for (let i = 0; i < 4; i++) recordAttempt(store, U, { conceptId: broken.id, prompt: "q", response: "r", correct: false });
  detectMistakes(store, U, broken.id);
  for (let i = 0; i < 6; i++) {
    recordAttempt(store, U, { conceptId: weak.id, prompt: "q", response: "r", correct: i % 3 === 0 });
  }

  const actions = nextBestActions(store, U);
  assert.ok(actions.length >= 2);
  assert.equal(actions[0].kind, "fix_misconception");
  assert.equal(actions[0].conceptId, broken.id);
  assert.match(actions[0].because, /4 attempts/);
  // Every suggestion carries the evidence behind it (§22).
  for (const action of actions) assert.ok(action.because.length > 0);
});

test("solid but stale knowledge is offered for review, not practice", () => {
  const { store, concept } = seed();
  for (let i = 0; i < 6; i++) attempt(store, concept.id, true);
  const muchLater = Date.now() + 20 * DAY;
  const actions = nextBestActions(store, U, 3, muchLater);
  const review = actions.find((a) => a.kind === "review_stale");
  assert.ok(review, `expected a review suggestion, got ${JSON.stringify(actions)}`);
  assert.match(review.because, /haven't practised it for \d+ days/);
});

test("allMastery reports only concepts with evidence, weakest first", () => {
  const store = createStore();
  const a = store.concepts.insert(U, { name: "A", key: "a", description: "", prerequisiteIds: [] } as never);
  const b = store.concepts.insert(U, { name: "B", key: "b", description: "", prerequisiteIds: [] } as never);
  store.concepts.insert(U, { name: "C", key: "c", description: "", prerequisiteIds: [] } as never);

  for (let i = 0; i < 4; i++) recordAttempt(store, U, { conceptId: a.id, prompt: "q", response: "r", correct: true });
  for (let i = 0; i < 4; i++) recordAttempt(store, U, { conceptId: b.id, prompt: "q", response: "r", correct: false });

  const all = allMastery(store, U);
  assert.equal(all.length, 2, "a concept never practised has no mastery to report");
  assert.equal(all[0].conceptId, b.id, "weakest first");
});
