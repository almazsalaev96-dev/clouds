/**
 * The Studio: every tool a student uses to turn material into marks, in
 * one registry, so the same tool behaves the same wherever it is opened —
 * from a book dropped into the Notebook, a page, a course topic, a chat.
 *
 * Save My Exams sells notes, exam questions, a marker, mocks and
 * flashcards; NotebookLM's Studio turns sources into a study guide, a mind
 * map, a quiz, flashcards and an audio overview. Both are right about the
 * outputs. What neither does is hold every output to a written standard
 * and check it against that standard before the student sees it, which is
 * what `standard` and `checkPrompt` are for: the professional bar for each
 * kind of thing, stated once, used to write it and then to judge it.
 *
 * Pure: prompts and parsers. The calls live in the component.
 */

import { COMMAND_WORDS } from "./exam";
import { CORNELL, EXAM, LESSON, ORGANISER } from "./revision";
import { STANDARDS, type ToolId } from "./standards";

/* ------------------------------------------------------- house rules -- */

/**
 * The rules every tool here writes under. Drawn from what the learning
 * sciences agree on (retrieval, spacing, worked examples, dual coding,
 * concrete examples) and from what the exam boards publish about marking.
 * Short on purpose: a rule the model has to hold alongside a source must
 * be one it can hold.
 */
export const HOUSE_RULES = [
  "You are making study material for a student. These rules hold for everything you write:",
  "1. Correct first. Only what is true at this level; where the source is wrong, unclear or out of date, say so plainly instead of repeating it.",
  "2. Aimed at the exam. Use the subject's own terms and the exam board's wording; bold the words a mark scheme looks for.",
  "3. From the source. When a source is given, everything comes from it or is marked as added; never invent quotations, page numbers, statistics or board codes.",
  "4. Made to be recalled, not reread. Prefer questions, cues and steps to paragraphs; every section should give the student something to test themselves on.",
  "5. Concrete and light to carry. Every abstract idea gets an example; every method gets a worked example with the reason for each step; a diagram where a structure or process is easier seen than read; short chunks, one idea at a time.",
  "6. Honest about level. Pitch it at the level given; if none is given, at school exam level, and say what you assumed in one line at the top.",
  "7. Complete and clean. No preamble, no filler, no placeholders, no 'as an AI'. Headings, tables and lists in Markdown.",
  "8. The student's language. Write in the language the source is written in, or the student's, keeping names, symbols and quoted terms exact.",
].join("\n");

/* -------------------------------------------------------------- tools -- */

export type { ToolId } from "./standards";

export type ToolKind =
  /** A Notebook page. */
  | "page"
  /** Cards into a deck. */
  | "cards"
  /** A paper to sit and have marked. */
  | "paper"
  /** Not made from a source: a form. */
  | "form";

export interface Tool {
  id: ToolId;
  name: string;
  /** One line under the name. */
  blurb: string;
  kind: ToolKind;
  /** The bar a professional version clears; used to write it and to check it. */
  standard: string[];
  /** The writing instruction, for page tools. */
  instruction?: string;
}

const COMMANDS = ["define", "state", "describe", "explain", "calculate", "compare", "evaluate", "justify"]
  .map((w) => COMMAND_WORDS.find((c) => c.word === w))
  .filter((c): c is NonNullable<typeof c> => Boolean(c))
  .map((c) => `${c.word} (${c.marks})`)
  .join("; ");

export const TOOLS: Tool[] = [
  {
    id: "notes",
    name: "Revision notes",
    blurb: "Topic by topic, the key points a mark scheme looks for, worked examples and examiner tips",
    kind: "page",
    standard: STANDARDS.notes.standard,
    instruction: [
      "Write revision notes on the source, the kind a student reads the night before and comes away able to score full marks.",
      "One `##` heading per topic, in the order of the source. Under each:",
      "- **Key points**: numbered, short, exact; bold the words a mark scheme looks for.",
      "- **Key terms**: a table, term | meaning, in the subject's own wording (only where the topic has terms).",
      "- **Worked example**: where the topic has a method or calculation, one example with every step and the reason for it.",
      "- **Common mistakes**: two or three, each with the fix. Use `> [!mistake]` for the worst one in the whole page.",
      "- **Examiner tip**: one or two lines on how the marks are awarded here.",
      "Use a Mermaid diagram (```mermaid) where a process, cycle or structure is easier seen than read, at most three in the page.",
      "End with `## Test yourself`: eight questions across the topics, then `## Answers` with each answer in one or two lines.",
    ].join("\n"),
  },
  {
    id: "guide",
    name: "Study guide",
    blurb: "An outline, a short quiz with its answers, essay questions and a glossary",
    kind: "page",
    standard: STANDARDS.guide.standard,
    instruction: [
      "Write a study guide for the source.",
      "`## Outline` — the source's argument or content as a nested outline, in its own order.",
      "`## Quiz` — ten short-answer questions across the whole source, then `## Answer key` with each answer in one or two sentences.",
      "`## Essay questions` — three to five extended questions that need the whole source to answer well, each with one line on what a strong answer would argue.",
      "`## Glossary` — a table, term | meaning, of the key terms.",
    ].join("\n"),
  },
  {
    id: "organiser",
    name: "Knowledge organiser",
    blurb: "The whole topic on one page: must-knows, terms, formulas, processes, how it is asked",
    kind: "page",
    standard: STANDARDS.organiser.standard,
    instruction: ORGANISER.instruction,
  },
  {
    id: "cornell",
    name: "Cornell notes",
    blurb: "Notes with their own questions: cover the right side and test yourself",
    kind: "page",
    standard: STANDARDS.cornell.standard,
    instruction: CORNELL.instruction,
  },
  {
    id: "flashcards",
    name: "Flashcards",
    blurb: "One fact a card, asked again on a schedule until it sticks",
    kind: "cards",
    standard: STANDARDS.flashcards.standard,
  },
  {
    id: "quiz",
    name: "Quiz",
    blurb: "Multiple choice with an explanation for every option, marked as you go",
    kind: "paper",
    standard: STANDARDS.quiz.standard,
  },
  {
    id: "paper",
    name: "Exam paper",
    blurb: "A timed paper in the board's style with a full mark scheme, sat here and marked",
    kind: "paper",
    standard: STANDARDS.paper.standard,
  },
  {
    id: "questions",
    name: "Exam questions",
    blurb: "Twelve questions in three tiers, each with a mark scheme, model answer and where marks are lost",
    kind: "page",
    standard: STANDARDS.questions.standard,
    instruction: EXAM.instruction,
  },
  {
    id: "mindmap",
    name: "Mind map",
    blurb: "The topic as a map of branches, drawn",
    kind: "page",
    standard: STANDARDS.mindmap.standard,
    instruction: [
      "Draw a mind map of the source as a Mermaid mindmap, then explain it.",
      "First a ```mermaid block starting with `mindmap`, the root as `root((<topic>))`, four to eight main branches and two to five short leaves on each; leaves are phrases of one to five words. Use only plain words in node text: no brackets, colons or quotes inside a node.",
      "Then `## Reading the map`: one short paragraph per main branch saying how its leaves connect and how it links to the other branches.",
      "Then `## Test yourself`: five questions that need two branches to answer, with answers under `## Answers`.",
    ].join("\n"),
  },
  {
    id: "glossary",
    name: "Glossary",
    blurb: "Every key term, defined the way the mark scheme wants it",
    kind: "page",
    standard: STANDARDS.glossary.standard,
    instruction: [
      "Write a glossary of the source's key terms.",
      "A table with the header `Term | Definition | Example or use`, alphabetical, every term a student could be asked to define or use, and no words that are only hard without being load-bearing.",
      "Definitions exact enough to earn the mark, in the subject's own wording; examples one line.",
      "Then `## Often confused`: pairs of terms students mix up, each with the one-line difference.",
    ].join("\n"),
  },
  {
    id: "timeline",
    name: "Timeline",
    blurb: "What happened when, and why it mattered",
    kind: "page",
    standard: STANDARDS.timeline.standard,
    instruction: [
      "Write a timeline of the source: every dated event, period or stage, in order.",
      "A table with the header `When | What happened | Why it mattered`. Use only dates the source gives or that are certain; where the order is known but not the date, say so.",
      "Then `## Turning points`: the three moments that changed most, with the reason for each.",
      "If the source has no chronology, make it a sequence of stages instead and say so in one line.",
    ].join("\n"),
  },
  {
    id: "summary",
    name: "Summary",
    blurb: "The shortest true account of it: the argument, the evidence, what it leaves out",
    kind: "page",
    standard: STANDARDS.summary.standard,
    instruction: [
      "Write a briefing on the source for a student who has not read it.",
      "`## In one paragraph` — the whole thing, five sentences at most.",
      "`## The main points` — numbered, in the source's order, each with the evidence or example the source gives.",
      "`## What to remember` — five bullets.",
      "`## What it does not cover` — one or two lines, so the student knows where to look next.",
    ].join("\n"),
  },
  {
    id: "worked",
    name: "Worked examples",
    blurb: "Problems solved step by step, then ones to try with answers",
    kind: "page",
    standard: STANDARDS.worked.standard,
    instruction: [
      "Write worked examples on the methods in the source.",
      "For each method (up to five): `## <method>`, then one example set out as `**Question**`, numbered steps each with the reason for the step, and `**Answer**` with units; then `**Your turn**`: a similar problem.",
      "Finish with `## Answers to Your turn`, with the working in two to four lines each.",
      "If the source has no methods or calculations, write worked model paragraphs for its typical questions instead, and say so in one line.",
    ].join("\n"),
  },
  {
    id: "essay",
    name: "Essay plan",
    blurb: "A thesis, paragraph by paragraph, with the evidence and the counter-argument",
    kind: "page",
    standard: STANDARDS.essay.standard,
    instruction: [
      "Write an essay plan on the source, for the essay question it most invites (state the question you chose at the top as `**Question:**`).",
      "`## Thesis` — one or two sentences that answer the question and could be argued with.",
      "`## Paragraphs` — four to six, each as: **Point** (one sentence), **Evidence** (quotation or fact from the source, exact), **Analysis** (how it proves the point), **Link** (back to the thesis).",
      "`## Counter-argument` — the strongest objection and how to answer it.",
      "`## Conclusion` — the judgement, in three sentences.",
      "`## What gets the top band` — three lines on what examiners reward in this kind of essay.",
    ].join("\n"),
  },
  {
    id: "model",
    name: "Model answers",
    blurb: "One question answered at three levels, with what the examiner would say about each",
    kind: "page",
    standard: STANDARDS.model.standard,
    instruction: [
      "Write model answers for the source: choose the extended exam question it most invites, with its marks (state it as `## The question`).",
      "Then three answers under `## A weak answer`, `## A middle answer`, `## A top-band answer`, each written the way a real student at that level writes under time, each followed by `**Examiner:**` — the mark it would get and the exact reasons, what it did and what it missed.",
      "Finish with `## What moved it up` — the three changes that take an answer from the middle to the top, as bullets.",
      "The command words mean: " + COMMANDS + ".",
    ].join("\n"),
  },
  {
    id: "lesson",
    name: "Lesson",
    blurb: "The hour a good teacher would give: objectives, the idea, a worked example, practice",
    kind: "page",
    standard: STANDARDS.lesson.standard,
    instruction: LESSON.instruction,
  },
  {
    id: "plan",
    name: "Revision plan",
    blurb: "Day by day to the exam, with spacing and practice built in",
    kind: "page",
    standard: STANDARDS.plan.standard,
    instruction: [
      "Write a revision plan for the topics in the source, up to the exam date if one is given (otherwise for four weeks).",
      "A table with the header `Day | Topic | What to do | Time`, sessions of 25 to 45 minutes. Every topic appears at least twice, spaced further apart each time. Every session is active: flashcards, exam questions, explaining from memory, a timed question — never 'reread'. Weaker or harder topics come earlier and more often. The last few days are mixed past-paper practice under time.",
      "Then `## How to use it` — five lines on spacing, retrieval, interleaving and what to do after a bad session.",
    ].join("\n"),
  },
  {
    id: "listen",
    name: "Listen",
    blurb: "An explainer written to be heard, read aloud to you",
    kind: "page",
    standard: STANDARDS.listen.standard,
    instruction: [
      "Write a spoken explainer of the source, about six minutes read aloud, as one teacher talking to one student.",
      "Written for the ear: short sentences, signposts ('first', 'the key thing is', 'so'), numbers said in words where that is clearer, no tables, no symbols that cannot be read aloud, no Markdown except `##` headings between parts.",
      "Cover the main ideas in order, each with one concrete example. End with `## Say it back`: three questions to answer out loud, then their answers.",
    ].join("\n"),
  },
  {
    id: "checker",
    name: "Answer checker",
    blurb: "Paste a question and your answer, or a photo, and have it marked point by point",
    kind: "form",
    standard: STANDARDS.checker.standard,
  },
];

export const toolById = (id: ToolId): Tool => TOOLS.find((t) => t.id === id) ?? TOOLS[0];
export const PAGE_TOOLS = TOOLS.filter((t) => t.kind === "page").map((t) => t.id);

/* ------------------------------------------------------- the intake -- */

export type SourceKind = "textbook" | "notes" | "novel" | "article" | "paper" | "slides" | "other";

export interface Reading {
  title: string;
  subject: string;
  /** What level it reads as, where that can be told. */
  level: string;
  kind: SourceKind;
  topics: string[];
  /** Tools worth making from it, best first. */
  recommend: ToolId[];
  /** Two sentences on what it is, for the student to confirm. */
  about: string;
}

export function readingPrompt(excerpt: string, name: string): string {
  return `A student has given you this to study from. Read it and say what it is, so they can choose what to make from it.

Name: ${name}

Return JSON only, no prose and no fence:
{"title":"…","subject":"…","level":"…","kind":"textbook|notes|novel|article|paper|slides|other","topics":["…"],"recommend":["…"],"about":"…"}

- "title": what it is, in a few words (a chapter title, the book, the topic).
- "subject": the school or university subject.
- "level": the level it is written at, if it can be told (GCSE, A level, IB, university year 1…), else "".
- "kind": textbook chapter, the student's own notes, a novel or play, an article, a past paper, lecture slides, or other.
- "topics": the three to twelve topics it covers, in order, as short noun phrases.
- "recommend": three to five tool ids, best first, from: ${TOOLS.filter((t) => t.id !== "checker").map((t) => t.id).join(", ")}. A textbook chapter suits notes, flashcards, paper, organiser; a novel or play suits summary, timeline, essay, model, glossary; maths and science methods suit worked; a past paper suits model and quiz.
- "about": two sentences on what it covers and who it is for.

THE MATERIAL (the start of it, or a reading of the whole)
${excerpt.slice(0, 24_000)}`;
}

const KINDS: SourceKind[] = ["textbook", "notes", "novel", "article", "paper", "slides", "other"];

export function parseReading(raw: unknown, name: string): Reading {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const ids = new Set(TOOLS.map((t) => t.id));
  const recommend = (Array.isArray(o.recommend) ? o.recommend : [])
    .map((x) => s(x, 20) as ToolId)
    .filter((x) => ids.has(x) && x !== "checker");
  const kind = KINDS.includes(s(o.kind, 20) as SourceKind) ? (s(o.kind, 20) as SourceKind) : "other";
  return {
    title: s(o.title) || name.replace(/\.[a-z0-9]+$/i, ""),
    subject: s(o.subject, 80),
    level: s(o.level, 60),
    kind,
    topics: (Array.isArray(o.topics) ? o.topics : []).map((t) => s(t, 120)).filter(Boolean).slice(0, 16),
    recommend: [...new Set(recommend.length ? recommend : defaultsFor(kind))].slice(0, 5),
    about: s(o.about, 500),
  };
}

/** What to offer when the reading gave no view of its own. */
export function defaultsFor(kind: SourceKind): ToolId[] {
  switch (kind) {
    case "novel": return ["summary", "timeline", "essay", "glossary"];
    case "paper": return ["model", "quiz", "notes"];
    case "article": return ["summary", "flashcards", "questions"];
    default: return ["notes", "flashcards", "paper", "organiser"];
  }
}

/* ------------------------------------------------------ the brief -- */

export interface Brief {
  /** What it is, for titles. */
  title: string;
  subject?: string;
  level?: string;
  board?: string;
  /** "exam", "understand", "teach", "quick" — what it is for. */
  purpose?: string;
  /** The exam date, for a plan. */
  examAt?: number;
  /** Topics to concentrate on, from the reading. */
  focus?: string[];
  difficulty?: "easy" | "standard" | "hard";
  /** Anything the student added. */
  extra?: string;
}

const PURPOSE: Record<string, string> = {
  exam: "They are revising for an exam: aim everything at the marks.",
  understand: "They want to understand it properly, not only pass: explain the why, with examples.",
  teach: "They will teach or present it: make it clear enough to explain to others.",
  quick: "They have little time: keep it to what matters most.",
};

export function briefLines(b: Brief, now = Date.now()): string {
  const lines = [
    b.subject ? `Subject: ${b.subject}` : "",
    b.level ? `Level: ${b.level}` : "",
    b.board ? `Exam board: ${b.board} — use its specification's wording and question style` : "",
    b.purpose && PURPOSE[b.purpose] ? PURPOSE[b.purpose] : "",
    b.examAt ? `The exam is on ${new Date(b.examAt).toDateString()} (${Math.max(0, Math.ceil((b.examAt - now) / 86_400_000))} days away).` : "",
    b.focus?.length ? `Focus on: ${b.focus.join(", ")} (the rest only as far as it is needed)` : "",
    b.difficulty ? `Difficulty: ${b.difficulty === "easy" ? "foundation — recall and simple application" : b.difficulty === "hard" ? "the hardest the exam sets — multi-step, unfamiliar contexts" : "the standard the exam sets"}` : "",
    b.extra?.trim() ? `The student adds: ${b.extra.trim().slice(0, 600)}` : "",
  ].filter(Boolean);
  return lines.length ? `ABOUT THE STUDENT\n${lines.join("\n")}` : "";
}

/** The whole prompt for a page tool. */
export function pagePrompt(tool: Tool, brief: Brief, source: string, sourceName: string): string {
  return [
    HOUSE_RULES,
    "",
    `THE TASK: ${tool.name}`,
    tool.instruction ?? "",
    "",
    "THE STANDARD it will be checked against before the student sees it:",
    ...tool.standard.map((s, i) => `${i + 1}. ${s}`),
    "",
    briefLines(brief),
    "",
    `THE SOURCE: ${sourceName}`,
    source.slice(0, 120_000),
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

/* ----------------------------------------------------- the check -- */

export interface Check {
  verdict: "meets" | "short";
  /** Which standard lines it falls short of. */
  missing: string[];
  /** What to change, briefly. */
  fix: string;
}

/**
 * The check: a second reading against the standard, before the student
 * sees it. The same loop Craft runs on a chat answer, applied to every
 * made thing — once, because the second round of a refine loop is where
 * the gains stop.
 */
export function checkPrompt(tool: Tool, brief: Brief, output: string, sourceExcerpt: string): string {
  return `Check this ${tool.name.toLowerCase()} against its standard and the source, as a strict head of department would before giving it to a student.

THE STANDARD
${tool.standard.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${briefLines(brief)}

Return JSON only, no prose and no fence:
{"verdict":"meets|short","missing":["…"],"fix":"…"}

- "short" if any line of the standard is not met, or anything is factually wrong, invented, or at the wrong level. Otherwise "meets".
- "missing": the standard lines it misses and any errors, each in a few words, quoting the wrong line where there is one.
- "fix": at most three sentences on exactly what to change.

THE SOURCE (the start of it)
${sourceExcerpt.slice(0, 12_000)}

WHAT WAS WRITTEN
${output.slice(0, 40_000)}`;
}

export function parseCheck(raw: unknown): Check | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const verdict = o.verdict === "short" ? "short" : o.verdict === "meets" ? "meets" : null;
  if (!verdict) return null;
  const missing = (Array.isArray(o.missing) ? o.missing : []).map((m) => (typeof m === "string" ? m.trim().slice(0, 300) : "")).filter(Boolean).slice(0, 8);
  return { verdict, missing, fix: typeof o.fix === "string" ? o.fix.trim().slice(0, 800) : "" };
}

export function fixPrompt(tool: Tool, brief: Brief, output: string, check: Check, source: string, sourceName: string): string {
  return `${pagePrompt(tool, brief, source, sourceName)}

A FIRST VERSION was written and checked. It fell short:
${check.missing.map((m) => `- ${m}`).join("\n")}
${check.fix ? `What to change: ${check.fix}` : ""}

Write the whole ${tool.name.toLowerCase()} again, fixing exactly that and keeping everything that was right. Return only the finished page.

THE FIRST VERSION
${output.slice(0, 40_000)}`;
}

/** The line a checked page carries at its foot. */
export function checkedLine(tool: Tool, check: Check | null, fixed: boolean): string {
  if (!check) return "";
  const n = tool.standard.length;
  return fixed
    ? `\n\n---\n*Checked against the standard for ${tool.name.toLowerCase()} (${n} points) by a second model, and rewritten where it fell short.*`
    : check.verdict === "meets"
      ? `\n\n---\n*Checked against the standard for ${tool.name.toLowerCase()} (${n} points) by a second model: meets it.*`
      : "";
}

/* ------------------------------------------------------ papers -- */

export interface PaperQuestion {
  question: string;
  marks: number;
  scheme: string[];
  model: string;
  tip: string;
  /** Multiple choice: the options, and the index of the right one. */
  options?: string[];
  answer?: number;
  /** Why each option is right or wrong. */
  why?: string[];
  topic?: string;
}

export function paperPrompt(brief: Brief, source: string, sourceName: string, minutes: number): string {
  const total = Math.max(10, Math.round(minutes));
  return `${HOUSE_RULES}

THE TASK: an exam paper on the source, the way the board would set it.
Time: ${minutes} minutes. Total: about ${total} marks.

${briefLines(brief)}

Return JSON only, no prose and no fence:
{"questions":[{"topic":"…","question":"…","marks":N,"scheme":["…"],"model":"…","tip":"…"}]}

Rules:
- 6 to 14 questions across the whole source, easier first, ending with at least one extended question.
- "question": worded like the real paper, command word first, with any data it needs, and the marks in square brackets at the end, like [4].
- "scheme": one line per mark, each the specific point that earns it, the way boards write them: alternatives after a slash, "allow …" for acceptable variants, "ignore …" for what does not cost the mark, "do not accept …" for near-misses, "ecf" where an earlier error is carried forward. For an extended question, one line per level (the level, its mark range and what it needs), then a line starting "Indicative content:"; "marks" is the top of the top level.
- "model": a full-mark answer. "tip": one sentence on what students most often get wrong. "topic": the topic it tests, in a few words.
- The marks add up to about ${total}.

THE SOURCE: ${sourceName}
${source.slice(0, 100_000)}`;
}

export function quizPrompt(brief: Brief, source: string, sourceName: string, count = 12): string {
  return `${HOUSE_RULES}

THE TASK: a multiple-choice quiz on the source.

${briefLines(brief)}

Return JSON only, no prose and no fence:
{"questions":[{"topic":"…","question":"…","options":["…","…","…","…"],"answer":N,"why":["…","…","…","…"]}]}

Rules:
- ${count} questions across the whole source, easier first.
- Four options each; exactly one correct; "answer" is its index from 0.
- Wrong options are built from real misconceptions, never silly, and about the same length as the right one.
- "why": one line per option saying why it is right or wrong.
- Never give the answer away in the question. Vary where the right answer sits.

THE SOURCE: ${sourceName}
${source.slice(0, 100_000)}`;
}

export function parsePaper(raw: unknown): PaperQuestion[] | null {
  const o = raw as { questions?: unknown } | unknown[] | null;
  const list = Array.isArray(o) ? o : Array.isArray((o as { questions?: unknown })?.questions) ? (o as { questions: unknown[] }).questions : null;
  if (!list) return null;
  const s = (v: unknown, max = 3000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out: PaperQuestion[] = [];
  for (const item of list.slice(0, 30)) {
    const q = item as Record<string, unknown>;
    const question = s(q?.question);
    if (!question) continue;
    const options = Array.isArray(q.options) ? q.options.map((x) => s(x, 400)).filter(Boolean) : [];
    if (options.length >= 2) {
      const answer = Number(q.answer);
      if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
      const why = Array.isArray(q.why) ? q.why.map((x) => s(x, 400)) : [];
      out.push({ question, marks: 1, scheme: [options[answer]], model: options[answer], tip: why[answer] ?? "", options, answer, why, topic: s(q.topic, 120) || undefined });
      continue;
    }
    const scheme = Array.isArray(q.scheme) ? q.scheme.map((x) => s(x, 600)).filter(Boolean) : [];
    if (!scheme.length) continue;
    const said = Number(q.marks);
    const marks = Number.isFinite(said) && said >= 1 && said <= 40 ? Math.round(said) : scheme.length;
    out.push({ question, marks, scheme, model: s(q.model, 4000), tip: s(q.tip, 600), topic: s(q.topic, 120) || undefined });
  }
  return out.length ? out : null;
}

/** A paper as a printable page: the questions, then the mark scheme on its own. */
export function paperMarkdown(title: string, qs: PaperQuestion[], minutes: number): string {
  const total = qs.reduce((s, q) => s + q.marks, 0);
  const lines = [`**Time:** ${minutes} minutes · **Total:** ${total} marks`, "", "## Questions", ""];
  qs.forEach((q, i) => {
    lines.push(`**${i + 1}.** ${q.question}`);
    if (q.options) q.options.forEach((o, j) => lines.push(`   ${String.fromCharCode(65 + j)}. ${o}`));
    lines.push("");
  });
  lines.push("---", "", "## Mark scheme", "");
  qs.forEach((q, i) => {
    lines.push(`**${i + 1}.** [${q.marks}]`);
    if (q.options && q.answer !== undefined) lines.push(`- ${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}${q.why?.[q.answer] ? ` — ${q.why[q.answer]}` : ""}`);
    else q.scheme.forEach((s) => lines.push(`- ${s}`));
    if (q.tip) lines.push(`- *Examiner tip:* ${q.tip}`);
    lines.push("");
  });
  return `# ${title}\n\n${lines.join("\n")}`;
}

/* --------------------------------------------------- the checker -- */

/** A mark scheme for a question the student brought without one. */
export function schemePrompt(brief: Brief, question: string, marks: number): string {
  return `Write the mark scheme for this exam question, as the exam board would.

${briefLines(brief)}

QUESTION [${marks} mark${marks === 1 ? "" : "s"}]
${question}

Return JSON only, no prose and no fence:
{"scheme":["…"],"model":"…","tip":"…"}

- "scheme": one line per mark (${marks} lines), each the specific point that earns it, with accepted alternatives after a slash. For a levels-of-response question, one line per level instead.
- "model": a full-mark answer. "tip": one sentence on what students most often get wrong.`;
}

export function parseScheme(raw: unknown): { scheme: string[]; model: string; tip: string } | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.scheme)) return null;
  const scheme = o.scheme.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 30);
  if (!scheme.length) return null;
  return { scheme, model: typeof o.model === "string" ? o.model.trim() : "", tip: typeof o.tip === "string" ? o.tip.trim() : "" };
}

/** A pasted mark scheme, one point a line, bullets and numbers stripped. */
export function schemeFromText(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\(\w\))\s*/, "").trim())
    .filter((l) => l.length > 1)
    .slice(0, 30);
}

export { toolForAsk } from "./standards";
