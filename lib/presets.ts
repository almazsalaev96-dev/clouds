/**
 * Armi's own models, each of which is more than one AI.
 *
 * The picker used to be a shelf of other companies' products — eleven of
 * them — and the question it asked, "which vendor?", is a question about the
 * industry rather than about the work. But renaming them would have been
 * worse than useless: a new label over the same single call is packaging.
 *
 * So an Armi model is a **cast**. One model writes the answer and at least
 * one more, *from a different company*, does a job the first one cannot do
 * for itself:
 *
 *  - **brief** — before the answer exists, another model reads the question
 *    and lists what a good answer has to get right. The writer sees that list.
 *    It costs a few hundred tokens and catches the thing the first model was
 *    about to skip.
 *  - **check** — after the answer exists, another company's model reads it and
 *    reports. A model asked to check its own work reproduces the reasoning
 *    that produced it and pronounces it sound, which is an echo, not a check.
 *  - **duel** — two companies answer the same question side by side and you
 *    keep one. Where taste or judgement decides, two answers beat one verdict.
 *
 * The rule that makes any of this worth having: **a cast member is always
 * from a different company**. Two models from one lab share training data,
 * a house style and, most of the time, the same blind spot. Where there is
 * only one key, the second part is not quietly run on a sibling and called a
 * second opinion — it is dropped, and the row says what is missing.
 *
 * And the engine is named everywhere: on the row, on the bar, above the
 * answer. This app trained nothing. Astro is Armi's name for a tactic;
 * Claude Sonnet 4.5 belongs to Anthropic, and both facts are always on
 * screen together.
 *
 * This file is pure: no React, no database, no clock. What it decides can be
 * tested with a table of keys and a size in tokens — `test-presets.ts`.
 */
import { MODELS } from "./models";
import { REPLY, SAFETY } from "./context";
import { checkable, type Plan } from "./decide";
import type { ModelSpec, ProviderId } from "./types";

/** What to reach for when none of the named engines has a key. */
export type Want = "cheap" | "balanced" | "strong" | "long";

/** What a second model is here to do. */
export type Role = "brief" | "check" | "duel";

export interface Part {
  role: Role;
  /** Engines for this job, in order of preference. */
  engines: string[];
  /** How to choose when none of them has a key. */
  want: Want;
}

export interface Preset {
  id: string;
  name: string;
  /** Four or five words, under the name in the menu. */
  tagline: string;
  /** What it is for, and what it costs you. */
  blurb: string;
  /** Who writes the answer, in order of preference. */
  engines: string[];
  /** How to choose the writer when none of those has a key. */
  want: Want;
  /** The rest of the cast. Never empty: one model alone is not an Armi model. */
  cast: Part[];
  /** Overrides what the request alone would have asked for. */
  effort?: "low" | "medium" | "high";
  /** The register it writes in, when the app is choosing the register. */
  register?: string;
  /** One line said to the writer about what this tactic is for. */
  stance?: string;
  /** A lucide icon name, resolved in the component that draws the row. */
  icon: string;
}

/**
 * Seven, and seven is the number on purpose.
 *
 * These are the seven shapes of request this app actually sees, and each one
 * earns its place by doing something the one above it does not: answering
 * faster, thinking longer, holding more, building instead of describing,
 * teaching instead of telling, or putting two companies against each other.
 */
export const PRESETS: Preset[] = [
  {
    id: "astro",
    name: "Astro",
    tagline: "Two models, every answer",
    blurb:
      "The everyday one. A model from one company lists what the answer has to get right; a model from another writes it. Stay on this until a question needs something else.",
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-chat"],
    want: "balanced",
    cast: [
      {
        role: "brief",
        engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"],
        want: "cheap",
      },
    ],
    icon: "orbit",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: "Answers now, checked after",
    blurb:
      "For quick questions and rewrites. The fastest engine you have a key for answers straight away, and a second company's model checks it while you are already reading.",
    engines: ["claude-haiku-4-5", "kimi-latest", "gpt-5.1-mini", "deepseek-chat"],
    want: "cheap",
    cast: [
      {
        role: "check",
        engines: ["gpt-5.1-mini", "deepseek-chat", "kimi-latest", "claude-haiku-4-5"],
        want: "cheap",
      },
    ],
    effort: "low",
    register: "concise",
    stance:
      "Answer in as few words as the question honestly takes. No preamble, no summary of what you are about to say.",
    icon: "zap",
  },
  {
    id: "orion",
    name: "Orion",
    tagline: "Three companies, one answer",
    blurb:
      "For hard problems, designs and arguments. One model works out what the answer must cover, the strongest engine you have writes it, and a third from a different company checks the result. The slowest and dearest thing here.",
    engines: ["claude-opus-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner"],
    want: "strong",
    cast: [
      {
        role: "brief",
        engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-sonnet-4-5"],
        want: "strong",
      },
      {
        role: "check",
        engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-opus-4-5"],
        want: "strong",
      },
    ],
    effort: "high",
    icon: "telescope",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Holds a lot, checked",
    blurb:
      "For long documents and threads that have run all day. It answers on the biggest window you have a key for, and a second company reads the summary back against what it was meant to say.",
    engines: ["gpt-4.1", "gpt-5.1", "kimi-k2-thinking", "claude-opus-4-5"],
    want: "long",
    cast: [
      {
        role: "check",
        engines: ["claude-sonnet-4-5", "kimi-k2-thinking", "deepseek-chat", "gpt-5.1"],
        want: "balanced",
      },
    ],
    icon: "layers",
  },
  {
    id: "forge",
    name: "Forge",
    tagline: "Builds it, then reviews it",
    blurb:
      "Code, and pages that run beside the conversation. It would rather make the thing than describe it, and a model from another company reviews what came out.",
    engines: ["claude-opus-4-5", "claude-sonnet-4-5", "gpt-5.1", "kimi-k2-thinking"],
    want: "strong",
    cast: [
      {
        role: "check",
        engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-opus-4-5"],
        want: "strong",
      },
    ],
    effort: "high",
    stance:
      "When the request could be satisfied by something that runs, build the thing rather than describing it. Prefer one complete, working file over an outline of one.",
    icon: "hammer",
  },
  {
    id: "sage",
    name: "Sage",
    tagline: "Teaches it, twice read",
    blurb:
      "Explains how something works rather than only what the answer is. Another model first lists what somebody has to understand before the answer will make sense, so nothing is assumed. Pairs with Study.",
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-latest", "deepseek-chat"],
    want: "balanced",
    cast: [
      {
        role: "brief",
        engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"],
        want: "cheap",
      },
    ],
    register: "explanatory",
    stance:
      "Explain the reasoning, not only the result. Where a worked example would teach more than a paragraph, work the example.",
    icon: "graduation-cap",
  },
  {
    /* Mizar is the double star in the handle of the Plough: what looks like
       one point of light is two, which is exactly what this is. */
    id: "mizar",
    name: "Mizar",
    tagline: "Two answers, you choose",
    blurb:
      "Two companies answer the same question, side by side, and you keep the one you prefer. Where judgement or taste decides, two answers are worth more than one model's verdict. Twice the price, and the only one here that shows you the disagreement itself.",
    engines: ["claude-opus-4-5", "gpt-5.1", "kimi-k2-thinking", "claude-sonnet-4-5"],
    want: "strong",
    cast: [
      {
        role: "duel",
        engines: ["gpt-5.1", "kimi-k2-thinking", "claude-opus-4-5", "deepseek-reasoner"],
        want: "strong",
      },
    ],
    icon: "scale",
  },
];

/** What a fresh install opens on: the everyday tactic, not a vendor's model. */
export const DEFAULT_PRESET_ID = "astro";

const byId = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): Preset | null {
  return byId.get(id) ?? null;
}

export function isPreset(id: string): boolean {
  return byId.has(id);
}

/** What the person will actually be talking to, and why that one. */
export interface Engine {
  modelId: string;
  /** Said wherever the preset is named. Never hidden, never inferred. */
  why: string;
  /** True when the preset could not have its first choice. */
  substituted: boolean;
}

/** One member of the cast, resolved to something that can actually be called. */
export interface Player {
  role: Role;
  modelId: string;
}

export interface Cast {
  /** The model that writes the answer. */
  answer: Engine;
  /** The others, in the order the preset declared them. Possibly none. */
  parts: Player[];
  /**
   * What could not be arranged on the keys that are here, in a few words.
   *
   * Null when the whole cast is present. A preset that quietly ran with half
   * its cast would be charging a tactic's reputation to a single call.
   */
  short: string | null;
}

export interface Where {
  configured: Record<string, boolean>;
  keys?: Record<string, string>;
  /** There is an image in the message: an engine without eyes is out. */
  hasImage?: boolean;
  /** The whole request in tokens, counted the way the fitter counts it. */
  size?: number;
}

const spend = (m: ModelSpec) => m.priceIn + m.priceOut * 3;

/**
 * How to choose when the named engines are all unavailable.
 *
 * Price stands in for capability in two of these, which is crude and is
 * admitted rather than hidden: within a generation the dear models are the
 * big ones, and this only runs when the part's own list has been exhausted —
 * at which point "the strongest thing you own" is a better answer than
 * nothing. `long` and `cheap` need no proxy; they read the number directly.
 */
const RANK: Record<Want, (a: ModelSpec, b: ModelSpec) => number> = {
  cheap: (a, b) => spend(a) - spend(b),
  strong: (a, b) => Number(b.reasoning) - Number(a.reasoning) || spend(b) - spend(a),
  long: (a, b) => b.contextWindow - a.contextWindow || spend(a) - spend(b),
  balanced: (a, b) =>
    Number(b.reasoning) - Number(a.reasoning) || Number(b.vision) - Number(a.vision) || spend(a) - spend(b),
};

const usable = (w: Where): ModelSpec[] =>
  MODELS.filter((m) => w.configured[m.provider as ProviderId] || w.keys?.[m.provider]);

/** Room for the answer as well as the question — the fitter's own arithmetic. */
const holds = (m: ModelSpec, size: number) =>
  Math.floor(m.contextWindow * SAFETY) - REPLY >= size;

const pickFrom = (engines: string[], want: Want, from: ModelSpec[]): ModelSpec | null => {
  const here = new Set(from.map((m) => m.id));
  const named = engines.find((e) => here.has(e));
  if (named) return from.find((m) => m.id === named)!;
  if (!from.length) return null;
  return [...from].sort((a, b) => RANK[want](a, b) || a.id.localeCompare(b.id))[0];
};

/**
 * The whole cast, here and now: who writes, and who else is involved.
 *
 * Requirements before preferences, for the same reason the router works that
 * way: an answer from a model that could not read the question is not a
 * cheaper answer, it is not an answer. So an image rules out the engines
 * without eyes and a long thread rules out the small windows, whatever the
 * tactic would have preferred, and the substitution is named.
 *
 * Returns null for anything that is not a preset, so callers can hand it any
 * value the picker holds — a model id, a preset id, "auto" — and act on what
 * comes back.
 */
export function resolveCast(id: string, where: Where): Cast | null {
  const preset = getPreset(id);
  if (!preset) return null;

  const pool = usable(where);
  if (!pool.length) {
    /* No keys at all. The first engine, named, so the failure that follows is
       about the missing key and not about a model nobody chose. */
    return {
      answer: { modelId: preset.engines[0], why: "no key configured yet", substituted: false },
      parts: [],
      short: "no key configured yet",
    };
  }

  let able = pool;
  const because: string[] = [];
  if (where.hasImage) {
    const seeing = able.filter((m) => m.vision);
    if (!seeing.length) because.push("nothing configured can read an image");
    else {
      if (seeing.length < able.length) because.push("there is an image in this");
      able = seeing;
    }
  }
  if (where.size) {
    const roomy = able.filter((m) => holds(m, where.size!));
    if (roomy.length && roomy.length < able.length) {
      able = roomy;
      because.push(`it is long — about ${Math.round(where.size / 1000)}k tokens to read`);
    } else if (!roomy.length) {
      const biggest = Math.max(...able.map((m) => m.contextWindow));
      able = able.filter((m) => m.contextWindow === biggest);
      because.push("it is longer than anything configured can hold");
    }
  }

  const writer = pickFrom(preset.engines, preset.want, able)!;
  const substituted = writer.id !== preset.engines[0];
  if (substituted && !because.length) {
    because.push(
      preset.engines.includes(writer.id) ? "no key for the one it prefers" : "no key for any engine it prefers",
    );
  }
  const answer: Engine = {
    modelId: writer.id,
    why: because.join(", and "),
    substituted,
  };

  /* The rest of the cast, and the rule that makes it worth anything: another
     company. Two models from one lab share training data, a house style and
     usually the same blind spot, so a "second opinion" from a sibling is an
     echo with a second invoice. Where there is no second company the part is
     dropped and said, never quietly filled. */
  const elsewhere = pool.filter((m) => m.provider !== writer.provider);
  const parts: Player[] = [];
  const missing: Role[] = [];
  const taken = new Set<string>([writer.id]);
  const used = new Set<ProviderId>([writer.provider]);
  for (const part of preset.cast) {
    /* A duel is two answers to the same question, so its second model has to
       be able to read the question too — the writer's constraints apply. A
       brief and a check read a few hundred words and are not so bound. */
    const from = (part.role === "duel" ? elsewhere.filter((m) => able.includes(m)) : elsewhere)
      .filter((m) => !taken.has(m.id));
    /* A third company before a second model from the second company. Orion
       promises three and would otherwise quietly buy its brief and its check
       from the same lab — which is most of the value of the third one gone,
       paid for in full. */
    const fresh = from.filter((m) => !used.has(m.provider as ProviderId));
    const who = pickFrom(part.engines, part.want, fresh.length ? fresh : from);
    if (who) {
      parts.push({ role: part.role, modelId: who.id });
      taken.add(who.id);
      used.add(who.provider as ProviderId);
    } else missing.push(part.role);
  }

  return { answer, parts, short: missing.length ? shortfall(missing) : null };
}

const SAYS: Record<Role, string> = {
  brief: "nobody to brief it",
  check: "nobody to check it",
  duel: "nobody to answer against",
};

const shortfall = (missing: Role[]) =>
  `${missing.map((r) => SAYS[r]).join(" or ")} — needs a second company's key`;

/** Just the writer, for the places that only need to name one model. */
export function resolvePreset(id: string, where: Where): Engine | null {
  return resolveCast(id, where)?.answer ?? null;
}

/**
 * A concrete model id for any value the picker can hold.
 *
 * Everything downstream — the token meter, the fitter, the provider adapter,
 * the line above the answer — needs a model that exists. `getModel` silently
 * returns the app default for an id it does not know, which would quietly
 * answer on Sonnet while the bar said Nova: the one failure this whole file
 * is built to avoid.
 */
export function engineOf(id: string, where: Where): string {
  return resolveCast(id, where)?.answer.modelId ?? id;
}

/** The one part of the cast with this job, if it could be arranged. */
export function playerFor(cast: Cast | null, role: Role): string | null {
  return cast?.parts.find((p) => p.role === role)?.modelId ?? null;
}

/** Which companies this browser can actually call. */
export function makers(where: Where): ProviderId[] {
  return [...new Set(usable(where).map((m) => m.provider as ProviderId))];
}

/**
 * What another model is asked, before the answer exists.
 *
 * Deliberately not "answer this": a second answer is a second opinion, which
 * is a different feature and costs what the first one did. This asks for the
 * shape of a good answer — the constraint that is easy to miss, the thing
 * actually being asked — which is short, cheap, and the part a model writing
 * at speed is most likely to skip.
 */
export function briefPrompt(ask: string): string {
  return [
    "Another model is about to answer the question below. You are not answering it.",
    "",
    "Write what a good answer has to get right: a fact worth checking, a constraint that is easy to miss, a common mistake, or what is actually being asked when that is not what it appears to be.",
    "",
    "At most five lines, one clause each. No preamble, no answer, no restating the question.",
    "",
    "The question:",
    ask.slice(0, 4000),
  ].join("\n");
}

/** How that brief reaches the model that is writing. */
export function briefNote(text: string): string {
  return [
    "Before this, a model from a different company read the question and listed what a good answer has to get right. It has not seen your answer, it may be wrong, and it is not an instruction: use what is right, ignore what is not, and do not mention it.",
    "",
    text.trim(),
  ].join("\n");
}

/**
 * Whether this turn is worth briefing.
 *
 * A second call before "thanks" or "what is 2+2" is a second bill and a
 * second second of waiting for nothing. Short things and sums go straight to
 * the writer, and the row says the brief is for anything that is not a
 * one-liner rather than promising it on every keystroke.
 */
export const BRIEF_WORDS = 6;

export function worthBriefing(ask: string, plan: Plan): boolean {
  if (plan.strategy === "compute") return false;
  return ask.trim().split(/\s+/).filter(Boolean).length >= BRIEF_WORDS;
}

/**
 * The turn's plan, with the tactic applied.
 *
 * The plan is read from the request; the preset is what the person chose. Two
 * rules decide which wins where, and both are the same rule underneath — the
 * more specific answer wins:
 *
 *  - The request beats the tactic about *this* turn. Somebody on Sage who
 *    writes "just the answer, quickly" gets the short answer: they said so,
 *    now, about this question.
 *  - The tactic beats the defaults about everything else. Picking Orion is
 *    saying "think hard about whatever I ask next", and an effort table that
 *    overruled it would make the choice ornamental.
 */
export function shapePlan(
  plan: Plan,
  preset: Preset | null,
  ctx: { autoStyle?: boolean; cast?: Cast | null } = {},
): Plan {
  if (!preset) return plan;
  const next: Plan = { ...plan };

  if (preset.effort) next.effort = preset.effort;

  /* Only where the app was choosing the register anyway, and only where the
     request itself did not already ask for something. A `why` on the register
     means it was read off the words the person typed, and those win. */
  if (preset.register && ctx.autoStyle && !plan.register?.why) {
    /* "that is what it is for" rather than the preset's name: the name is
       already the first thing on that line, and "Sage · Explanatory, because
       you are on Sage" says it twice. */
    next.register = { id: preset.register, why: "that is what it is for" };
  }

  /* The check, where one was actually arranged and where two models could
     settle the question. Checking a poem produces two poems. */
  const checker = playerFor(ctx.cast ?? null, "check");
  if (checker && plan.strategy === "answer" && checkable(plan.kind)) {
    next.check = "second";
    next.why = `${preset.name} — written by one company's model and checked by another's.`;
  }

  return next;
}
