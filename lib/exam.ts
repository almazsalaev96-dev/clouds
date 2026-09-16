/**
 * Reading a question the way an examiner does.
 *
 * Exam boards publish what their command words mean, and the shape of a
 * full-mark answer follows from the word: "describe" wants features and no
 * reasons, "explain" wants reasons, "evaluate" wants a weighed judgement.
 * A student who explains in a describe question wastes minutes; one who
 * describes in an evaluate question loses most of the marks. The model can
 * be told this once, precisely, per question — which is what this file is
 * for.
 *
 * The meanings below follow the Cambridge International list (standard
 * across its syllabuses since 2019); other boards' words differ little.
 * Pure: text in, a reading out.
 */

export interface CommandWord {
  word: string;
  /** What the board says it means. */
  means: string;
  /** What a full-mark answer must contain — the thing to mark for. */
  marks: string;
}

export const COMMAND_WORDS: CommandWord[] = [
  { word: "define", means: "give the precise meaning", marks: "the definition, in the subject's own terms" },
  { word: "state", means: "express in clear terms, briefly", marks: "the point itself, no reasons" },
  { word: "give", means: "produce an answer from recall or from the material", marks: "the item asked for" },
  { word: "identify", means: "name or select from the material", marks: "the name, not a description" },
  { word: "name", means: "give the name of", marks: "the name" },
  { word: "describe", means: "set out the main features or points, without reasons", marks: "features or steps; no 'because' is needed" },
  { word: "outline", means: "set out the main points, briefly", marks: "the main points, briefly" },
  { word: "summarise", means: "give the main points, briefly", marks: "coverage, briefly" },
  { word: "explain", means: "set out purposes or reasons, or make the relationships clear", marks: "causal links: because … therefore …" },
  { word: "calculate", means: "work out from given facts, figures or information", marks: "the method shown, units, the right number of significant figures" },
  { word: "determine", means: "establish an answer using the information available", marks: "the method and the answer" },
  { word: "show", means: "provide structured evidence that leads to a given result", marks: "every step to the stated result" },
  { word: "sketch", means: "make a simple freehand drawing showing the key features", marks: "the key features, labelled" },
  { word: "compare", means: "identify or comment on similarities and/or differences", marks: "both things named, point by point" },
  { word: "contrast", means: "identify or comment on differences", marks: "differences, point by point" },
  { word: "analyse", means: "examine in detail to show meaning, and identify elements and the relationship between them", marks: "the parts and how they relate" },
  { word: "discuss", means: "write about issues or topics in a structured way", marks: "points on more than one side, developed" },
  { word: "consider", means: "review and respond to given information", marks: "a response to each piece of the information" },
  { word: "comment", means: "give an informed opinion", marks: "an opinion with its reason" },
  { word: "evaluate", means: "judge or calculate the quality, importance, amount or value of something", marks: "'however … overall': a weighed judgement" },
  { word: "assess", means: "make an informed judgement", marks: "a judgement, with the grounds for it" },
  { word: "justify", means: "support a case with evidence or argument", marks: "evidence tied to the claim" },
  { word: "suggest", means: "apply knowledge and understanding to a new situation, or propose an idea", marks: "a plausible application, not a recalled fact" },
  { word: "predict", means: "suggest what may happen based on available information", marks: "the prediction and the reasoning" },
  { word: "deduce", means: "conclude from available information", marks: "the conclusion and the information it came from" },
  { word: "demonstrate", means: "show how or give an example", marks: "the how, or the example" },
  { word: "examine", means: "investigate closely, in detail", marks: "detail" },
  { word: "develop", means: "take forward to a more advanced stage", marks: "the next stage, built on the first" },
];

const byWord = new Map(COMMAND_WORDS.map((c) => [c.word, c]));

/**
 * The command word a question turns on, if it has one.
 *
 * The first one in the text, as a whole word, in any case. "Describe and
 * explain" is read as "describe": the first word sets the shape and the
 * second is a part of the answer, which is how the papers use the pair.
 */
export function commandWordOf(text: string): CommandWord | null {
  const words = text.toLowerCase().split(/[^a-z]+/);
  for (const w of words) {
    const hit = byWord.get(w);
    if (hit) return hit;
  }
  return null;
}

/**
 * The marks a question carries, read from how papers print them:
 * "[4]", "(4 marks)", "4 marks", "[Total: 6]".
 */
export function marksOf(text: string): number | null {
  const m =
    text.match(/\[\s*(?:total:?\s*)?(\d{1,2})\s*(?:marks?)?\s*\]/i) ??
    text.match(/\(\s*(\d{1,2})\s*marks?\s*\)/i) ??
    text.match(/\b(\d{1,2})\s*marks?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 30 ? n : null;
}

/** Whether this reads as an exam question rather than a conversation. */
export function looksLikeExamQuestion(text: string): boolean {
  const marks = marksOf(text);
  const word = commandWordOf(text);
  if (marks && word) return true;
  /* Marks alone are enough: a bare "[6]" at the end of a sentence is not
     something people type by accident. A command word alone is not: "explain
     how you got there" is a conversation. */
  return Boolean(marks) && text.trim().length < 800;
}

/**
 * What to tell the model about this question, or nothing.
 *
 * Written for the turn prompt: the shape the command word demands, the marks
 * to account for, and the order — mark points first, then a model answer,
 * then the invitation to try. Kept short; the model knows the subject.
 * `force` is for the Exam stance, where every question is one even when it
 * carries no marks.
 */
export function examNote(text: string, force = false): string | undefined {
  if (!force && !looksLikeExamQuestion(text)) return undefined;
  const word = commandWordOf(text);
  const marks = marksOf(text);
  const lines = ["This is an exam question. Answer it the way it will be marked."];
  if (word) lines.push(`The command word is "${word.word}", which means: ${word.means}. A full answer must give ${word.marks}.`);
  if (marks) lines.push(`It carries ${marks} mark${marks === 1 ? "" : "s"}: give exactly ${marks} numbered mark points first, one line each, the way a mark scheme lists them.`);
  else lines.push("List the mark points first, one line each, the way a mark scheme lists them.");
  lines.push("Then the model answer, in the length the marks justify. Then one line inviting them to try it and be marked against those points.");
  return lines.join(" ");
}
