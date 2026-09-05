"use client";

/**
 * Write operations.
 *
 * One place where an answered question turns into everything downstream:
 * an attempt record, mistakes for each mark lost, cards scheduled from those
 * mistakes, and the analytics events that every statistic is later derived
 * from. Keeping this in one function is what stops the derived state from
 * drifting — there is exactly one path by which evidence enters the system.
 */

import { useCallback } from "react";
import { useStore } from "@/store/provider";
import { mistakesFromAttempt, mistakeStatus, type Mistake } from "@/domain/mistakes";
import { newMemoryState, review, type Grade, type MemoryState } from "@/domain/scheduling";
import type { LearningEvent } from "@/domain/events";
import type { Attempt, Question } from "@/domain/question";
import type { StoredCard, StudentState } from "@/store/types";

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function useRecordAttempt() {
  const { update } = useStore();

  return useCallback(
    (question: Question, partial: Omit<Attempt, "id">, sessionId?: string) => {
      const attempt: Attempt = { ...partial, id: uid("att"), sessionId };
      const now = attempt.submittedAt;

      const events: LearningEvent[] = [
        {
          type: "question_answered",
          at: now,
          questionId: question.id,
          topicIds: question.topicIds,
          score: attempt.score,
          maxScore: attempt.maxScore,
          timeSpent: attempt.timeSpent,
          confidence: attempt.confidence,
          mode: attempt.mode,
          sessionId,
        },
        {
          type: "answer_marked",
          at: now,
          questionId: question.id,
          markedBy: attempt.markedBy,
          score: attempt.score,
          maxScore: attempt.maxScore,
        },
      ];

      update((s) => {
        const nextMistakes = [...s.mistakes];
        const nextCards = [...s.cards];
        const nextMemory = { ...s.memory };

        // A clean run on a question that previously produced a mistake counts
        // toward repair. Three of those, and only then, is it "eliminated".
        const cleanRun = attempt.maxScore > 0 && attempt.score >= attempt.maxScore;
        for (let i = 0; i < nextMistakes.length; i++) {
          const m = nextMistakes[i]!;
          if (m.questionId !== question.id || m.status === "eliminated") continue;
          if (cleanRun) {
            const updated: Mistake = { ...m, cleanRunsSince: m.cleanRunsSince + 1 };
            updated.status = mistakeStatus(updated);
            nextMistakes[i] = updated;
            if (updated.status === "eliminated") {
              events.push({
                type: "mistake_eliminated",
                at: now,
                mistakeId: updated.id,
                daysOpen: Math.round((new Date(now).getTime() - new Date(updated.firstSeenAt).getTime()) / 86_400_000),
              });
            }
          }
        }

        // New mistakes from this attempt, merged into any existing record for
        // the same cause on the same question rather than duplicated.
        for (const draft of mistakesFromAttempt(question, attempt)) {
          const existingIdx = nextMistakes.findIndex(
            (m) => m.questionId === draft.questionId && m.category === draft.category && m.requiredPoint === draft.requiredPoint,
          );
          if (existingIdx >= 0) {
            const prev = nextMistakes[existingIdx]!;
            const updated: Mistake = {
              ...prev,
              occurrences: prev.occurrences + 1,
              cleanRunsSince: 0,
              lastSeenAt: now,
              marksLost: draft.marksLost,
              studentAnswer: draft.studentAnswer,
            };
            updated.status = mistakeStatus(updated);
            nextMistakes[existingIdx] = updated;
            events.push({ type: "mistake_repeated", at: now, mistakeId: updated.id, occurrences: updated.occurrences });
          } else {
            const mistake: Mistake = {
              ...draft,
              id: uid("mis"),
              firstSeenAt: now,
              occurrences: 1,
              cleanRunsSince: 0,
              status: "open",
            };
            nextMistakes.push(mistake);
            events.push({ type: "mistake_created", at: now, mistakeId: mistake.id, category: mistake.category, topicIds: mistake.topicIds });

            // A mistake that names the mark-scheme point it missed makes a good
            // card on its own. Cards born this way start with lower stability
            // and are deliberately over-reviewed.
            if (mistake.requiredPoint && mistake.requiredPoint.length > 12) {
              const card: StoredCard = {
                id: uid("card"),
                syllabusId: question.syllabusId,
                topicIds: question.topicIds,
                kind: "basic",
                front: shorten(question.prompt, 180),
                back: mistake.requiredPoint,
                origin: "mistake",
                source: `Mistake on ${question.id}`,
                createdAt: now,
              };
              nextCards.push(card);
              nextMemory[card.id] = newMemoryState(now, "mistake");
              mistake.linkedCardId = card.id;
            }
          }

          events.push({
            type: "mark_lost",
            at: now,
            questionId: question.id,
            topicIds: question.topicIds,
            category: draft.category,
            marks: draft.marksLost,
          });
        }

        return { ...s, attempts: [...s.attempts, attempt], mistakes: nextMistakes, cards: nextCards, memory: nextMemory };
      }, events);

      return attempt;
    },
    [update],
  );
}

/** Grade a review card and reschedule it. */
export function useReviewCard() {
  const { update } = useStore();
  return useCallback(
    (cardId: string, grade: Grade, opts: { examDate?: string; importance?: number; origin?: MemoryState["origin"] } = {}) => {
      const now = new Date().toISOString();
      update((s) => {
        const prior = s.memory[cardId] ?? newMemoryState(now, opts.origin ?? "authored");
        const outcome = review(prior, grade, now, {
          targetRetention: 0.9,
          maximumInterval: 365,
          examDate: opts.examDate,
          importance: opts.importance,
        });
        return { ...s, memory: { ...s.memory, [cardId]: outcome.state } };
      });
      // The event needs the computed interval, so recompute it here rather than
      // threading state out of the updater.
      return now;
    },
    [update],
  );
}

export function useRecordEvent() {
  const { record } = useStore();
  return record;
}

function shorten(s: string, n: number): string {
  const clean = s.trim().replace(/\s+/g, " ");
  return clean.length <= n ? clean : `${clean.slice(0, n - 1)}…`;
}

/** Add a card the student wrote themselves, or one generated from a note. */
export function addCard(
  state: StudentState,
  card: Omit<StoredCard, "id" | "createdAt">,
  now: string,
): StudentState {
  const id = uid("card");
  return {
    ...state,
    cards: [...state.cards, { ...card, id, createdAt: now }],
    memory: { ...state.memory, [id]: newMemoryState(now, card.origin) },
  };
}
