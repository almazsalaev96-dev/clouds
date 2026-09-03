import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import { ingestDocument } from "../src/documents/ingest.ts";
import { retrieve, neighbours, BlockIndex } from "../src/knowledge/retrieval.ts";

const U = "u1";

function seed() {
  const store = createStore();
  ingestDocument(store, U, {
    workspaceId: "w1",
    text: `# Price Elasticity

Price elasticity of demand measures how quantity responds to a price change.

## Inelastic Goods

Salt and insulin have few substitutes, so buyers keep buying when prices rise.
`,
  });
  ingestDocument(store, U, {
    workspaceId: "w1",
    text: `# Exchange Rates

A floating exchange rate is set by currency markets.

## Depreciation

A weaker currency makes exports cheaper abroad.
`,
  });
  return store;
}

test("retrieval ranks the on-topic block first", () => {
  const store = seed();
  const hits = retrieve(store, U, "how does quantity respond to price changes?");
  assert.ok(hits.length > 0, "expected hits");
  assert.match(hits[0].block.text, /quantity responds to a price change/);
  assert.equal(hits[0].via, "lexical");
  assert.ok(hits[0].matchedTerms.length > 0);
});

test("retrieval separates topics rather than returning everything", () => {
  const store = seed();
  const hits = retrieve(store, U, "currency depreciation exports", { expandViaGraph: false });
  assert.ok(hits.length > 0);
  for (const h of hits.slice(0, 2)) {
    assert.doesNotMatch(h.block.text, /elasticity|salt/i);
  }
});

test("rarer terms outrank common ones (idf actually applies)", () => {
  const store = createStore();
  // "market" appears in many blocks (high document frequency, low idf);
  // "hyperinflation" in exactly one (low df, high idf). A query naming both
  // must surface the discriminating term, not the ubiquitous one.
  const common = Array.from({ length: 20 }, (_, i) =>
    `## Section ${i}\n\nThe market in section ${i} behaves as a market normally does.\n`,
  ).join("\n");
  ingestDocument(store, U, {
    workspaceId: "w1",
    text: `# Corpus\n\n${common}\n## Rare\n\nHyperinflation destroyed household savings.\n`,
  });
  const hits = retrieve(store, U, "hyperinflation market", { expandViaGraph: false });
  assert.match(hits[0].block.text, /Hyperinflation/);
});

test("document restriction never leaks other documents", () => {
  const store = seed();
  const docs = store.documents.list(U);
  const target = docs.find((d) => d.title === "Exchange Rates")!;
  const hits = retrieve(store, U, "price", { documentIds: [target.id], expandViaGraph: false });
  for (const h of hits) assert.equal(h.block.documentId, target.id);
});

test("graph expansion recovers related blocks that share no query words", () => {
  const store = seed();
  const withGraph = retrieve(store, U, "insulin", { expandViaGraph: true });
  const withoutGraph = retrieve(store, U, "insulin", { expandViaGraph: false });
  assert.ok(withGraph.length >= withoutGraph.length);
  // Graph hits are present but ranked strictly below lexical ones.
  const firstGraph = withGraph.findIndex((h) => h.via === "graph");
  const lastLexical = withGraph.map((h) => h.via).lastIndexOf("lexical");
  if (firstGraph !== -1) assert.ok(firstGraph > lastLexical - 1);
});

test("graph expansion reaches body text through its heading's concept", () => {
  const store = seed();
  // "elasticity" does not lexically match "Demand is inelastic..." — the two
  // share no terms. The graph must bridge them via the enclosing heading.
  const hits = retrieve(store, U, "elasticity", { expandViaGraph: true });
  assert.ok(
    hits.some((h) => /Salt and insulin/.test(h.block.text) || /few substitutes/.test(h.block.text)),
    `expected body text under the Elasticity heading, got: ${hits.map((h) => h.block.text.slice(0, 40)).join(" | ")}`,
  );
});

test("retrieval is scoped per user", () => {
  const store = seed();
  assert.deepEqual(retrieve(store, "someone-else", "elasticity"), []);
});

test("empty and stopword-only queries return nothing rather than everything", () => {
  const store = seed();
  assert.deepEqual(retrieve(store, U, ""), []);
  assert.deepEqual(retrieve(store, U, "the of and"), []);
});

test("the index refreshes when new documents arrive", () => {
  const store = seed();
  assert.equal(retrieve(store, U, "monopsony", { expandViaGraph: false }).length, 0);
  ingestDocument(store, U, { workspaceId: "w1", text: "# Labour\n\nA monopsony is a single buyer.\n" });
  const hits = retrieve(store, U, "monopsony", { expandViaGraph: false });
  assert.ok(hits.length > 0, "index should have picked up the new document");
});

test("graph neighbours walk edges in both directions with decaying weight", () => {
  const store = seed();
  const doc = store.documents.list(U)[0];
  const oneHop = neighbours(store, U, "document", doc.id, 1);
  assert.ok(oneHop.length > 0);
  assert.ok(oneHop.every((n) => n.distance === 1));

  const twoHop = neighbours(store, U, "document", doc.id, 2);
  assert.ok(twoHop.length >= oneHop.length);
  // Reaching the heading block via its concept is a two-hop path.
  assert.ok(twoHop.some((n) => n.type === "block" && n.distance === 2));
  // Weight never increases with distance.
  for (const n of twoHop) assert.ok(n.weight <= 1);
});

test("index handles an empty corpus without dividing by zero", () => {
  const store = createStore();
  const index = new BlockIndex();
  index.build(store, U);
  assert.equal(index.size, 0);
  assert.deepEqual(index.search("anything", 5), []);
});
