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
import { MODELS, estimateCost, getModel } from "./models";
import { REPLY, SAFETY } from "./context";
import { checkable, type Plan } from "./decide";
import type { ModelSpec, ProviderId } from "./types";

/** What to reach for when none of the named engines has a key. */
export type Want = "cheap" | "balanced" | "strong" | "long";

/** What a second model is here to do. */
export type Role = "brief" | "check" | "duel" | "council";

/**
 * A job on the council, where several models work on different halves of the
 * same question rather than all answering it.
 *
 * Four models given the same prompt produce four versions of one answer and
 * leave the reader to be the editor. Four models given four different jobs
 * produce something none of them would have written alone — which is the
 * only reason to pay for four.
 */
export type Angle = "strategy" | "logic" | "knowledge";

/**
 * What the briefing model is asked for.
 *
 * "What does a good answer need?" is the right question for a question and
 * the wrong one for a build, a translation or a sum. One mechanism, five
 * askings — which is most of what makes thirteen tactics thirteen tactics
 * rather than one tactic with thirteen names.
 */
export type Flavour = "cover" | "plan" | "risks" | "misconceptions" | "audience";

export interface Part {
  role: Role;
  /** Engines for this job, in order of preference. */
  engines: string[];
  /** How to choose when none of them has a key. */
  want: Want;
  /** For a brief: what to ask it for. */
  as?: Flavour;
  /** For a council seat: which half of the question it is given. */
  angle?: Angle;
}

/** Where a tactic sits in the menu: the ones for anything, and the specialists. */
export type Group = "everyday" | "job";

export interface Preset {
  id: string;
  /** With the prefix, as the menu and Settings say it: "ARMI Quant". */
  name: string;
  /** Without it, for the bar, where the product name is already everywhere. */
  short: string;
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
  /** The ones for anything, or the ones for one thing. */
  group: Group;
  /**
   * Everything in the cast has to be able to see.
   *
   * Only true where the work *is* the picture. Everywhere else an image in
   * the message is a requirement read off the message itself, which is a
   * different thing from a tactic that exists for images.
   */
  sees?: boolean;
  /** Two or three lines: the requests this is the right answer to. */
  examples: string[];
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
/**
 * Thirteen, and thirteen is not a catalogue.
 *
 * Five are for anything and eight are for one thing, which is the split that
 * matters: somebody who does not want to think about it stays on Astro
 * forever and loses nothing, and somebody who is translating a contract or
 * reading a screenshot of a stack trace can have a tactic built for exactly
 * that. Each one earns its place by being a different *arrangement of
 * models*, not a different adjective: who briefs, who writes, who checks,
 * who answers against it, and what the briefing model is asked for.
 */
/**
 * Eleven, under one naming language.
 *
 * The celestial names they had were pretty and said nothing: nobody could
 * tell from "Mizar" what it was for, and a person choosing between thirteen
 * constellations is doing astronomy rather than work. These say the job.
 * **One** is the flagship you stay on; **Quant** reasons; **Forge** builds;
 * **Orbit** holds documents; **Vision** sees; **Tutor** teaches; **Council**
 * is the most this app can bring to one question. The prefix is the product,
 * so the row says "ARMI Quant" and the bar, where the product name is already
 * everywhere, says "Quant".
 *
 * Five are for anything and six are for one thing, which is the split that
 * matters: somebody who does not want to think about it stays on ARMI One
 * forever and loses nothing.
 */
export const PRESETS: Preset[] = [
  /* ------------------------------------------------------------ everyday -- */
  {
    id: "one",
    name: "ARMI One",
    short: "One",
    tagline: "The flagship, two models deep",
    blurb:
      "Your primary assistant: everyday questions, writing, planning, and knowing when something needs a specialist. A model from one company lists what the answer has to get right; a model from another writes it.",
    examples: ["what is a debounce", "is this contract clause normal", "plan my week around three deadlines"],
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-chat"],
    want: "balanced",
    group: "everyday",
    cast: [
      { role: "brief", as: "cover", engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"], want: "cheap" },
    ],
    icon: "orbit",
  },
  {
    id: "flash",
    name: "ARMI Flash",
    short: "Flash",
    tagline: "Answers now, checked after",
    blurb:
      "For quick questions and rewrites. The fastest engine you have a key for answers straight away, and a second company's model checks it while you are already reading.",
    examples: ["what does ECONNRESET mean", "shorten this to one line", "what time is it in Tokyo"],
    engines: ["claude-haiku-4-5", "kimi-latest", "gpt-5.1-mini", "deepseek-chat"],
    want: "cheap",
    group: "everyday",
    cast: [
      { role: "check", engines: ["gpt-5.1-mini", "deepseek-chat", "kimi-latest", "claude-haiku-4-5"], want: "cheap" },
    ],
    effort: "low",
    register: "concise",
    stance:
      "Answer in as few words as the question honestly takes. No preamble, no summary of what you are about to say.",
    icon: "zap",
  },
  {
    id: "quant",
    name: "ARMI Quant",
    short: "Quant",
    tagline: "Reasoning, checked twice",
    blurb:
      "Mathematics, economics, logic, analysis, hard strategy. One model writes down where this is most likely to go wrong before anybody answers, the strongest engine you have does the work, and a third from a different company checks it. Pure arithmetic never reaches a model at all — this app works that out exactly, for nothing.",
    examples: ["compound return over seven years", "event sourcing or CRUD, and why", "does this spreadsheet actually add up"],
    engines: ["claude-opus-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner"],
    want: "strong",
    group: "everyday",
    cast: [
      { role: "brief", as: "risks", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-sonnet-4-5"], want: "strong" },
      { role: "check", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-opus-4-5"], want: "strong" },
    ],
    effort: "high",
    stance:
      "Show the working rather than asserting the result. Carry the units through every step and name them. Where a figure is an estimate, say what it rests on.",
    icon: "sigma",
  },
  {
    /* The one the whole idea is for. Not four models answering the same
       question — that is four drafts and a reader made into an editor — but
       four models given four jobs, and one of them writing what comes of it. */
    id: "council",
    name: "ARMI Council",
    short: "Council",
    tagline: "Four jobs, one answer",
    blurb:
      "The most this app can bring to one question. Three companies each take a different half of it — the strategy, the reasoning, what is actually known — and a fourth writes one answer out of the three, saying where they disagreed and what is still uncertain. Four models a turn, and by some way the dearest thing here.",
    examples: ["design my AI education startup", "should we rebuild this or refactor it", "review this plan before we commit"],
    engines: ["claude-opus-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner"],
    want: "strong",
    group: "everyday",
    cast: [
      { role: "council", angle: "strategy", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-opus-4-5"], want: "strong" },
      { role: "council", angle: "logic", engines: ["deepseek-reasoner", "gpt-5.1", "kimi-k2-thinking", "claude-opus-4-5"], want: "strong" },
      { role: "council", angle: "knowledge", engines: ["kimi-k2-thinking", "gpt-5.1", "deepseek-chat", "claude-sonnet-4-5"], want: "strong" },
    ],
    effort: "high",
    icon: "users",
  },
  {
    id: "orbit",
    name: "ARMI Orbit",
    short: "Orbit",
    tagline: "Holds a lot, read back",
    blurb:
      "Books, PDFs, research, threads that have run all day. It answers on the biggest window you have a key for, and a second company reads the summary back against what it was meant to say.",
    examples: ["summarise this 80-page report", "what changed between these two contracts", "find every mention of the deadline"],
    engines: ["gpt-4.1", "gpt-5.1", "kimi-k2-thinking", "claude-opus-4-5"],
    want: "long",
    group: "everyday",
    cast: [
      { role: "check", engines: ["claude-sonnet-4-5", "kimi-k2-thinking", "deepseek-chat", "gpt-5.1"], want: "balanced" },
    ],
    icon: "layers",
  },

  /* ----------------------------------------------------------- for a job -- */
  {
    id: "forge",
    name: "ARMI Forge",
    short: "Forge",
    tagline: "Plans it, builds it, reviews it",
    blurb:
      "Code, and pages that run beside the conversation. Another company plans the thing first — the pieces, the order, what is easy to leave out — the strongest coder you have builds it, and a third reads the result back. It would rather make the thing than describe it.",
    examples: ["build me a stopwatch with lap times", "refactor this to remove the nested loop", "why does this test fail only in CI"],
    engines: ["claude-opus-4-5", "claude-sonnet-4-5", "gpt-5.1", "kimi-k2-thinking"],
    want: "strong",
    group: "job",
    cast: [
      { role: "brief", as: "plan", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-sonnet-4-5"], want: "strong" },
      { role: "check", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-reasoner", "claude-opus-4-5"], want: "strong" },
    ],
    effort: "high",
    stance:
      "When the request could be satisfied by something that runs, build the thing rather than describing it. Prefer one complete, working file over an outline of one.",
    icon: "hammer",
  },
  {
    id: "vision",
    name: "ARMI Vision",
    short: "Vision",
    tagline: "Two pairs of eyes",
    blurb:
      "Screenshots, diagrams, photographs of a whiteboard. Two models that can actually see are given the same picture and answer side by side, because what a model gets wrong about an image it gets wrong confidently and a second reading is the only way to catch it.",
    examples: ["what is wrong in this screenshot", "read this handwriting", "turn this diagram into a description"],
    engines: ["claude-sonnet-4-5", "gpt-5.1", "gpt-4.1", "claude-haiku-4-5"],
    want: "balanced",
    group: "job",
    sees: true,
    cast: [
      { role: "duel", engines: ["gpt-5.1", "gpt-4.1", "claude-sonnet-4-5", "kimi-latest"], want: "balanced" },
    ],
    icon: "eye",
  },
  {
    id: "tutor",
    name: "ARMI Tutor",
    short: "Tutor",
    tagline: "Teaches, then asks",
    blurb:
      "For learning something rather than obtaining it. Another model first writes down what somebody asking this usually believes that is wrong, so the explanation starts where you actually are; the answer ends with questions you cannot pass by having just read it; and a second company checks the teaching was right before you commit it to memory. Cards made here live in Study.",
    examples: ["explain eigenvalues like I have forgotten the algebra", "teach me the water cycle", "I have an exam on the Krebs cycle on Friday"],
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-latest", "deepseek-chat"],
    want: "balanced",
    group: "job",
    cast: [
      { role: "brief", as: "misconceptions", engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"], want: "cheap" },
      { role: "check", engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"], want: "cheap" },
    ],
    register: "explanatory",
    stance:
      "Explain the reasoning, not only the result, and work an example where one would teach more than a paragraph. End with three short questions that test whether it landed, and do not answer them.",
    icon: "graduation-cap",
  },
  {
    id: "lingua",
    name: "ARMI Lingua",
    short: "Lingua",
    tagline: "Translated, then read back",
    blurb:
      "Translation, where the mistake you cannot see is the one that matters. One model translates and a model from a different company reads the translation against the original and reports what drifted.",
    examples: ["translate this email into Japanese", "what does this clause say in English", "is this the right register for a formal letter"],
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-k2-thinking", "deepseek-chat"],
    want: "balanced",
    group: "job",
    cast: [
      { role: "check", engines: ["gpt-5.1", "kimi-k2-thinking", "deepseek-chat", "claude-sonnet-4-5"], want: "balanced" },
    ],
    stance:
      "Translate the meaning and the register, not the words. Keep names, numbers, and formatting exactly as they are. Where an idiom has no equivalent, say plainly what it means rather than inventing one.",
    icon: "languages",
  },
  {
    id: "studio",
    name: "ARMI Studio",
    short: "Studio",
    tagline: "Written for someone else",
    blurb:
      "Emails, letters, posts, anything with a reader who is not you. Another model works out who reads it and what it has to achieve before a word is written, which is the part that is usually skipped and the reason most drafts have to be rewritten.",
    examples: ["write to my landlord about the boiler", "a resignation letter that keeps the door open", "turn these notes into an announcement"],
    engines: ["claude-sonnet-4-5", "gpt-5.1", "kimi-latest", "deepseek-chat"],
    want: "balanced",
    group: "job",
    cast: [
      { role: "brief", as: "audience", engines: ["gpt-5.1-mini", "kimi-latest", "deepseek-chat", "claude-haiku-4-5"], want: "cheap" },
    ],
    register: "formal",
    icon: "feather",
  },
  {
    id: "duet",
    name: "ARMI Duet",
    short: "Duet",
    tagline: "Two answers, you choose",
    blurb:
      "Two companies answer the same question, side by side, and you keep the one you prefer. Where judgement or taste decides, two answers are worth more than one model's verdict — and unlike the Council, nothing is blended away.",
    examples: ["what should we call this feature", "is this opening paragraph any good", "which of these two designs"],
    engines: ["claude-opus-4-5", "gpt-5.1", "kimi-k2-thinking", "claude-sonnet-4-5"],
    want: "strong",
    group: "job",
    cast: [
      { role: "duel", engines: ["gpt-5.1", "kimi-k2-thinking", "claude-opus-4-5", "deepseek-reasoner"], want: "strong" },
    ],
    icon: "scale",
  },
];

/** What a fresh install opens on: the everyday tactic, not a vendor's model. */
export const DEFAULT_PRESET_ID = "one";

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
  /** For a brief: which of the five questions it was asked. */
  as?: Flavour;
  /** For a council seat: the job it was given. */
  angle?: Angle;
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
  /* A tactic that exists for pictures needs eyes whether or not this
     particular message has one in it: picking a blind model now and
     discovering it when an image arrives is the failure, not the fix. */
  if (preset.sees) {
    const seeing = able.filter((m) => m.vision);
    if (seeing.length) able = seeing;
    else because.push("nothing configured can read an image");
  }
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
      .filter((m) => !taken.has(m.id))
      /* Two pairs of eyes means two pairs of eyes. */
      .filter((m) => !preset.sees || m.vision);
    /* A third company before a second model from the second company. Orion
       promises three and would otherwise quietly buy its brief and its check
       from the same lab — which is most of the value of the third one gone,
       paid for in full. */
    const fresh = from.filter((m) => !used.has(m.provider as ProviderId));
    const who = pickFrom(part.engines, part.want, fresh.length ? fresh : from);
    if (who) {
      parts.push({ role: part.role, modelId: who.id, as: part.as, angle: part.angle });
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
  council: "nobody to sit on the council",
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
export function playerFor(cast: Cast | null, role: Role): Player | null {
  return cast?.parts.find((p) => p.role === role) ?? null;
}

/** Every part with this job: a tactic may put two models on the same one. */
export function playersFor(cast: Cast | null, role: Role): Player[] {
  return (cast?.parts ?? []).filter((p) => p.role === role);
}

/**
 * What a turn on this tactic actually costs, in models and in money.
 *
 * The old picker carried a price per million tokens on every row, which is
 * the number a person cannot use: nobody knows how many tokens their
 * question is. An Armi model makes that worse, because it is two or three
 * calls rather than one, and "three models" is a thing somebody would want
 * to know *before* they pick it rather than after the bill.
 *
 * So the arithmetic is done here, over a turn of ordinary size, and what is
 * shown is the one figure a person can weigh: about what this costs to ask
 * once. It is an estimate and is labelled as one — a long thread costs more
 * and a one-line question costs less — but it is an estimate of the real
 * thing, summed over every model the tactic will actually call.
 */
export const TYPICAL = {
  /** A question with a page or two of conversation behind it. */
  answer: { in: 3_000, out: 800 },
  /** A brief reads the question alone and writes a few lines. */
  brief: { in: 1_200, out: 250 },
  /** A check reads the question and the answer, and reports. */
  check: { in: 2_600, out: 400 },
  /** A council seat answers one half of the question, at length. */
  council: { in: 2_000, out: 700 },
};

export interface Profile {
  /** How many models are called for one answer. */
  calls: number;
  /** Roughly what that costs, in dollars, for a turn of ordinary size. */
  usd: number;
}

export function profileOf(cast: Cast): Profile {
  const of = (id: string, turn: { in: number; out: number }) =>
    estimateCost(getModel(id), turn.in, turn.out);
  let usd = of(cast.answer.modelId, TYPICAL.answer);
  for (const p of cast.parts) {
    usd += of(
      p.modelId,
      p.role === "brief"
        ? TYPICAL.brief
        : p.role === "check"
          ? TYPICAL.check
          : p.role === "council"
            ? TYPICAL.council
            : TYPICAL.answer,
    );
  }
  return { calls: 1 + cast.parts.length, usd };
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
export function briefPrompt(ask: string, flavour: Flavour = "cover"): string {
  return [
    "Another model is about to answer the question below. You are not answering it.",
    "",
    ASKS[flavour],
    "",
    "At most five lines, one clause each. No preamble, no answer, no restating the question.",
    "",
    "The question:",
    ask.slice(0, 4000),
  ].join("\n");
}

/**
 * The five things worth asking a model that is not answering.
 *
 * Each one is chosen for the work the tactic is for, and they are genuinely
 * different questions rather than the same question in five voices — which
 * is the difference between thirteen tactics and one tactic with thirteen
 * names. A build wants a plan; a translation wants to know what drifts; a
 * letter wants to know who reads it.
 */
const ASKS: Record<Flavour, string> = {
  cover:
    "Write what a good answer has to get right: a fact worth checking, a constraint that is easy to miss, a common mistake, or what is actually being asked when that is not what it appears to be.",
  plan:
    "Write the shape of the thing to build: the pieces it needs, the order to build them in, and the part that is easiest to leave out and hardest to add later.",
  risks:
    "Write where this is most likely to go wrong: the step where the arithmetic slips, a unit that has to be carried through, an assumption smuggled into the question, a figure that cannot be known.",
  misconceptions:
    "Write what somebody asking this usually already believes that is wrong, and what they have to understand first for the answer to mean anything.",
  audience:
    "Write who reads this and what it has to achieve: the tone it needs, what it must ask for, and what it must not say.",
};

/**
 * What each seat on the council is asked.
 *
 * Three different jobs, not three copies of the question. The strategist is
 * asked what to do and what it costs; the logician is asked whether the
 * reasoning holds; the one with the documents is asked what is actually
 * known and what is being assumed. None of them is asked for "the answer",
 * because the answer is what the writer makes out of the three.
 */
const SEATS: Record<Angle, string> = {
  strategy:
    "You are one of three models working on this, and your half is the strategy: what should actually be done, in what order, what it costs, and what the realistic alternative is. Do not write the whole answer.",
  logic:
    "You are one of three models working on this, and your half is the reasoning: does the argument hold, what does it assume, where does it break, and what would have to be true for it to be wrong. Do not write the whole answer.",
  knowledge:
    "You are one of three models working on this, and your half is what is actually known: the facts, figures, precedents and definitions that bear on it, and — said plainly — which parts you are not sure of. Do not write the whole answer.",
};

export function councilPrompt(ask: string, angle: Angle): string {
  return [
    SEATS[angle],
    "",
    "At most two hundred words. No preamble. Say plainly where you are uncertain.",
    "",
    "The question:",
    ask.slice(0, 6000),
  ].join("\n");
}

/** What each seat is called where a person can see it. */
export const SEAT_NAMES: Record<Angle, string> = {
  strategy: "on strategy",
  logic: "on the reasoning",
  knowledge: "on what is known",
};

/**
 * How the council's work reaches the model that writes the answer.
 *
 * The instruction that matters is the last one. Three opinions pasted under
 * three headings is not an answer, it is a reading list — and a model handed
 * three drafts will otherwise average them, which loses exactly the
 * disagreement that was worth paying three models for.
 */
export function councilNote(seats: { who: string; angle: Angle; text: string }[]): string {
  return [
    "Three other models, from different companies, have each worked on one half of this question. Their notes are below. They have not seen each other's work and none of them wrote an answer.",
    "",
    ...seats.map((s) => `### ${s.who}, ${SEAT_NAMES[s.angle]}\n\n${s.text.trim()}`),
    "",
    "Write one answer out of these. Use what holds and drop what does not — they can be wrong, and you are the one accountable for what goes on the page. Where two of them genuinely disagree about something that matters, say so in a line and say which you are going with and why. Where all three are unsure, say that rather than picking. Do not summarise them one by one, do not name them, and do not mention that any of this happened.",
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
/** And a council, which is four models, wants a question worth four models. */
export const COUNCIL_WORDS = 8;

export function worthConvening(ask: string, plan?: Plan): boolean {
  if (plan?.strategy === "compute") return false;
  return ask.trim().split(/\s+/).filter(Boolean).length >= COUNCIL_WORDS;
}

export function worthBriefing(ask: string, plan?: Plan): boolean {
  /* The plan is optional because the duel path has not made one yet: it is
     two answers rather than one and never had a single turn to plan. The
     length rule is the same either way. */
  if (plan?.strategy === "compute") return false;
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
