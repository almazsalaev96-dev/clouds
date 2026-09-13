import type { Memory, MemoryKind } from "./types";
import { estimateTokens } from "./models";

/**
 * What the app remembers about you between conversations.
 *
 * ## It only remembers what you told it to
 *
 * The other way to build this is to read every turn with a model afterwards
 * and keep whatever looks durable. That costs a call per turn, and it keeps
 * things you never agreed to — which is the failure the whole feature is one
 * misstep away from. A memory you did not ask for is indistinguishable, from
 * the outside, from an app that is quietly writing down everything you say.
 *
 * So the trigger is a sentence: *remember that I write in British English*.
 * Detection is a regex, which means it is free, it runs before anything is
 * sent anywhere, and it is inspectable — you can read this file and know
 * exactly what makes the app keep something. The cost is recall: it will not
 * notice that you have mentioned your dissertation in nine conversations. That
 * is a real limitation and it is stated in the README rather than papered over
 * with a heuristic that guesses.
 *
 * ## Not everything you ask it to remember
 *
 * `refuseToRemember` is the one place the app overrules the request, and it
 * overrules it for one reason: the sentence contains a credential. An API key
 * in a memory is an API key in every prompt that memory is retrieved into —
 * sent to a provider, sitting in their logs, in a text field with no masking
 * and no rotation. The app already goes to some trouble to keep keys out of
 * backups; a memory is the same hole with a friendlier door.
 *
 * ## Retrieval is selective, and in the turn rather than the prefix
 *
 * Everything the model is told before your first word is assembled by
 * `composeSystemPrompt`, and it is built to be a *stable prefix* so the
 * provider's cache can hold it. Memory cannot live there: what gets retrieved
 * depends on what you just asked, so it changes every turn, and folding a
 * per-turn block into the prefix invalidates the cache for the project
 * knowledge sitting above it. It goes in the turn block, beside the rest of
 * what belongs to this question.
 */

/** How much of a turn memory may spend. Small on purpose — it is context, not content. */
export const MEMORY_BUDGET_TOKENS = 500;

/** And how many, whatever they cost. A list nobody could hold in their head is a list nobody can audit. */
export const MAX_RETRIEVED = 12;

/**
 * A memory is a sentence.
 *
 * Longer than this and it is a document, and a document belongs in a project
 * where it can be read whole, cited and removed on its own. Truncating instead
 * would be the worse answer: half a rule reads as a complete one.
 */
export const MAX_MEMORY_CHARS = 300;

/* --- Reading the request ------------------------------------------------ */

/**
 * The openings that mean "keep this".
 *
 * Deliberately short, and deliberately anchored to the start of a sentence.
 * Recall is not the thing to optimise here — a memory saved by accident is the
 * failure mode of the entire feature, and the person who wanted one and did not
 * get it can simply ask again in plainer words.
 */
const TRIGGERS = [
  /(?:^|[.!?]\s+)(?:please\s+)?remember\s*(?:that|this[:,]|[:,])\s*/i,
  /(?:^|[.!?]\s+)(?:please\s+)?(?:keep in mind|bear in mind)\s+that\s+/i,
  /(?:^|[.!?]\s+)(?:please\s+)?don'?t forget\s+that\s+/i,
  /(?:^|[.!?]\s+)for future reference[,:]\s*/i,
  /(?:^|[.!?]\s+)from now on[,:]\s+/i,
];

/**
 * `remember to …` is not one of them.
 *
 * It is a reminder, and this app has no clock, no notifications and nothing
 * that will ever bring it back to you at the right moment. Filing it under
 * "things I know about you" would be the app answering a request it cannot
 * perform with a shape that looks like it did.
 */
const NOT_A_MEMORY = /(?:^|[.!?]\s+)(?:please\s+)?remember\s+to\s+/i;

export interface RememberRequest {
  /** The sentence to keep, cleaned up but not rewritten. */
  text: string;
  kind: MemoryKind;
}

/**
 * Whether this message asks the app to remember something, and what.
 *
 * Returns null for a question — *do you remember what I said?* is a question
 * about the past, not an instruction about the future, and the two are one
 * question mark apart.
 */
export function readRememberRequest(message: string): RememberRequest | null {
  const text = message.trim();
  if (!text) return null;
  if (NOT_A_MEMORY.test(text)) return null;
  // "I remember that…" and "you remember that…" are recall, not instruction.
  if (/(?:^|[.!?]\s+)(?:i|you|we|they)\s+remember\b/i.test(text)) return null;

  for (const trigger of TRIGGERS) {
    const m = trigger.exec(text);
    if (!m) continue;
    const from = m.index + m[0].length;
    const rest = text.slice(from);
    // To the end of the sentence, so "Remember that I use metric. Now convert
    // this recipe." keeps the rule and not the errand.
    const end = rest.search(/[.!?](?:\s|$)/);
    const claimed = (end === -1 ? rest : rest.slice(0, end)).trim();
    if (isQuestion(text, from + (end === -1 ? rest.length : end))) return null;
    const clean = tidy(claimed);
    if (!clean) return null;
    return { text: clean, kind: classify(clean) };
  }
  return null;
}

/** A trigger inside a question is part of the question. */
function isQuestion(text: string, at: number): boolean {
  const sentence = text.slice(0, at);
  const start = Math.max(sentence.lastIndexOf("."), sentence.lastIndexOf("!"), sentence.lastIndexOf("?"));
  const rest = text.slice(start + 1);
  const end = rest.search(/[.!?](?:\s|$)/);
  return (end === -1 ? rest : rest.slice(0, end + 1)).trimEnd().endsWith("?");
}

/** Cleaned, not rewritten: the leading conjunction goes, the words stay yours. */
function tidy(s: string): string {
  const out = s
    .replace(/^(?:that|this|the fact that)\s+/i, "")
    .replace(/^[,:;\-\s]+/, "")
    .replace(/[,:;\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (out.length < 3) return "";
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const PREFERENCE = /\b(?:prefer|prefers|preferred|like|likes|dislike|hate|always|never|call me|my name is|in (?:metric|imperial|celsius|fahrenheit)|units?|spelling|british|american|tone|style|format|language|shorter|longer|concise|verbose|bullet|prose)\b/i;
const PROJECT = /\b(?:working on|work on|building|build(?:ing)? a|my (?:project|company|startup|thesis|dissertation|book|team|repo|app|site))\b/i;
const WORKFLOW = /\b(?:when(?:ever)? i (?:ask|say|send)|if i (?:ask|say|send)|every time i|my (?:workflow|process)|first .*then)\b/i;

function classify(text: string): MemoryKind {
  if (WORKFLOW.test(text)) return "workflow";
  if (PREFERENCE.test(text)) return "preference";
  if (PROJECT.test(text)) return "project";
  return "fact";
}

/* --- The one thing it refuses ------------------------------------------- */

/**
 * Patterns that are credentials by construction.
 *
 * Prefix-shaped ones first, because those are certain — nothing that starts
 * `sk-ant-` and runs on for forty characters is a preference about spelling.
 */
const SECRET_SHAPES: [RegExp, string][] = [
  [/\bsk-[A-Za-z0-9_-]{16,}/, "an API key"],
  [/\bsk-ant-[A-Za-z0-9_-]{8,}/, "an API key"],
  [/\bAIza[0-9A-Za-z_-]{20,}/, "an API key"],
  [/\bAKIA[0-9A-Z]{12,}/, "an access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/, "an access token"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "an access token"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "an access token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "a signed token"],
  [/\b(?:bearer|authorization)\s*[:=]?\s*[A-Za-z0-9._-]{20,}/i, "an access token"],
];

/**
 * And the ones that are credentials by what the sentence says they are.
 *
 * A password has no shape — `hunter2` is a password and also a word — so the
 * only signal is the person saying so. Which they do, in the sentence they are
 * asking to have written down.
 */
const SECRET_WORDS =
  /\b(?:password|passphrase|passcode|api[- ]?key|secret[- ]?key|private[- ]?key|access[- ]?token|refresh[- ]?token|seed phrase|recovery phrase|security code|cvv|pin(?:\s+number)?)\b\s*(?:for\s+\S+\s*)?(?:is|=|:)\s*\S/i;

/**
 * Why this must not be remembered, or null if it may be.
 *
 * The string is shown to the person, so it names what was recognised and does
 * not repeat it back.
 */
export function refuseToRemember(text: string): string | null {
  if (text.trim().length > MAX_MEMORY_CHARS) {
    return `That is longer than a memory should be. Keep it to a sentence — anything bigger belongs in a project, where it can be read whole and removed on its own.`;
  }
  for (const [re, what] of SECRET_SHAPES) {
    if (re.test(text)) return `That looks like ${what}, and a memory goes out with your questions. Nothing secret is kept here.`;
  }
  if (SECRET_WORDS.test(text)) {
    return `That reads as a credential, and a memory goes out with your questions. Nothing secret is kept here.`;
  }
  if (luhnCandidate(text)) {
    return `That looks like a card number, and a memory goes out with your questions. Nothing secret is kept here.`;
  }
  return null;
}

/** A 13–19 digit run that passes Luhn. Spaces and dashes are how people type them. */
function luhnCandidate(text: string): boolean {
  for (const m of text.matchAll(/\b(?:\d[ -]?){12,18}\d\b/g)) {
    const digits = m[0].replace(/[^0-9]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

/* --- Not keeping the same thing twice ----------------------------------- */

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "i", "in", "is", "it",
  "me", "my", "of", "on", "or", "that", "the", "this", "to", "want", "was", "with", "you", "your",
]);

/** Words worth matching on. Lowercased, de-punctuated, stopwords dropped. */
export function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    // A crude stem, and crude is the right amount: it collapses plurals and
    // gerunds, which is where most near-misses live, and does nothing clever.
    out.add(raw.replace(/(?:ies|es|s|ing|ed)$/, ""));
  }
  return out;
}

/** How much two sentences say the same thing, 0 to 1. */
export function similarity(a: string, b: string): number {
  const ta = terms(a);
  const tb = terms(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

/** Near enough that keeping both would be keeping one twice. */
export const SAME_ENOUGH = 0.7;

/** The existing memory this one restates, if any. */
export function findDuplicate(text: string, existing: Memory[]): Memory | null {
  let best: { m: Memory; score: number } | null = null;
  for (const m of existing) {
    const score = similarity(text, m.text);
    if (score >= SAME_ENOUGH && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}

/* --- Choosing what goes out with a question ----------------------------- */

export interface RetrievalOptions {
  /** The project this conversation belongs to, if any. */
  projectId?: string;
  budgetTokens?: number;
  max?: number;
}

/**
 * Which memories this question needs.
 *
 * Two tiers, because one rule cannot serve both halves of what a memory is:
 *
 * A **preference** is a standing instruction. *Answer in metric* has no word
 * in common with *how far away is the moon*, and is exactly as relevant to it
 * as to everything else. Matching those on vocabulary would file them away
 * precisely when they are needed. So preferences are always eligible, ordered
 * by how recently they were set or used, and capped low enough that they
 * cannot crowd the turn.
 *
 * Everything else — a fact, a project, a workflow — has to earn its place by
 * overlapping with what was asked. *My dissertation is on tidal locking* is
 * useful when the subject comes up and noise when it does not, and shipping
 * the whole database every turn is the thing §95 is about.
 */
export function retrieve(
  memories: Memory[],
  question: string,
  opts: RetrievalOptions = {},
): Memory[] {
  const budget = opts.budgetTokens ?? MEMORY_BUDGET_TOKENS;
  const max = opts.max ?? MAX_RETRIEVED;
  const asked = terms(question);

  /* A memory written inside a project belongs to it. Outside that project it
     is not merely less relevant, it is somebody else's context — the one place
     retrieval is a hard filter rather than a score. */
  const eligible = memories.filter((m) => !m.projectId || m.projectId === opts.projectId);

  const scored = eligible.map((m) => {
    const mine = terms(m.text);
    let shared = 0;
    for (const t of mine) if (asked.has(t)) shared++;
    /* Divided by the root rather than the count, so a long memory with three
       matching words still beats a short one with one, without a two-word
       memory winning every time it lands. */
    const overlap = mine.size ? shared / Math.sqrt(mine.size) : 0;
    const standing = m.kind === "preference";
    const recency = recencyBonus(m);
    const scoped = m.projectId && m.projectId === opts.projectId ? 0.35 : 0;
    return {
      m,
      standing,
      score: overlap + recency + scoped + (standing ? 0.5 : 0),
      matched: shared > 0,
    };
  });

  const chosen = scored
    .filter((s) => s.standing || s.matched)
    .sort((a, b) => b.score - a.score);

  const out: Memory[] = [];
  let spent = 0;
  let standingKept = 0;
  for (const s of chosen) {
    if (out.length >= max) break;
    /* Standing preferences go every turn, which is only safe while there are
       few of them. Past this, the oldest-used ones wait their turn rather than
       the turn block growing without limit. */
    if (s.standing && !s.matched) {
      if (standingKept >= MAX_STANDING) continue;
      standingKept++;
    }
    const cost = estimateTokens(s.m.text) + 6;
    if (spent + cost > budget) continue;
    spent += cost;
    out.push(s.m);
  }
  return out;
}

/** How many standing preferences may ride along on a question that did not mention them. */
export const MAX_STANDING = 6;

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Recent beats stale, gently: a tenth of a point, halving every week. */
function recencyBonus(m: Memory): number {
  const at = Math.max(m.usedAt ?? 0, m.updatedAt);
  const age = Math.max(0, Date.now() - at);
  return 0.2 * Math.pow(0.5, age / WEEK);
}

/* --- Saying it to the model --------------------------------------------- */

const KIND_ORDER: MemoryKind[] = ["preference", "workflow", "project", "fact"];

/**
 * The block that goes out with the question.
 *
 * Grouped by kind, because the four kinds want different treatment and saying
 * so is cheaper than hoping: a preference is an instruction about the answer,
 * a fact is background. Undifferentiated, a model reads "they are writing a
 * dissertation on tidal locking" as a request to mention it.
 */
export function memoryBlock(memories: Memory[]): string {
  if (!memories.length) return "";
  const by = new Map<MemoryKind, string[]>();
  for (const m of memories) {
    const list = by.get(m.kind) ?? [];
    list.push(m.text.trim());
    by.set(m.kind, list);
  }
  const lines: string[] = [];
  for (const kind of KIND_ORDER) {
    const list = by.get(kind);
    if (!list?.length) continue;
    lines.push(`${KIND_HEADING[kind]}\n${list.map((t) => `- ${t}`).join("\n")}`);
  }
  return (
    `## What you remember about this person\n\n` +
    `They told you these directly, in earlier conversations. Treat the preferences as ` +
    `instructions about how to answer. Treat the rest as background you already have — ` +
    `use it where it bears on the question and do not recite it back, or announce that ` +
    `you remembered.\n\n${lines.join("\n\n")}`
  );
}

const KIND_HEADING: Record<MemoryKind, string> = {
  preference: "How they want answers:",
  workflow: "How they work:",
  project: "What they are working on:",
  fact: "About them:",
};

/** For the Memory panel, where the four kinds are shown as four groups. */
export const KIND_LABEL: Record<MemoryKind, string> = {
  preference: "Preference",
  workflow: "Workflow",
  project: "Project",
  fact: "Fact",
};
