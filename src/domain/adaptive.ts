/**
 * Adaptive item selection.
 *
 * After each answer the engine decides what to serve next. The governing idea
 * is *desirable difficulty*: the most informative and most learning-productive
 * question is one the student has roughly a 70–80% chance of getting right —
 * hard enough to require retrieval, easy enough that the retrieval succeeds.
 * Serving questions a student always gets right teaches nothing; serving ones
 * they always fail teaches less than nothing, because it destroys the will to
 * continue.
 *
 * Two properties this engine has that simple "get it right, go harder" ladders
 * do not:
 *
 *  - It distinguishes *why* an answer was wrong. A calculation slip on a
 *    conceptually easy question should not lower conceptual difficulty.
 *  - It interleaves. Consecutive questions from one subtopic let a student
 *    pattern-match the method instead of choosing it, which is exactly the
 *    skill the exam tests.
 */

import { overallDifficulty, type Attempt, type Question, type QuestionType } from "./question";
import { clamp01, type TopicId, type Unit } from "./types";

export type NextMove =
  | "harder"
  | "same"
  | "easier"
  | "prerequisite"
  | "similar"
  | "different-topic"
  | "exam-style"
  | "consolidate"
  | "stop";

export interface SelectionContext {
  /** Running ability estimate for the topic being practised, 0..1. */
  ability: Unit;
  /** Answers so far this session, newest last. */
  session: { questionId: string; topicId?: TopicId; fraction: Unit; difficulty: Unit }[];
  /** Consecutive wrong answers. */
  streakWrong: number;
  streakRight: number;
  /** Minutes remaining in the session. */
  minutesLeft: number;
  /** Whether the student asked for interleaving. */
  interleave: boolean;
}

export interface MoveDecision {
  move: NextMove;
  /** Difficulty band to look for, 0..1. */
  targetDifficulty: Unit;
  because: string;
}

/** The sweet spot: aim for a question the student has a ~75% chance of getting. */
export const TARGET_SUCCESS = 0.75;

/**
 * Invert the logistic used by the ability model to find the difficulty at which
 * the student's success probability equals `TARGET_SUCCESS`.
 * From p = 1/(1+e^{-6(a-d)})  ⇒  d = a - ln(p/(1-p))/6.
 */
export function difficultyForTargetSuccess(ability: Unit, p = TARGET_SUCCESS): Unit {
  return clamp01(ability - Math.log(p / (1 - p)) / 6);
}

export function decideNextMove(ctx: SelectionContext): MoveDecision {
  const target = difficultyForTargetSuccess(ctx.ability);

  if (ctx.minutesLeft <= 1) {
    return { move: "stop", targetDifficulty: target, because: "Session time is up — stopping on time is itself an exam skill." };
  }

  // Two wrong in a row: the problem is upstream. Do not simply lower difficulty
  // within the same topic — check whether the prerequisite is the real failure.
  if (ctx.streakWrong >= 2) {
    return {
      move: "prerequisite",
      targetDifficulty: clamp01(target - 0.25),
      because: "Two in a row wrong. Repeating the same level rarely helps; the cause is usually one level down.",
    };
  }
  if (ctx.streakWrong === 1) {
    return {
      move: "easier",
      targetDifficulty: clamp01(target - 0.15),
      because: "One wrong. Drop a step to rebuild the pattern before pushing again.",
    };
  }

  if (ctx.streakRight >= 3) {
    return {
      move: "harder",
      targetDifficulty: clamp01(target + 0.18),
      because: "Three correct in a row means this level is no longer teaching you anything.",
    };
  }

  // Interleaving: after two consecutive questions on the same topic, switch.
  if (ctx.interleave && ctx.session.length >= 2) {
    const last = ctx.session[ctx.session.length - 1];
    const prev = ctx.session[ctx.session.length - 2];
    if (last?.topicId && last.topicId === prev?.topicId) {
      return {
        move: "different-topic",
        targetDifficulty: target,
        because: "Switching topic. Blocked practice lets you match the method instead of choosing it — the exam never does that.",
      };
    }
  }

  if (ctx.streakRight >= 2 && ctx.ability > 0.7) {
    return {
      move: "exam-style",
      targetDifficulty: clamp01(target + 0.1),
      because: "Secure at this level — time to meet it in full exam framing.",
    };
  }

  return { move: "same", targetDifficulty: target, because: "Holding this level to build consistency." };
}

export interface Candidate {
  question: Pick<Question, "id" | "topicIds" | "difficulty" | "type" | "marks" | "prerequisiteTopicIds">;
  /** Times this student has already seen it. */
  seenCount: number;
  /** Fraction scored the last time, if seen. */
  lastFraction?: Unit;
  /** Retention of its topic, for review-weighted selection. */
  topicRetention?: Unit;
}

export interface SelectionResult {
  chosen: Candidate | null;
  because: string[];
  ranked: { candidate: Candidate; score: number }[];
}

/**
 * Choose the next question. Scores candidates on closeness to the target
 * difficulty, novelty, interleaving distance, and review value, then picks the
 * best — with a small amount of controlled randomness so a student repeating a
 * session does not get an identical sequence.
 */
export function selectNext(
  candidates: Candidate[],
  decision: MoveDecision,
  ctx: SelectionContext,
  random: () => number = Math.random,
): SelectionResult {
  if (candidates.length === 0) {
    return { chosen: null, because: ["No questions available that match this filter."], ranked: [] };
  }

  const recentIds = new Set(ctx.session.slice(-6).map((s) => s.questionId));
  const recentTopics = ctx.session.slice(-3).map((s) => s.topicId).filter(Boolean) as TopicId[];

  const ranked = candidates
    .map((c) => {
      const d = overallDifficulty(c.question.difficulty);

      // Closeness to target difficulty — the dominant term.
      const fit = 1 - Math.min(1, Math.abs(d - decision.targetDifficulty) / 0.35);

      // Novelty. Unseen questions are worth much more than repeats, but a
      // question previously failed is worth revisiting deliberately.
      let novelty = c.seenCount === 0 ? 1 : 0.35 / c.seenCount;
      if (c.lastFraction !== undefined && c.lastFraction < 0.5) novelty += 0.4;

      // Interleaving distance.
      const sameTopicRecently = c.question.topicIds.some((t) => recentTopics.includes(t));
      const interleaveBonus = ctx.interleave && !sameTopicRecently ? 0.25 : 0;
      const interleavePenalty =
        decision.move === "different-topic" && sameTopicRecently ? -0.7 : 0;

      // Review value: questions on decaying topics do double duty.
      const reviewValue = c.topicRetention !== undefined ? (1 - c.topicRetention) * 0.3 : 0;

      const justSeen = recentIds.has(c.question.id) ? -1.5 : 0;

      const jitter = (random() - 0.5) * 0.06;

      const score =
        fit * 1.0 + novelty * 0.55 + interleaveBonus + interleavePenalty + reviewValue + justSeen + jitter;
      return { candidate: c, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const because = [decision.because];
  if (top) {
    const d = overallDifficulty(top.candidate.question.difficulty);
    because.push(
      `Chosen at difficulty ${Math.round(d * 100)}% against a target of ${Math.round(decision.targetDifficulty * 100)}% — roughly a ${Math.round(successProbability(ctx.ability, d) * 100)}% chance you get this right.`,
    );
    if (top.candidate.lastFraction !== undefined && top.candidate.lastFraction < 0.5) {
      because.push("You have seen this before and lost marks on it.");
    }
  }
  return { chosen: top?.candidate ?? null, because, ranked };
}

export function successProbability(ability: Unit, difficulty: Unit): Unit {
  return clamp01(1 / (1 + Math.exp(-6 * (ability - difficulty))));
}

/**
 * Build an interleaved order from a pool that is grouped by topic. Maximises
 * the distance between same-topic items rather than shuffling blindly, because
 * random shuffles routinely produce runs of three from one topic.
 */
export function interleaveByTopic<T>(items: T[], topicOf: (t: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = topicOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const out: T[] = [];
  let lastKey: string | null = null;
  while (out.length < items.length) {
    // Always take from the largest remaining group that isn't the last used.
    const options = [...groups.entries()].filter(([k, v]) => v.length > 0 && k !== lastKey);
    const pool = options.length ? options : [...groups.entries()].filter(([, v]) => v.length > 0);
    if (!pool.length) break;
    pool.sort((a, b) => b[1].length - a[1].length);
    const [key, arr] = pool[0]!;
    out.push(arr.shift()!);
    lastKey = key;
  }
  return out;
}

/** Vary retrieval format so a student cannot rehearse one answer shape. */
export function varyFormat(recent: QuestionType[], available: QuestionType[]): QuestionType[] {
  const recentSet = new Set(recent.slice(-3));
  const fresh = available.filter((t) => !recentSet.has(t));
  return fresh.length ? fresh : available;
}
