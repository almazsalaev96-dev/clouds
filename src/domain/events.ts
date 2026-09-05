/**
 * The analytics event model.
 *
 * Every statistic in the product is derived from this log, never hard-coded and
 * never incremented in a UI component. That has three consequences worth the
 * discipline: new metrics can be computed retroactively over history, a number
 * can always be traced back to the events that produced it, and exporting a
 * student's data means exporting one table.
 *
 * The log is local-first and private by default. See docs/PRIVACY.md.
 */

import type { Timestamp } from "./types";
import type { AttemptMode, MarkLossCategory } from "./question";

export type LearningEvent =
  | { type: "session_started"; at: Timestamp; sessionId: string; plannedMinutes: number; mode: AttemptMode }
  | { type: "session_ended"; at: Timestamp; sessionId: string; actualMinutes: number; blocksCompleted: number; blocksPlanned: number }
  | { type: "question_started"; at: Timestamp; questionId: string; topicIds: string[]; mode: AttemptMode; sessionId?: string }
  | { type: "question_answered"; at: Timestamp; questionId: string; topicIds: string[]; score: number; maxScore: number; timeSpent: number; confidence?: number; mode: AttemptMode; sessionId?: string }
  | { type: "question_skipped"; at: Timestamp; questionId: string; reason?: string }
  | { type: "answer_marked"; at: Timestamp; questionId: string; markedBy: "self" | "ai" | "teacher" | "auto"; score: number; maxScore: number }
  | { type: "mark_lost"; at: Timestamp; questionId: string; topicIds: string[]; category: MarkLossCategory; marks: number }
  | { type: "mistake_created"; at: Timestamp; mistakeId: string; category: MarkLossCategory; topicIds: string[] }
  | { type: "mistake_repeated"; at: Timestamp; mistakeId: string; occurrences: number }
  | { type: "mistake_eliminated"; at: Timestamp; mistakeId: string; daysOpen: number }
  | { type: "card_reviewed"; at: Timestamp; cardId: string; grade: number; intervalDays: number; retrievability: number }
  | { type: "explanation_opened"; at: Timestamp; topicId: string; depth: string }
  | { type: "hint_used"; at: Timestamp; questionId: string; level: number }
  | { type: "topic_mastered"; at: Timestamp; topicId: string; masteryScore: number }
  | { type: "mock_started"; at: Timestamp; mockId: string; paperId: string }
  | { type: "mock_completed"; at: Timestamp; mockId: string; paperId: string; score: number; maxScore: number; minutesUsed: number; minutesAllowed: number }
  | { type: "plan_generated"; at: Timestamp; horizonDays: number }
  | { type: "mission_item_completed"; at: Timestamp; itemId: string; kind: string }
  | { type: "recommendation_shown"; at: Timestamp; kind: string; subject: string; reason: string }
  | { type: "recommendation_accepted"; at: Timestamp; kind: string; subject: string }
  | { type: "recommendation_dismissed"; at: Timestamp; kind: string; subject: string; feedback?: string }
  | { type: "ai_request"; at: Timestamp; feature: string; model: string; inputTokens: number; outputTokens: number; cached: boolean; ms: number }
  | { type: "ai_failed"; at: Timestamp; feature: string; reason: string }
  | { type: "content_reported"; at: Timestamp; questionId: string; issue: string };

export type EventType = LearningEvent["type"];

/** Narrow an event log by type with the right payload type preserved. */
export function ofType<T extends EventType>(
  events: LearningEvent[],
  type: T,
): Extract<LearningEvent, { type: T }>[] {
  return events.filter((e): e is Extract<LearningEvent, { type: T }> => e.type === type);
}

export function eventsBetween(events: LearningEvent[], from: Timestamp, to: Timestamp): LearningEvent[] {
  return events.filter((e) => e.at >= from && e.at <= to);
}

export interface DailyRollup {
  date: string;
  questionsAnswered: number;
  marksEarned: number;
  marksAvailable: number;
  minutesStudied: number;
  cardsReviewed: number;
  mistakesFixed: number;
}

export function rollupByDay(events: LearningEvent[]): DailyRollup[] {
  const days = new Map<string, DailyRollup>();
  const get = (at: Timestamp) => {
    const key = at.slice(0, 10);
    if (!days.has(key))
      days.set(key, { date: key, questionsAnswered: 0, marksEarned: 0, marksAvailable: 0, minutesStudied: 0, cardsReviewed: 0, mistakesFixed: 0 });
    return days.get(key)!;
  };

  for (const e of events) {
    switch (e.type) {
      case "question_answered": {
        const d = get(e.at);
        d.questionsAnswered++;
        d.marksEarned += e.score;
        d.marksAvailable += e.maxScore;
        d.minutesStudied += e.timeSpent / 60;
        break;
      }
      case "card_reviewed":
        get(e.at).cardsReviewed++;
        break;
      case "mistake_eliminated":
        get(e.at).mistakesFixed++;
        break;
      case "session_ended":
        get(e.at).minutesStudied += 0; // question time already counted; avoid double-count
        break;
      default:
        break;
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Consecutive days with any recorded study, ending today or yesterday. */
export function studyStreak(rollups: DailyRollup[], today: string): number {
  const active = new Set(rollups.filter((r) => r.questionsAnswered > 0 || r.cardsReviewed > 0).map((r) => r.date));
  let streak = 0;
  const d = new Date(today);
  // Allow today to be empty without breaking a streak earned yesterday.
  if (!active.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!active.has(key)) break;
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Confidence calibration. Compares stated confidence against actual outcome —
 * the metric that reveals the fluency illusion, which is the single most common
 * reason capable students underperform.
 */
export interface Calibration {
  buckets: { confidence: number; label: string; attempts: number; accuracy: number; gap: number }[];
  overconfidence: number;
  verdict: string;
}

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Guessing",
  2: "Unsure",
  3: "Fairly sure",
  4: "Certain",
};

/** Expected accuracy if a student's self-rating were perfectly calibrated. */
const EXPECTED_ACCURACY: Record<number, number> = { 1: 0.25, 2: 0.5, 3: 0.75, 4: 0.95 };

export function calibration(events: LearningEvent[]): Calibration {
  const answered = ofType(events, "question_answered").filter((e) => e.confidence !== undefined);
  const buckets = [1, 2, 3, 4].map((c) => {
    const rows = answered.filter((e) => e.confidence === c);
    const accuracy = rows.length
      ? rows.reduce((s, e) => s + (e.maxScore ? e.score / e.maxScore : 0), 0) / rows.length
      : 0;
    return {
      confidence: c,
      label: CONFIDENCE_LABELS[c]!,
      attempts: rows.length,
      accuracy,
      gap: rows.length ? accuracy - EXPECTED_ACCURACY[c]! : 0,
    };
  });

  const weighted = buckets.filter((b) => b.attempts > 0);
  const overconfidence = weighted.length
    ? -weighted.reduce((s, b) => s + b.gap * b.attempts, 0) / weighted.reduce((s, b) => s + b.attempts, 0)
    : 0;

  let verdict = "Not enough rated answers yet to judge calibration.";
  if (weighted.reduce((s, b) => s + b.attempts, 0) >= 12) {
    if (overconfidence > 0.15)
      verdict =
        "You are overconfident: the things you feel sure about are wrong more often than you expect. That feeling of fluency is the main thing standing between you and the marks — trust closed-book output, not familiarity.";
    else if (overconfidence < -0.15)
      verdict =
        "You are underconfident: you know more than you think, and you are probably second-guessing correct answers in exams. Commit to your first answer more often.";
    else verdict = "Your confidence tracks your accuracy well. That is unusual and genuinely valuable — it means you can trust your own sense of what needs work.";
  }

  return { buckets, overconfidence, verdict };
}

/** Time efficiency: seconds spent per mark earned, by question size. */
export function timeEfficiency(events: LearningEvent[]): { bucket: string; secondsPerMark: number; attempts: number }[] {
  const answered = ofType(events, "question_answered");
  const buckets: Record<string, { seconds: number; marks: number; n: number }> = {};
  for (const e of answered) {
    const key = e.maxScore <= 2 ? "1–2 marks" : e.maxScore <= 5 ? "3–5 marks" : e.maxScore <= 10 ? "6–10 marks" : "11+ marks";
    buckets[key] ??= { seconds: 0, marks: 0, n: 0 };
    buckets[key]!.seconds += e.timeSpent;
    buckets[key]!.marks += e.maxScore;
    buckets[key]!.n++;
  }
  return Object.entries(buckets).map(([bucket, v]) => ({
    bucket,
    secondsPerMark: v.marks ? v.seconds / v.marks : 0,
    attempts: v.n,
  }));
}
