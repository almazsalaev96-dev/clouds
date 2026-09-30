/**
 * Which part of a long book.
 *
 * A student who drops a 400-page textbook in and asks about osmosis does not
 * want the whole book read first: that is forty-eight calls and minutes of
 * waiting to answer a question about twelve pages. So a long text is first
 * given an outline — its chapters, found in the text itself, with the pages
 * they cover — and the person is asked which part they need; or, when the
 * question is already there, the parts that bear on it are found for them.
 * Reading the whole book stays one press away for when that is the job.
 *
 * Everything here is pure and local: no model, no network. The outline comes
 * from the headings a book already has ("Chapter 3", "Unit 4", "2.1 Cells",
 * "# Heading", a PDF's page markers); a book with none is cut into even
 * parts named by their pages, so there is always something to choose.
 */
import { chunk, rank } from "./retrieve";

/** Over this, reading the whole thing takes several calls; ask first. */
export const LONG = 120_000;

export interface Section {
  id: string;
  title: string;
  start: number;
  end: number;
  /** First and last page, where the text carries PDF page markers. */
  from?: number;
  to?: number;
}

const PAGE = /^--- page (\d+) ---$/gm;

/** Page starts, in order: [offset, page number]. */
function pageMarks(text: string): [number, number][] {
  const out: [number, number][] = [];
  PAGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAGE.exec(text))) out.push([m.index, Number(m[1])]);
  return out;
}

/** The page an offset falls on, or undefined when the text has no pages. */
function pageAt(marks: [number, number][], at: number): number | undefined {
  if (!marks.length) return undefined;
  let lo = 0;
  let hi = marks.length - 1;
  let best = marks[0][1];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid][0] <= at) { best = marks[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

export function pageCount(text: string): number | undefined {
  const marks = pageMarks(text);
  return marks.length ? marks[marks.length - 1][1] : undefined;
}

/* A heading is a short line that names a part of a book. Three strengths:
   a word like "Chapter" (in English, Russian and Kazakh) is strongest, a
   Markdown heading next, a numbered one like "2.1 Cell membranes" last. */
const WORD = /^(?:chapter|unit|part|section|topic|module|lecture|lesson|week|book|глава|раздел|тема|часть|урок|лекция|бөлім|тарау|тақырып|сабақ)(?=[\s\d.:])\s*[\divxlcIVXLC]*[.:)\-–—]?\s*\S/iu;
const MD = /^#{1,3}\s+\S/;
const NUMBERED = /^(\d{1,2})(?:\.(\d{1,2}))?\.?\s+[A-ZА-ЯЁӘІҢҒҮҰҚӨҺ]/;

/* A PDF's own bookmark, written into the text by lib/pdf.ts. */
const BOOKMARK = /^--- chapter: (.+) ---$/;

function strength(line: string): number {
  if (BOOKMARK.test(line)) return 4;
  if (line.length > 90 || line.length < 3) return 0;
  /* A table of contents line: dot leaders, or a title ending in a page number. */
  if (/\.{3,}|…{2,}|\s\d{1,4}$/.test(line) && !MD.test(line)) return 0;
  if (WORD.test(line)) return 3;
  if (MD.test(line)) return 2;
  const n = NUMBERED.exec(line);
  if (n && !/[.:;,]$/.test(line) && line.split(/\s+/).length <= 12) return n[2] ? 1 : 1.5;
  return 0;
}

const clean = (line: string) => (BOOKMARK.exec(line)?.[1] ?? line).replace(/^#{1,3}\s+/, "").replace(/\s+/g, " ").trim();

/**
 * The parts of a long text, in order. Headings of the strongest kind the
 * book uses often enough (two or more) mark the parts; a part too small to
 * be a chapter is folded into the one before; a book with no headings is cut
 * into even parts. Never more than `max` parts.
 */
export function outlineOf(text: string, max = 60): Section[] {
  const marks = pageMarks(text);
  const lines: { at: number; line: string; s: number }[] = [];
  let at = 0;
  /* A heading right under a page marker starts with that page, not one
     line into it — or each chapter would end a page late. */
  let pageLine = -1;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const s = strength(line);
    if (s) lines.push({ at: pageLine >= 0 ? pageLine : at, line: clean(line), s });
    if (/^--- page \d+ ---$/.test(line)) pageLine = at;
    else if (line && !BOOKMARK.test(line)) pageLine = -1;
    at += raw.length + 1;
  }
  /* The strongest kind the book uses at least twice; a lone "Chapter" in a
     preface is not an outline. Numbered sub-sections (2.1) only when there
     is nothing coarser. */
  let heads: typeof lines = [];
  for (const level of [4, 3, 2, 1.5, 1]) {
    const these = lines.filter((l) => l.s >= level);
    if (these.length >= 2) { heads = these; break; }
  }
  const minSize = Math.max(1_500, Math.floor(text.length / (max * 3)));
  let parts: Section[] = [];
  if (heads.length >= 2) {
    const starts = heads.map((h) => ({ at: h.at, title: h.line }));
    if (starts[0].at > minSize) starts.unshift({ at: 0, title: "Opening pages" });
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1].at : text.length;
      parts.push({ id: "", title: starts[i].title, start: starts[i].at, end });
    }
    /* Fold parts too small to be one: a contents page listing the chapters
       as headings, a heading followed at once by the next. The same title
       seen again later means the first was the contents; keep the later. */
    const merged: Section[] = [];
    for (const p of parts) {
      const prev = merged[merged.length - 1];
      if (prev && prev.end - prev.start < minSize) {
        const later = parts.some((q) => q.start > prev.start && q.title.toLowerCase() === prev.title.toLowerCase());
        merged[merged.length - 1] = later ? { ...p, start: prev.start } : { ...prev, end: p.end };
      } else merged.push({ ...p });
    }
    parts = merged;
  }
  if (parts.length < 2 || parts.length > max) {
    /* Even parts, each a comfortable read, named by its pages. */
    const n = Math.min(max, Math.max(2, Math.ceil(text.length / 60_000)));
    const size = Math.ceil(text.length / n);
    parts = Array.from({ length: n }, (_, i) => ({ id: "", title: "", start: i * size, end: Math.min(text.length, (i + 1) * size) }));
    parts = parts.map((p, i) => {
      const from = pageAt(marks, p.start);
      const to = pageAt(marks, Math.max(p.start, p.end - 1));
      return { ...p, title: from !== undefined ? `Pages ${from}–${to}` : `Part ${i + 1} of ${n}` };
    });
  }
  return parts.map((p, i) => ({
    ...p,
    id: `s${i}`,
    title: p.title.slice(0, 80),
    from: pageAt(marks, p.start),
    to: pageAt(marks, Math.max(p.start, p.end - 1)),
  }));
}

export function pagesLabel(s: Pick<Section, "from" | "to">): string {
  if (s.from === undefined) return "";
  return s.to !== undefined && s.to !== s.from ? `pp. ${s.from}–${s.to}` : `p. ${s.from}`;
}

/**
 * Which parts a topic is about: each part scored by how well its paragraphs
 * match (BM25), plus its title, best first. Parts that do not mention the
 * topic at all are left out.
 */
export function matchTopic(text: string, sections: Section[], topic: string, limit = 6): Section[] {
  const q = topic.trim();
  if (!q) return [];
  const chunks = sections.flatMap((s) => chunk(s.id, text.slice(s.start, s.end), 1_500));
  const hits = rank(q, chunks, 40);
  const score = new Map<string, number>();
  for (const h of hits) score.set(h.source, (score.get(h.source) ?? 0) + h.score);
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  for (const s of sections) {
    const t = s.title.toLowerCase();
    if (words.some((w) => t.includes(w))) score.set(s.id, (score.get(s.id) ?? 0) + 10);
  }
  return sections
    .filter((s) => (score.get(s.id) ?? 0) > 0)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, limit);
}

/**
 * The chosen parts as one text, in book order, with where each came from —
 * so the model can say "page 41" and the reader knows it was not the whole.
 */
export function pick(text: string, sections: Section[], name: string, total?: number): string {
  const inOrder = [...sections].sort((a, b) => a.start - b.start);
  const where = inOrder.map((s) => `${s.title}${pagesLabel(s) ? ` (${pagesLabel(s)})` : ""}`).join("; ");
  const of = total ? ` of ${total} pages` : "";
  return `[Only part of ${name}${of} is given here, as the reader chose: ${where}.]\n\n${inOrder.map((s) => text.slice(s.start, s.end).trim()).join("\n\n[…]\n\n")}`;
}

/** A short name for what was chosen, for a chip. */
export function chosenLabel(sections: Section[]): string {
  if (!sections.length) return "";
  const s = [...sections].sort((a, b) => a.start - b.start);
  const pages = s[0].from !== undefined ? ` · ${pagesLabel({ from: s[0].from, to: s[s.length - 1].to })}` : "";
  return s.length === 1 ? `${s[0].title}${pages}` : `${s.length} parts${pages}`;
}

/**
 * The passages of a long text that bear on a question, in book order, up
 * to `budget` characters, each marked with its page. What a question about
 * a book needs, found without reading the book: the question is the topic.
 */
export function forQuestion(text: string, name: string, question: string, budget = 60_000): string {
  const marks = pageMarks(text);
  const pieces = chunk(name, text, 1_500);
  const hits = rank(question, pieces, 80);
  const kept: typeof hits = [];
  let used = 0;
  for (const h of hits) {
    if (used + h.text.length > budget) continue;
    kept.push(h);
    used += h.text.length;
  }
  if (!kept.length) return text.slice(0, budget);
  kept.sort((a, b) => a.index - b.index);
  const body = kept
    .map((h) => {
      const at = text.indexOf(h.text.slice(0, 80));
      const p = at >= 0 ? pageAt(marks, at) : undefined;
      return `${p !== undefined ? `[page ${p}] ` : ""}${h.text.replace(/^--- page \d+ ---\s*/gm, "")}`;
    })
    .join("\n\n[…]\n\n");
  return `[The passages of ${name} that bear on the question, found by search; the rest of it is not given.]\n\n${body}`;
}

/**
 * Sources for a question: unchanged when they fit together, and otherwise
 * each long one cut to the passages about the question — so a notebook of
 * three textbooks answers in one call instead of reading all three first.
 * Short sources beside a long one go whole.
 */
export function focusSources<T extends { name: string; text: string }>(sources: T[], question: string, budget = 90_000): { sources: T[]; focused: boolean } {
  const total = sources.reduce((n, s) => n + s.text.length, 0);
  if (total <= LONG) return { sources, focused: false };
  const short = sources.filter((s) => s.text.length <= budget / sources.length);
  const left = Math.max(20_000, budget - short.reduce((n, s) => n + s.text.length, 0));
  const long = sources.length - short.length || 1;
  return {
    sources: sources.map((s) => (short.includes(s) ? s : { ...s, text: forQuestion(s.text, s.name, question, Math.floor(left / long)) })),
    focused: true,
  };
}
