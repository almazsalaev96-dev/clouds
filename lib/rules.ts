/**
 * Your rules.
 *
 * Standing instructions the model follows in every room: not a style (how
 * an answer is shaped) and not a memory (what it knows about you), but what
 * it must and must not do. ChatGPT stacks three layers of this — a
 * personality preset, custom instructions, memory — and its own guidance
 * is that the instructions that work are the specific, action-shaped ones:
 * "always include error handling", never "be helpful". So the presets here
 * are sentences a person would actually say to a tutor, each one a switch,
 * and the free text under them is for the ones nobody thought of.
 *
 * Precedence: these sit right after the house rules in the system prompt,
 * so they beat the app's opinions and lose to a project's instructions —
 * the narrower thing wins, as everywhere in `lib/prompt.ts`.
 */

export interface Rule {
  id: string;
  /** The switch's label, as a person would put it. */
  label: string;
  /** One line under the label saying what it changes. */
  blurb: string;
  /** What the model is told. */
  text: string;
  group: "answers" | "teaching" | "honesty" | "language";
}

export const RULES: Rule[] = [
  /* --- how it answers */
  { id: "short", group: "answers", label: "Keep it short", blurb: "The point first, then only what is needed.", text: "Keep answers short: the point first, then only what is needed to use it. No padding." },
  { id: "examples", group: "answers", label: "One example every time", blurb: "Every abstract point comes with a concrete case.", text: "Give one concrete example with every abstract point." },
  { id: "tables", group: "answers", label: "Compare in a table", blurb: "Two or more things side by side, always as a table.", text: "Whenever you compare or contrast two or more things, put the comparison in a table, one row per point of difference." },
  { id: "easy-read", group: "answers", label: "Easy to read", blurb: "Short sentences, one idea per line, key terms in bold.", text: "Write for easy reading: short sentences, one idea per bullet, key terms in bold, no walls of text. (Helpful for dyslexia and tired eyes.)" },
  { id: "latex", group: "answers", label: "Maths step by step", blurb: "LaTeX maths, one step per line.", text: "Write all mathematics in LaTeX, one step per line, and say in words what each step does." },
  /* --- how it teaches */
  { id: "hint-first", group: "teaching", label: "Hints before answers", blurb: "When I am working something out, do not finish it for me.", text: "When I am working something out, give a hint before an answer, and never the last step unless I ask for it outright." },
  { id: "exam-level", group: "teaching", label: "Exam standard", blurb: "Pitch at A-level / IB, in the board's own wording.", text: "Pitch answers at A-level / IB standard. Use the exam board's own terms and wording where they exist, and say what a full-mark answer would have to contain." },
  { id: "test-me", group: "teaching", label: "End with a question to test me", blurb: "Recall beats rereading: every explanation ends on a question.", text: "End every explanation or set of notes with two short questions that test what was just covered, with the answers hidden under a line I have to scroll past." },
  { id: "mark-scheme", group: "teaching", label: "Answer like the mark scheme", blurb: "Mark points first, command word obeyed.", text: "When I ask an exam-style question, answer the way the mark scheme is written: the command word obeyed, one point per mark, in the board's wording, and say how many marks the answer would earn." },
  { id: "worked", group: "teaching", label: "Worked example for every method", blurb: "Every step and the reason for it.", text: "Whenever you show a method or a calculation, give a fully worked example with every step and the reason for the step, units kept to the end." },
  { id: "no-homework", group: "teaching", label: "Do not do my coursework for me", blurb: "Help me write it; never write it for me to hand in.", text: "When I am working on coursework or homework I will hand in, help me plan, check and improve my own work, but never write the finished piece for me." },
  { id: "plain", group: "teaching", label: "Plain words", blurb: "Define a term the first time, then use it.", text: "Use plain words. Define any technical term in one line the first time it appears, then use it." },
  { id: "socratic", group: "teaching", label: "Teach me by questions", blurb: "Guide me with questions; the answer only if I ask twice.", text: "Teach by questions: guide me towards the answer one question at a time, and only state the answer outright if I ask for it twice." },
  { id: "mistakes", group: "teaching", label: "Name the common mistakes", blurb: "The two or three mistakes students make on this.", text: "After explaining a topic or method, name the two or three mistakes students most often make on it and how to avoid each." },
  { id: "memorable", group: "teaching", label: "Make it memorable", blurb: "A mnemonic or analogy for anything to learn by heart.", text: "For any list, sequence or definition I need to learn by heart, give one short mnemonic or analogy that makes it stick." },
  { id: "strict-marking", group: "teaching", label: "Mark my work strictly", blurb: "Every lost mark named, nothing softened.", text: "When you mark my work, mark it strictly against the mark scheme: give the mark, name every mark lost and why, and do not soften it. Then say the one change that would gain the most marks." },
  { id: "units", group: "teaching", label: "Units and significant figures", blurb: "SI units, stated precision, a units check.", text: "In any calculation, keep SI units throughout, give the answer to a stated number of significant figures, and check it with the units." },
  { id: "revise-next", group: "teaching", label: "Tell me what to revise next", blurb: "End with the next thing to study and how long.", text: "End each study answer with one line: what I should revise next and roughly how long it will take." },
  { id: "card-it", group: "teaching", label: "Three flashcards at the end", blurb: "Question and answer pairs I can save.", text: "End every explanation with three flashcards as question :: answer lines I can save to a deck." },
  /* --- honesty */
  { id: "unsure", group: "honesty", label: "Say when unsure", blurb: "And never invent a number, a source or a quote.", text: "Say plainly when you are unsure or when the material does not settle it. Never invent a number, a source, a quote or a citation." },
  { id: "quote", group: "honesty", label: "Quote what you relied on", blurb: "From my files, notes or the page.", text: "When answering from my files, my notes or a page I am reading, quote the exact line you relied on." },
  { id: "pages", group: "honesty", label: "Page numbers from my files", blurb: "Say the page when citing a PDF.", text: "When you rely on one of my PDFs or documents, give the page number (or section) you took it from." },
  /* --- language */
  { id: "british", group: "language", label: "British English", blurb: "Spelling, units and dates.", text: "Use British English spelling, metric units and day-month-year dates." },
  { id: "american", group: "language", label: "American English", blurb: "US spelling and month-day-year dates.", text: "Use American English spelling and month-day-year dates." },
  { id: "glossary", group: "language", label: "Key terms in both languages", blurb: "For studying in a second language.", text: "I am studying in a second language: give each key term in English and, in brackets, in the language I write to you in." },
];

export const GROUPS: { id: Rule["group"]; label: string }[] = [
  { id: "answers", label: "How it answers" },
  { id: "teaching", label: "How it teaches" },
  { id: "honesty", label: "Honesty" },
  { id: "language", label: "Language" },
];

/** Rules that contradict each other: turning one on turns the other off. */
export const EXCLUSIVE: [string, string][] = [
  ["british", "american"],
  ["socratic", "short"],
];

/** The switch flipped, with any rule it contradicts turned off. */
export function toggled(on: string[], id: string): string[] {
  if (on.includes(id)) return on.filter((r) => r !== id);
  const clash = new Set(EXCLUSIVE.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])));
  return [...on.filter((r) => !clash.has(r)), id];
}

/** The rules that are on, in the order they are listed. */
export function rulesOn(ids: string[]): Rule[] {
  const on = new Set(ids);
  return RULES.filter((r) => on.has(r.id));
}

/** How many rules are in force, presets and your own lines together. */
export function rulesCount(ids: string[], custom: string): number {
  return rulesOn(ids).length + custom.split("\n").filter((l) => l.trim()).length;
}

/**
 * The section of the system prompt, or an empty string when there are no
 * rules. Presets first, then your own lines, each as a bullet — a list the
 * model can check itself against rather than a paragraph it can skim.
 */
export function rulesText(ids: string[], custom: string): string {
  const lines = [
    ...rulesOn(ids).map((r) => r.text),
    ...custom.split("\n").map((l) => l.trim()).filter(Boolean),
  ];
  if (!lines.length) return "";
  return `## Your rules\n\nThe person you are talking to set these. They hold in every room and every answer:\n\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
