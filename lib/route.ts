import { MODELS, getModel } from "./models";
import type { ModelSpec, ProviderId } from "./types";
import { solve, type Sum } from "./arith";

/**
 * One AI that knows how to use every AI.
 *
 * The app held four providers' keys and asked you which one to use — which is
 * "all the models in one app", and that is the weak version of the idea. The
 * person asking the question is the one least equipped to answer it: knowing
 * that this particular request wants a long-context model rather than a fast
 * one requires knowing what all of them are, which is the work the app was
 * supposed to be doing.
 *
 * So: **Auto**. The ask is read, its shape is worked out, and a model is picked
 * from the ones you actually have keys for — with the reason said out loud and
 * the choice overridable, because a router you cannot see or overrule is a
 * router you cannot trust and cannot correct.
 *
 * Two principles that matter more than the routing table:
 *
 *  - **Nothing is picked that cannot answer.** A vision model is not a
 *    preference when there is an image in the message, it is the requirement,
 *    and a router that "prefers" one and then sends an image to a model without
 *    eyes has produced a confident answer about nothing.
 *  - **Sometimes the right model is no model.** A question that is only
 *    arithmetic is answered by a calculator, exactly, for nothing. See
 *    `lib/arith.ts` — it is a small feature standing for a large principle.
 */

/* What a request needs, rather than what it is about. Deliberately not topics:
   "physics" does not tell you anything about which model to use, and "this has
   an image in it" and "this is forty thousand words" tell you everything. */
export interface Shape {
  /** There is an image in the message. Not a preference — a requirement. */
  vision: boolean;
  /** Roughly how much has to be read, in tokens. */
  size: number;
  /** Code, or a question about code. */
  coding: boolean;
  /** Asks for a judgement, a design, a proof, a comparison — thinking. */
  depth: boolean;
  /** A small mechanical rewrite: translate this, fix this, shorten this. */
  quick: boolean;
}

/** How hard to try. `auto` is the one almost everybody should be on. */
export type Effort = "auto" | "economy" | "fast" | "balanced" | "deep";

export const EFFORTS: { id: Effort; name: string; blurb: string }[] = [
  { id: "auto", name: "Auto", blurb: "Reads the request and picks. The right default." },
  { id: "economy", name: "Economy", blurb: "The cheapest model that can do it." },
  { id: "fast", name: "Fast", blurb: "The quickest answer that is still an answer." },
  { id: "balanced", name: "Balanced", blurb: "A good all-rounder, whatever the request." },
  { id: "deep", name: "Deep", blurb: "The strongest reasoning you have a key for." },
];

/**
 * What each model is *for*, beyond what its spec already says.
 *
 * The registry knows price, context, vision and whether it reasons. It does not
 * know that one of them is the fast one and another is the careful one, and
 * that is the judgement a router runs on. Kept as a small explicit table rather
 * than derived from price, because cheap-and-quick and cheap-and-slow are both
 * real and the bill cannot tell them apart.
 *
 * 1–3 on each. Unlisted models get the middling row, so adding one to the
 * registry and forgetting this file produces a usable default rather than a
 * model that is never chosen or always chosen.
 */
interface Traits {
  /** Answers quickly. */
  speed: number;
  /** Holds a hard problem together. */
  depth: number;
  /** Writes and reads code well. */
  coding: number;
}

const TRAITS: Record<string, Traits> = {
  "claude-opus-4-5": { speed: 1, depth: 3, coding: 3 },
  "claude-sonnet-4-5": { speed: 2, depth: 2, coding: 3 },
  "claude-haiku-4-5": { speed: 3, depth: 1, coding: 2 },
  "gpt-5.1": { speed: 1, depth: 3, coding: 3 },
  "gpt-5.1-mini": { speed: 3, depth: 1, coding: 2 },
  "gpt-4.1": { speed: 2, depth: 2, coding: 2 },
  "gemini-3-pro": { speed: 2, depth: 3, coding: 2 },
  "gemini-2.5-flash": { speed: 3, depth: 1, coding: 1 },
  "deepseek-chat": { speed: 2, depth: 2, coding: 2 },
  "deepseek-reasoner": { speed: 1, depth: 3, coding: 2 },
};

const MIDDLING: Traits = { speed: 2, depth: 2, coding: 2 };
const traitsOf = (id: string): Traits => TRAITS[id] ?? MIDDLING;

/** Rough, and rough is enough: this decides between models, not budgets. */
const sizeOf = (text: string) => Math.ceil(text.length / 4);

const CODE = /```|\b(function|const |let |class |import |def |SELECT |=>|null|undefined|async |await )\b|[{};]\s*$/m;
const CODE_WORDS = /\b(code|bug|stack ?trace|refactor|typescript|javascript|python|rust|golang|css|html|sql|api|regex|compile|runtime|exception)\b/i;
const DEEP_WORDS = /\b(why|design|architect|architecture|prove|derive|trade[- ]?offs?|compare|strategy|plan|analy[sz]e|explain how|decide|evaluate|implications|root cause)\b/i;
const QUICK_WORDS = /\b(translate|rephrase|reword|shorten|tidy|fix the (spelling|grammar)|make it shorter|tl;?dr|name (this|it)|a synonym|capitali[sz]e)\b/i;

/** Read the request for what it needs. */
export function shapeOf(text: string, opts: { hasImage?: boolean; extra?: string } = {}): Shape {
  const whole = `${text}\n${opts.extra ?? ""}`;
  const size = sizeOf(whole);
  const coding = CODE.test(whole) || CODE_WORDS.test(text);
  /* Short and mechanical. Length is half the signal: "translate this" over
     forty pages is not a quick job however quick the verb sounds. */
  const quick = QUICK_WORDS.test(text) && size < 400;
  return {
    vision: Boolean(opts.hasImage),
    size,
    coding,
    depth: !quick && (DEEP_WORDS.test(text) || size > 20_000),
    quick,
  };
}

export interface Choice {
  modelId: string;
  /** One line, in the words a person would use. Shown, not logged. */
  why: string;
  /** Answered without a model at all. */
  sum?: Sum;
}

/** The models this browser can actually call. */
function usable(configured: Record<string, boolean>, keys: Record<string, string>): ModelSpec[] {
  return MODELS.filter((m) => configured[m.provider as ProviderId] || keys[m.provider]);
}

/**
 * Pick one.
 *
 * Hard requirements first and separately from preferences: vision and context
 * are not things to weigh against cost, they are things a model either has or
 * does not, and an answer from a model that could not read the question is not
 * a cheaper answer, it is not an answer.
 */
export function route(
  text: string,
  ctx: {
    configured: Record<string, boolean>;
    keys: Record<string, string>;
    effort: Effort;
    hasImage?: boolean;
    /** Conversation so far, for judging how much has to be read. */
    extra?: string;
    /** What the user is on now, to fall back to and to leave alone. */
    current: string;
  },
): Choice {
  /* No model at all, where none is needed. Checked before anything else
     because the cheapest and most accurate route is the one that does not go
     out to a network to do long multiplication. */
  const sum = solve(text);
  if (sum) {
    return {
      modelId: ctx.current,
      sum,
      why: "Worked out here — a sum does not need a model, and this way it is exact.",
    };
  }

  const pool = usable(ctx.configured, ctx.keys);
  if (!pool.length) return { modelId: ctx.current, why: "No key configured yet." };

  const shape = shapeOf(text, { hasImage: ctx.hasImage, extra: ctx.extra });

  /* Requirements. Anything that cannot read the request is out, whatever else
     it is good at. */
  let able = pool;
  const reasons: string[] = [];
  if (shape.vision) {
    const seeing = able.filter((m) => m.vision);
    if (seeing.length) {
      able = seeing;
      reasons.push("there is an image in this");
    }
  }
  // Headroom for the answer as well as the question.
  const needed = shape.size + 4_000;
  const roomy = able.filter((m) => m.contextWindow >= needed);
  if (roomy.length && roomy.length < able.length) {
    able = roomy;
    reasons.push(`it is long — about ${Math.round(shape.size / 1000)}k tokens to read`);
  } else if (!roomy.length) {
    // Nothing fits. Take the largest there is and say so rather than silently
    // sending something that will be cut.
    const biggest = Math.max(...able.map((m) => m.contextWindow));
    able = able.filter((m) => m.contextWindow === biggest);
    reasons.push("it is longer than anything configured can hold");
  }

  const score = (m: ModelSpec): number => {
    const t = traitsOf(m.id);
    const cheap = 4 - Math.min(3, Math.ceil((m.priceIn + m.priceOut) / 6));
    switch (ctx.effort) {
      case "economy":
        return cheap * 3 + t.speed;
      case "fast":
        return t.speed * 3 + cheap;
      case "deep":
        return t.depth * 3 + (shape.coding ? t.coding : 0);
      case "balanced":
        return t.depth + t.speed + t.coding;
      default: {
        // Auto: what the request actually asks for.
        if (shape.quick) return t.speed * 3 + cheap * 2;
        if (shape.coding && shape.depth) return t.coding * 2 + t.depth * 2;
        if (shape.coding) return t.coding * 3 + t.speed;
        if (shape.depth) return t.depth * 3 + t.speed;
        return t.depth + t.speed * 2 + cheap;
      }
    }
  };

  /* Ties broken by price, then by name, so the same request routes the same
     way every time. A router that answers differently on identical input is
     one nobody can reason about — including whoever has to debug it. */
  const best = [...able].sort((a, b) => {
    const d = score(b) - score(a);
    if (d) return d;
    const p = a.priceIn + a.priceOut - (b.priceIn + b.priceOut);
    if (p) return p;
    return a.id.localeCompare(b.id);
  })[0];

  if (ctx.effort !== "auto") {
    const label = EFFORTS.find((e) => e.id === ctx.effort)?.name ?? ctx.effort;
    reasons.unshift(`you asked for ${label.toLowerCase()}`);
  } else if (shape.quick) reasons.unshift("this is a small mechanical edit");
  else if (shape.coding && shape.depth) reasons.unshift("this is a hard question about code");
  else if (shape.coding) reasons.unshift("this is about code");
  else if (shape.depth) reasons.unshift("this one needs thinking about");

  return {
    modelId: best.id,
    why: reasons.length
      ? `${getModel(best.id).short} — ${reasons.join(", and ")}.`
      : `${getModel(best.id).short}.`,
  };
}
