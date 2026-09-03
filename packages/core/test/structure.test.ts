import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStructure } from "../src/documents/structure.ts";

/**
 * The invariant everything else depends on. If this ever fails, every citation
 * in the product is a lie, so it is asserted on every fixture rather than on a
 * chosen example.
 */
function assertOffsetsExact(source: string, label: string) {
  const blocks = extractStructure(source);
  for (const b of blocks) {
    assert.equal(
      source.slice(b.startOffset, b.endOffset), b.text,
      `${label}: block ${b.index} (${b.kind}) offsets do not match its text`,
    );
    assert.ok(b.startOffset < b.endOffset, `${label}: block ${b.index} is empty`);
  }
  // Blocks must be ordered and non-overlapping.
  for (let i = 1; i < blocks.length; i++) {
    assert.ok(
      blocks[i].startOffset >= blocks[i - 1].endOffset,
      `${label}: block ${i} overlaps its predecessor`,
    );
  }
  return blocks;
}

const MARKDOWN = `# Supply and Demand

Price is determined where supply meets demand. This is the central
mechanism of a market economy.

## Elasticity

Price elasticity of demand measures responsiveness.

- Elastic: PED > 1
- Inelastic: PED < 1
- Unit elastic: PED = 1

What happens to revenue when price rises for an inelastic good?

| Good | PED |
|---|---|
| Salt | 0.1 |
| Cars | 2.4 |

> Demand curves slope downward.

\`\`\`
revenue = price * quantity
\`\`\`
`;

test("offsets are exact for every block kind", () => {
  assertOffsetsExact(MARKDOWN, "markdown");
});

test("recognises the structural kinds that matter for retrieval", () => {
  const blocks = extractStructure(MARKDOWN);
  const kinds = new Set(blocks.map((b) => b.kind));
  for (const expected of ["heading", "paragraph", "listItem", "question", "table", "quote", "code"]) {
    assert.ok(kinds.has(expected as never), `expected to find a ${expected} block, got ${[...kinds]}`);
  }
});

test("headings nest, and blocks point at their enclosing heading", () => {
  const blocks = extractStructure(MARKDOWN);
  const h1 = blocks.find((b) => b.kind === "heading" && b.depth === 1)!;
  const h2 = blocks.find((b) => b.kind === "heading" && b.depth === 2)!;
  assert.equal(h1.text, "# Supply and Demand");
  assert.equal(h2.text, "## Elasticity");
  // The h2 sits under the h1.
  assert.equal(h2.parentIndex, h1.index);
  // Content after the h2 points at the h2, not the h1.
  const elasticityPara = blocks.find((b) => b.text.startsWith("Price elasticity"))!;
  assert.equal(elasticityPara.parentIndex, h2.index);
});

test("each list item is separately addressable", () => {
  const items = extractStructure(MARKDOWN).filter((b) => b.kind === "listItem");
  assert.equal(items.length, 3);
  assert.equal(items[0].text, "- Elastic: PED > 1");
});

test("questions are distinguished from statements", () => {
  const blocks = extractStructure("The price rose.\n\nWhy did the price rise?\n");
  assert.equal(blocks[0].kind, "paragraph");
  assert.equal(blocks[1].kind, "question");
});

test("page markers assign page numbers, including retroactively to page 1", () => {
  const src = "Intro text.\n\n<!-- page: 2 -->\n\nSecond page text.\n\n<!-- page: 3 -->\n\nThird.\n";
  const blocks = assertOffsetsExact(src, "paged");
  assert.equal(blocks[0].pageNumber, 1);
  assert.equal(blocks[1].pageNumber, 2);
  assert.equal(blocks[2].pageNumber, 3);
});

test("form feed advances the page counter", () => {
  const blocks = extractStructure("One.\n\n\f\n\nTwo.\n");
  assert.equal(blocks[0].pageNumber, 1);
  assert.equal(blocks[1].pageNumber, 2);
});

test("setext headings are recognised", () => {
  const blocks = extractStructure("Chapter One\n===========\n\nBody text here.\n");
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[0].depth, 1);
  assert.equal(blocks[0].text, "Chapter One");
  assert.equal(blocks[1].kind, "paragraph");
});

test("handles CRLF, unicode and awkward whitespace without breaking offsets", () => {
  assertOffsetsExact("# Héading\r\n\r\nPáragraph with émoji 🎓 and — dashes.\r\n", "crlf");
  assertOffsetsExact("   \n\n\n# Only heading\n\n\n   \n", "whitespace");
  assertOffsetsExact("no trailing newline", "no-newline");
});

test("empty and whitespace-only documents produce no blocks", () => {
  assert.deepEqual(extractStructure(""), []);
  assert.deepEqual(extractStructure("   \n\n  \t \n"), []);
});

test("unterminated code fence does not run away or lose offsets", () => {
  const blocks = assertOffsetsExact("Intro.\n\n```\nunclosed code\n", "unterminated");
  assert.equal(blocks.at(-1)!.kind, "code");
});

test("formula blocks are recognised", () => {
  const blocks = assertOffsetsExact("$$\nPED = \\frac{\\%\\Delta Q}{\\%\\Delta P}\n$$\n", "math");
  assert.equal(blocks[0].kind, "formula");
});

test("a long realistic document keeps the invariant", () => {
  const sections = Array.from({ length: 40 }, (_, i) =>
    `## Section ${i}\n\nBody paragraph ${i} with detail.\n\n- point a\n- point b\n\n| c | d |\n|---|---|\n| 1 | 2 |\n`,
  ).join("\n");
  const blocks = assertOffsetsExact(`# Big Document\n\n${sections}`, "long");
  assert.ok(blocks.length > 150, `expected many blocks, got ${blocks.length}`);
});
