import type { Attempt, Grade, Problem, Trap } from "./types";
import { schedule } from "./study";
import { db, uid } from "./db";

/**
 * Answers are checked here, on this machine, with no model in the loop.
 *
 * That is a design constraint rather than an optimisation: a learner mid-drill
 * cannot wait two seconds and a possible failure to find out whether they were
 * right. It is also why the generator is only ever asked for cloze and numeric
 * problems — both are fully checkable locally *and* are the formats real work
 * takes. Multiple choice would be trivially checkable and worthless: it puts
 * the answer on screen before every attempt.
 */
export function normalise(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[$\\]/g, "")
    .replace(/\s*([+\-*/^=(),])\s*/g, "$1")
    .replace(/^\{|\}$/g, "");
}

export function checkAnswer(problem: Problem, response: string): boolean {
  const given = response.trim();
  if (!given) return false;

  if (problem.kind === "numeric") {
    // Accept the ways people actually type numbers, including a fraction.
    const cleaned = given.replace(/[,\s]/g, "");
    const fraction = cleaned.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    const value = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(cleaned);
    if (!Number.isFinite(value) || problem.answer.value === undefined) return false;
    const tolerance = problem.answer.tolerance ?? Math.max(1e-9, Math.abs(problem.answer.value) * 1e-6);
    return Math.abs(value - problem.answer.value) <= tolerance;
  }

  return (problem.answer.accept ?? []).some((a) => normalise(a) === normalise(given));
}

/**
 * The grade is derived from what happened, never chosen and never timed.
 *
 * A miss is a miss even when the retry succeeds — that is the whole reason the
 * retry exists. Speed is not an input: slow-because-tired and slow-because-
 * shaky are indistinguishable, and turning fatigue into a shorter interval
 * would be less honest than asking outright.
 */
export function deriveGrade(opts: {
  correctFirstTry: boolean;
  hinted: boolean;
  shown: boolean;
  window: string;
}): Grade {
  if (opts.shown || !opts.correctFirstTry) return "again";
  if (opts.hinted) return "hard";
  // Three clean first tries in a row is the only thing that earns a long jump.
  return opts.window.slice(-3) === "111" ? "easy" : "good";
}

const OUTCOME: Record<string, string> = { first: "1", hinted: "h", retried: "r", missed: "x" };

export function outcomeChar(opts: { correctFirstTry: boolean; hinted: boolean; shown: boolean; retriedOk: boolean }) {
  if (opts.shown || (!opts.correctFirstTry && !opts.retriedOk)) return OUTCOME.missed;
  if (!opts.correctFirstTry) return OUTCOME.retried;
  return opts.hinted ? OUTCOME.hinted : OUTCOME.first;
}

/**
 * One transaction: the evidence, and the schedule it earns.
 *
 * The trap's counters are denormalised deliberately — the index and the skill
 * sheet must never scan the attempts table to draw a row — but that only stays
 * true if they are written with the attempt rather than after it.
 */
export async function recordAttempt(opts: {
  trap: Trap;
  problem: Problem;
  response: string;
  correctFirstTry: boolean;
  retriedOk: boolean;
  hinted: boolean;
  shown: boolean;
}): Promise<{ grade: Grade; trap: Trap }> {
  const now = Date.now();
  const grade = deriveGrade({
    correctFirstTry: opts.correctFirstTry,
    hinted: opts.hinted,
    shown: opts.shown,
    window: opts.trap.window,
  });
  const char = outcomeChar(opts);

  const scheduled = schedule(opts.trap, grade, now);
  const next: Trap = {
    ...scheduled,
    state: "open",
    seen: opts.trap.seen + 1,
    firstTry: opts.trap.firstTry + (opts.correctFirstTry && !opts.hinted && !opts.shown ? 1 : 0),
    window: (opts.trap.window + char).slice(-8),
    lastMissAt: char === "x" || char === "r" ? now : opts.trap.lastMissAt,
    updatedAt: now,
  };

  const attempt: Attempt = {
    id: uid(),
    skillId: opts.problem.skillId,
    trapId: opts.trap.id,
    problemId: opts.problem.id,
    kind: opts.correctFirstTry ? "first" : "retry",
    response: opts.response,
    correct: opts.correctFirstTry || opts.retriedOk,
    hinted: opts.hinted,
    shown: opts.shown,
    createdAt: now,
  };

  await db.transaction("rw", [db.attempts, db.traps, db.problems], async () => {
    await db.attempts.add(attempt);
    await db.traps.put(next);
    await db.problems.update(opts.problem.id, { servedAt: now, retired: true });
  });

  return { grade, trap: next };
}

/**
 * Interleaved: never two problems in a row on the same trap.
 *
 * Blocked practice — six problems on one trap — feels far better and teaches
 * far less, because after the first you are applying a rule you have just been
 * told rather than deciding which rule applies. Deciding is the skill.
 */
export function interleave(problems: Problem[]): Problem[] {
  const byTrap = new Map<string, Problem[]>();
  for (const p of problems) {
    const list = byTrap.get(p.trapId);
    if (list) list.push(p);
    else byTrap.set(p.trapId, [p]);
  }
  const out: Problem[] = [];
  let last = "";
  while (byTrap.size) {
    // Take from the largest remaining group that is not the one just served.
    const groups = [...byTrap.entries()].sort((a, b) => b[1].length - a[1].length);
    const pick = groups.find(([id]) => id !== last) ?? groups[0];
    out.push(pick[1].shift()!);
    last = pick[0];
    if (!pick[1].length) byTrap.delete(pick[0]);
  }
  return out;
}

/** Hold first-try error near a quarter: the band where practice is worth doing. */
export function steerBand(band: 1 | 2 | 3, window: string): 1 | 2 | 3 {
  const recent = window.slice(-6);
  if (recent.length < 6) return band;
  const clean = [...recent].filter((c) => c === "1").length / recent.length;
  if (clean > 0.85 && band < 3) return (band + 1) as 1 | 2 | 3;
  if (clean < 0.5 && band > 1) return (band - 1) as 1 | 2 | 3;
  return band;
}
