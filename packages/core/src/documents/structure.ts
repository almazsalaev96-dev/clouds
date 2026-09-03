/**
 * Document structure extraction (§14).
 *
 * A document is decomposed into semantic blocks that each carry the exact
 * character range they occupy in the source text. That invariant —
 *
 *     document.text.slice(block.startOffset, block.endOffset) === block.text
 *
 * — is what makes a citation *verifiable* rather than asserted. When the model
 * later claims something came from page 14, the system can prove it by
 * re-reading the source at that offset. Everything in the provenance chain
 * rests on this function being exact, so it is tested against that invariant
 * directly rather than against expected output.
 *
 * This is a structural parser, not a Markdown renderer. It recognises the
 * shapes that matter for retrieval and citation, and deliberately does not
 * attempt inline formatting.
 */

import type { BlockKind } from "../types/index.ts";

export interface ExtractedBlock {
  kind: BlockKind;
  text: string;
  startOffset: number;
  endOffset: number;
  depth: number;
  index: number;
  pageNumber: number | null;
  /** Index into the emitted array of the nearest enclosing heading. */
  parentIndex: number | null;
}

/** A page break marker some extractors emit; recognised so PDFs keep page numbers. */
const PAGE_BREAK = /^\s*(?:\f|<!--\s*page\s*:\s*(\d+)\s*-->)\s*$/i;

const FENCE = /^\s*(?:```|~~~)/;
const ATX_HEADING = /^(#{1,6})\s+(\S.*)$/;
const SETEXT_UNDER = /^\s*(=+|-{2,})\s*$/;
const BULLET = /^\s*([-*+•]|\d+[.)])\s+\S/;
const QUOTE = /^\s*>\s?/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const DISPLAY_MATH = /^\s*\$\$/;
/** "1." / "(a)" / "Q3." style question labels common in worksheets and exams. */
const QUESTION_LABEL = /^\s*(?:Q\s*\d+|\(?[a-z]\)|\d+\s*[.)])\s+\S/i;

interface Line {
  text: string;
  start: number;
  end: number; // exclusive, not including the newline
}

function splitLines(source: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i <= source.length; i++) {
    if (i === source.length || source[i] === "\n") {
      let end = i;
      // Treat a trailing CR as part of the separator, not the content.
      if (end > start && source[end - 1] === "\r") end--;
      lines.push({ text: source.slice(start, end), start, end });
      start = i + 1;
    }
  }
  // A trailing newline produces a final empty line; harmless, filtered later.
  return lines;
}

const isBlank = (line: Line): boolean => line.text.trim().length === 0;

/**
 * Classifies a run of non-blank lines that is not code, a table, or a heading.
 * Order matters: a quoted question is a question, not a quote.
 */
function classifyProse(text: string): BlockKind {
  const trimmed = text.trim();
  if (DISPLAY_MATH.test(trimmed)) return "formula";
  if (QUESTION_LABEL.test(trimmed) && trimmed.includes("?")) return "question";
  if (trimmed.endsWith("?")) return "question";
  if (QUOTE.test(trimmed)) return "quote";
  if (BULLET.test(trimmed)) return "list";
  return "paragraph";
}

export function extractStructure(source: string): ExtractedBlock[] {
  const lines = splitLines(source);
  const blocks: ExtractedBlock[] = [];
  /** Stack of emitted-block indices for headings, by depth. */
  const headingStack: Array<{ depth: number; index: number }> = [];
  let pageNumber: number | null = null;
  let sawPageMarker = false;

  const parentFor = (depth: number): number | null => {
    for (let i = headingStack.length - 1; i >= 0; i--) {
      if (headingStack[i].depth < depth) return headingStack[i].index;
    }
    return null;
  };

  const push = (
    kind: BlockKind,
    startOffset: number,
    endOffset: number,
    depth: number,
    parentIndex: number | null,
  ): void => {
    // Trim trailing whitespace off the range without ever growing it, so the
    // slice invariant holds exactly.
    let s = startOffset;
    let e = endOffset;
    while (s < e && /\s/.test(source[s])) s++;
    while (e > s && /\s/.test(source[e - 1])) e--;
    if (e <= s) return;
    blocks.push({
      kind,
      text: source.slice(s, e),
      startOffset: s,
      endOffset: e,
      depth,
      index: blocks.length,
      pageNumber,
      parentIndex,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── page markers ──────────────────────────────────────────────────────
    const pageMatch = line.text.match(PAGE_BREAK);
    if (pageMatch) {
      if (!sawPageMarker) {
        // The first marker implies everything before it was page 1.
        sawPageMarker = true;
        for (const b of blocks) if (b.pageNumber === null) b.pageNumber = 1;
        pageNumber = 1;
      }
      pageNumber = pageMatch[1] ? Number(pageMatch[1]) : (pageNumber ?? 1) + 1;
      i++;
      continue;
    }

    if (isBlank(line)) {
      i++;
      continue;
    }

    // ── fenced code ───────────────────────────────────────────────────────
    if (FENCE.test(line.text)) {
      const start = line.start;
      let j = i + 1;
      while (j < lines.length && !FENCE.test(lines[j].text)) j++;
      const end = j < lines.length ? lines[j].end : lines[lines.length - 1].end;
      push("code", start, end, 0, parentFor(99));
      i = j + 1;
      continue;
    }

    // ── ATX heading ───────────────────────────────────────────────────────
    const atx = line.text.match(ATX_HEADING);
    if (atx) {
      const depth = atx[1].length;
      const parent = parentFor(depth);
      push("heading", line.start, line.end, depth, parent);
      while (headingStack.length && headingStack[headingStack.length - 1].depth >= depth) {
        headingStack.pop();
      }
      headingStack.push({ depth, index: blocks.length - 1 });
      i++;
      continue;
    }

    // ── setext heading (text underlined by === or ---) ────────────────────
    if (i + 1 < lines.length && SETEXT_UNDER.test(lines[i + 1].text) && !isBlank(line)
        && !BULLET.test(line.text) && !TABLE_ROW.test(line.text)) {
      const depth = lines[i + 1].text.trim().startsWith("=") ? 1 : 2;
      const parent = parentFor(depth);
      push("heading", line.start, line.end, depth, parent);
      while (headingStack.length && headingStack[headingStack.length - 1].depth >= depth) {
        headingStack.pop();
      }
      headingStack.push({ depth, index: blocks.length - 1 });
      i += 2;
      continue;
    }

    // ── table (a run of pipe rows) ────────────────────────────────────────
    if (TABLE_ROW.test(line.text)) {
      const start = line.start;
      let j = i;
      while (j < lines.length && TABLE_ROW.test(lines[j].text)) j++;
      push("table", start, lines[j - 1].end, 0, parentFor(99));
      i = j;
      continue;
    }

    // ── display math block ────────────────────────────────────────────────
    if (DISPLAY_MATH.test(line.text)) {
      const start = line.start;
      let j = i + 1;
      while (j < lines.length && !DISPLAY_MATH.test(lines[j].text)) j++;
      const end = j < lines.length ? lines[j].end : lines[j - 1].end;
      push("formula", start, end, 0, parentFor(99));
      i = j + 1;
      continue;
    }

    // ── list: each item becomes its own block so citations can address one ─
    if (BULLET.test(line.text)) {
      const parent = parentFor(99);
      while (i < lines.length && !isBlank(lines[i]) && !ATX_HEADING.test(lines[i].text)) {
        if (!BULLET.test(lines[i].text)) break;
        const start = lines[i].start;
        let j = i + 1;
        // Continuation lines of the same item are indented and not new bullets.
        while (j < lines.length && !isBlank(lines[j]) && !BULLET.test(lines[j].text)
               && /^\s+\S/.test(lines[j].text)) j++;
        const depth = (lines[i].text.match(/^\s*/)?.[0].length ?? 0) / 2;
        push("listItem", start, lines[j - 1].end, Math.floor(depth), parent);
        i = j;
      }
      continue;
    }

    // ── prose paragraph: consume until blank line or a structural boundary ─
    {
      const start = line.start;
      let j = i;
      while (
        j < lines.length &&
        !isBlank(lines[j]) &&
        !PAGE_BREAK.test(lines[j].text) &&
        !FENCE.test(lines[j].text) &&
        !TABLE_ROW.test(lines[j].text) &&
        (j === i || !ATX_HEADING.test(lines[j].text)) &&
        (j === i || !BULLET.test(lines[j].text)) &&
        !(j + 1 < lines.length && SETEXT_UNDER.test(lines[j + 1].text) && j > i)
      ) j++;
      const end = lines[j - 1].end;
      push(classifyProse(source.slice(start, end)), start, end, 0, parentFor(99));
      i = j;
    }
  }

  return blocks;
}
