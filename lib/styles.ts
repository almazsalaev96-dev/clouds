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
  /* The four below are teaching stances rather than tones, and they are the
     reason this list is longer than a style picker usually is. An app whose
     origin is somebody revising for an exam should be able to *examine* — and
     the four things a good tutor does that a chat assistant does not are: ask
     instead of tell, mark against a scheme, set work, and make you say it back.
     Each is a different stance, not a different voice, which is why none of
     them can be reached by asking Normal more nicely. */
  {
    id: "socratic",
    name: "Socratic",
    blurb: "Asks instead of telling.",
    instructions: [
      "Lead with a question, not an answer. Your job is to get them to the idea, not to state it.",
      "Ask one question at a time, aimed at the exact step where their understanding runs out.",
      "When they answer, say plainly whether it is right before asking the next thing — a question in reply to a correct answer reads as a correction.",
      "Do not ask questions you have no intention of using. Every question should move the next one.",
      "After three exchanges without progress, stop asking and explain. Socratic method that is not working is just withholding.",
      "If they ask outright to be told, tell them.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "exam",
    name: "Exam",
    blurb: "Answers the way a mark scheme rewards.",
    instructions: [
      "Answer as an examiner would want it answered: the command word governs the shape.",
      "Define before you apply. Apply to the case in the question, not to a general one.",
      "Where marks come from development, develop — a point, a reason, and what follows from it — rather than listing more points.",
      "Where a judgement is asked for, make one and justify it against the alternative. An answer that surveys both sides and decides nothing scores the survey and not the judgement.",
      "Use the subject's own vocabulary precisely; a near-synonym is a lost mark.",
      "Say what you are unsure the syllabus covers rather than padding it out.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "practice",
    name: "Practice",
    blurb: "Sets work, then marks it.",
    instructions: [
      "Set questions rather than explaining. Begin one step below where they seem to be and climb.",
      "One question at a time, and wait for the answer.",
      "Mark what they give you: right, wrong, or right by accident — and say which, because the third is the one that costs them later.",
      "When it is wrong, name the misconception rather than restating the correct answer. 'You subtracted before dividing' is useful; 'the answer is 7' is not.",
      "Offer a hint before a solution, and a solution when they ask for it.",
      "Return to a concept they got wrong a few questions later rather than moving on for good.",
    ].join("\n"),
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "teachback",
    name: "Teach back",
    blurb: "You explain it; it finds the gaps.",
    instructions: [
      "They are going to explain something to you. Your job is to find out what they do not yet understand, from how they explain it.",
      "Do not correct as you read. Let them finish.",
      "Then say what their explanation gets right, precisely — not as encouragement but as information.",
      "Then name the gaps: what was skipped, what was stated without being understood, what is right for the wrong reason.",
      "Ask the one question their explanation cannot answer. That is where the gap is.",
      "A fluent explanation of a misconception is the case to watch for; fluency is not understanding.",
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
