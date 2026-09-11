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
 *
 * And it distinguishes three outcomes, not two. Found; not found; and not
 * checked — a four-word quote, or one naming a file that is not here. Telling a
 * reader "not found in the source" about something that was never looked for is
 * a lie in the direction that costs the most, because the whole feature is
 * believed exactly as far as its failures are accurate.
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

/**
 * Text with the noise taken out, and the way back to where it came from.
 *
 * `map[i]` is the offset in the original of the character that produced
 * `text[i]`, so a match on the folded text can be reported in the source's own
 * offsets. The two arrays are the same length by construction and that is the
 * invariant the whole file rests on.
 */
interface Folded {
  text: string;
  map: number[];
}

/** Letters and digits in any script, for deciding what a hyphen is doing. */
const WORDY = /[\p{L}\p{N}]/u;

/**
 * The one normaliser.
 *
 * Everything that goes into a comparison comes through here — the quote and the
 * source alike — and the map is the only difference between the two calls.
 *
 * That is not tidiness, it is the fix for a real bug. There used to be two
 * implementations of "the same" rules: a chain of regexes for the quote and a
 * character loop for the source. They did not agree. The regexes joined a
 * hyphenated word only across a newline; the loop joined it across any
 * whitespace and deleted a spaced dash outright. So a source reading
 * "profits — and losses" folded to "profits and losses" on one side and
 * "profits - and losses" on the other, and a quote lifted **verbatim** out of
 * that source was reported to the reader as not being in it. Rules that have to
 * agree are not written twice.
 *
 * The other thing this fixes is quieter. `"İ".toLowerCase()` is two characters,
 * not one — an `i` and a combining dot — so the old loop's one-push-per-input
 * assumption slid the map by one at the first Turkish capital and every offset
 * after it pointed at the wrong place, which surfaced as a citation that opened
 * on the whole document. Output characters are mapped one for one, whatever the
 * case table does.
 */
function fold(s: string): Folded {
  const map: number[] = [];
  let text = "";
  const emit = (out: string, at: number) => {
    for (let k = 0; k < out.length; k++) map.push(at);
    text += out;
  };

  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      // Leading space is dropped; a run of it is one space.
      if (text.length === 0 || prevSpace) continue;
      emit(" ", i);
      prevSpace = true;
      continue;
    }

    /* A word broken across a line break is one word: "under-\nstand" is
       "understand". Only across a line break, and only between two word
       characters — "profits — and losses" is punctuation and stays. A PDF
       hyphenates at the right margin and nowhere else. */
    if (ch === "-" && WORDY.test(s[i - 1] ?? "")) {
      let j = i + 1;
      let broke = false;
      while (j < s.length && /\s/.test(s[j])) {
        if (s[j] === "\n" || s[j] === "\r") broke = true;
        j++;
      }
      if (broke && WORDY.test(s[j] ?? "")) {
        i = j - 1;
        continue;
      }
    }

    prevSpace = false;
    const low =
      "‘’ʼ".includes(ch) ? "'" :
      "“”".includes(ch) ? '"' :
      "–—".includes(ch) ? "-" :
      /* Decomposed, so "café" written as five code points and "café" written
         as four are the same five characters here. A PDF extractor and a model
         disagree about this constantly, and a citation failing because one side
         composed its accent is a fabrication warning about a verbatim quote.

         NFD rather than NFC because decomposition is defined one code point at
         a time: composition would need to look across characters, and the map
         from folded position back to real offset is built one character at a
         time. ASCII is left alone, which is nearly all of nearly every
         document and the difference between this being free and this being a
         normalise call per character of a four-hundred-thousand-character
         book. */
      ch < "\u0080" ? ch.toLowerCase() : ch.toLowerCase().normalize("NFD");
    /* A run of hyphens is one dash. Models write "--" for an em dash about as
       often as they write the character, and which of the two arrived is not a
       difference any reader would call one. */
    if (low === "-" && text.endsWith("-")) continue;
    emit(low, i);
  }

  // Trailing space, dropped the same way the leading one was.
  if (prevSpace) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

/** The same rules, when only the text is wanted. */
export function normalise(s: string): string {
  return fold(s).text;
}

/** Under this, a match is a coincidence rather than evidence. */
const SHORTEST = 12;

/**
 * Where a quote is in a source, in the source's own offsets.
 *
 * Matched on folded text and mapped back, because the offsets have to index the
 * real string — the reader is shown the source as it is, not as the matcher saw
 * it.
 */
function locate(hay: Folded, quote: string): { start: number; end: number } | null {
  const needle = normalise(quote);
  if (needle.length < SHORTEST) return null;
  return span(hay, needle);
}

function span(hay: Folded, needle: string): { start: number; end: number } | null {
  const at = hay.text.indexOf(needle);
  if (at === -1) return null;
  const start = hay.map[at] ?? 0;
  const endIdx = Math.min(at + needle.length - 1, hay.map.length - 1);
  return { start, end: (hay.map[endIdx] ?? start) + 1 };
}

/**
 * Where a quote sits inside a passage, by the rules the check itself used.
 *
 * The panel marks the quoted words inside the context around them, and it has
 * to mark the words the matcher actually found — a highlight that disagrees
 * with the citation it is illustrating is worse than no highlight. It used to
 * do its own thing: search for the quote with its whitespace collapsed, then
 * cut `quote.length` characters, which is the *uncollapsed* length, so a quote
 * containing a line break highlighted the right words plus however many
 * characters of the next ones. And it knew nothing of curly quotes, so a
 * citation that matched perfectly showed up unmarked.
 */
export function findIn(text: string, quote: string): { start: number; end: number } | null {
  const needle = normalise(quote);
  if (!needle) return null;
  return span(fold(text), needle);
}

/** `--- page 7 ---` on a line of its own, as `extractPdf` writes it. */
const PAGE_MARK = /^--- page (\d+) ---$/gm;

/**
 * A source, prepared once.
 *
 * The fold is a pass over the whole text and the page index is another, and a
 * page with thirty citations against one book used to do both thirty times —
 * nearly two seconds of a four-hundred-thousand-character string being walked
 * again for each quote, all of it identical work. Once per source, held for the
 * length of one call and dropped after.
 */
interface Prepared {
  fold: Folded;
  /** Where each page marker sits, so an offset can be told which page it is on. */
  pages: { at: number; page: number }[];
}

function prepare(source: Source): Prepared {
  const pages: { at: number; page: number }[] = [];
  PAGE_MARK.lastIndex = 0;
  for (let m = PAGE_MARK.exec(source.text); m; m = PAGE_MARK.exec(source.text)) {
    pages.push({ at: m.index, page: Number(m[1]) });
  }
  return { fold: fold(source.text), pages };
}

/**
 * Which page an offset falls on.
 *
 * A PDF read by this app keeps its page boundaries — `--- page 7 ---` on a line
 * of its own — so this is a lookup rather than an estimate. It used to be
 * `offset / length * pages`, which is right only if every page holds the same
 * number of characters and the whole document was read. Neither is true: a
 * chapter opening is a third of a page of text, and extraction stops at four
 * hundred thousand characters, so the last page of a long book's *readable*
 * part was confidently reported as its last page. A citation that sends a
 * reader to page 900 of a book it is actually on page 340 of is worse than one
 * that admits it does not know, so where there are no markers there is no page
 * number.
 */
function pageAt(prepared: Prepared, offset: number): number | undefined {
  let found: number | undefined;
  for (const p of prepared.pages) {
    if (p.at > offset) break;
    found = p.page;
  }
  return found;
}

/** A sentence or so either side, so the quote reads as part of something. */
function contextAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 220);
  const to = Math.min(text.length, end + 220);
  return (from > 0 ? "…" : "") + text.slice(from, to).replace(/\s+/g, " ").trim() + (to < text.length ? "…" : "");
}

/**
 * Which source a citation named, when it named one at all.
 *
 * The near-match is the interesting case. A model writing "notes" against a
 * page holding `notes-2023.pdf` and `notes-2024.pdf` has named neither, and the
 * old code handed back whichever was added first — so a quote was checked
 * against the wrong file, and either failed for being in the other one or,
 * worse, succeeded because both files say much the same thing, and the reader
 * was shown a confident citation to a document the claim did not come from. An
 * ambiguous name is not a name. It is left unattributed and the page says so.
 */
function pickSource(named: string, sources: Source[]): Source | undefined {
  const want = named.trim().toLowerCase();
  if (want) {
    const exact = sources.filter((s) => s.name.trim().toLowerCase() === want);
    if (exact.length === 1) return exact[0];
    if (exact.length === 0) {
      /* Either direction: "notes" for `notes.pdf`, and "chapter 3 of notes.pdf"
         for `notes.pdf`. One match is a name; two is a guess. */
      const near = sources.filter((s) => {
        const n = s.name.trim().toLowerCase();
        return n.length > 0 && (n.includes(want) || want.includes(n));
      });
      if (near.length === 1) return near[0];
    }
    return undefined;
  }
  /* No name, one source: there is nothing to be ambiguous about, and a page
     built from a single book should not lose its citations to a model that
     did not bother repeating the filename. */
  return sources.length === 1 ? sources[0] : undefined;
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
  /* One preparation per source, made when the first citation names it. A page
     that cites one of five books does not walk the other four. */
  const ready = new Map<string, Prepared>();
  const prepared = (s: Source): Prepared => {
    let p = ready.get(s.id);
    if (!p) ready.set(s.id, (p = prepare(s)));
    return p;
  };

  let out = "";
  let i = 0;
  let n = 0;

  for (;;) {
    const open = raw.indexOf(CITE_OPEN, i);
    if (open === -1) {
      out += raw.slice(i);
      break;
    }
    const from = open + CITE_OPEN.length;

    /* Where this citation could end. The first `]]` is nearly always right, and
       is wrong exactly when the quoted words contain one — quoting code, or a
       nested reference. That used to truncate the quote silently, which failed
       the citation *and* spilled the rest of the body into the page as text. So
       every close up to the next citation is a candidate and the *longest* one
       that checks out wins — longest, not first, because a truncated quote can
       match perfectly well: cut `arr[[0]] = true` at its first `]]` and
       `arr[[0` is still a real substring of the source, so first-that-matches
       would take the short reading, report it found, and leave `= true` sitting
       in the prose. If none checks out the shortest is used, so the failure is
       reported against the reading the model most likely meant. */
    const nextOpen = raw.indexOf(CITE_OPEN, from);
    const limit = nextOpen === -1 ? raw.length : nextOpen;
    const closes: number[] = [];
    for (let c = raw.indexOf(CITE_CLOSE, from); c !== -1 && c < limit; c = raw.indexOf(CITE_CLOSE, c + 1)) {
      closes.push(c);
      if (closes.length >= 8) break; // a body with eight `]]` in it is not a quote
    }
    if (closes.length === 0) {
      out += raw.slice(i);
      break;
    }

    const read = (close: number) => {
      const body = raw.slice(from, close);
      const bar = body.indexOf("|");
      const named = (bar === -1 ? "" : body.slice(0, bar)).trim();
      const quote = (bar === -1 ? body : body.slice(bar + 1)).trim().replace(/^["“]|["”]$/g, "");
      const source = pickSource(named, sources);
      const hit = source && quote ? locate(prepared(source).fold, quote) : null;
      return { close, named, quote, source, hit };
    };

    let pick = read(closes[0]);
    for (let k = closes.length - 1; k >= 1; k--) {
      const alt = read(closes[k]);
      if (alt.hit) { pick = alt; break; }
    }
    const { named, quote, source, hit } = pick;

    out += raw.slice(i, open);
    n += 1;

    /* Three outcomes, and the reader is told which. "Not found" is a claim
       about the source; the other two are admissions about the check. */
    const why: Citation["why"] = hit
      ? undefined
      : !source
        ? "unnamed"
        : normalise(quote).length < SHORTEST
          ? "short"
          : "missing";

    citations.push({
      n,
      sourceId: source?.id,
      // `||`, not `??`: an empty name is missing, and "" ?? x is "".
      sourceName: source?.name || named || "unknown",
      quote,
      found: Boolean(hit),
      why,
      at: hit && source ? { ...hit, page: pageAt(prepared(source), hit.start) } : undefined,
      context: hit && source ? contextAround(source.text, hit.start, hit.end) : undefined,
    });

    /* A link, because the page is markdown and markdown already has one way to
       write "press this". The href is what the reader's click is caught by. */
    out += `[${hit ? n : `${n}?`}](#armi-cite-${n})`;
    i = pick.close + CITE_CLOSE.length;
  }

  return { text: out, citations };
}

/**
 * How much of a page could actually be traced, for a sentence about it.
 *
 * `unchecked` is counted apart from `missing` because they call for different
 * sentences. One says the page may be wrong; the other says the page may be
 * fine and this app cannot tell, which is a smaller thing and must not be
 * reported as the larger one.
 */
export function citeScore(citations: Citation[]): { found: number; missing: number; unchecked: number; total: number } {
  let found = 0, missing = 0, unchecked = 0;
  for (const c of citations) {
    if (c.found) found++;
    else if (c.why === "missing" || !c.why) missing++;
    else unchecked++;
  }
  return { found, missing, unchecked, total: citations.length };
}
