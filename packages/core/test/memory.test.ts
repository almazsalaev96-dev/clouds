import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import {
  editMemory, forget, listMemories, markUsed, remember,
  retireUnusedMemories, setMemoryEnabled,
} from "../src/memory/index.ts";

const seed = () => {
  const store = createStore();
  const user = store.createUser({ displayName: "A" });
  return { store, U: user.id };
};

test("a memory records the words it came from", () => {
  const { store, U } = seed();
  const r = remember(store, U, {
    kind: "goal", text: "Preparing for A Level Business in June",
    quote: "I've got my Business A Level in June",
    conversationId: "c1",
  });
  assert.ok(r.ok);
  assert.equal(r.value.provenance.quote, "I've got my Business A Level in June");
  assert.equal(r.value.useCount, 0);
});

test("a memory without provenance is refused", () => {
  const { store, U } = seed();
  const r = remember(store, U, { kind: "goal", text: "Something", quote: "" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.failure.message, /where it came from/);
});

test("sensitive categories are refused at the write boundary", () => {
  const { store, U } = seed();
  for (const [text, label] of [
    ["Has been diagnosed with ADHD", /health/],
    ["Is a practising Muslim", /beliefs/],
    ["Voted Conservative last time", /politics/],
    ["Cannot afford the textbook", /finances/],
    ["Can't afford the revision guide", /finances/],
    ["Couldn't afford the trip", /finances/],
  ] as const) {
    const r = remember(store, U, { kind: "fact", text, quote: text });
    assert.equal(r.ok, false, `"${text}" must not be stored`);
    if (!r.ok) assert.match(r.failure.message, label);
  }
  // Nothing reached storage.
  assert.equal(store.memories.count(U), 0);
});

test("ordinary learning facts are kept", () => {
  const { store, U } = seed();
  for (const text of [
    "Finds evaluation questions harder than knowledge questions",
    "Prefers worked examples before abstract explanation",
    "Studying price elasticity this term",
  ]) {
    assert.equal(remember(store, U, { kind: "difficulty", text, quote: text }).ok, true);
  }
  assert.equal(store.memories.count(U), 3);
});

test("editing re-applies the sensitive check", () => {
  const { store, U } = seed();
  const m = remember(store, U, { kind: "goal", text: "Wants an A*", quote: "I want an A*" });
  assert.ok(m.ok);
  assert.equal(editMemory(store, U, m.value.id, "Diagnosed with dyslexia").ok, false);
  assert.equal(editMemory(store, U, m.value.id, "Wants an A grade").ok, true);
  assert.equal(store.memories.get(U, m.value.id)!.text, "Wants an A grade");
});

test("duplicates refresh rather than accumulate", () => {
  const { store, U } = seed();
  const input = { kind: "goal" as const, text: "Exam in June", quote: "exam in June" };
  const first = remember(store, U, input);
  const second = remember(store, U, { ...input, pinned: true });
  assert.ok(first.ok && second.ok);
  assert.equal(first.value.id, second.value.id);
  assert.equal(store.memories.count(U), 1);
  assert.equal(second.value.pinned, true);
});

test("unused stale memories are retired; used and pinned ones survive", () => {
  const { store, U } = seed();
  const stale = remember(store, U, { kind: "fact", text: "Old unused note", quote: "q" });
  const used = remember(store, U, { kind: "fact", text: "Useful note", quote: "q" });
  const pinned = remember(store, U, { kind: "fact", text: "Pinned note", quote: "q", pinned: true });
  assert.ok(stale.ok && used.ok && pinned.ok);
  markUsed(store, U, [used.value.id]);

  const later = Date.now() + 1000 * 60 * 60 * 24 * 61;
  const retired = retireUnusedMemories(store, U, later);

  assert.deepEqual(retired.map((m) => m.text), ["Old unused note"]);
  assert.equal(store.memories.count(U), 2);
});

test("the user can inspect, edit and delete everything", () => {
  const { store, U } = seed();
  const m = remember(store, U, { kind: "goal", text: "Target grade A", quote: "q" });
  assert.ok(m.ok);
  assert.equal(listMemories(store, U).length, 1);
  assert.equal(forget(store, U, m.value.id).ok, true);
  assert.equal(listMemories(store, U).length, 0);
  assert.equal(forget(store, U, m.value.id).ok, false);
});

test("disabling memory deletes what was stored and blocks new writes", () => {
  const { store, U } = seed();
  remember(store, U, { kind: "goal", text: "Target grade A", quote: "q" });
  assert.equal(store.memories.count(U), 1);

  assert.equal(setMemoryEnabled(store, U, false).ok, true);
  assert.equal(store.memories.count(U), 0, "turning it off must also forget");

  const blocked = remember(store, U, { kind: "goal", text: "Another", quote: "q" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.failure.message, /turned off/);

  assert.equal(setMemoryEnabled(store, U, true).ok, true);
  assert.equal(remember(store, U, { kind: "goal", text: "Another", quote: "q" }).ok, true);
});

test("memory listing puts pinned and frequently used first", () => {
  const { store, U } = seed();
  const a = remember(store, U, { kind: "fact", text: "rarely used", quote: "q" });
  const b = remember(store, U, { kind: "fact", text: "often used", quote: "q" });
  const c = remember(store, U, { kind: "fact", text: "pinned", quote: "q", pinned: true });
  assert.ok(a.ok && b.ok && c.ok);
  markUsed(store, U, [b.value.id, b.value.id, b.value.id]);
  assert.deepEqual(listMemories(store, U).map((m) => m.text), ["pinned", "often used", "rarely used"]);
});
