/**
 * What is the single most useful thing this student could do right now?
 *
 * Everything is scored in expected mastery gain per minute, so a five-minute targeted
 * intervention can beat thirty minutes of rereading — and rest is a real candidate,
 * because a study product that can never recommend stopping is optimising for the
 * wrong thing.
 */
import * as M from "./mastery.js";
import * as S from "./scheduling.js";

export const W_FIX = 0.55;
export const W_REVIEW = 0.40;
export const W_TRANSFER = 0.25;
export const W_ASSIGNMENT = 2.20;
export const W_DIAGNOSTIC = 0.50;
export const W_REST = 0.60;

export const FATIGUE_ONSET_MIN = 25.0;
export const FATIGUE_SPAN_MIN = 45.0;
export const REST_MINUTES = 5.0;
export const DEADLINE_HORIZON_HOURS = 72.0;
export const MINUTES_PER_QUESTION = 3.0;
export const WORK_BLOCK_MINUTES = 10.0;
export const MIN_ASSIGNMENT_URGENCY = 0.15;

export function importance(concept, fanout, maxFanout) {
  const fan = maxFanout > 0 ? fanout / maxFanout : 0;
  const upcoming = Math.min(concept.upcomingUses ?? 0, 4) / 4;
  return (concept.examWeight ?? 1) * (1 + 0.25 * fan + 0.25 * upcoming);
}

/** Starts mattering two days out, not on the morning it is due. */
export function deadlineUrgency(dueAt, now) {
  if (dueAt == null) return MIN_ASSIGNMENT_URGENCY;
  const hours = (dueAt - now) / 3_600_000;
  if (hours <= 0) return 1;
  const ramp = Math.pow(M.clamp(1 - hours / DEADLINE_HORIZON_HOURS, 0, 1), 1.5);
  return Math.max(MIN_ASSIGNMENT_URGENCY, ramp);
}

export const fatigue = (minutesWorked) =>
  M.clamp((minutesWorked - FATIGUE_ONSET_MIN) / FATIGUE_SPAN_MIN, 0, 1);

function fanoutOf(concepts) {
  const counts = Object.fromEntries(concepts.map((c) => [c.id, 0]));
  for (const c of concepts) {
    for (const p of c.prerequisites ?? []) if (p in counts) counts[p] += 1;
  }
  return counts;
}

export function recommend(states, concepts, assignments, ctx) {
  const now = ctx.now;
  const byId = Object.fromEntries(concepts.map((c) => [c.id, c]));
  const fan = fanoutOf(concepts);
  const maxFan = Math.max(0, ...Object.values(fan));
  const reviewCtx = { daysUntilExam: ctx.daysUntilExam ?? null };
  const out = [];

  for (const [id, state] of Object.entries(states)) {
    const concept = byId[id];
    if (!concept) continue;
    const imp = importance(concept, fan[id] ?? 0, maxFan);
    const p = M.predictedP(state);
    // Deliberately the *fresh* state. Something known but faded is a recall problem,
    // handled below; scoring it as a knowledge gap too would send the student back to
    // relearn what they already understand.
    const fresh = M.freshState(state);

    if (M.rank(fresh) < M.rank("reliable") && state.attempts > 0) {
      const minutes = 8;
      const value = (1 - p) * W_FIX * imp;
      out.push({
        kind: "fixWeakness", title: `Fix: ${concept.name}`,
        reason: `You are at ${Math.round(p * 100)}% unaided on this.`,
        minutes, value, score: value / minutes, conceptIds: [id], assignmentId: null,
      });
    }

    const risk = S.forgettingRisk(state, now);
    if (risk > 0.05) {
      const minutes = 2.5;
      const value = risk * W_REVIEW * imp;
      const over = S.overdueDays(state, now, reviewCtx);
      const when = over <= 0 ? "due now" : `${Math.floor(over)} days overdue`;
      out.push({
        kind: "retrievalReview", title: `Recall: ${concept.name}`,
        reason: `Review ${when}; recall is at ${Math.round(M.currentRetrievability(state, now) * 100)}%.`,
        minutes, value, score: value / minutes, conceptIds: [id], assignmentId: null,
      });
    }

    if (M.rank(fresh) >= M.rank("reliable") && state.transferCorrect === 0) {
      const minutes = 4;
      const value = W_TRANSFER * imp;
      out.push({
        kind: "transferProbe", title: `Try a different angle: ${concept.name}`,
        reason: "You can do the standard version. This checks you understand it.",
        minutes, value, score: value / minutes, conceptIds: [id], assignmentId: null,
      });
    }
  }

  for (const a of assignments) {
    const remaining = Math.max(0, a.questionsTotal - a.questionsDone);
    if (remaining <= 0) continue;
    const urgency = deadlineUrgency(a.dueAt ?? null, now);
    // Score the *next block* of work: dividing a worksheet's value by a worksheet's
    // minutes buries urgent work beneath optional five-minute reviews.
    const minutes = Math.min(
      remaining * MINUTES_PER_QUESTION, WORK_BLOCK_MINUTES,
      Math.max(1, ctx.availableMinutes ?? 30),
    );
    const value = urgency * W_ASSIGNMENT;
    out.push({
      kind: "finishAssignment", title: `Continue: ${a.title}`,
      reason: `${remaining} of ${a.questionsTotal} questions left.`,
      minutes, value, score: value / minutes,
      conceptIds: a.conceptIds ?? [], assignmentId: a.id,
    });
  }

  if ((ctx.modelUncertainty ?? 0) > 0.35) {
    const minutes = 6;
    const value = ctx.modelUncertainty * W_DIAGNOSTIC;
    out.push({
      kind: "diagnostic", title: "Six quick questions",
      reason: "Your recent work does not say clearly where the problem is.",
      minutes, value, score: value / minutes, conceptIds: [], assignmentId: null,
    });
  }

  const f = fatigue(ctx.minutesWorkedContinuously ?? 0);
  if (f > 0) {
    const value = f * f * W_REST;
    out.push({
      kind: "rest", title: "Take five minutes",
      reason: `You have been working for ${Math.floor(ctx.minutesWorkedContinuously)} minutes.`,
      minutes: REST_MINUTES, value, score: value / REST_MINUTES,
      conceptIds: [], assignmentId: null,
    });
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.title.localeCompare(b.title);
  });
  return out;
}

/**
 * Greedy pack by value density. Never pads to fill the time — if the best work takes
 * eleven minutes of a stated thirty, the plan is eleven minutes long.
 */
export function planSession(recommendations, availableMinutes, maxItems = 6) {
  const chosen = [];
  let used = 0;
  const seen = new Set();

  for (const r of recommendations) {
    if (chosen.length >= maxItems || used + r.minutes > availableMinutes) continue;
    if (r.kind === "rest" && chosen.length === 0) {
      chosen.push(r);
      used += r.minutes;
      continue;
    }
    const key = [...r.conceptIds].sort().join("|");
    if (key && seen.has(key)) continue;
    chosen.push(r);
    if (key) seen.add(key);
    used += r.minutes;
  }
  return chosen;
}
