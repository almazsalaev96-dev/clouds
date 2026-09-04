/** The engine, as one import. */
export * as mastery from "./mastery.js";
export * as scheduling from "./scheduling.js";
export * as misconceptions from "./misconceptions.js";
export * as eig from "./eig.js";
export * as nextaction from "./nextaction.js";

import * as M from "./mastery.js";
import * as S from "./scheduling.js";
import * as MC from "./misconceptions.js";
import * as NA from "./nextaction.js";

/** Replay the log. Order matters, so it is enforced here rather than assumed. */
export function fold(attempts) {
  const states = {};
  const ordered = [...attempts].sort((a, b) =>
    a.at !== b.at ? a.at - b.at
      : a.conceptId !== b.conceptId ? a.conceptId.localeCompare(b.conceptId)
        : (a.questionId ?? "").localeCompare(b.questionId ?? ""));
  for (const a of ordered) {
    states[a.conceptId] = M.apply(states[a.conceptId] ?? M.newState(a.conceptId), a);
  }
  return states;
}

/**
 * Evidence in, understanding out. A pure function of the log and the clock, so every
 * conclusion is recomputed rather than stored — which is what makes "why am I being
 * shown this?" answerable and deleting data actually delete the beliefs behind it.
 */
export function project(attempts, concepts, assignments = [], ctx = {}) {
  const now = ctx.now ?? Date.now();
  const states = fold(attempts);
  const byId = Object.fromEntries(concepts.map((c) => [c.id, c]));
  const reviewCtx = { daysUntilExam: ctx.daysUntilExam ?? null };

  const views = Object.keys(states).sort().map((id) => {
    const state = states[id];
    return {
      conceptId: id,
      name: byId[id]?.name ?? id,
      state: M.effectiveState(state, now),
      freshState: M.freshState(state),
      pUnaided: M.predictedP(state),
      retrievability: M.currentRetrievability(state, now),
      stabilityDays: state.stability,
      difficulty: state.difficulty,
      attempts: state.attempts,
      independentCorrect: state.independentCorrect,
      evidence: M.evidenceStrength(state),
      independence: M.independence(state),
      dueAt: S.dueAt(state, reviewCtx),
      overdueDays: S.overdueDays(state, now, reviewCtx),
      get needsReview() { return M.rank(this.state) < M.rank(this.freshState); },
    };
  });

  const recommendations = NA.recommend(states, concepts, assignments, {
    now, availableMinutes: ctx.availableMinutes ?? 30, ...ctx,
  });

  return {
    at: now,
    states,
    concepts: views,
    patterns: MC.detect(attempts, now),
    recommendations,
    plan: NA.planSession(recommendations, ctx.availableMinutes ?? 30),
    weakest: views.filter((c) => c.attempts > 0)
      .sort((a, b) => a.pUnaided - b.pUnaided || a.conceptId.localeCompare(b.conceptId)),
    nextBestAction: recommendations[0] ?? null,
  };
}
