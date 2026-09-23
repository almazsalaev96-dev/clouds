/**
 * Reading the whole of a long source before anything is written from it.
 *
 * A revision pack from a 988-page book used to be written from its first
 * ninety thousand characters — about forty pages — because that is what
 * `makeFromSources` sliced each source to, and nothing said so. The chip
 * read "988p" and the pack was about chapter one.
 *
 * Sending the whole book to the writer is not the fix either: two million
 * characters is past every window here, and the ones that come close charge
 * for it on every page of the pack. So the book is read the way a person
 * with a deadline reads one — in parts, making notes — and the writing
 * happens from the notes.
 *
 *   1. Split each source that is too big into parts on paragraph breaks.
 *   2. A cheap model with a long window (route.reader) reads each part, a
 *      few at a time, into dense notes that keep the *exact sentences* worth
 *      quoting.
 *   3. The writer gets the notes, in order, under the source's own name.
 *
 * Step 2's instruction to quote verbatim is what keeps citations honest:
 * `lib/cite.ts` checks every quotation against the original file, not the
 * notes, so a quote the reader paraphrased is caught exactly as a quote the
 * writer invented would be.
 *
 * Notes are cached for the session by source and length, because a pack is
 * three pages from the same book and reading it three times would triple
 * the cost and the wait for nothing.
 */
import { complete, type Progress } from "./complete";
import { reader, biggestWindow } from "./route";
import type { ContentBlock } from "./types";
import { getConfigured } from "./configured";
import { useSettings } from "./store";

/** Everything together under this goes to the writer whole, as before. */
export const WHOLE = 120_000;
/** One part, for the reader. About fifty pages of a textbook. */
export const PART = 60_000;
/** Parts read at once: quick enough, and polite to a rate limit. */
const AT_ONCE = 4;
/** Past this many parts a source is read in a spread rather than whole. */
export const MAX_PARTS = 48;

export interface Material {
  name: string;
  text: string;
}

export interface Read {
  /** What the writer is given, one entry per source, under its own name. */
  material: Material[];
  /** Parts read in total, and how many sources needed reading at all. */
  parts: number;
  /** A source too long to read every part of — named, so it can be said. */
  sampled: string[];
}

/** Split on paragraph breaks, never mid-sentence where it can be helped. */
export function partsOf(text: string, size = PART): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(at + size, text.length);
    if (end < text.length) {
      const para = text.lastIndexOf("\n\n", end);
      const line = text.lastIndexOf("\n", end);
      const stop = text.lastIndexOf(". ", end);
      const cut = [para, line, stop].find((c) => c > at + size * 0.6);
      if (cut !== undefined) end = cut + 1;
    }
    out.push(text.slice(at, end));
    at = end;
  }
  return out;
}

/** An even spread across the book when it has more parts than can be read. */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

const cache = new Map<string, string>();
const keyOf = (name: string, text: string, i: number) => `${name}\u0000${text.length}\u0000${i}\u0000${text.slice(0, 64)}`;

const NOTE = (name: string, i: number, n: number, part: string) =>
  `You are reading part ${i + 1} of ${n} of "${name}" so that someone can later write revision material from the whole of it. You will not see the other parts. Make notes on this part only.

Write, in Markdown:
- A line saying what this part covers (its chapter or section titles, if it has them).
- Every definition, law, rule, formula, date, figure and named example in it, one per line, stated completely.
- The steps of any process or method, in order.
- Anything the text marks as important, common mistakes, or exam points.
- Then a section headed "Quotable", with the 8 to 20 sentences from this part most worth citing, each on its own line starting with "> ", copied **exactly** — every word, every comma, no ellipsis, no fixing. These are checked against the book character by character.

No introduction, no summary of the book as a whole, nothing that is not in this part.

--- ${name}, part ${i + 1} of ${n} ---
${part}`;

/**
 * Turn sources into material the writer can hold.
 *
 * Small material comes back unchanged. Nothing is read when no model can
 * hold a part — the caller falls back to the old slice, and says so.
 */
export async function readWhole(
  sources: Material[],
  opts: Progress & { onPart?: (done: number, total: number) => void } = {},
): Promise<Read> {
  const total = sources.reduce((n, s) => n + s.text.length, 0);
  if (total <= WHOLE) return { material: sources, parts: 0, sampled: [] };

  const settings = useSettings.getState();
  const modelId = reader({ configured: getConfigured(), keys: settings.keys }, PART);
  if (!modelId) return { material: sources, parts: 0, sampled: [] };

  /* Short sources beside a long one go whole; only what does not fit is read. */
  const jobs: { source: number; i: number; n: number; text: string }[] = [];
  const sampled: string[] = [];
  sources.forEach((s, source) => {
    if (s.text.length <= PART) return;
    const all = partsOf(s.text);
    const kept = spread(all.map((text, i) => ({ text, i })), MAX_PARTS);
    if (kept.length < all.length) sampled.push(s.name);
    for (const k of kept) jobs.push({ source, i: k.i, n: all.length, text: k.text });
  });

  const notes = new Map<string, string>();
  let done = 0;
  opts.onPart?.(0, jobs.length);
  let next = 0;
  const work = async () => {
    while (next < jobs.length) {
      if (opts.signal?.aborted) return;
      const j = jobs[next++];
      const name = sources[j.source].name;
      const key = keyOf(name, sources[j.source].text, j.i);
      let got = cache.get(key);
      if (!got) {
        got = (await complete(NOTE(name, j.i, j.n, j.text), {
          modelId,
          maxTokens: 3_000,
          temperature: 0.1,
          signal: opts.signal,
          onMoved: opts.onMoved,
        }).catch(() => null)) ?? "";
        if (got.trim()) cache.set(key, got);
      }
      notes.set(`${j.source}:${j.i}`, got);
      opts.onPart?.(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, jobs.length) }, work));

  const material = sources.map((s, source) => {
    if (s.text.length <= PART) return s;
    const mine = jobs.filter((j) => j.source === source);
    const body = mine
      .map((j) => {
        const n = notes.get(`${source}:${j.i}`)?.trim();
        return `### Part ${j.i + 1} of ${j.n}\n\n${n || "(this part could not be read)"}`;
      })
      .join("\n\n");
    /* The file's own name, unchanged: citations name the file, and a
       "(notes)" suffix would make every one of them miss. */
    return { name: s.name, text: `(Read in ${mine.length} parts; notes on each follow, with exact quotations under "Quotable".)\n\n${body}` };
  });
  return { material, parts: jobs.length, sampled };
}

/**
 * A file in a conversation too big for any window the keys can reach.
 *
 * The router used to pick the biggest window and send it anyway, and the
 * provider refused with "prompt is too long" — a 988-page PDF dropped into a
 * chat was an error, every time. Such a file is now read in parts before the
 * turn goes out, and the thread keeps the notes in its place, so the next
 * question about it fits too. Files that fit are left exactly as they are:
 * a model that can hold the whole book should read the whole book.
 */
export async function fitFiles(
  content: ContentBlock[],
  onPart?: (name: string, done: number, total: number) => void,
): Promise<ContentBlock[]> {
  const window = biggestWindow({ configured: getConfigured(), keys: useSettings.getState().keys });
  if (!window) return content;
  /* Six tenths of the window for the file, leaving the rest for the thread,
     the instructions and the reply; ~3.2 characters to a token, as the
     fitter counts. */
  const fits = Math.floor(window * 0.6 * 3.2);
  const out: ContentBlock[] = [];
  for (const c of content) {
    if (c.type !== "file" || c.text.length <= fits) {
      out.push(c);
      continue;
    }
    const read = await readWhole([{ name: c.name, text: c.text }], { onPart: (d, t) => onPart?.(c.name, d, t) });
    out.push(read.parts ? { ...c, text: read.material[0].text } : { ...c, text: c.text.slice(0, fits) });
  }
  return out;
}
