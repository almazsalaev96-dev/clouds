/** Spaced retrieval. Spec: docs/LEARNING-MODEL.md section 5. */
import * as M from "./mastery.js";

export const R_DEFAULT = 0.90;
export const R_EXAM_NEAR = 0.93;
export const R_EXAM_IMMINENT = 0.95;
export const R_PREREQUISITE = 0.93;
export const R_LOW_PRIORITY = 0.85;
export const EXAM_NEAR_DAYS = 14.0;
export const EXAM_IMMINENT_DAYS = 5.0;
export const MIN_INTERVAL_DAYS = 0.02;
export const MAX_INTERVAL_DAYS = 365.0;

/** Higher target ⇒ shorter interval ⇒ more frequent review as an exam nears. */
export function targetRetention(ctx = {}) {
  if (ctx.lowPriority) return R_LOW_PRIORITY;
  let t = R_DEFAULT;
  if (ctx.daysUntilExam != null) {
    if (ctx.daysUntilExam <= EXAM_IMMINENT_DAYS) t = Math.max(t, R_EXAM_IMMINENT);
    else if (ctx.daysUntilExam <= EXAM_NEAR_DAYS) t = Math.max(t, R_EXAM_NEAR);
  }
  if (ctx.isPrerequisiteOfDueWork) t = Math.max(t, R_PREREQUISITE);
  return t;
}

export function intervalDays(stability, ctx = {}) {
  if (stability <= 0) return MIN_INTERVAL_DAYS;
  const r = targetRetention(ctx);
  return M.clamp(9 * stability * (1 / r - 1), MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS);
}

export function dueAt(state, ctx = {}) {
  if (state.lastReviewed === null) return null;
  return state.lastReviewed + intervalDays(state.stability, ctx) * 86_400_000;
}

export function overdueDays(state, now, ctx = {}) {
  const due = dueAt(state, ctx);
  if (due === null) return 0;
  return Math.max(0, M.daysBetween(due, now));
}

/**
 * What is at risk of being lost — but only for material that was actually learned.
 * A concept never understood is a gap, not a forgetting risk, and conflating the two
 * sends students to revise things they have never seen.
 */
export function forgettingRisk(state, now) {
  if (state.lastReviewed === null) return 0;
  const p = M.predictedP(state);
  if (p < M.P_PRACTICING) return 0;
  return (1 - M.currentRetrievability(state, now)) * p;
}
