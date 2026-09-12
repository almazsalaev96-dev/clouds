import type { TaskKind } from "./task";

/**
 * What answering this kind of work *well* would mean.
 *
 * `task.ts` works out what kind of job a request is, and until now that answer
 * was used for exactly one thing: telling a second model what to look for when
 * checking the first one. So the app knew a request was a proof, or a pull
 * request, or a claim about the world — and then asked for it in the same voice
 * it would use for anything else. The classification was spent on the audit and
 * never on the work.
 *
 * This is the other half. `CHECKS` says what would make an answer wrong for
 * this kind of job; this says what would make it right, in the form the model
 * reads before it writes rather than after.
 *
 * ## Why these are rules and not a template
 *
 * The temptation is a fixed skeleton — answer, then why, then an example, then
 * the limits — and it is wrong for a reason the research is unambiguous about.
 * Adding a second rendering of something already understood *subtracts*: the
 * reader cannot decline to process it, so they spend working memory
 * reconciling two sources that carry one fact (Sweller's redundancy effect, and
 * the reason a recap of what was just said is worse than nothing). A template
 * guarantees redundancy on every short answer. So each line below is a
 * condition and a consequence — *when* this is true, do that — and an answer
 * that triggers none of them is correctly a paragraph.
 *
 * ## Why they are so specific
 *
 * "Be clear" is not an instruction, it is a hope. Every line here names a
 * behaviour that can be observed in the output and would be visibly absent if
 * the model ignored it.
 */
export const SHAPE: Record<TaskKind, string[]> = {
  /* Someone is trying to understand, not to obtain. Every line here is a
     finding with an effect size behind it rather than a preference. */
  learning: [
    "Lead with the shortest true answer, then build. Someone who already has it stops reading; someone who does not now has something to attach the rest to.",
    "Pitch at the structure of what they said, not at the difficulty of the topic. One idea in their question means supply the second idea and the link between them; several unconnected ideas means do not add a third — ask how two of them constrain each other. Fluent terminology tells you the level to teach at. It does not tell you they want a lecture.",
    "Where the idea has a common wrong version, say the wrong version, say plainly that it is wrong, and say *what it mispredicts* — then give the right one. Stating the correct fact on its own leaves the wrong model running: it is a working theory, not an empty slot, and it goes on being used everywhere the correct fact is not consciously recalled.",
    "An analogy earns its place only if it licenses a correct prediction about the thing being explained that was not obvious without it. Say where it breaks, in the same breath — the unmapped part is where the next misconception comes from.",
    "Where something has a non-obvious distinguishing feature, show two cases that differ in it and ask what separates them before explaining. An explanation is an answer, and an answer given to someone with no question has nothing to attach to.",
    "End on something for them to do or recall, not on a summary of what you just said. Retrieving is the event that makes it stick; re-reading produces fluency, and fluency is what people mistake for knowing.",
    "Never explain the explanation. If a point landed, the restatement is cost with nothing bought.",
  ],

  coding: [
    "Give the working thing first. Explanation after code is read; explanation before code is scrolled past.",
    "Say what it does at the level of intent — the invariant, the thing that must stay true — rather than narrating the lines, which the reader can already see.",
    "Name the input that breaks it before they find it: the empty case, the null, the duplicate, the boundary, the second call. One sentence each.",
    "Where there was a real choice, say what you chose against and why. A decision with no alternative stated reads as the only option and is the thing that gets cargo-culted.",
    "Where the exercise is the point rather than the code, leave the step that carries the learning and mark it clearly — an explicit gap is a question, a filled-in gap is a transcript.",
  ],

  research: [
    "Separate what you know from what you infer, in the sentence itself rather than in a caveat at the end. 'X, which suggests Y' and 'X, therefore Y' are different claims and the reader cannot recover which you meant from a general disclaimer.",
    "Give the strongest version of the case against, not the weakest. An account that only survives its easiest objection has not been tested.",
    "State confidence in a form that carries information: what would have to be true for this to be wrong, and what evidence would settle it.",
    "Where a claim rests on a source, say what the source actually says, not what it is usually cited for.",
    "Say what is not known. An unknown named is a finding; an unknown papered over is a mistake waiting to be repeated.",
  ],

  writing: [
    "Write the thing. A description of what the piece would be like is not the piece.",
    "Hold to the reader and the purpose that were given. Where they were not given, say the one you assumed in a line, and keep going rather than asking.",
    "Vary the sentence length. Uniform rhythm is the single clearest signal that nobody chose the words.",
    "Cut the opening that announces what the piece is about, and the closing that says what it said.",
    "Where you have changed their voice rather than their prose, say so — that is the edit a person will want back.",
  ],

  data: [
    "Do the arithmetic and show the step where a reader could check it. A number with no derivation is a number nobody can use.",
    "Say what the numbers cannot support. A correlation stated as a cause is the failure that survives review because it reads exactly like a finding.",
    "Name the assumption the calculation rests on — the base, the denominator, the period, whether the sample stands for the population.",
    "Where a table is the answer, give the table and not a paragraph about the table.",
    "Say which number would change the conclusion if it moved, and by how much.",
  ],

  design: [
    "Say what the thing should do before what it should look like. A layout justified by taste cannot be argued with; one justified by the job can.",
    "Give the values, not the adjectives — the size, the weight, the spacing, the duration, the contrast ratio. 'Generous spacing' is not implementable.",
    "Check it against the small screen, the large text setting, and the keyboard, and say so rather than leaving it to be discovered.",
    "Where you break a convention already in the interface, say why. An inconsistency with a reason is a decision; without one it is a bug that survived.",
    "Say where it fails — the content length, the language, the density that this falls apart at.",
  ],

  /* Deliberately empty, on the same principle as `CHECKS.general`. Most
     requests are general, and a model given a list of virtues to perform on an
     ordinary question performs them: it reaches for a structure the question
     did not need and the answer gets worse in a way that reads as thorough. */
  general: [],
};

/**
 * The block that goes into the system prompt, or nothing at all.
 *
 * Nothing at all is the common case and the right one. It is also why this
 * returns a string rather than mutating a prompt: the caller can see that it
 * added nothing.
 */
export function shapeFor(kind: TaskKind): string {
  const lines = SHAPE[kind];
  if (!lines.length) return "";
  return [
    `## This request`,
    "",
    `It reads as ${LABEL[kind]}. That does not change what is true; it changes what a good answer to it looks like:`,
    "",
    ...lines.map((l) => `- ${l}`),
  ].join("\n");
}

const LABEL: Record<TaskKind, string> = {
  learning: "someone trying to understand something rather than to obtain it",
  coding: "work on code",
  research: "a claim about the world that stands or falls on evidence",
  writing: "prose that someone other than the asker will read",
  data: "work with numbers",
  design: "how something should look and behave",
  general: "an ordinary request",
};
