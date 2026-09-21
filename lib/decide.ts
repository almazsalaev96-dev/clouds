/**
 * One decision per turn, made once and written down.
 *
 * The app has always decided several things about a request before answering
 * it: what kind of job it is (`task.ts`), whether it wants words or a thing
 * (`modes.ts`), which model should answer (`route.ts`), how hard to think
 * (`effortFor`), and whether the answer needs checking (`lint.ts`). Each was
 * read at a different call site, none was recorded, and nothing ever asked
 * whether the decision had been a good one. So the app could not get better
 * at deciding: every request was the first request it had ever seen.
 *
 * This is the one place the decision is made, and `Plan` is the whole of it.
 * It is stored with the answer, the answer's fate is stored beside it, and
 * the next decision of the same shape can read what happened to the last
 * one. That loop — decide, act, observe, record, decide better — is the
 * point; everything else here is bookkeeping in service of it.
 *
 * What it deliberately does not do is invent a new taxonomy. The readers
 * already exist and are already tested; this composes them.
 */
import { taskOf, effortFor, type Task, type TaskKind } from "./task";
import { modeFor, type Mode } from "./modes";
import { registerFor, type Register } from "./register";

/** What this turn is going to be. */
export type Strategy =
  /** Answered here, by arithmetic, with no model at all. */
  | "compute"
  /** A page, built and run beside the conversation. */
  | "build"
  /** Words. */
  | "answer";

/**
 * How much checking the answer earns.
 *
 * `lint` is free and local: the app reads its own answer for the faults it
 * knows about. `second` costs a call to a different provider and is worth it
 * only where it has been earning its keep — which is a fact about this
 * person's own history, not a setting.
 */
export type Check = "none" | "lint" | "second";

export interface Plan {
  strategy: Strategy;
  kind: TaskKind;
  task: Task | null;
  mode: Mode;
  effort?: "low" | "medium" | "high";
  check: Check;
  /**
   * How to answer, when the thread is on Auto. Null when the person has
   * chosen a style themselves, which always wins: this is the app filling
   * in a blank, not overruling an answer somebody already gave.
   */
  register: Register | null;
  /** One line, in the words a person would use. Shown, not logged. */
  why: string;
}

/** What became of the answers this app has already given of this shape. */
export interface Past {
  /** Turns of this kind answered by this model. */
  n: number;
  /** How many of those the person had to do something about. */
  bad: number;
}

/**
 * Kinds where a second opinion is worth what it costs.
 *
 * A disagreement about a fact, a sum, a line of code or a claim from a source
 * is a disagreement somebody can settle. A disagreement about a poem is two
 * poems. Asking a second model to grade creative work produces a confident
 * paragraph about taste and teaches the system nothing.
 */
const CHECKABLE: ReadonlySet<TaskKind> = new Set<TaskKind>([
  "coding",
  "research",
  "data",
  "summarize",
  "translate",
  "general",
]);

/**
 * Whether a second opinion on this kind of work would mean anything.
 *
 * Exported because the Armi models ask it too: Mizar's whole tactic is a
 * check from a second company, and a check it runs on a poem is two poems
 * and a bill. One list, read by both, rather than two that drift.
 */
export function checkable(kind: TaskKind): boolean {
  return CHECKABLE.has(kind);
}

/** Below this many turns, a run of bad luck is a run of bad luck. */
export const ENOUGH = 4;
/** Above this share going wrong, the next one gets checked. */
export const TOO_MANY = 0.5;

export function planTurn(
  ask: string,
  ctx: {
    /** A tail of the conversation, for reading what kind of thing this is. */
    history?: string;
    /** A mode stamped on the thread wins: the canvas sets one on purpose. */
    mode?: string;
    /** The calculator already answered, so no model is involved. */
    computed?: boolean;
    /** What happened last time this kind went to this model. */
    past?: Past;
    /** Their own recent messages, for reading how they write. */
    theirs?: string[];
    /** How many times lately they have said an answer was too long. */
    tooLong?: number;
    /** False when the person picked a style: then nothing here chooses one. */
    autoStyle?: boolean;
  } = {},
): Plan {
  const task = ask.trim() ? taskOf(ask, ctx.history ?? "") : null;
  const kind = task?.kind ?? "general";

  const register = ctx.autoStyle
    ? registerFor(ask, { kind, theirs: ctx.theirs, tooLong: ctx.tooLong })
    : null;

  if (ctx.computed) {
    return {
      strategy: "compute",
      kind,
      task,
      mode: "chat",
      check: "none",
      register,
      why: "Worked out here — a sum does not need a model, and this way it is exact.",
    };
  }

  const mode: Mode = ctx.mode === "creative" || ctx.mode === "chat" || ctx.mode === "learn"
    ? (ctx.mode as Mode)
    : modeFor(ask);
  const strategy: Strategy = mode === "creative" ? "build" : "answer";
  const effort = effortFor(kind);

  /* The loop, closing. A second opinion is not a setting anybody should have
     to find and not a tax on every answer: it is what this app does after it
     has watched its own answers of this shape go wrong for this person often
     enough to expect the next one to. */
  const plan: Plan = {
    strategy,
    kind,
    task,
    mode,
    effort,
    check: "lint",
    register,
    why:
      strategy === "build"
        ? "Built rather than described — this app can run what it makes."
        : task?.why
          ? `Read as ${kind}: ${task.why}.`
          : "Answered as asked.",
  };
  return ctx.past ? withPast(plan, ctx.past) : plan;
}

/**
 * The same plan, decided again in the light of what happened last time.
 *
 * Separate from `planTurn` so that reading the request and reading the
 * record stay two different operations: the first is a regex pass over the
 * text and the second is a query, and folding them together would make the
 * whole decision async for the sake of one field.
 */
export function withPast(plan: Plan, past: Past): Plan {
  if (plan.strategy !== "answer" || !CHECKABLE.has(plan.kind)) return plan;
  if (past.n < ENOUGH || past.bad / past.n < TOO_MANY) return plan;
  return {
    ...plan,
    check: "second",
    why: `Checked by a second model — ${past.bad} of the last ${past.n} answers like this needed another go.`,
  };
}

/**
 * Whether a plan is worth recording.
 *
 * A turn nobody can learn from is a row that costs storage and teaches
 * nothing. An answer with no model behind it is the clear case.
 */
export function worthRecording(plan: Plan): boolean {
  return plan.strategy !== "compute";
}
