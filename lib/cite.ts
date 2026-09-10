import type { Citation, Source } from "./types";

/**
 * Checking what it said against what it read.
 *
 * A generated page is only worth keeping if you can find out where any line in
 * it came from. Asking a model to cite its sources gets you citations; it does
 * not get you *true* citations, because a plausible page reference is as easy
 * to produce as a plausible sentence and considerably harder to notice. A
 * footnote nobody can check is decoration, and decoration that looks like
 * evidence is worse than none.
 *
 * So the model is not asked for a reference. It is asked to quote the words it
 * is relying on, and this file goes and finds them. A quote that is in the
 * source becomes a citation you can open; a quote that is not becomes a
 * visible failure. The app does the verifying, which means the guarantee does
 * not depend on the model being honest — only on it being quotable.
 *
 * The matching is deliberately forgiving in the ways that do not matter and
 * strict in the way that does. Whitespace, line breaks, curly quotes and
 * hyphenation across a line break are all noise a PDF introduces and no reader
 * would call a difference. The words themselves are not: if the sentence is
 * not there, nothing here will pretend it is.
 */

/** What the model is told to emit, and what this file takes apart. */
export const CITE_OPEN = "[[cite:";
export const CITE_CLOSE = "]]";

/* `Citation` lives in types.ts: a page stores its own, so the shape belongs
   with the row rather than with the code that produces it. */
export type { Citation };

export interface Cited {
  /** The page, with each citation replaced by a marker a reader can press. */
  text: string;
  citations: Citation[];
}

/** Everything a PDF or a line-wrap does to text that is not a difference. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    /* A word broken across a line break is one word. This has to happen before
       whitespace collapses, or "under-\nstand" becomes "under stand" and never
       matches "understand" again. */
    .replace(/-\s*\n\s*/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    /* A run of hyphens is one dash. Models write "--" for an em dash about as
       often as they write the character, and which of the two arrived is not a
       difference any reader would call one. */
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Where a quote is in a source, in the source's own offsets.
 *
 * Matched on normalised text and mapped back, because the offsets have to
 * index the real string — the reader is shown the source as it is, not as the
 * matcher saw it.
 */
function locate(source: string, quote: string): { start: number; end: number } | null {
  const needle = normalise(quote);
  if (needle.length < 12) return null; // too short to be evidence of anything

  /* An index from normalised position back to real position, built once per
     call. A quote is a few dozen characters and a source is a few hundred
     thousand, so this is the cheap direction to be careless in. */
  const map: number[] = [];
  let hay = "";
  let prevSpace = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      if (hay.length === 0 || prevSpace) continue;
      map.push(i);
      hay += " ";
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    // The same normalisations as above, one character at a time.
    if (ch === "-" && /\s/.test(source[i + 1] ?? "")) {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j++;
      if (j < source.length) { i = j - 1; continue; }
    }
    const low =
      "‘’ʼ".includes(ch) ? "'" :
      "“”".includes(ch) ? '"' :
      "–—".includes(ch) ? "-" :
      ch.toLowerCase();
    // The same hyphen-run collapse as above, one character at a time.
    if (low === "-" && hay.endsWith("-")) continue;
    map.push(i);
    hay += low;
  }

  const at = hay.indexOf(needle);
  if (at === -1) return null;
  const start = map[at] ?? 0;
  const endIdx = Math.min(at + needle.length - 1, map.length - 1);
  return { start, end: (map[endIdx] ?? start) + 1 };
}

/** Roughly which page an offset falls on, when the source has pages. */
function pageAt(source: Source, offset: number): number | undefined {
  if (!source.pages || source.pages < 1 || !source.text.length) return undefined;
  /* Even division, and honest about being an estimate: a PDF's text has no
     page boundaries left in it by the time it is one string. It is the
     difference between "somewhere in a 400-page book" and "around page 212",
     which is the difference between a citation you check and one you do not. */
  return Math.min(source.pages, Math.floor((offset / source.text.length) * source.pages) + 1);
}

/** A sentence or so either side, so the quote reads as part of something. */
function contextAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 220);
  const to = Math.min(text.length, end + 220);
  return (from > 0 ? "…" : "") + text.slice(from, to).replace(/\s+/g, " ").trim() + (to < text.length ? "…" : "");
}

/**
 * Take the citations out of a generated page and check every one.
 *
 * Unfound citations are kept rather than quietly deleted. Removing them would
 * make the page look better and be worth less: a claim whose evidence turned
 * out not to exist is exactly the claim a reader most needs flagged, and a
 * page that silently drops its failures is a page that only ever looks
 * well-sourced.
 */
export function extractCitations(raw: string, sources: Source[]): Cited {
  const citations: Citation[] = [];
  let out = "";
  let i = 0;
  let n = 0;

  for (;;) {
    const open = raw.indexOf(CITE_OPEN, i);
    if (open === -1) {
      out += raw.slice(i);
      break;
    }
    const close = raw.indexOf(CITE_CLOSE, open);
    if (close === -1) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, open);

    const body = raw.slice(open + CITE_OPEN.length, close);
    const bar = body.indexOf("|");
    const named = (bar === -1 ? "" : body.slice(0, bar)).trim();
    const quote = (bar === -1 ? body : body.slice(bar + 1)).trim().replace(/^["“]|["”]$/g, "");

    /* Named exactly where possible, and by the only source there is when the
       name is missing or wrong — a one-source page whose model dropped the
       name should still get a checked citation rather than a failed one. */
    const source =
      sources.find((s) => s.name.toLowerCase() === named.toLowerCase()) ??
      sources.find((s) => named && s.name.toLowerCase().includes(named.toLowerCase())) ??
      (sources.length === 1 ? sources[0] : undefined);

    n += 1;
    const hit = source ? locate(source.text, quote) : null;
    citations.push({
      n,
      sourceId: source?.id,
      sourceName: source?.name ?? named ?? "unknown",
      quote,
      found: Boolean(hit),
      at: hit ? { ...hit, page: source ? pageAt(source, hit.start) : undefined } : undefined,
      context: hit && source ? contextAround(source.text, hit.start, hit.end) : undefined,
    });

    /* A link, because the page is markdown and markdown already has one way to
       write "press this". The href is what the reader's click is caught by. */
    out += `[${hit ? n : `${n}?`}](#armi-cite-${n})`;
    i = close + CITE_CLOSE.length;
  }

  return { text: out, citations };
}

/** How much of a page could actually be traced, for a sentence about it. */
export function citeScore(citations: Citation[]): { found: number; total: number } {
  return { found: citations.filter((c) => c.found).length, total: citations.length };
}
