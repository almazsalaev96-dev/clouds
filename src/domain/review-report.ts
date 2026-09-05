/**
 * Periodic reviews.
 *
 * A weekly report that a student would actually read: what moved, what did not,
 * what is recurring, and one instruction for next week. Derived entirely from
 * the event log, so it can be computed for any past window retroactively.
 *
 * The design constraint is that it must be *falsifiable*. "Great work this
 * week!" is unfalsifiable and therefore worthless; "your accuracy on evaluation
 * questions rose 11 points while your recall on Section 5 fell to 58%" is a
 * claim a student can check, and one they can act on.
 */

import { ofType, rollupByDay, type LearningEvent } from "./events";
import { MARK_LOSS_LABELS, TECHNIQUE_LOSSES, type MarkLossCategory } from "./question";
import { addDays, daysBetween, type Timestamp } from "./types";

export interface PeriodReport {
  from: string;
  to: string;
  label: string;
  /** True when there is too little activity to say anything honest. */
  quiet: boolean;
  questionsAnswered: number;
  marksEarned: number;
  marksAvailable: number;
  minutesStudied: number;
  cardsReviewed: number;
  activeDays: number;
  accuracy: number;
  accuracyChange: number | null;
  mistakesCreated: number;
  mistakesEliminated: number;
  /** Loss category that cost the most marks in this window. */
  dominantLoss: { category: MarkLossCategory; label: string; marks: number } | null;
  /** Loss categories that also dominated the previous window — the real problem. */
  recurringLoss: { category: MarkLossCategory; label: string } | null;
  topicsImproved: { topicId: string; delta: number }[];
  topicsSlipped: { topicId: string; delta: number }[];
  /** One instruction. Not a list — a list is a way of avoiding a decision. */
  headline: string;
  instruction: string;
}

export function buildPeriodReport(
  events: LearningEvent[],
  now: Timestamp,
  days: number,
  label: string,
): PeriodReport {
  const from = addDays(now, -days);
  const previousFrom = addDays(now, -days * 2);

  const inWindow = (e: LearningEvent) => e.at >= from && e.at <= now;
  const inPrevious = (e: LearningEvent) => e.at >= previousFrom && e.at < from;

  const current = events.filter(inWindow);
  const previous = events.filter(inPrevious);

  const answered = ofType(current, "question_answered");
  const answeredBefore = ofType(previous, "question_answered");

  const marksEarned = answered.reduce((s, e) => s + e.score, 0);
  const marksAvailable = answered.reduce((s, e) => s + e.maxScore, 0);
  const accuracy = marksAvailable ? marksEarned / marksAvailable : 0;

  const beforeAvailable = answeredBefore.reduce((s, e) => s + e.maxScore, 0);
  const accuracyBefore = beforeAvailable
    ? answeredBefore.reduce((s, e) => s + e.score, 0) / beforeAvailable
    : null;
  const accuracyChange = accuracyBefore !== null ? accuracy - accuracyBefore : null;

  const rollups = rollupByDay(current);
  const activeDays = rollups.filter((r) => r.questionsAnswered > 0 || r.cardsReviewed > 0).length;

  // --- mark loss ------------------------------------------------------------
  const lossNow = tallyLoss(ofType(current, "mark_lost"));
  const lossBefore = tallyLoss(ofType(previous, "mark_lost"));
  const dominant = [...lossNow.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantBefore = [...lossBefore.entries()].sort((a, b) => b[1] - a[1])[0];

  const dominantLoss = dominant
    ? { category: dominant[0], label: MARK_LOSS_LABELS[dominant[0]], marks: dominant[1] }
    : null;
  const recurringLoss =
    dominant && dominantBefore && dominant[0] === dominantBefore[0]
      ? { category: dominant[0], label: MARK_LOSS_LABELS[dominant[0]] }
      : null;

  // --- topic movement -------------------------------------------------------
  const accuracyByTopic = (rows: typeof answered) => {
    const map = new Map<string, { earned: number; available: number; questions: number }>();
    for (const e of rows) {
      for (const t of e.topicIds) {
        const cur = map.get(t) ?? { earned: 0, available: 0, questions: 0 };
        cur.earned += e.score / e.topicIds.length;
        cur.available += e.maxScore / e.topicIds.length;
        cur.questions += 1;
        map.set(t, cur);
      }
    }
    return map;
  };
  const nowByTopic = accuracyByTopic(answered);
  const beforeByTopic = accuracyByTopic(answeredBefore);

  const movement: { topicId: string; delta: number }[] = [];
  for (const [topicId, cur] of nowByTopic) {
    const prev = beforeByTopic.get(topicId);
    // Require real evidence on both sides. The guard counts questions, not
    // marks: a single 4-mark question is still a single observation, and one
    // observation per window is a coin flip presented as a trend.
    if (!prev || prev.questions < 3 || cur.questions < 3) continue;
    if (prev.available <= 0 || cur.available <= 0) continue;
    movement.push({ topicId, delta: cur.earned / cur.available - prev.earned / prev.available });
  }

  const questionsAnswered = answered.length;
  const quiet = questionsAnswered < 5;

  // --- the one instruction --------------------------------------------------
  let headline: string;
  let instruction: string;

  if (quiet) {
    headline = activeDays === 0
      ? `No recorded study in the last ${days} days.`
      : `Only ${questionsAnswered} question${questionsAnswered === 1 ? "" : "s"} recorded in the last ${days} days.`;
    instruction =
      "Too little to draw conclusions from. A single 25-minute session would give the next report something honest to say.";
  } else if (recurringLoss) {
    headline = `“${recurringLoss.label}” cost you the most marks this period — and it did last period too.`;
    instruction = `This is not drifting, it is entrenched. Spend one session on that move alone, in isolation, rather than meeting it again inside full questions.`;
  } else if (dominantLoss && TECHNIQUE_LOSSES.has(dominantLoss.category)) {
    headline = `Your biggest loss was “${dominantLoss.label}” — ${dominantLoss.marks.toFixed(0)} marks, and it is technique rather than knowledge.`;
    instruction = "Technique transfers across every topic, so this is the cheapest improvement available. Drill the move directly.";
  } else if (accuracyChange !== null && accuracyChange <= -0.08) {
    headline = `Accuracy fell ${Math.abs(Math.round(accuracyChange * 100))} points against the previous period.`;
    instruction =
      "A fall usually means the difficulty rose rather than that you got worse — the adaptive engine raises it as you improve. Check whether the questions were harder before concluding anything.";
  } else if (accuracyChange !== null && accuracyChange >= 0.08) {
    headline = `Accuracy rose ${Math.round(accuracyChange * 100)} points against the previous period.`;
    instruction = "Keep the method that produced it. Do not change three things at once.";
  } else if (dominantLoss) {
    headline = `Your biggest loss was “${dominantLoss.label}” — ${dominantLoss.marks.toFixed(0)} marks.`;
    instruction = "Work that specific cause rather than the topics it happened to appear in.";
  } else {
    headline = `${questionsAnswered} questions across ${activeDays} day${activeDays === 1 ? "" : "s"}, with no dominant failure.`;
    instruction = "Nothing is obviously broken. Follow the priority order and sit a timed paper.";
  }

  return {
    from: from.slice(0, 10),
    to: now.slice(0, 10),
    label,
    quiet,
    questionsAnswered,
    marksEarned,
    marksAvailable,
    minutesStudied: answered.reduce((s, e) => s + e.timeSpent, 0) / 60,
    cardsReviewed: ofType(current, "card_reviewed").length,
    activeDays,
    accuracy,
    accuracyChange,
    mistakesCreated: ofType(current, "mistake_created").length,
    mistakesEliminated: ofType(current, "mistake_eliminated").length,
    dominantLoss,
    recurringLoss,
    topicsImproved: movement.filter((m) => m.delta > 0.1).sort((a, b) => b.delta - a.delta).slice(0, 4),
    topicsSlipped: movement.filter((m) => m.delta < -0.1).sort((a, b) => a.delta - b.delta).slice(0, 4),
    headline,
    instruction,
  };
}

function tallyLoss(rows: Extract<LearningEvent, { type: "mark_lost" }>[]): Map<MarkLossCategory, number> {
  const map = new Map<MarkLossCategory, number>();
  for (const e of rows) map.set(e.category, (map.get(e.category) ?? 0) + e.marks);
  return map;
}

/** Study consistency over a window: active days as a share of days elapsed. */
export function consistency(events: LearningEvent[], now: Timestamp, days: number): number {
  const from = addDays(now, -days);
  const rollups = rollupByDay(events.filter((e) => e.at >= from));
  const active = rollups.filter((r) => r.questionsAnswered > 0 || r.cardsReviewed > 0).length;
  return Math.min(1, active / Math.max(1, Math.min(days, Math.ceil(daysBetween(from, now)))));
}
