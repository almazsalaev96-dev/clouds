/**
 * Armi's own models, which are tactics rather than weights.
 *
 * The picker used to be a shelf of other companies' products: Claude Opus
 * 4.5, GPT-5.1, Gemini 3 Pro, DeepSeek V3, eleven of them, and the question
 * it asked was "which vendor?" — which is a question about the industry, not
 * about the work. Answering it well requires knowing what all eleven are,
 * which is the job the app was supposed to be doing, and answering it badly
 * costs you either money or the answer.
 *
 * So the app names its own. An Armi model is a *tactic*: an ordered list of
 * engines it will run on, how hard it thinks, how it writes, whether a second
 * company's model checks the answer, and one line of instruction about what
 * it is for. Astro is not a rebadged Sonnet — it is "the everyday one", and
 * on a machine with only a Google key it is Gemini, and it is still Astro,
 * because the tactic is the thing being named and the engine is the thing
 * being rented.
 *
 * Three rules hold this honest, and they are the whole difference between a
 * useful abstraction and a lie:
 *
 *  1. **The engine is always named.** Every row in the picker says what it is
 *     running on, the bar says it, and the answer says it. Nobody is ever led
 *     to believe this app trained a model.
 *  2. **A substitution is said out loud.** When the preferred engine has no
 *     key, or cannot see the image, or cannot hold the thread, the one that
 *     answers instead is named along with the reason it was chosen.
 *  3. **The tactic is real.** Nova genuinely thinks less and writes shorter,
 *     Forge genuinely prefers to build the thing, Mizar genuinely calls a
 *     second company. A name over identical behaviour would be packaging.
 *
 * This file is pure: no React, no database, no clock. What it decides can be
 * tested with a table of keys and a size in tokens, which is what
 * `test-presets.ts` does.
 */
import { MODELS } from "./models";
import { REPLY, SAFETY } from "./context";
import { checkable, type Plan } from "./decide";
import type { ModelSpec, ProviderId } from "./types";

/** What to reach for when none of the named engines has a key. */
export type Want = "cheap" | "balanced" | "strong" | "long";

export interface Preset {
  id: string;
  name: string;
  /** Four or five words, under the name in the menu. */
  tagline: string;
  /** A sentence or two: what it is for, and what it costs you. */
  blurb: string;
  /**
   * Engines in order of preference. The first one there is a key for wins.
   *
   * Written as a list rather than a single model because a bring-your-own-key
   * app cannot assume which company you have paid. A preset that resolved to
   * one model would be unavailable to three quarters of the people who picked
   * it, which is a worse outcome than running the same tactic on a different
   * company's model and saying so.
   */
  engines: string[];
  /** How to choose when the list runs out. */
  want: Want;
  /** Overrides what the request alone would have asked for. */
  effort?: "low" | "medium" | "high";
  /** A second opinion from a different company, wherever one can settle it. */
  check?: "second";
  /** The register it writes in, when the app is choosing the register. */
  register?: string;
  /** One line said to the model about what this tactic is for. */
  stance?: string;
  /** It is not itself on one key: Mizar with one company is Mizar alone. */
  needsTwo?: boolean;
  /** A lucide icon name, resolved in the component that draws the row. */
  icon: string;
}

/**
 * Seven, and seven is the number on purpose.
 *
 * Eleven engines was a catalogue; three presets would have been a toy. These
 * are the seven shapes of request this app actually sees, and each one earns
 * its place by doing something the one above it does not: answering faster,
 * thinking longer, holding more, building instead of describing, teaching
 * instead of telling, or checking itself against a different company.
 */
export const PRESETS: Preset[] = [
  {
    id: "astro",
    name: "Astro",
    tagline: "The everyday one",
    blurb:
      "Good at nearly everything and quick enough that you stop noticing it. Stay on this one until a question needs something else.",
    engines: ["claude-sonnet-4-5", "gpt-5.1", "gemini-3-pro", "deepseek-chat"],
    want: "balanced",
    icon: "orbit",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: "Answers now",
    blurb:
      "For quick questions, rewrites and anything you would rather not wait for. Thinks less on purpose and writes short.",
    engines: ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"],
    want: "cheap",
    effort: "low",
    register: "concise",
    stance: "Answer in as few words as the question honestly takes. No preamble, no summary of what you are about to say.",
    icon: "zap",
  },
  {
    id: "orion",
    name: "Orion",
    tagline: "Thinks before it answers",
    blurb:
      "For hard problems, designs, proofs and arguments. The slowest and the dearest here, and the one to use when being right matters more than being quick.",
    engines: ["claude-opus-4-5", "gpt-5.1", "gemini-3-pro", "deepseek-reasoner"],
    want: "strong",
    effort: "high",
    icon: "telescope",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Holds a lot at once",
    blurb:
      "For long documents, whole files and threads that have run all day. Picks whichever engine has the biggest window you hold a key for.",
    engines: ["gemini-3-pro", "gpt-4.1", "gpt-5.1", "gemini-2.5-flash", "claude-opus-4-5"],
    want: "long",
    icon: "layers",
  },
  {
    id: "forge",
    name: "Forge",
    tagline: "Builds the thing",
    blurb:
      "Code, and pages that run beside the conversation. Given a choice between describing something and making it, it makes it.",
    engines: ["claude-opus-4-5", "claude-sonnet-4-5", "gpt-5.1", "gemini-3-pro"],
    want: "strong",
    effort: "high",
    stance:
      "When the request could be satisfied by something that runs, build the thing rather than describing it. Prefer one complete, working file over an outline of one.",
    icon: "hammer",
  },
  {
    id: "sage",
    name: "Sage",
    tagline: "Teaches it",
    blurb:
      "Explains how something works rather than only what the answer is, and leaves you able to do the next one yourself. Pairs with Study.",
    engines: ["claude-sonnet-4-5", "gpt-5.1", "gemini-3-pro", "deepseek-chat"],
    want: "balanced",
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
    tagline: "Two makers, not one",
    blurb:
      "One model answers and a model from a different company checks it, on anything two models can actually disagree about. Slower and dearer, and the only one here that can tell you it is unsure.",
    engines: ["claude-opus-4-5", "gpt-5.1", "gemini-3-pro", "claude-sonnet-4-5", "deepseek-reasoner"],
    want: "strong",
    check: "second",
    needsTwo: true,
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
 * big ones, and this only runs when the tactic's own list has been exhausted
 * — at which point "the strongest thing you own" is a better answer than
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

/**
 * The engine behind an Armi model, here and now.
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
export function resolvePreset(id: string, where: Where): Engine | null {
  const preset = getPreset(id);
  if (!preset) return null;

  const pool = usable(where);
  if (!pool.length) {
    /* No keys at all. The first engine, named, so the failure that follows is
       about the missing key and not about a model nobody chose. */
    return { modelId: preset.engines[0], why: "no key configured yet", substituted: false };
  }

  let able = pool;
  const because: string[] = [];
  if (where.hasImage) {
    const seeing = able.filter((m) => m.vision);
    if (seeing.length && seeing.length < able.length) {
      able = seeing;
      because.push("there is an image in this");
    } else if (!seeing.length) {
      because.push("nothing configured can read an image");
    } else {
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

  const here = new Set(able.map((m) => m.id));
  const first = preset.engines.find((e) => here.has(e));
  if (first) {
    /* Its first choice, or near enough: if a requirement narrowed the field
       and its top engine survived, nothing was substituted. */
    const substituted = first !== preset.engines[0];
    if (substituted && !because.length) because.push("no key for the one it prefers");
    return {
      modelId: first,
      why: because.length ? because.join(", and ") : "",
      substituted,
    };
  }

  /* Nothing it named is here. Take the best of what is, by what the tactic is
     for, and say that is what happened. */
  const best = [...able].sort((a, b) => RANK[preset.want](a, b) || a.id.localeCompare(b.id))[0];
  because.push("no key for any engine it prefers");
  return { modelId: best.id, why: because.join(", and "), substituted: true };
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
  return resolvePreset(id, where)?.modelId ?? id;
}

/**
 * Whether this preset can be what it promises on the keys that are here.
 *
 * Only Mizar can fail this, and it fails it quietly unless somebody says so:
 * a second opinion from the same company is not a second opinion, so with one
 * key Mizar is an expensive Orion. The picker says that on the row rather
 * than letting you find out from a bill.
 */
export function shortOf(preset: Preset, where: Where): string | null {
  if (!preset.needsTwo) return null;
  return makers(where).length >= 2 ? null : "needs a second company's key";
}

/**
 * Which companies this browser can actually call.
 *
 * A count rather than a list is what every caller wants, but the list is what
 * makes the count checkable, and "two" here means two different companies —
 * not two models, which is how a check ends up being run by a sibling of the
 * model that wrote the answer.
 */
export function makers(where: Where): ProviderId[] {
  return [...new Set(usable(where).map((m) => m.provider as ProviderId))];
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
  ctx: { autoStyle?: boolean; twoMakers?: boolean } = {},
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

  /* The second opinion, where there is a second company to ask and something
     two models could actually settle. Checking a poem produces two poems. */
  if (preset.check === "second" && ctx.twoMakers && plan.strategy === "answer" && checkable(plan.kind)) {
    next.check = "second";
    next.why = `${preset.name} — answered by one company's model and checked by another's.`;
  }

  return next;
}
