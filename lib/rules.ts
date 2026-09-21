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
  { id: "no-preamble", group: "answers", label: "No preamble, no praise", blurb: "Straight in, and never “great question”.", text: "No preamble, no praise, and never restate my question back to me. Start with the answer." },
  { id: "ask-first", group: "answers", label: "Ask before guessing", blurb: "One clarifying question when the ask is ambiguous.", text: "If my question could mean two different things, ask one short clarifying question before answering rather than guessing." },
  /* --- how it teaches */
  { id: "hint-first", group: "teaching", label: "Hints before answers", blurb: "When I am working something out, do not finish it for me.", text: "When I am working something out, give a hint before an answer, and never the last step unless I ask for it outright." },
  { id: "check-me", group: "teaching", label: "Check I followed", blurb: "One short question after every explanation.", text: "After explaining something, ask me one short question that checks I followed. Wait for my answer." },
  { id: "exam-level", group: "teaching", label: "Exam standard", blurb: "Pitch at A-level / IB, in the board's own wording.", text: "Pitch answers at A-level / IB standard. Use the exam board's own terms and wording where they exist, and say what a full-mark answer would have to contain." },
  { id: "plain", group: "teaching", label: "Plain words", blurb: "Define a term the first time, then use it.", text: "Use plain words. Define any technical term in one line the first time it appears, then use it." },
  /* --- honesty */
  { id: "unsure", group: "honesty", label: "Say when unsure", blurb: "And never invent a number, a source or a quote.", text: "Say plainly when you are unsure or when the material does not settle it. Never invent a number, a source, a quote or a citation." },
  { id: "quote", group: "honesty", label: "Quote what you relied on", blurb: "From my files, notes or the page.", text: "When answering from my files, my notes or a page I am reading, quote the exact line you relied on." },
  /* --- language */
  { id: "british", group: "language", label: "British English", blurb: "Spelling, units and dates.", text: "Use British English spelling, metric units and day-month-year dates." },
];

export const GROUPS: { id: Rule["group"]; label: string }[] = [
  { id: "answers", label: "How it answers" },
  { id: "teaching", label: "How it teaches" },
  { id: "honesty", label: "Honesty" },
  { id: "language", label: "Language" },
];

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
