/**
 * How to answer, read from who is asking and how.
 *
 * The model is chosen for you, the mode is read from the request, how hard
 * to think is read from the kind of work — and the *style*, which is the
 * one a reader actually notices, was a setting behind two menus that
 * almost nobody ever opened. So every answer came out in the same register
 * whether the person had typed four words or four paragraphs, whether they
 * were revising for an exam or writing a letter to a landlord.
 *
 * This reads it instead, from three things, in order of how much they are
 * worth:
 *
 *  1. What they said. "quickly", "explain why", "write me an email" are
 *     instructions about the answer, not only about the subject.
 *  2. What they did with the last few answers. Somebody who has told this
 *     app twice that an answer was too long has told it how to write.
 *  3. How they write. Four words and no punctuation is a different
 *     conversation from a careful paragraph, and it wants a different reply.
 *
 * Only four of the built-in styles are ever chosen this way, and the five
 * teaching stances are not among them: they withhold the answer on purpose,
 * and withholding an answer nobody asked to be withheld is the rudest thing
 * this app could do on its own initiative. Practice is the exception, and
 * only when somebody has asked in as many words to be quizzed.
 */
import type { TaskKind } from "./task";

/** The thread is on Auto: the app picks the register per turn. */
export const AUTO_STYLE = "auto";

export interface Register {
  /** A built-in style id, or "normal" for the model's own voice. */
  id: string;
  /** One line, in the words a person would use. Shown, not logged. */
  why: string;
}

const NORMAL: Register = { id: "normal", why: "" };

/* Said outright. An instruction about the answer beats anything inferred
   from how the question was typed. */
const WANTS_SHORT =
  /\b(quick(ly)?|short(ly)?|brief(ly)?|in a sentence|one sentence|in a word|tl;?dr|just tell me|straight answer|no (preamble|waffle|essay)|don'?t explain)\b/i;
const WANTS_WHY =
  /\b(why\b|how (does|do|did) .* (work|happen)|explain|what does that mean|i (don'?t|do not) (get|understand)|help me understand|walk me through|eli5|like i'?m (five|5)|in simple terms)\b/i;
const WANTS_POLISH =
  /\b(write (me )?(an?|the) (email|letter|message|note|post|report|proposal|statement|announcement|bio|cover letter)|draft (an?|the)|for (my|the) (boss|client|landlord|teacher|professor|company)|formal|professional)\b/i;
const WANTS_QUIZ =
  /\b(quiz me|test me|ask me (questions|about)|give me (some )?(practice|questions)|drill me)\b/i;

/** Four words with no punctuation is a different conversation from a paragraph. */
const CLIPPED_WORDS = 7;

export function registerFor(
  ask: string,
  ctx: {
    kind?: TaskKind;
    /** The person's own recent messages, newest last, for how they write. */
    theirs?: string[];
    /** How many times lately they have said an answer was too long. */
    tooLong?: number;
  } = {},
): Register {
  const text = ask.trim();
  if (!text) return NORMAL;

  /* 1. Said outright. */
  if (WANTS_QUIZ.test(text)) {
    return { id: "practice", why: "asked to be quizzed" };
  }
  if (WANTS_SHORT.test(text)) {
    return { id: "concise", why: "you asked for it short" };
  }
  if (WANTS_POLISH.test(text) || ctx.kind === "writing") {
    return { id: "formal", why: "this is going to somebody else" };
  }
  if (WANTS_WHY.test(text) || ctx.kind === "learning") {
    return { id: "explanatory", why: "you asked how it works, not just what it is" };
  }

  /* 2. Done, rather than said. Two complaints is a pattern; one is a
     sentence that happened to be long. */
  if ((ctx.tooLong ?? 0) >= 2) {
    return { id: "concise", why: "you have said twice that answers were too long" };
  }

  /* 3. How they write. Measured over their own turns rather than this one,
     because one short question in a long conversation is a follow-up, not a
     change of register. Their last few, and all of them have to be short:
     a single paragraph anywhere in there means they are willing to read. */
  const theirs = (ctx.theirs ?? []).filter((t) => t.trim()).slice(-4);
  if (theirs.length >= 2) {
    const clipped = theirs.every((t) => t.trim().split(/\s+/).length <= CLIPPED_WORDS);
    if (clipped) return { id: "concise", why: "you are writing in short lines" };
  }

  return NORMAL;
}
