import type { ModelParams } from "./types";
import { BASE_BRIEF } from "./base";

/**
 * Two ways to ask.
 *
 * Chat is the default and adds nothing at all. Creative changes two things
 * that actually change an answer — how the model samples, and what it is
 * asked for — rather than being a label on a toggle.
 *
 * Sampling first, because that is the half a prompt cannot do. Temperature is
 * the width of the distribution the next token is drawn from; asking for
 * "creative" writing at temperature 0.7 gets you the most probable phrasing
 * of an unusual instruction, which is exactly the flat, competent prose people
 * mean when they say an answer sounds like AI. The prompt half then asks for
 * range and for the option that was not obvious — and, deliberately, keeps the
 * requirement to be accurate, because the failure mode of a creative setting
 * is a model that decides facts are also negotiable.
 */
export type Mode = "chat" | "creative" | "learn";

export interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
  /** What the composer asks, so the box itself says which mode you are in. */
  placeholder: string;
  /** Layered after the style, closest to the answer. */
  instructions: string;
  /** Applied over the model's own parameters. */
  params?: Partial<ModelParams>;
}

export const MODES: ModeSpec[] = [
  {
    /* The study-mode / Guided-Learning pattern the three flagships converged
       on in 2025–26, as a mode of the thread rather than a room: a plan
       first, one step at a time, a check after each, the level asked once.
       Gerlich (2025) found heavier assistant use tracks lower critical
       thinking through offloading; this mode is the app refusing to be
       offloaded onto. */
    id: "learn",
    label: "Learn",
    blurb: "A plan, one step at a time, and a check after each.",
    placeholder: "What are you trying to understand?",
    instructions: [
      "You are teaching, not answering. The goal is that they can do it without you afterwards.",
      "On the first turn about a topic: ask, in one line, what they already know and what level they are at (school year, exam, course) — unless the conversation already says. Then lay out a short plan: three to six steps, one line each, from where they are to where they want to be.",
      "Then take one step at a time. Explain the step in a few short paragraphs with one concrete example, and end every step with one question that checks they followed — a question they must answer, not a rhetorical one. Wait for the answer.",
      "Read their answer. Right: say so in a word and move to the next step. Partly right: name the part that holds, then the gap, and try a different angle — a new analogy, a simpler case, a picture in words. Wrong: do not give the answer; give the smallest hint that would let them find it, and ask again.",
      "Never hand over the final answer to a problem they are working while they are still trying. If they ask for it outright, give it, then ask them to do the next one.",
      "Keep a running sense of where you are in the plan and say it briefly when a step is done (“Step 2 of 5 done”).",
      "Short paragraphs, plain words, one idea at a time. No preamble.",
    ].join("\n"),
  },
  {
    id: "chat",
    label: "Chat",
    blurb: "Straight answers.",
    placeholder: "How can I help you today?",
    instructions: "",
  },
  {
    id: "creative",
    label: "Creative",
    blurb: "Range, options, the unobvious one.",
    placeholder: "What should we make?",
    instructions: [
      "Work in a creative register.",
      "Where there is more than one good answer, give more than one, and say what each is good for — do not silently pick the safe one.",
      "Reach for the specific over the general: a concrete image, a real example, an unexpected but apt comparison.",
      "Avoid the phrasings that show up in every answer to this kind of question. If a sentence could open any essay on the subject, it is the wrong sentence.",
      "None of this loosens accuracy. Invent freely in what you write; never in what you claim is true.",
      "",
      /* The half that stops "make me a timetable" coming back as a paragraph
         about timetables. The app can run a page: an answer that *is* the
         thing beats an answer that describes it, every time, and the reader
         can tell within a second which one they got. */
      "When someone asks you for a thing rather than for words — a timetable, a deck of cards, a quiz, a checklist, a timer, a tracker, a calculator, a board, a game, a countdown, a form, a page — build it. Reply with one complete HTML document in a single ```html block: at most one short sentence before it, nothing after it. This app runs that block beside the conversation, so what they get is the working thing rather than a description of it, and code you write outside that block is code nobody asked to read.",
      "Make it real: it should do the job with the material they gave you, not with placeholders. If they gave you no material, invent a small, plausible set — six cards, five questions, a week of real-looking events — and put it in one plain array or object at the top of the script under a comment saying that is the part to edit.",
      "When they ask for a change to something you built earlier in this conversation, reply the same way: the whole updated document in one ```html block. Not a diff, not the changed lines — the app replaces the running thing with what you send, so it has to be all of it.",
      "",
      "Rules for anything you build:",
      "- One self-contained document. Styles in a <style>, behaviour in a <script>, no network requests and no CDN — it has to keep working saved to a disk with no internet.",
      "- Never touch localStorage or sessionStorage. It runs on an opaque origin and they throw.",
      `- ${BASE_BRIEF}`,
      "- Design it like something people pay for. A clear title and one line of what it is; one thing that matters in the middle of the page with the room it needs; spacing on a 4px scale with real whitespace between groups; a type scale of no more than four sizes; cards on var(--surface) with var(--shadow) where things are grouped; one primary action in var(--accent) and everything else quiet. Empty, done and error states designed, not left blank.",
      "- It should move. Things that appear should arrive, state changes should be acknowledged, and anything that measures should sweep rather than jump — but honour prefers-reduced-motion, and never animate for longer than a third of a second.",
      "- It should work with a keyboard and on a phone: real focus styles, targets no smaller than 44px, text that reflows, and a layout that still makes sense at 360px wide.",
      "- Light and dark both. The base stylesheet handles the tokens; do not set your own body background or text colour in a way that breaks one of the two.",
      "- Never say something is right or wrong with colour alone; give it a mark as well.",
      "- Give the document a <title> that names the thing — that is what it will be called.",
    ].join("\n"),
    /* 1.0 is the top of the range every provider here accepts, and the point
       where the distribution is the model's own rather than a sharpened copy.

       This half does not always land, and that is the provider's rule rather
       than a bug: Anthropic rejects `temperature` alongside extended thinking,
       so on a reasoning model with a thinking budget the request goes out
       without it and the instructions above do the work alone. Creative does
       not turn thinking off to win the argument — trading reasoning for
       sampling width would be a silent downgrade, and nobody asked for it. */
    params: { temperature: 1, topP: 0.98 },
  },
];

export const DEFAULT_MODE: Mode = "chat";

export function findMode(id: string | undefined): ModeSpec {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

/**
 * Which mode this request is in, read off the request.
 *
 * It was a switch in the composer, and a switch is the wrong shape for it.
 * Choosing between Chat and Creative is a question about the machine, asked
 * before the person has said what they want, and answerable only by someone
 * who already knows what the two settings do — the ones who most need the
 * built thing are the least likely to have found the toggle. The app can read
 * the request instead: this is the same move the model router already makes,
 * and for the same reason.
 *
 * ## What makes it a make
 *
 * A thing rather than words. "Build me a timer" wants a timer; "how do
 * timers work" wants an explanation, and the difference is in the sentence.
 * Two signals, and both have to be there:
 *
 *  - an asking-for verb, or an outright "run it"
 *  - a noun that names something that can actually run
 *
 * Requiring both is what keeps "write me an email", "make it shorter" and
 * "explain how a tracker works" out. Prose is not a thing that runs, editing
 * is not building, and a question about a tracker is not a request for one.
 */
const MAKE_VERB =
  /\b(make|build|create|generate|design|give me|put together|knock up|write)\b/i;

/** No verb needed: it is already an instruction. */
const RUN_IT = /\b(run (it|this|that|the)|open (it|this) (in|as)|make it run|get it running)\b/i;

/**
 * Things that run. Deliberately not "essay", "email", "poem" or "summary" —
 * those are words, and words belong in the transcript where they can be read,
 * quoted and pointed at.
 */
const RUNNABLE =
  /\b(web ?(app|page|site)?|site|page|app|html|landing page|game|timer|countdown|stopwatch|clock|tracker|quiz|flashcards?|calculator|converter|dashboard|chart|graph|checklist|todo|to-do|timetable|schedule|planner|form|survey|poll|board|generator|simulator|visuali[sz]er|widget|tool)\b/i;

/** Editing prose is not building a thing, however imperative it sounds. */
const EDITING = /\bmake (it|this|them|that)\b(?!.*\b(run|work)\b)/i;

export function modeFor(text: string): Mode {
  const t = text.slice(0, 600);
  if (RUN_IT.test(t)) return "creative";
  if (EDITING.test(t)) return "chat";
  return MAKE_VERB.test(t) && RUNNABLE.test(t) ? "creative" : "chat";
}
