/**
 * A revision pack: what a chapter becomes when the aim is marks.
 *
 * The research this is built on, in one paragraph. Dunlosky, Rawson, Marsh,
 * Nathan & Willingham (2013, *Psychological Science in the Public Interest*)
 * reviewed ten study techniques against the evidence and rated two as high
 * utility — practice testing and distributed practice — three as moderate
 * — elaborative interrogation ("why is that so?"), self-explanation, and
 * interleaved practice — and rated the five everybody actually does as low:
 * summarising, highlighting, keyword mnemonics, imagery and rereading.
 * Roediger & Karpicke (2006) put a number on the first: a week after one
 * reading, students who were tested retained ~56% against ~42% for those
 * who reread three times, and the rereaders *felt* more confident. Bjork's
 * "desirable difficulties" is the same finding from the other side: what
 * makes revision feel easy makes it not work. Cornell notes (Pauk, 1962)
 * put retrieval into the page itself — a cue column of questions beside the
 * notes, answered with the notes covered. Knowledge organisers, the one-page
 * "everything you must know" sheet that became standard in English secondary
 * schools after 2015, are the same idea for a whole topic. And on marks
 * specifically: examiners' reports say the same thing every year — marks are
 * lost not on the content but on the command word (a *describe* answered
 * with reasons, an *evaluate* answered with a list) and on not knowing what
 * a full-mark answer contains.
 *
 * So a pack is not a summary. It is three pages and a deck, each one a
 * different way of being asked:
 *
 *   1. A knowledge organiser — the topic on one page, ranked, with the terms,
 *      the formulas, the mistakes, and how it is asked.
 *   2. Cornell notes — per section, a cue column of questions beside the
 *      notes and a three-line summary underneath. Cover the right-hand side
 *      and the left is a retrieval sheet.
 *   3. Exam questions with mark schemes — tiered from recall to evaluation,
 *      each with its marks, what earns them, and a model answer.
 *   4. Cards into Study, so the whole thing is asked again on the schedule.
 *
 * Every recipe below says what it must not do as well as what it must,
 * because the failure mode of all of them is a summary wearing a costume.
 */

import { COMMAND_WORDS } from "./exam";

export interface Recipe {
  /** The suffix of the page's title: "<source> — Knowledge organiser". */
  title: string;
  /** What the chip and the history call it. */
  label: string;
  instruction: string;
}

/* The words the three tiers turn on, not the first twelve of the list:
   "evaluate" is the word most marks are lost on and it sits near the end. */
const WANTED = ["define", "state", "name", "give", "describe", "explain", "calculate", "compare", "suggest", "analyse", "evaluate", "assess", "discuss", "justify"];
const COMMANDS = WANTED
  .map((w) => COMMAND_WORDS.find((c) => c.word === w))
  .filter((c): c is NonNullable<typeof c> => Boolean(c))
  .map((c) => `${c.word} (${c.marks})`)
  .join("; ");

export const ORGANISER: Recipe = {
  title: "Knowledge organiser",
  label: "Knowledge organiser",
  instruction: [
    "Write a knowledge organiser for the source: the whole topic on one page, ranked, that a student pins above the desk and can be tested on.",
    "Not a summary, not prose. Every line is a thing that could be asked and marked.",
    "In this order, with these headings:",
    "## Must know — eight to fourteen bullets, ranked most-examined first; each one a fact, definition, number or rule, exact enough to be marked right or wrong.",
    "## Key terms — a two-column table, term | meaning as the source uses it. Twelve at most; leave out words that are only hard and not load-bearing.",
    "## Formulas and rules — every formula with each symbol named underneath, and every if-then rule; write \"None in this source\" if there are none.",
    "## Processes — any sequence, cycle or method as a numbered list of steps, each step one line.",
    "## Common mistakes — five things students reliably get wrong on this topic, each with what to do instead. Use the callout `> [!mistake]` for the single worst one.",
    "## How it is asked — the command words examiners use on this topic and what a full-mark answer to each must contain, using this meaning of the words: " + COMMANDS + ".",
    "## Links — three sentences on how this topic connects to the ones before and after it in the subject.",
    "Use `> [!key]` on at most three lines in the whole page: the ones a student loses most marks for not knowing exactly.",
    "No preamble, no table of contents, nothing you did not get from the source; where the source is unclear, say so.",
  ].join("\n"),
};

export const CORNELL: Recipe = {
  title: "Cornell notes",
  label: "Cornell notes",
  instruction: [
    "Write Cornell notes on the source: notes that carry their own questions, so the page can be revised from by covering the right-hand side.",
    "Split the source into its real sections — the ideas, not the chapter's headings. Six to twelve sections.",
    "For each section, in this exact shape:",
    "### <the idea, as a noun phrase>",
    "A two-column table with the header `Cue | Notes`. In the Cue column, one question per row that the Notes in that row answer — questions that make it possible to be wrong, never ones answered by recognising a word. In the Notes column, the answer in the fewest words that are still complete: numbers, names, the mechanism. Four to eight rows per section.",
    "Then a line beginning **Summary:** — three sentences, in the student's own voice, that say what the section established and why it matters.",
    "After all sections, one final heading `## The whole thing in ten lines` — ten bullets that are the shortest true account of the source.",
    "Every cue must be answerable from the source. Do not write a cue whose answer is the sentence before it. No preamble. Where the source is unclear, say so rather than inventing a resolution.",
  ].join("\n"),
};

export const EXAM: Recipe = {
  title: "Exam questions",
  label: "Exam questions",
  instruction: [
    "Write exam questions on the source, with mark schemes, the way a paper on this topic would ask them.",
    "Twelve questions in three tiers, in this order: four **Recall** (1–2 marks each: define, state, name, give), four **Apply** (3–4 marks: explain, calculate, describe, compare, suggest), four **Evaluate** (6–8 marks: analyse, evaluate, assess, discuss, justify). Use these command words with these meanings: " + COMMANDS + ".",
    "For every question, in this exact shape:",
    "### Q<n>. <the question, with the command word first> [<marks> marks]",
    "**Mark scheme** — one bullet per mark: the point that earns it, in the examiner's words. For evaluate-tier questions, say what separates a middle band from the top band.",
    "**Model answer** — a full-mark answer, written the way a strong student writes under time: the command word obeyed, the marks visibly hit, no padding.",
    "**Where marks are lost** — one line: the mistake most students make on this question.",
    "Every question must be answerable from the source, and no question may have the sentence before it as its answer. Vary the wording so recognising a phrase does not earn a mark. No preamble. Where the source is unclear, say so.",
  ].join("\n"),
};

/** The pack, in the order it is made and read. */
export const PACK: Recipe[] = [ORGANISER, CORNELL, EXAM];

/** The title a pack page gets. */
export function packTitle(source: string, recipe: Recipe): string {
  return `${source} — ${recipe.title}`;
}

/** The source a pack page was made for, read back off its title. */
export function packSourceOf(title: string): string | null {
  const m = /^(.+?) — (Knowledge organiser|Cornell notes|Exam questions)$/.exec(title.trim());
  return m ? m[1] : null;
}

/**
 * The pages that belong to the same pack as this one: the same source in
 * front of the dash, one of the three recipes after it, in recipe order.
 */
export function packOf<T extends { title: string }>(page: T, pages: T[]): T[] {
  const source = packSourceOf(page.title);
  if (!source) return [];
  const mine = pages.filter((p) => packSourceOf(p.title) === source);
  return PACK.map((r) => mine.find((p) => p.title === packTitle(source, r))).filter((p): p is T => Boolean(p));
}

/** A short name for the source a pack is made from: the file, minus its type. */
export function sourceName(files: { name: string }[]): string {
  const first = files[0]?.name ?? "Notes";
  return first.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Notes";
}

/**
 * The whole pack as one file to download or print: a title, how to use it —
 * because a pack used as a summary is a summary — and the pages in order,
 * with the organiser first because it is the one to pin up.
 */
export function packMarkdown(source: string, pages: { title: string; content: string }[]): string {
  const head = [
    `# ${source} — revision pack`,
    "",
    "How to use this, in the order that works:",
    "",
    "1. Read the **knowledge organiser** once. Then cover it and write down everything you can; check; repeat until nothing is missing.",
    "2. Work the **Cornell notes** with the right-hand column covered: answer every cue out loud or on paper, then uncover and mark yourself.",
    "3. Do the **exam questions** under time, in full sentences, before reading the mark schemes. Mark yourself against the scheme, not against how it felt.",
    "4. Come back to the cards in Study when they come due. The gap is the point — what you retrieve after nearly forgetting is what stays.",
    "",
    "Reading this again is the one thing that does not work. Being asked is what works.",
    "",
  ].join("\n");
  const body = pages.map((p) => `\n---\n\n# ${p.title}\n\n${p.content.trim()}\n`).join("");
  return head + body;
}
