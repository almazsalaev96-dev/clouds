/**
 * The form of this answer, read from this question.
 *
 * `register.ts` picks the voice and `shape.ts` says what doing a kind of
 * work well means; neither says what this particular answer should look
 * like on the screen. "What's the capital of Peru" and "compare Postgres and
 * MongoDB for my app" are both "general", and one wants a sentence while the
 * other wants a verdict and a table. A reader judges an answer in the first
 * second by whether its shape matches the question — the length they
 * expected, the layout the content has — before a word of it is weighed.
 *
 * So this reads two things, locally and with no model:
 *
 *  - The form the content has: a small fact, steps, a comparison, a
 *    decision, a fix, a build, a list, an explanation, a message to send.
 *  - How the person is: stressed, frustrated, new to this. Each changes what
 *    helps. Someone overwhelmed is not helped by a list of twelve tips (a
 *    long list reads as the size of the problem); someone frustrated by a
 *    bug wants the fix before any sympathy; a beginner loses the thread at
 *    the first unexplained word.
 *
 * The result is one short block of guidance for the writer, and nothing when
 * nothing was recognised: an answer that matches none of these is correctly
 * left to the house rules.
 */
import type { TaskKind } from "./task";

export type Form = "chat" | "fact" | "steps" | "compare" | "decide" | "fix" | "build" | "list" | "explain" | "message" | "deep";
export type Mood = "stressed" | "frustrated" | "beginner";

const FORMS: Record<Form, string> = {
  chat: "This is conversation, not a request: reply in one or two warm, natural sentences. No heading, no list, no menu of things you could do.",
  fact: "This is a small factual question: answer in one or two sentences — the fact first, then the single detail that makes it useful. No heading, no list.",
  steps: "This asks how to do something: numbered steps, one action each, with the exact command, setting or click in `code` or **bold**; at most eight steps; say what they should see when it has worked. Anything they must have first goes in one line before step 1.",
  compare: "This is a comparison: open with a one-sentence verdict, then a table — one row per thing that actually decides it, one column per option — then one line on when to choose each.",
  decide: "This asks for a decision: give the recommendation in the first sentence, then the two or three reasons that decide it, then what would change the answer. Do not lay out options without choosing.",
  fix: "This is something broken: say the cause in one sentence, give the fixed code or setting in full, then how to confirm it is fixed. Mention anything else you noticed in one line at the end, not before the fix.",
  build: "This asks for something built: deliver it complete and runnable — every file whole, each under its file name; how to run it in one command; which part to edit first. Production quality: handle the empty, loading and error cases, validate input, no secrets in client code, accessible and responsive by default.",
  list: "This asks for a list: give it numbered, each item one line with the reason it is on the list; the strongest first; no introduction and no closing summary.",
  explain: "This asks to understand something: the shortest true answer first, then build it up with one concrete example; use a heading only if it runs past four paragraphs. End with one short question they can answer to check it landed.",
  message: "This is something to send: write the thing itself, ready to use (a subject line if it is an email), in the right tone for who reads it. No commentary before it; at most one line after, if a choice was made they should know about.",
  deep: "They asked for depth: be thorough, organise it with clear headings, and put a three-line summary at the top so the whole can be read in ten seconds.",
};

const MOODS: Record<Mood, string> = {
  stressed: "They sound stressed or overwhelmed: start with one or two sentences that take it seriously, in plain warm words (not a script), then give one small next step they can do today — not a list of tips. Keep it short; a long answer reads as the size of the problem.",
  frustrated: "They sound frustrated: no apology paragraph and no restating the problem. Lead with what to do, then what was wrong in one line.",
  beginner: "They are new to this: no unexplained jargon (define a term in a few words the first time), one idea at a time, and an everyday comparison where it helps.",
};

const W = (s: string) => new RegExp(s, "i");
const CHAT = /^(hi|hello|hey|hiya|yo|salam|привет|сәлем|good (morning|afternoon|evening|night)|how are you|how's it going|what'?s up|thanks|thank you|ok(ay)?|cool|nice|great|lol|haha|bye|good ?night|спасибо|рахмет)\b[^?]{0,30}$/iu;
const FACT = /^(what(?:'s| is| are| was| were)|who (is|was|are|were|wrote|invented|discovered|founded|won)|when (is|was|did|does)|where (is|are|was)|how (many|much|old|tall|far|long|big)|define|meaning of|capital of)\b/i;
const STEPS = W("\\b(how (do|can|should) i|how to|steps? (to|for)|set ?up|install|configure|get started with|walk me through (setting|installing))\\b");
const COMPARE_STRONG = W("\\b(vs\\.?|versus|compare|comparison|difference between|differences between|which is better)\\b");
const DECIDE = W("\\b(should i|should we|which (one )?should|what would you (choose|pick|recommend)|recommend|is it worth|best (way|option|choice|laptop|phone|language|framework|approach) (for|to))\\b");
const FIX = W("\\b(error|exception|bug|broken|doesn'?t work|does not work|not working|fails?|failing|crash(es|ed|ing)?|won'?t (run|compile|start|load)|stack ?trace|undefined is not|cannot read|traceback|fix (this|my|it))\\b");
const BUILD = W("\\b(build|make|create|code|write) (me )?(an?|the|my)? ?(web ?site|website|web app|webpage|landing page|app|application|game|tool|dashboard|api|backend|server|bot|extension|script|program|calculator|to-?do|tracker|clone)\\b");
const LIST = W("\\b(ideas? for|list (of|some)|give me (\\d+|some|a few|ten|five)|top \\d+|examples of|names for)\\b");
const EXPLAIN = W("\\b(explain|why (does|do|is|are|did)|how (does|do|did) .{1,60} work|what does .{1,40} mean|help me understand|eli5|in simple terms)\\b");
const MESSAGE = W("\\b(write|draft) (me )?(an?|the|my)? ?(email|letter|message|reply|text|post|cover letter|bio|caption|speech|announcement)\\b");
const DEEP = W("\\b(in detail|in depth|in-depth|detailed|comprehensive|thorough(ly)?|deep dive|everything about|full guide|complete guide)\\b");

const STRESSED = /\b(stress(ed|ful)?|anxious|anxiety|panic(king)?|overwhelm(ed|ing)|can'?t cope|scared|terrified|worried|depress(ed|ing)|burn(ed|t)? out|hopeless|so tired of|i give up|failing (my|the|all)|failed (my|the))\b/i;
const FRUSTRATED = /\b(still (doesn'?t|does not|not|isn'?t|broken|wrong)|again\?*!|wtf|why won'?t|for the (\w+ )?time|nothing works|useless|ugh+)\b|!{2,}|\b[A-Z]{5,}\b.*\b[A-Z]{4,}\b/;
const BEGINNER = /\b(i'?m (new|a beginner|just starting)|beginner|never (done|used|coded|programmed)|complete noob|noob|newbie|from scratch|in simple (terms|words)|like i'?m (five|5|a kid))\b/i;

/** The form the content of this question has, or null for none in particular. */
export function formOf(ask: string, kind?: TaskKind): Form | null {
  const t = ask.trim();
  if (!t) return null;
  const words = t.split(/\s+/).length;
  if (words <= 8 && CHAT.test(t)) return "chat";
  if (MESSAGE.test(t) || kind === "writing") return "message";
  if (BUILD.test(t)) return "build";
  if (FIX.test(t) && (kind === "coding" || /```|\b(code|app|site|page|script|function|npm|pip|python|javascript|react)\b/i.test(t))) return "fix";
  if (COMPARE_STRONG.test(t)) return "compare";
  if (DECIDE.test(t)) return "decide";
  if (DEEP.test(t)) return "deep";
  if (STEPS.test(t)) return "steps";
  if (LIST.test(t)) return "list";
  if (EXPLAIN.test(t) || kind === "learning") return "explain";
  if (words <= 12 && FACT.test(t)) return "fact";
  return null;
}

/** How the person seems, from how they wrote this (and, lightly, the turn before). */
export function moodOf(ask: string, earlier: string[] = []): Mood[] {
  const t = ask.trim();
  const out: Mood[] = [];
  if (STRESSED.test(t)) out.push("stressed");
  if (FRUSTRATED.test(t) || (earlier.length && /\b(still|again)\b/i.test(t) && FIX.test(t))) out.push("frustrated");
  if (BEGINNER.test(t)) out.push("beginner");
  return out;
}

/**
 * The block for the writer: the form, then how they are. Empty when neither
 * was recognised, so an ordinary question carries nothing extra.
 */
export function formNote(ask: string, opts: { kind?: TaskKind; earlier?: string[] } = {}): string {
  const form = formOf(ask, opts.kind);
  const moods = moodOf(ask, opts.earlier);
  const lines = [form ? FORMS[form] : "", ...moods.map((m) => MOODS[m])].filter(Boolean);
  if (!lines.length) return "";
  return `## The shape of this answer\n\nRead from how this question was asked. The person's own words about length or format win over this.\n\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
