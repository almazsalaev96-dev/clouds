import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import { ingestDocument, resolveSpan } from "../src/documents/ingest.ts";
import { conceptKey, tokenize } from "../src/knowledge/concepts.ts";

const U = "u1";
const DOC = `# Elasticity

Price elasticity of demand measures responsiveness to price.

## Determinants

Substitutes matter most.
`;

function seed() {
  const store = createStore();
  const res = ingestDocument(store, U, { workspaceId: "w1", text: DOC });
  assert.ok(res.ok, "ingest should succeed");
  return { store, ...res.value };
}

test("ingest persists blocks with resolvable parents", () => {
  const { store, document, blocks } = seed();
  assert.equal(document.ingestState, "ready");
  assert.equal(document.blockCount, blocks.length);
  assert.equal(document.title, "Elasticity");

  const h2 = blocks.find((b) => b.kind === "heading" && b.depth === 2)!;
  const h1 = blocks.find((b) => b.kind === "heading" && b.depth === 1)!;
  assert.equal(h2.parentBlockId, h1.id);
  // Every parent id must actually exist in the store.
  for (const b of blocks) {
    if (b.parentBlockId) assert.ok(store.blocks.get(U, b.parentBlockId), "dangling parent");
  }
});

test("every stored block's offsets still resolve against the document", () => {
  const { store, document, blocks } = seed();
  for (const b of blocks) {
    const span = resolveSpan(store, U, document.id, b.startOffset, b.endOffset);
    assert.ok(span.ok);
    assert.equal(span.value, b.text);
  }
});

test("headings become concepts, connected by edges with provenance", () => {
  const { store, document, newConceptIds } = seed();
  assert.equal(newConceptIds.length, 2);
  const names = newConceptIds.map((id) => store.concepts.get(U, id)!.name).sort();
  assert.deepEqual(names, ["Determinants", "Elasticity"]);

  const teaches = store.edges.list(U, { where: { kind: "teaches", fromId: document.id } as never });
  assert.equal(teaches.length, 2);
  for (const e of teaches) {
    assert.ok(e.provenance.length > 0, "edges must record why they exist");
    assert.ok(e.weight > 0 && e.weight <= 1);
  }
  // A depth-1 heading is a stronger subject claim than a depth-2 one.
  const byConcept = new Map(teaches.map((e) => [store.concepts.get(U, e.toId)!.name, e.weight]));
  assert.ok(byConcept.get("Elasticity")! > byConcept.get("Determinants")!);
});

test("re-ingesting the same topic reuses the concept instead of duplicating", () => {
  const { store } = seed();
  const before = store.concepts.count(U);
  const again = ingestDocument(store, U, { workspaceId: "w1", text: "# elasticity\n\nMore on it.\n" });
  assert.ok(again.ok);
  assert.equal(again.value.newConceptIds.length, 0);
  assert.equal(store.concepts.count(U), before);
});

test("ingest failures are typed and user-readable, not exceptions", () => {
  const store = createStore();
  const empty = ingestDocument(store, U, { workspaceId: "w1", text: "   " });
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.failure.code, "invalid_input");
    assert.match(empty.failure.message, /empty/i);
  }
  // A failed ingest must not leave a half-built document behind.
  assert.equal(store.documents.count(U), 0);
  assert.equal(store.blocks.count(U), 0);
});

test("oversized documents are refused with an actionable message", () => {
  const store = createStore();
  const huge = ingestDocument(store, U, { workspaceId: "w1", text: "x ".repeat(5 * 1024 * 1024) });
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.match(huge.failure.message, /splitting/i);
});

test("citations outside the document are rejected", () => {
  const { store, document } = seed();
  assert.equal(resolveSpan(store, U, document.id, 0, 999999).ok, false);
  assert.equal(resolveSpan(store, U, document.id, 5, 5).ok, false);
  assert.equal(resolveSpan(store, "other-user", document.id, 0, 5).ok, false);
});

test("concept keys merge case, punctuation, articles and regular plurals", () => {
  assert.equal(conceptKey("Price Elasticity of Demand"), conceptKey("price elasticity, demand"));
  assert.equal(conceptKey("Externalities"), conceptKey("externality"));
  assert.equal(conceptKey("The Market"), conceptKey("markets"));
  // ...but does not over-merge genuinely different concepts.
  assert.notEqual(conceptKey("supply"), conceptKey("demand"));
  assert.notEqual(conceptKey("elastic"), conceptKey("inelastic"));
});

test("tokenizer drops stopwords and normalises for matching", () => {
  assert.deepEqual(tokenize("The Prices of Goods!"), ["price", "good"]);
  assert.deepEqual(tokenize(""), []);
});
