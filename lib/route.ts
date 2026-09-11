import { REPLY, SAFETY } from "./context";
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

/**
 * How cheap, on a scale that keeps its order.
 *
 * This was four buckets, `4 - min(3, ceil((in + out) / 6))`, and above twelve
 * dollars a million everything landed on the same rung. So did everything
 * below six: DeepSeek at about $1.40 and Haiku at $6.00 scored identically on
 * the one axis Economy is supposed to be about, and since the bucket was
 * multiplied by three while price only broke ties at the very end, Economy
 * would take a model four times dearer for being one point faster. Which is
 * not economy.
 *
 * Continuous instead, and logarithmic because the spread is two orders of
 * magnitude — a linear scale makes every model below the top price look the
 * same, which is the bug again with extra steps. Output is weighted three to
 * one: a chat reads a paragraph and writes several, and it is the written ones
 * that arrive on the bill.
 */
function cheapness(m: ModelSpec): number {
  const usd = m.priceIn + m.priceOut * 3;
  // 4 at about a dollar a million, 1 at about a hundred, clamped either side.
  return Math.max(0, Math.min(4, 4 - Math.log10(Math.max(usd, 0.1)) * 1.5));
}

const CODE = /```|\b(function|const |let |class |import |def |SELECT |=>|null|undefined|async |await )\b|[{};]\s*$/m;
const CODE_WORDS = /\b(code|bug|stack ?trace|refactor|typescript|javascript|python|rust|golang|css|html|sql|api|regex|compile|runtime|exception)\b/i;
const DEEP_WORDS = /\b(why|design|architect|architecture|prove|derive|trade[- ]?offs?|compare|strategy|plan|analy[sz]e|explain how|decide|evaluate|implications|root cause)\b/i;
const QUICK_WORDS = /\b(translate|rephrase|reword|shorten|tidy|fix the (spelling|grammar)|make it shorter|tl;?dr|name (this|it)|a synonym|capitali[sz]e)\b/i;

/**
 * Read the request for what it needs.
 *
 * Three inputs, kept apart because they answer different questions.
 *
 *  - `text` is what was asked. It decides the subject.
 *  - `attached` is what came with it — a PDF, a pasted file. Part of the
 *    request, so it counts for the subject too: "fix this" over four hundred
 *    lines of TypeScript is a question about code, and nothing in the sentence
 *    says so.
 *  - `extra` is the conversation so far, which counts for size and for nothing
 *    else. It used to count for the subject as well, so one code block
 *    anywhere in a long thread made every message after it "about code" for
 *    the rest of the day.
 *
 * And `size` is passed in rather than measured here whenever the caller can
 * count properly. It has to be the whole of what the model will receive,
 * attachments and images included, which is a sum this function cannot do from
 * strings — `lib/context.ts` already does it exactly, for the fitter, and the
 * router and the fitter disagreeing about how big a request is produces the
 * one failure worth avoiding here: a model chosen for a request it cannot hold.
 */
export function shapeOf(
  text: string,
  opts: { hasImage?: boolean; extra?: string; attached?: string; size?: number } = {},
): Shape {
  const request = `${text}\n${opts.attached ?? ""}`;
  const size = opts.size ?? sizeOf(`${request}\n${opts.extra ?? ""}`);
  /* What this message alone brings, which is not the same number. `size` is
     everything that has to fit — the conversation included — and is the right
     measure for "which windows can hold this". It is the wrong one for "does
     this need thinking about": an hour of small talk is fifty thousand tokens
     and not a hard question, and routing it to the deepest model would be a
     bill nobody asked for. Forty pages attached to *this* message is a hard
     question, whatever the sentence carrying it says. */
  const own = sizeOf(request);
  const coding = CODE.test(request) || CODE_WORDS.test(text);
  /* Short and mechanical. Length is half the signal: "translate this" over
     forty pages is not a quick job however quick the verb sounds. */
  const quick = QUICK_WORDS.test(text) && size < 400;
  return {
    vision: Boolean(opts.hasImage),
    size,
    coding,
    depth: !quick && (DEEP_WORDS.test(text) || own > 20_000),
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
    /** Text that came with this message — a PDF, a pasted file. */
    attached?: string;
    /**
     * The whole request in tokens, counted the way the fitter counts it.
     *
     * Given whenever the caller can: `extra` is a tail of the conversation
     * rather than all of it, and attachments are not in either string, so
     * measuring from what is passed here reads a two-hundred-page PDF as a
     * ten-thousand-token chat and picks a model that cannot hold it.
     */
    size?: number;
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
      /* Exact where it is exact, and not where it is not. `948392 × 73` is the
         product; `1 ÷ 3` is twelve significant figures of a number that does
         not end, and one sentence claiming both spends the credit the first
         earns to cover the second. */
      why: sum.exact
        ? "Worked out here — a sum does not need a model, and this way it is exact."
        : "Worked out here rather than guessed at — shown to twelve significant figures.",
    };
  }

  const pool = usable(ctx.configured, ctx.keys);
  if (!pool.length) return { modelId: ctx.current, why: "No key configured yet." };

  const shape = shapeOf(text, {
    hasImage: ctx.hasImage, extra: ctx.extra, attached: ctx.attached, size: ctx.size,
  });

  /* Requirements. Anything that cannot read the request is out, whatever else
     it is good at. */
  let able = pool;
  const reasons: string[] = [];
  if (shape.vision) {
    const seeing = able.filter((m) => m.vision);
    if (seeing.length) {
      able = seeing;
      reasons.push("there is an image in this");
    } else {
      /* Nothing here can see. Said out loud rather than routed around in
         silence: an answer from a model that never received the picture reads
         exactly like an answer from one that did, and the reader has no way to
         tell which they are holding. */
      reasons.push("nothing configured can read an image, so this is about the words only");
    }
  }
  /* Room for the answer as well as the question, by the same arithmetic the
     fitter will do when this is actually sent. It used to be `size + 4000`
     against the raw window, while `fitToContext` works against 92% of the
     window minus the reply — so the router could hand a request to a model the
     fitter then had to trim, and the person was told which model was chosen
     and, separately, that their conversation had been cut. One number, in one
     place, used by both. */
  const roomy = able.filter((m) => Math.floor(m.contextWindow * SAFETY) - REPLY >= shape.size);
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
    const cheap = cheapness(m);
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
        /* A great deal to read is not a hard question and must not be scored as
           one — an hour of small talk is fifty thousand tokens — but it is a
           reason to prefer a model that holds a long document together over the
           cheapest one whose window technically accepts it. Eighty pages is
           where that starts to be worth paying for. */
        if (shape.size > 100_000) return t.depth * 2 + t.speed + cheap;
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

/**
 * Which provider an id belongs to, including ones no longer in the registry.
 *
 * Model ids are not opaque — every provider stamps its own name on the front —
 * so a retired `claude-3-opus` can still be placed even though nothing in
 * `MODELS` matches it. The registry is asked first and this is the fallback;
 * anything neither can place returns nothing, and the caller says so rather
 * than guessing.
 */
function providerOf(id: string): ProviderId | null {
  const known = MODELS.find((m) => m.id === id);
  if (known) return known.provider;
  if (/^claude-/.test(id)) return "anthropic";
  if (/^(gpt-|o[1-9]|chatgpt)/.test(id)) return "openai";
  if (/^gemini-/.test(id)) return "google";
  if (/^deepseek-/.test(id)) return "deepseek";
  return null;
}

/**
 * A second opinion has to come from somewhere else.
 *
 * The whole value of checking an answer is that the checker did not produce
 * it. A model asked to check its own output reproduces the same reasoning from
 * the same weights and reports that it holds up — which is not verification,
 * it is an echo with extra steps, and it is worse than no check because a
 * reader takes it as evidence.
 *
 * So: a different provider, and the most capable one available there, because
 * a check is exactly the job not to economise on. Returns nothing when there
 * is no second provider — the caller says so plainly rather than quietly
 * checking with a sibling model and calling it independent.
 */
export function checker(
  answeredBy: string,
  ctx: { configured: Record<string, boolean>; keys: Record<string, string> },
): string | null {
  const from = providerOf(answeredBy);
  /* An id nobody recognises is an id whose provider cannot be established, and
     a check that might have come from the same weights is the one thing this
     function exists not to return. `!answering || ...` used to let every model
     through in exactly that case — so a conversation held on a model since
     retired from the registry got its "second opinion" from a sibling, under a
     heading promising it came from somewhere else. */
  if (!from) return null;
  const pool = usable(ctx.configured, ctx.keys).filter((m) => m.provider !== from);
  if (!pool.length) return null;
  /* Strongest, not cheapest. Everywhere else in this file cost is a real
     consideration; here it is the wrong one — a check you cannot rely on has
     cost you the price of the call and told you nothing. */
  return [...pool].sort((a, b) => {
    const d = traitsOf(b.id).depth - traitsOf(a.id).depth;
    if (d) return d;
    const p = b.priceIn + b.priceOut - (a.priceIn + a.priceOut);
    if (p) return p;
    return a.id.localeCompare(b.id);
  })[0].id;
}
