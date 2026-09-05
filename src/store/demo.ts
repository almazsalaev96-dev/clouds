/**
 * Example data.
 *
 * A published build opens on an empty onboarding form, which shows a visitor
 * nothing about what the product does — every analysis surface needs evidence
 * before it can say anything. This seeds a plausible fortnight of study so the
 * engines have something to reason about.
 *
 * Two rules make this honest rather than a fake demo:
 *
 *  1. The *answers* are synthetic; the *analysis* is not. Attempts are built
 *     against the real question bank and then fed through the same engines as
 *     any real student's work — mastery, retention, priority, readiness, the
 *     mistake taxonomy. Nothing here writes a conclusion; the conclusions are
 *     computed from these attempts exactly as they would be from yours.
 *
 *  2. It is labelled everywhere it appears and can be cleared in one click.
 *     `profile.isExample` drives a persistent banner, so example figures can
 *     never be mistaken for a record of the reader's own work.
 */

import type { Attempt, MarkLossCategory, Question } from "@/domain/question";
import type { Mistake } from "@/domain/mistakes";
import { mistakeStatus } from "@/domain/mistakes";
import { newMemoryState, review, type Grade } from "@/domain/scheduling";
import type { LearningEvent } from "@/domain/events";
import { addDays } from "@/domain/types";
import { emptyState, type StoredCard, type StudentState } from "./types";

/**
 * A small deterministic generator, so the example is identical on every open
 * and any surprising figure can be traced rather than blamed on randomness.
 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const LOSS_CAUSES: MarkLossCategory[] = [
  "no-chain",
  "no-chain",
  "no-application",
  "no-judgement",
  "insufficient-development",
  "knowledge-gap",
  "calculation-error",
  "command-word-misread",
];

export interface DemoOptions {
  syllabusId: string;
  packId: string;
  questions: Question[];
  now: string;
  /** Days of history to fabricate. */
  days?: number;
}

export function buildExampleState(opts: DemoOptions): StudentState {
  const { syllabusId, packId, questions, now } = opts;
  const days = opts.days ?? 16;
  const rand = seeded(20260905);

  const state = emptyState(now);
  const pool = questions.filter((q) => q.syllabusId === syllabusId);

  state.profile = {
    displayName: undefined,
    weeklyMinutes: [30, 45, 45, 60, 45, 45, 90],
    isExample: true,
    onboardedAt: addDays(now, -days),
    subjects: [
      {
        syllabusId,
        packId,
        stage: "a-level",
        targetGrade: "A*",
        selfEstimatedGrade: "B",
        examDate: addDays(now, 74),
        examSession: "May/June",
        addedAt: addDays(now, -days),
      },
    ],
  };

  const attempts: Attempt[] = [];
  const mistakes: Mistake[] = [];
  const cards: StoredCard[] = [];
  const events: LearningEvent[] = [];
  const memory: Record<string, StoredCard["id"] extends string ? never : never> = {} as never;
  const memoryStates: StudentState["memory"] = {};

  let n = 0;
  // Work forward through time so ability improves — the trajectory chart and
  // the weekly report both need a real before-and-after to say anything.
  for (let d = days; d >= 0; d--) {
    const at = addDays(now, -d);
    // Two rest days a fortnight, so consistency is not implausibly perfect.
    if (d === 11 || d === 4) continue;
    const perDay = 2 + Math.floor(rand() * 3);

    for (let k = 0; k < perDay; k++) {
      const q = pool[(n * 7 + k * 3) % pool.length];
      if (!q) continue;
      n++;

      // Improvement over the fortnight, plus per-question noise.
      const progress = 1 - d / days;
      const base = 0.42 + progress * 0.34;
      const fraction = Math.max(0, Math.min(1, base + (rand() - 0.5) * 0.42));
      const score = Math.round(fraction * q.marks * 2) / 2;
      const timeSpent = Math.round(q.timeSeconds * (0.7 + rand() * 0.7));
      const confidence = (fraction > 0.7 ? (rand() > 0.4 ? 3 : 4) : rand() > 0.5 ? 2 : 3) as 1 | 2 | 3 | 4;

      const points = q.markScheme.points ?? [];
      const ledger = points.map((p, i) => {
        const hit = i < Math.round((score / q.marks) * points.length);
        const cause = LOSS_CAUSES[(n + i) % LOSS_CAUSES.length]!;
        return {
          pointId: p.id,
          outcome: (hit ? "hit" : "missed") as "hit" | "missed",
          awarded: hit ? p.marks : 0,
          lossReason: hit ? undefined : cause,
        };
      });

      const attempt: Attempt = {
        id: `demo-att-${n}`,
        questionId: q.id,
        questionVersion: q.version,
        startedAt: at,
        submittedAt: at,
        timeSpent,
        response:
          q.type === "mcq" || q.type === "true-false" || q.type === "multi-select"
            ? { kind: "choice", selected: [q.response?.choices?.[0]?.id ?? "a"] }
            : q.type === "numeric"
              ? { kind: "numeric", value: q.markScheme.acceptedValues?.[0]?.value ?? 0 }
              : {
                  kind: "text",
                  text:
                    "Contribution is selling price minus variable cost per unit, so break-even output is fixed costs divided by contribution. This matters here because the margin of safety is narrow.",
                },
        confidence,
        score,
        maxScore: q.marks,
        markedBy: points.length ? "self" : "auto",
        markedAt: at,
        ledger: points.length ? ledger : undefined,
        mode: d % 5 === 0 ? "timed" : "practice",
      };
      attempts.push(attempt);

      events.push({
        type: "question_answered",
        at,
        questionId: q.id,
        topicIds: q.topicIds,
        score,
        maxScore: q.marks,
        timeSpent,
        confidence,
        mode: attempt.mode,
      });

      // Mistakes and their cards, from the points actually missed.
      for (const entry of ledger) {
        if (entry.outcome === "hit") continue;
        const point = points.find((p) => p.id === entry.pointId);
        if (!point) continue;
        const cause = entry.lossReason ?? "unknown";
        const existing = mistakes.find((m) => m.questionId === q.id && m.requiredPoint === point.text);
        if (existing) {
          existing.occurrences += 1;
          existing.cleanRunsSince = 0;
          existing.lastSeenAt = at;
          existing.status = mistakeStatus(existing);
        } else {
          const id = `demo-mis-${mistakes.length + 1}`;
          const cardId = `demo-card-${mistakes.length + 1}`;
          mistakes.push({
            id,
            questionId: q.id,
            topicIds: q.topicIds,
            category: cause,
            marksLost: point.marks,
            studentAnswer: "…",
            requiredPoint: point.text,
            firstSeenAt: at,
            lastSeenAt: at,
            occurrences: 1,
            cleanRunsSince: 0,
            status: "open",
            linkedCardId: cardId,
          });
          cards.push({
            id: cardId,
            syllabusId,
            topicIds: q.topicIds,
            kind: "basic",
            front: q.prompt.slice(0, 160),
            back: point.text,
            origin: "mistake",
            source: `Mistake on ${q.id}`,
            createdAt: at,
          });
          memoryStates[cardId] = newMemoryState(at, "mistake");
          events.push({ type: "mistake_created", at, mistakeId: id, category: cause, topicIds: q.topicIds });
        }
        events.push({ type: "mark_lost", at, questionId: q.id, topicIds: q.topicIds, category: cause, marks: point.marks });
      }
    }
  }

  // A handful of card reviews, run through the real scheduler so the due queue
  // and the review-load forecast are genuine rather than hand-placed.
  const reviewable = cards.slice(0, Math.min(14, cards.length));
  reviewable.forEach((card, i) => {
    const at = addDays(now, -(6 - (i % 6)));
    const grade = ((i % 4) + 1) as Grade;
    const prior = memoryStates[card.id] ?? newMemoryState(at, "mistake");
    const out = review(prior, grade, at, {
      targetRetention: 0.9,
      maximumInterval: 365,
      examDate: state.profile.subjects[0]?.examDate,
    });
    memoryStates[card.id] = out.state;
    events.push({ type: "card_reviewed", at, cardId: card.id, grade, intervalDays: out.intervalDays, retrievability: out.retrievabilityAtReview });
  });

  return {
    ...state,
    attempts,
    mistakes,
    cards,
    memory: memoryStates,
    events,
    updatedAt: now,
  };
}
