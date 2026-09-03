import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";
import { ingestDocument } from "../src/documents/ingest.ts";
import { resolveCitations } from "../src/context/citations.ts";

const U = "u1";

function seed() {
  const store = createStore();
  const res = ingestDocument(store, U, {
    workspaceId: "w1",
    text: "# Elasticity\n\nDemand is inelastic when PED is below one.\n\n## Revenue\n\nRaising price raises revenue for an inelastic good.\n",
  });
  assert.ok(res.ok);
  return { store, blocks: res.value.blocks, document: res.value.document };
}

test("a citation the model was shown resolves to a verified span", () => {
  const { store, blocks, document } = seed();
  const target = blocks.find((b) => b.text.startsWith("Demand is inelastic"))!;

  const out = resolveCitations(
    store, U,
    `PED below one means inelastic demand.[[cite:${target.id}]]`,
    [target.id],
  );

  assert.equal(out.citations.length, 1);
  assert.equal(out.stripped, 0);
  assert.equal(out.hallucinatedCitation, false);
  const citation = out.citations[0];
  assert.equal(citation.blockId, target.id);
  assert.equal(citation.documentTitle, "Elasticity");
  // The citation must re-read to exactly the quoted source.
  assert.equal(
    document.text.slice(citation.startOffset, citation.endOffset),
    citation.text,
  );
  // The marker is gone from rendered text.
  assert.doesNotMatch(out.text, /\[\[cite:/);
});

test("a fabricated block id is stripped and flagged", () => {
  const { store, blocks } = seed();
  const out = resolveCitations(
    store, U,
    "This is definitely on page 14.[[cite:totally-made-up-id]]",
    [blocks[0].id],
  );
  assert.equal(out.citations.length, 0);
  assert.equal(out.stripped, 1);
  assert.equal(out.hallucinatedCitation, true);
  assert.equal(out.text, "This is definitely on page 14.");
});

test("citing a real block that was never retrieved is still refused", () => {
  const { store, blocks } = seed();
  const notShown = blocks.at(-1)!;
  // The block genuinely exists — but the model was not given it, so it cannot
  // have read it, and a citation to it is not evidence.
  const out = resolveCitations(store, U, `Claim.[[cite:${notShown.id}]]`, [blocks[0].id]);
  assert.equal(out.citations.length, 0);
  assert.equal(out.hallucinatedCitation, true);
});

test("a citation whose source text has drifted is refused", () => {
  const { store, blocks, document } = seed();
  const target = blocks[1];
  // Simulate the document being edited underneath a stale block record.
  store.documents.update(U, document.id, {
    text: document.text.replace("Demand is inelastic", "Demand is ELASTIC"),
  } as never);

  const out = resolveCitations(store, U, `Claim.[[cite:${target.id}]]`, [target.id]);
  assert.equal(out.citations.length, 0, "a drifted span is no longer evidence");
  assert.equal(out.stripped, 1);
});

test("citations cannot cross user boundaries", () => {
  const { store, blocks } = seed();
  const out = resolveCitations(store, "someone-else", `Claim.[[cite:${blocks[0].id}]]`, [blocks[0].id]);
  assert.equal(out.citations.length, 0);
  assert.equal(out.stripped, 1);
});

test("repeated citations of one block produce a single entry", () => {
  const { store, blocks } = seed();
  const id = blocks[1].id;
  const out = resolveCitations(store, U, `A[[cite:${id}]] and B[[cite:${id}]].`, [id]);
  assert.equal(out.citations.length, 1);
  assert.equal(out.stripped, 0);
});

test("mixed valid and fabricated citations keep the valid one", () => {
  const { store, blocks } = seed();
  const good = blocks[1].id;
  const out = resolveCitations(
    store, U,
    `True thing[[cite:${good}]] and invented thing[[cite:nope]].`,
    [good],
  );
  assert.equal(out.citations.length, 1);
  assert.equal(out.stripped, 1);
  assert.equal(out.hallucinatedCitation, true);
});

test("stripping markers does not leave whitespace or punctuation debris", () => {
  const { store, blocks } = seed();
  const out = resolveCitations(store, U, `Sentence one [[cite:bogus]] . Sentence two.`, [blocks[0].id]);
  assert.equal(out.text, "Sentence one. Sentence two.");
});

test("text with no citations passes through unchanged", () => {
  const { store } = seed();
  const out = resolveCitations(store, U, "Just an answer.", []);
  assert.equal(out.text, "Just an answer.");
  assert.equal(out.citations.length, 0);
  assert.equal(out.hallucinatedCitation, false);
});
