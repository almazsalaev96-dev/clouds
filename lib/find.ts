/**
 * Searching what is written down, not only what it was called.
 *
 * The leading assistants search conversation *titles*. That is a reasonable
 * place to stop when the store holds one kind of thing, and a poor one here:
 * this app keeps four rooms, and the way anybody actually looks for something
 * is by a phrase from inside it — a line the model wrote, the front of a card,
 * a sentence in a page — not by a heading they never chose.
 *
 * Pure, so the interesting part is testable without a browser: the store
 * hands in rows, this hands back hits with the line each one matched on.
 */

/** One place the query was found, with enough around it to recognise. */
export interface Hit {
  /** How well it matched. Higher is better; comparable across rooms. */
  score: number;
  /** The matched line, trimmed, with an ellipsis where it was cut. */
  line: string;
  /** Where in `line` the match sits, so it can be marked. */
  at: number;
  /** How many characters matched. */
  length: number;
}

/** How much of the line to keep either side of the match. */
const AROUND = 44;

/**
 * The line a query matched, cut to something that fits a row.
 *
 * Cut around the match rather than from the start of the text: a hit four
 * hundred characters into a paragraph, shown as the paragraph's first forty
 * characters, is a row that does not contain the word you typed — which reads
 * as a bug every time.
 */
export function matchLine(text: string, query: string): Hit | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2 || !text) return null;
  const at = text.toLowerCase().indexOf(q);
  if (at < 0) return null;

  /* The sentence it sits in, where there is one: a line break is a better
     boundary than a character count, because it is where the writing itself
     said one thing ended. */
  let from = text.lastIndexOf("\n", at) + 1;
  let to = text.indexOf("\n", at);
  if (to < 0) to = text.length;
  if (at - from > AROUND) from = at - AROUND;
  if (to - (at + q.length) > AROUND) to = at + q.length + AROUND;

  const head = from > 0 && text[from - 1] !== "\n" ? "…" : "";
  const tail = to < text.length && text[to] !== "\n" ? "…" : "";
  const raw = text.slice(from, to).trim();
  /* A row of a markdown table reads as its cells, not its pipes. The match
     offset is recomputed on the tidied line rather than shifted, because a
     pipe removed *before* the match moves it and one removed after does not,
     and counting which is which is how off-by-ones get in. */
  const tidy = raw.replace(/^\|\s*/, "").replace(/\s*\|$/, "").replace(/\s*\|\s*/g, " · ");
  const line = head + tidy + tail;
  const shown = line.toLowerCase().indexOf(q);
  return {
    /* Earlier in the text is worth more, on the same reasoning as a title
       match: what a thing opens with is more likely to be what it is about.
       Floored so a late hit is still worth more than no hit at all. */
    score: Math.max(60, 300 - at),
    line,
    at: shown >= 0 ? shown : at - from + head.length,
    length: q.length,
  };
}

/**
 * What each field after the first is worth.
 *
 * Callers pass their fields in order of importance — a page's title then its
 * body, a card's front then its back — and without a weight the position
 * *within* a field is the only signal, so a hit at the start of the back beats
 * one in the middle of the front. That is the wrong way round: the front is
 * the question, and matching the question is what you meant.
 *
 * A third for the second field, which is the same ratio the palette already
 * used for note bodies, and a flat sixth after that.
 */
const FIELD = [1, 0.34, 0.17];

/**
 * The best hit across several strings, most important field first.
 *
 * A message is blocks, a card is two sides, a page is a title and a body.
 * The caller never has to know which field it came from — only to pass them
 * in the order it would want them to win.
 */
export function bestHit(texts: (string | undefined)[], query: string): Hit | null {
  let best: Hit | null = null;
  texts.forEach((t, i) => {
    if (!t) return;
    const h = matchLine(t, query);
    if (!h) return;
    const scored = { ...h, score: h.score * (FIELD[i] ?? FIELD[FIELD.length - 1]) };
    if (!best || scored.score > best.score) best = scored;
  });
  return best;
}

/**
 * Text out of a message's content blocks.
 *
 * A message is not a string — it is blocks, some of which are pictures — and
 * searching `JSON.stringify(content)` would match the word "image" in every
 * message that carried one.
 */
export function textOf(content: { type: string; text?: string }[] | undefined): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}
