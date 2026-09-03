import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import { ingestDocument } from "../src/documents/ingest.ts";
import { assembleContext } from "../src/context/assemble.ts";
import { recordAttempt } from "../src/learning/nextAction.ts";

const U = "u1";
const W = "w1";

function seedCorpus(store = createStore(), documents = 1) {
  for (let d = 0; d < documents; d++) {
    ingestDocument(store, U, {
      workspaceId: W,
      text: `# Topic ${d}\n\n` +
        Array.from({ length: 30 }, (_, i) =>
          `## Section ${d}.${i}\n\nParagraph ${i} of topic ${d} discussing markets and pricing in detail, at length, so that it consumes a meaningful number of tokens in any budget.\n`,
        ).join("\n"),
    });
  }
  return store;
}

test("what the user selected is always included, even against a huge corpus", () => {
  const store = seedCorpus(createStore(), 8);
  const doc = store.documents.list(U)[0];
  const { items, trace } = assembleContext(store, U, {
    query: "markets and pricing",
    workspaceId: W,
    openDocumentId: doc.id,
    selection: {
      documentId: doc.id,
      text: "the specific sentence the user pointed at",
      startOffset: 0,
      endOffset: 41,
    },
    budget: 500,
  });

  const selection = items.find((i) => i.kind === "selection");
  assert.ok(selection, "the selection must survive packing");
  assert.equal(selection.text, "the specific sentence the user pointed at");
  // And it must rank first: nothing outranks what the user pointed at.
  assert.equal(items[0].kind, "selection");
  assert.ok(trace.candidateCount > 20, "corpus should have produced real competition");
});

test("the token budget is never exceeded", () => {
  const store = seedCorpus(createStore(), 6);
  for (const budget of [100, 500, 2000, 8000]) {
    const { items, trace } = assembleContext(store, U, {
      query: "markets and pricing in detail",
      workspaceId: W,
      budget,
    });
    const actual = items.reduce((sum, i) => sum + i.tokens, 0);
    assert.ok(actual <= budget, `budget ${budget} exceeded: used ${actual}`);
    assert.equal(trace.used, actual);
    assert.ok(trace.budget === budget);
  }
});

test("a large document cannot evict the conversation or memory", () => {
  const store = seedCorpus(createStore(), 6);
  const conversation = store.conversations.insert(U, {
    workspaceId: W, projectId: null, title: "Chat", pinnedDocumentIds: [],
  } as never);
  for (let i = 0; i < 10; i++) {
    store.messages.insert(U, {
      conversationId: conversation.id,
      role: i % 2 === 0 ? "user" : "assistant",
      text: `Turn ${i} about pricing decisions we already discussed.`,
      citations: [], toolCalls: [],
    } as never);
  }
  store.memories.insert(U, {
    kind: "goal", text: "Preparing for a pricing exam in June.",
    provenance: { messageId: null, conversationId: null, quote: "" },
    useCount: 0, lastUsedAt: null, pinned: true,
  } as never);

  const { items } = assembleContext(store, U, {
    query: "pricing",
    workspaceId: W,
    conversationId: conversation.id,
    openDocumentId: store.documents.list(U)[0].id,
    budget: 800,
  });

  assert.ok(items.some((i) => i.kind === "conversationTurn"), "conversation was evicted");
  assert.ok(items.some((i) => i.kind === "memory"), "memory was evicted");
});

test("unused floor capacity is released rather than wasted", () => {
  const store = seedCorpus(createStore(), 2);
  // No conversation, no memory, no selection: those floors have no claimants.
  const { items, trace } = assembleContext(store, U, {
    query: "markets pricing detail",
    workspaceId: W,
    openDocumentId: store.documents.list(U)[0].id,
    budget: 2000,
  });
  assert.ok(items.length > 0);
  // Should use most of the budget on document content rather than reserving
  // half of it for kinds that produced nothing.
  assert.ok(trace.used > 1200, `expected the pool to be reused, used ${trace.used}`);
});

test("ranking is explainable: every item carries its feature values", () => {
  const store = seedCorpus();
  const { items, trace } = assembleContext(store, U, {
    query: "markets and pricing",
    workspaceId: W,
    openDocumentId: store.documents.list(U)[0].id,
    budget: 1500,
  });
  for (const item of items) {
    assert.ok(Number.isFinite(item.score));
    const featureSum = Object.values(item.features).reduce((a, b) => a + b, 0);
    assert.ok(featureSum > 0, `${item.kind} was included with no supporting feature`);
  }
  assert.ok(trace.elapsedMs >= 0);
  assert.equal(trace.included.length, items.length);
});

test("items dropped for budget are recorded with a reason", () => {
  const store = seedCorpus(createStore(), 4);
  const { trace } = assembleContext(store, U, {
    query: "markets pricing", workspaceId: W, budget: 200,
  });
  assert.ok(trace.dropped.length > 0, "expected drops at a small budget");
  for (const d of trace.dropped) assert.ok(d.reason.length > 0);
});

test("results are ordered by score, descending", () => {
  const store = seedCorpus(createStore(), 3);
  const { items } = assembleContext(store, U, {
    query: "markets pricing", workspaceId: W, budget: 3000,
  });
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].score >= items[i].score, "context is not score-ordered");
  }
});

test("assembly is deterministic for identical input", () => {
  const store = seedCorpus(createStore(), 3);
  const request = { query: "markets pricing", workspaceId: W, budget: 1200, now: 1_700_000_000_000 };
  const a = assembleContext(store, U, request);
  const b = assembleContext(store, U, request);
  assert.deepEqual(
    a.items.map((i) => [i.kind, i.refId]),
    b.items.map((i) => [i.kind, i.refId]),
  );
});

test("memory is excluded entirely when the user disabled it", () => {
  const store = createStore();
  const user = store.createUser({ displayName: "A", memoryEnabled: false });
  store.memories.insert(user.id, {
    kind: "goal", text: "pricing exam in June", pinned: true,
    provenance: { messageId: null, conversationId: null, quote: "" },
    useCount: 0, lastUsedAt: null,
  } as never);

  const off = assembleContext(store, user.id, {
    query: "pricing exam", workspaceId: W, budget: 2000,
  });
  assert.equal(off.items.filter((i) => i.kind === "memory").length, 0);

  // ...and included once they turn it back on, proving the switch is the cause.
  store.users.update(user.id, user.id, { memoryEnabled: true } as never);
  const on = assembleContext(store, user.id, {
    query: "pricing exam", workspaceId: W, budget: 2000,
  });
  assert.equal(on.items.filter((i) => i.kind === "memory").length, 1);
});

test("a weak concept is surfaced only once there is graded evidence", () => {
  const store = createStore();
  ingestDocument(store, U, { workspaceId: W, text: "# Elasticity\n\nResponsiveness to price.\n" });
  const concept = store.concepts.list(U)[0];

  const before = assembleContext(store, U, { query: "elasticity", workspaceId: W, budget: 2000 });
  assert.equal(before.items.filter((i) => i.kind === "concept").length, 0,
    "no evidence yet, so nothing should be claimed about the learner");

  for (let i = 0; i < 5; i++) {
    recordAttempt(store, U, {
      conceptId: concept.id, prompt: "q", response: "wrong", correct: false, difficulty: 0.4,
    });
  }
  const after = assembleContext(store, U, { query: "elasticity", workspaceId: W, budget: 2000 });
  const conceptItem = after.items.find((i) => i.kind === "concept");
  assert.ok(conceptItem, "with five failed attempts the weakness should reach context");
  assert.match(conceptItem.text, /struggled/);
});

test("an empty corpus produces an empty context rather than throwing", () => {
  const store = createStore();
  const { items, trace } = assembleContext(store, U, { query: "anything", workspaceId: W });
  assert.deepEqual(items, []);
  assert.equal(trace.used, 0);
  assert.equal(trace.candidateCount, 0);
});

test("an item larger than the entire budget is dropped with the honest reason", () => {
  const store = createStore();
  ingestDocument(store, U, { workspaceId: W, text: `# T\n\n${"word ".repeat(5000)}\n` });
  const { trace } = assembleContext(store, U, { query: "word", workspaceId: W, budget: 50 });
  assert.ok(trace.dropped.some((d) => d.reason === "item exceeds entire budget"));
});
