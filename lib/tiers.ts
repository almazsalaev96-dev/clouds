/**
 * The ladder: which Armi model a request lands on when nobody chose one.
 *
 * Auto used to pick an engine — one model, from the traits table in
 * `lib/route.ts`. That was the right first answer and the wrong last one: an
 * Armi model is a cast, and the thing the router should be choosing is how
 * much of a cast a request deserves. So Auto now reads the request for its
 * *level* and hands it to the tier built for that level:
 *
 *   0  a sum          — the calculator, no model at all (`lib/arith.ts`)
 *   1  quick          — Nova 4: the fast engine, checked after
 *   2  everyday       — Mira 4.1: briefed, written, checked when earned
 *   3  a picture      — Lumos 4: a model that can see, then another
 *   4  the hardest    — Astro 5: planned, reasoned independently, verified
 *
 * The principle is the strategy document's, and it is the opposite of "use
 * the biggest model": the cheapest, fastest tier with a high enough chance
 * of getting this right. Level 4 is meant for the hardest few per cent, so
 * it needs more than a hard word — "why" and "design" are everyday; a
 * *whole* architecture, a rigorous synthesis of thirty papers, a proof, or a
 * question carrying a book's worth of text is where the top of the ladder
 * earns what it costs. The spend setting caps the level, and a picture is
 * never traded for price.
 *
 * Pure. The page passes what it knows and gets a tier and a sentence.
 */
import { shapeOf, type Shape } from "./route";
import type { TaskKind } from "./task";

export type Level = 0 | 1 | 2 | 3 | 4;

/** The tier for each level, by the preset id the picker holds. */
export const TIER_OF: Record<Exclude<Level, 0>, string> = { 1: "flash", 2: "one", 3: "vision", 4: "astro" };

/** As the row says it, without the product prefix. */
export const LEVEL_NAME: Record<Level, string> = {
  0: "the calculator",
  1: "Nova 4",
  2: "Mira 4.1",
  3: "Lumos 4",
  4: "Astro 5",
};

/** How hard the writer is told to think at each level. */
export const LEVEL_EFFORT: Record<Exclude<Level, 0>, "low" | "medium" | "high"> = { 1: "low", 2: "medium", 3: "medium", 4: "high" };

/**
 * What makes a question one for the top of the ladder.
 *
 * Whole-of-a-thing words, rigour words, formal words, a count of sources in
 * the tens, and "extremely" attached to hard. Each is a phrase somebody
 * writes when they mean the biggest version of the work, and not one a
 * person types asking why their loop is slow.
 */
const EXTREME =
  /\b(complete|entire|whole|full|end[- ]to[- ]end)\s+(architecture|design|system|specification|spec|strategy|plan|analysis|review)\b|\brigorous(ly)?\b|\bsynthesi[sz]e\b|\bsynthesis\b|\bfrom first principles\b|\bprove\b|\bproof\b|\b(\d{2,}|dozens of|thirty|forty|fifty)\s+(papers|sources|studies|documents|files|reports)\b|\bresearch papers\b|\bformal(ly)? (proof|verification|model)\b|\bextremely (hard|complicated|complex|difficult)\b/i;

/** A book's worth in this one message: not a hard sentence, but hard work. */
const HEAVY = 30_000;

export interface Tier {
  level: Level;
  /** The preset to run, or null at level 0, where nothing runs. */
  presetId: string | null;
  effort: "low" | "medium" | "high";
  /** One line, in the words a person would use, beginning with who chose. */
  why: string;
}

/**
 * Read a shape for its level. The shape is the router's own reading of the
 * request, so the two never disagree about whether there is a picture in it
 * or how much has to be read.
 */
export function levelOf(
  text: string,
  shape: Shape,
  opts: { spend?: "low" | "balanced" | "any"; kind?: TaskKind } = {},
): { level: Level; why: string[] } {
  const why: string[] = [];
  const own = Math.ceil(text.length / 4);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  let level: Level;
  if (shape.vision) {
    level = 3;
    why.push("there is an image in this, so a model that can see");
  } else if (shape.quick) {
    level = 1;
    why.push("this is a small mechanical edit");
  } else if (!shape.depth && !shape.coding && words <= 12 && shape.size < 2_000) {
    level = 1;
    why.push("a short ask with nothing to weigh");
  } else if (shape.depth && (EXTREME.test(text) || own >= HEAVY)) {
    level = 4;
    why.push(own >= HEAVY ? `it carries about ${Math.round(own / 1000)}k tokens of its own` : "it asks for the whole of something, rigorously");
  } else {
    level = 2;
    if (shape.coding && shape.depth) why.push("this is a hard question about code");
    else if (shape.coding) why.push("this is about code");
    else if (shape.depth) why.push("this one needs thinking about");
    else if (opts.kind && opts.kind !== "general") why.push(`read as ${opts.kind}`);
  }

  /* The budget governor, at the level rather than the engine: a low spend
     stays on the quick tier and a balanced one stays off the top. A picture
     is a requirement, and requirements are never traded for price. */
  if (opts.spend === "low" && level !== 3 && level > 1) {
    level = 1;
    why.push("kept on the quick tier by your low spend setting");
  } else if (opts.spend === "balanced" && level === 4) {
    level = 2;
    why.push("kept off the top tier by your balanced spend setting");
  }
  return { level, why };
}

/**
 * The whole decision, from the request: which tier, how hard, and why.
 *
 * Takes the same inputs the router takes so the shape is read once, the
 * same way. `reason` is the router's own sentence about the engine, kept
 * where it says something the level does not.
 */
export function tierFor(
  text: string,
  ctx: {
    hasImage?: boolean;
    extra?: string;
    attached?: string;
    size?: number;
    spend?: "low" | "balanced" | "any";
    kind?: TaskKind;
  },
): Tier {
  const shape = shapeOf(text, { hasImage: ctx.hasImage, extra: ctx.extra, attached: ctx.attached, size: ctx.size });
  const { level, why } = levelOf(text, shape, { spend: ctx.spend, kind: ctx.kind });
  if (level === 0) return { level, presetId: null, effort: "low", why: "" };
  /* A colon, not a dash: the line under an answer strips everything before
     its first dash as the name of who answered. */
  const said = why.length ? `Auto chose ${LEVEL_NAME[level]}: ${why.join(", and ")}` : `Auto chose ${LEVEL_NAME[level]}`;
  return { level, presetId: TIER_OF[level], effort: LEVEL_EFFORT[level], why: said };
}
