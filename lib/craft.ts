/**
 * Craft: how a bigger task is done, as a team does it.
 *
 * A person asks in a few words for something they picture whole: "make me
 * a website about business revision notes". The words are the brief; the
 * picture is the job. The reference apps answer the words. This stage
 * answers the picture, the way a studio would take the brief:
 *
 *   1. Study the field. Before anything is written, a model studies how the
 *      best makers do exactly this thing — what they include as a matter of
 *      course, how they write, how they lay it out, what they charge and why
 *      that works, what the minimum standard is and what the best add on
 *      top — and writes down the standard this answer will be held to, and
 *      what the person most likely pictured beyond their words. With the web
 *      on, it looks; without, it works from what it knows.
 *   2. Ask, only if it must. Where one open choice would change the whole
 *      deliverable, the study says so and the person is asked, with examples
 *      to pick from. Otherwise the most likely reading is taken and said.
 *   3. Write to the standard. The writer gets the standard as a note, the
 *      way it gets a brief: use what is right, deliver the whole thing.
 *   4. Judge, then improve. A second model reads the answer against the ask
 *      and the standard: did it do all that was asked, is it up to the
 *      standard, is it whole. Short, the writer answers again with the
 *      findings. One round — the second round of a refine loop is where
 *      the gains stop and the bill does not (RESEARCH §7).
 *
 * Not for every message. "Thanks", "shorter", "what is 2+2" go straight
 * to the writer; this runs when the task is more than a normal one — a
 * deliverable is asked for, or the ask is long, or it comes with material.
 * The rule is here, pure, and tested.
 */

import type { TaskKind } from "./task";
import { extractJson } from "./complete";
import { worthChecking } from "./presets";

/** What the study came back with. */
export interface Study {
  /** What is being made, in one line. */
  field: string;
  /** Who does this best and what they get right, 3–5 lines. */
  makers: string[];
  /** The standard the answer is held to: the minimum, and what the best add. */
  standard: string[];
  /** What the person most likely pictured beyond their words. */
  imagined: string;
  /** One choice that would change the deliverable, with examples to pick from. */
  unsure?: { question: string; options: string[] } | null;
  /** Which model studied. */
  modelId: string;
}

/** What the judge said about the answer. */
export interface Judgement {
  verdict: "meets" | "short";
  /** What was asked for or pictured and is not there. */
  missing: string[];
  /** What is there and below the standard. */
  weak: string[];
  /** What to change, in one paragraph, for the writer. */
  fix: string;
  modelId: string;
}

/* ------------------------------------------------------------- the gate -- */

/** Above this many words an ask is a task, whatever its verb. */
export const CRAFT_WORDS = 25;
/** Or it came with material of this size. */
export const CRAFT_TOKENS = 2_000;

/* A deliverable: the verbs of making and the nouns of things made. A big
   thing is a task on its own; a small thing — a set of cards, an email, a
   function — is a normal task unless the ask around it says otherwise. */
const MAKE = /\b(make|build|create|design|write|draft|plan|prepare|produce|put together|set up|develop|compose|generate|come up with|redesign|rewrite|improve|launch)\b/i;
const BIG = /\b(website|web ?site|site|landing page|home ?page|app|application|web page|notes|revision notes|study notes|deck|slides|presentation|essay|report|article|blog|newsletter|letter|cv|résumé|resume|cover letter|proposal|pitch|business plan|plan|strategy|roadmap|timetable|schedule|course|curriculum|lesson|syllabus|guide|handbook|manual|tutorial|worksheet|game|dashboard|tracker|calculator|template|brand|logo|campaign|speech|menu|programme|program|library|api|chatbot|spreadsheet|budget|forecast|analysis|study|survey|portfolio|prospectus|brochure|documentation|readme|specification|spec|policy|contract)s?\b/i;
const SMALL = /\b(flashcards?|cards|quiz|test|exam questions?|email|post|tweet|caption|title|name|poem|story|joke|list|table|summary|function|class|module|component|script|snippet|regex|query|command|paragraph|sentence|line|ad|copy)s?\b/i;
/** Under this many words, a small thing asked for is a normal task. */
export const SMALL_WORDS = 12;
/* This app's own quick tools (lib/actions.ts): a project, an assistant, a
   routine, a memory made in a second by a sentence. Not a deliverable to
   study a field for, however the sentence is built. */
const OWN = /\b(make|create|set ?up|add|schedule|start|open|remember|remind)\b[^.?!]{0,16}\b(project|assistant|routine|reminder|memory|folder)\b/i;
/* A question of fact or a one-liner is not a task, however it is phrased. */
const FACT = /^(what|who|when|where|which|why|how (many|much|old|far|long))\b/i;

/**
 * Whether this ask is more than a normal task.
 *
 * A deliverable asked for by name; or a long ask; or a short ask over a
 * lot of material. Never a follow-up on the last answer, a thanks, a sum,
 * or a question of fact under the length.
 */
export function worthCrafting(ask: string, kind: TaskKind | undefined, size = 0): boolean {
  const t = ask.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (!words) return false;
  /* "Summarise this" over forty pages is two words and a day's work: the
     material is the task, whatever the words are. */
  if (size >= CRAFT_TOKENS && words >= 2 && !/^(thanks|thank you|ok|okay)\b/i.test(t)) return true;
  if (!worthChecking(t)) return false;
  if (kind === "data" && /^\s*[\d\s+\-*/^().,%]+\s*=?\s*\??\s*$/.test(t)) return false;
  if (words >= CRAFT_WORDS) return true;
  if (FACT.test(t) && words < 14) return false;
  if (OWN.test(t)) return false;
  if (!MAKE.test(t)) return false;
  if (BIG.test(t)) return words >= 4;
  return SMALL.test(t) && words >= SMALL_WORDS;
}

/* ------------------------------------------------------------ the study -- */

export const STUDY_HEAD = "Study how the best do this, before anyone writes it.";

/** The prompt for the model that studies the field. */
export function studyPrompt(ask: string, context = "", canSearch = false): string {
  return [
    STUDY_HEAD,
    "",
    "Someone has asked an assistant for the thing below. Before the assistant writes it, your job is to work out what the best in this field do when they make exactly this, and to write down the standard the assistant's answer must meet. You are not writing the thing. You are setting the bar.",
    "",
    canSearch
      ? "Search the web where it helps — the makers people actually use for this, how they do it, what they charge — and work from what you find rather than from memory alone."
      : "Work from what you know of the makers people actually use for this.",
    "",
    "Cover, as it applies to this thing:",
    "- who does this best and what each gets right (products, publishers, schools, studios — whichever fits)",
    "- what every good one includes as a matter of course: the parts, the functions, the structure",
    "- how they write: register, length, the words they use and avoid",
    "- how they look and where things go, where that matters: layout, colour, what is first, what is one press away",
    "- what they charge and the psychology of it, where money is part of it",
    "- the minimum standard nobody serious falls below, and what the best add on top",
    "- what the person most likely pictured beyond their few words: the whole thing they imagine receiving, not the literal sentence",
    "",
    "Only if one open choice would change the whole deliverable — the audience, the country, the exam board, the platform — put it under \"unsure\" with two to four concrete options to pick from. Otherwise take the most likely reading, say it under \"imagined\", and leave \"unsure\" null. Do not ask about anything a good maker would simply decide.",
    "",
    "Answer with JSON and nothing else:",
    "",
    '{"field": "what is being made, in one line",',
    ' "makers": ["Name — what they get right", "..."],',
    ' "standard": ["a thing the answer must have or do", "..."],',
    ' "imagined": "what they most likely picture, in two or three sentences",',
    ' "unsure": null | {"question": "the one thing to settle", "options": ["...", "...", "..."]}}',
    "",
    "Six to twelve lines of standard, each one checkable. Three to five makers. Plain language.",
    "",
    context ? `${context}\n` : "",
    "The ask:",
    "",
    ask.trim(),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const lines = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, max) : [];

/** The study, read off the model's reply; null when it did not come back as one. */
export function parseStudy(raw: string | null | undefined, modelId: string): Study | null {
  if (!raw) return null;
  const j = extractJson(raw) as Record<string, unknown> | null;
  if (!j || typeof j !== "object") return null;
  const standard = lines(j.standard, 12);
  if (standard.length < 3) return null;
  const field = typeof j.field === "string" ? j.field.trim().slice(0, 200) : "";
  const imagined = typeof j.imagined === "string" ? j.imagined.trim().slice(0, 800) : "";
  let unsure: Study["unsure"] = null;
  const u = j.unsure as Record<string, unknown> | null | undefined;
  if (u && typeof u === "object" && typeof u.question === "string" && u.question.trim()) {
    const options = lines(u.options, 4);
    if (options.length >= 2) unsure = { question: u.question.trim().slice(0, 300), options };
  }
  return { field, makers: lines(j.makers, 5), standard, imagined, unsure, modelId };
}

/** How the standard reaches the model that is writing. */
export function standardNote(study: Study): string {
  return [
    "Before this, a model studied how the best in this field make exactly this thing, and set the standard your answer is held to. It is not an instruction and it may be wrong in places: use what is right, and do not mention it.",
    "",
    study.field ? `What is being made: ${study.field}` : "",
    study.makers.length ? `Who does this best:\n${study.makers.map((m) => `- ${m}`).join("\n")}` : "",
    `The standard:\n${study.standard.map((s) => `- ${s}`).join("\n")}`,
    study.imagined ? `What they most likely picture: ${study.imagined}` : "",
    "",
    "Deliver the whole thing, not a sketch of it or a plan for it: everything they asked for and everything they clearly pictured, to this standard, in one answer. No placeholders, no \"you could add\", no lorem ipsum. Where the thing is a page, an app or a document, build it. A second model will read your answer against this standard.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * When the study is unsure, the answer is a question. Short, with the
 * options as a list, and a line saying why it asks rather than guesses.
 */
export function askFirst(study: Study): string {
  const u = study.unsure!;
  return [
    `Before I make this, one thing would change the whole of it: **${u.question.replace(/\?$/, "")}?**`,
    "",
    ...u.options.map((o, i) => `${i + 1}. ${o}`),
    "",
    "Reply with a number, or say it in your own words — and I will make the whole thing to that.",
  ].join("\n");
}

/* ------------------------------------------------------------ the judge -- */

export const JUDGE_HEAD = "Judge the answer below against the ask and the standard.";

/** The prompt for the model that judges the answer. */
export function judgePrompt(ask: string, study: Study, answer: string): string {
  return [
    JUDGE_HEAD,
    "",
    "Someone asked an assistant for something. Before it answered, the field was studied and a standard set. The answer is below. Your job is to say whether it is good enough to hand over — not to rewrite it.",
    "",
    "Judge three things:",
    "1. The ask: did it do everything that was asked, in the form asked for?",
    "2. The standard: is each point met, or a good reason given for leaving it?",
    "3. Whole and usable: is it the thing itself rather than a plan or a sketch of it — no placeholders, nothing left \"for later\", nothing the person would have to finish themselves?",
    "",
    "\"short\" only when something the person would notice is missing or below the standard. Do not fail an answer for taste, for length on its own, or for a point of the standard that does not fit what was asked.",
    "",
    "Answer with JSON and nothing else:",
    "",
    '{"verdict": "meets" | "short",',
    ' "missing": ["what was asked or pictured and is not there"],',
    ' "weak": ["what is there and below the standard, and how"],',
    ' "fix": "what to change, in one paragraph, to the writer"}',
    "",
    "The ask:",
    "",
    ask.trim(),
    "",
    "The standard:",
    ...study.standard.map((s) => `- ${s}`),
    study.imagined ? `\nWhat they most likely pictured: ${study.imagined}` : "",
    "",
    "The answer:",
    "",
    answer.trim().slice(0, 60_000),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function parseJudgement(raw: string | null | undefined, modelId: string): Judgement | null {
  if (!raw) return null;
  const j = extractJson(raw) as Record<string, unknown> | null;
  if (!j || typeof j !== "object") return null;
  const verdict = j.verdict === "short" ? "short" : j.verdict === "meets" ? "meets" : null;
  if (!verdict) return null;
  return {
    verdict,
    missing: lines(j.missing, 8),
    weak: lines(j.weak, 8),
    fix: typeof j.fix === "string" ? j.fix.trim().slice(0, 2_000) : "",
    modelId,
  };
}

/** The judgement, handed back to the writer for the second pass. */
export function improveNote(judgement: Judgement): string {
  const found = [
    ...judgement.missing.map((m) => `- Missing: ${m}`),
    ...judgement.weak.map((w) => `- Below the standard: ${w}`),
  ];
  return [
    "A second model has read your last answer against what was asked and the standard it was held to, and found it short. It said:",
    "",
    ...(found.length ? found.map((l) => `> ${l}`) : []),
    judgement.fix ? `> ${judgement.fix}` : "",
    "",
    "Answer again, whole: keep everything that was right, put in what is missing, bring up what was below the standard. Do not describe the changes or mention this note; give the finished thing.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** The words on the answer's line, for what happened besides being answered. */
export function craftLine(study: Study | null, judgement?: Judgement | null): string {
  if (!study) return "";
  const parts = [`studied the field first, held to a standard of ${study.standard.length}`];
  if (judgement) parts.push(judgement.verdict === "meets" ? "judged to meet it" : "judged short, answered again");
  return parts.join(", ");
}
