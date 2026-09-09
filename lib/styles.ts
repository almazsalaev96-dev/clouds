import type { Style } from "./types";

/**
 * Response styles.
 *
 * A style changes the *shape* of an answer, never its content — how long, how
 * formal, how much scaffolding. It is kept separate from the system prompt for
 * one reason: the system prompt is where you put what the model should know,
 * and if the two share a box then "you are a tutor for my thermodynamics
 * course" and "keep it short" get edited, forgotten and lost together.
 *
 * Normal carries no instructions at all. A style that says "be balanced and
 * natural" is a style that makes the model self-conscious about being balanced
 * and natural, which reads as neither.
 */
export const BUILT_IN_STYLES: Style[] = [
  {
    id: "normal",
    name: "Normal",
    blurb: "The model's own voice.",
    instructions: "",
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "concise",
    name: "Concise",
    blurb: "Shorter answers, less preamble.",
    instructions: [
      "Answer in as few words as the question honestly takes.",
      "No preamble, no restating the question, no summary of what you just said.",
      "Prose over lists unless the content is genuinely a list. Skip the closing offer to help further.",
      "Being brief never means leaving out a caveat that changes the answer.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "explanatory",
    name: "Explanatory",
    blurb: "Teaches as it answers.",
    instructions: [
      "Answer the question first, then explain the reasoning that got there.",
      "Name the concept at work and why it applies here rather than somewhere else.",
      "Use a concrete example when one makes the idea land faster than a definition would.",
      "Say what would change the answer — the assumption it rests on, the case where it breaks.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "formal",
    name: "Formal",
    blurb: "Polished, for writing you'll hand to someone.",
    instructions: [
      "Write in complete, well-formed prose in a professional register.",
      "No contractions, no filler openings, no conversational asides or exclamations.",
      "Structure with clear paragraphs; use headings only when the length actually needs them.",
      "Precise, specific language over hedged or padded phrasing.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "learning",
    name: "Learning",
    blurb: "Leaves the last step to you.",
    instructions: [
      "You are helping someone learn, not delivering a finished answer.",
      "Work through the problem with them and stop short of the final step, leaving it for them to take.",
      "Where a piece of code or a derivation is the point of the exercise, mark the gap clearly — a TODO, a blank — instead of filling it in.",
      "Ask one question back when their answer depends on something only they know.",
      "If they ask outright for the full answer, give it. This is a teaching stance, not a refusal.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

export const DEFAULT_STYLE_ID = "normal";

export function findStyle(id: string | undefined, custom: Style[] = []): Style | undefined {
  if (!id) return undefined;
  return BUILT_IN_STYLES.find((s) => s.id === id) ?? custom.find((s) => s.id === id);
}

/** Every style, built-ins first, for a picker. */
export function allStyles(custom: Style[] = []): Style[] {
  return [...BUILT_IN_STYLES, ...custom];
}
