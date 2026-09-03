/**
 * Next best action (§23).
 *
 * The specification calls this one of the product's strongest differentiators,
 * and it is also the easiest place to fake intelligence. So the rule here is
 * strict: every suggestion must be derived from recorded evidence, and must
 * carry the evidence with it. If there is nothing to say, this returns an
 * empty list — the interface then says nothing, rather than inventing
 * encouragement.
 *
 * This is also why §42's WOW 6 is honestly a month-two moment: on day one
 * there is no evidence, so there is correctly no suggestion.
 */

import type { Id } from "../types/index.ts";
import type { Store } from "../store/index.ts";
import { allMastery, masteryFor, MIN_REPORTABLE_CONFIDENCE } from "./mastery.ts";
import { openMistakes } from "./mistakes.ts";

export type ActionKind = "fix_misconception" | "practice_weak" | "review_stale" | "study_new";

export interface NextAction {
  kind: ActionKind;
  conceptId: Id | null;
  /** Shown to the user. Written as a statement of fact plus an offer. */
  title: string;
  /** Why the system believes this — always inspectable (§22). */
  because: string;
  /** 0..1. Below `MIN_SUGGESTION_CONFIDENCE` nothing is surfaced. */
  confidence: number;
  priority: number;
}

/** §22: a wrong nudge costs more trust than a missing one gains. */
export const MIN_SUGGESTION_CONFIDENCE = 0.35;

const STALE_MS = 1000 * 60 * 60 * 24 * 10;

export function nextBestActions(
  store: Store,
  userId: Id,
  limit = 3,
  now: number = Date.now(),
): NextAction[] {
  const actions: NextAction[] = [];

  // 1. A live misconception outranks everything: practising on top of a broken
  //    model just reinforces it.
  for (const mistake of openMistakes(store, userId)) {
    const concept = store.concepts.get(userId, mistake.conceptId);
    if (!concept) continue;
    actions.push({
      kind: "fix_misconception",
      conceptId: concept.id,
      title: `Fix the underlying idea in ${concept.name}`,
      because: `${mistake.occurrences} attempts on ${concept.name} have gone wrong the same way.`,
      confidence: Math.min(1, 0.5 + mistake.occurrences * 0.15),
      priority: 100 + mistake.occurrences,
    });
  }

  // 2. Concepts with real evidence of weakness.
  for (const mastery of allMastery(store, userId, now)) {
    if (mastery.confidence < MIN_REPORTABLE_CONFIDENCE) continue;
    if (mastery.estimate >= 0.7) continue;
    if (actions.some((a) => a.conceptId === mastery.conceptId)) continue;
    const concept = store.concepts.get(userId, mastery.conceptId);
    if (!concept) continue;
    actions.push({
      kind: "practice_weak",
      conceptId: concept.id,
      title: `Practise ${concept.name}`,
      because: `${Math.round(mastery.estimate * 100)}% correct across ${mastery.attempts} attempts.`,
      confidence: mastery.confidence,
      priority: 50 + (1 - mastery.estimate) * 20,
    });
  }

  // 3. Solid but ageing knowledge — retrieval practice before it decays.
  for (const mastery of allMastery(store, userId, now)) {
    if (mastery.estimate < 0.7) continue;
    if (!mastery.lastPracticedAt || now - mastery.lastPracticedAt < STALE_MS) continue;
    if (actions.some((a) => a.conceptId === mastery.conceptId)) continue;
    const concept = store.concepts.get(userId, mastery.conceptId);
    if (!concept) continue;
    const days = Math.floor((now - mastery.lastPracticedAt) / (1000 * 60 * 60 * 24));
    actions.push({
      kind: "review_stale",
      conceptId: concept.id,
      title: `Review ${concept.name}`,
      because: `You knew this well, but haven't practised it for ${days} days.`,
      confidence: mastery.confidence * 0.8,
      priority: 20,
    });
  }

  return actions
    .filter((a) => a.confidence >= MIN_SUGGESTION_CONFIDENCE)
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
    .slice(0, limit);
}

/** Records a graded attempt and updates every downstream signal. */
export function recordAttempt(
  store: Store,
  userId: Id,
  input: {
    conceptId: Id;
    artifactId?: Id | null;
    prompt: string;
    response: string;
    correct: boolean;
    score?: number;
    difficulty?: number;
  },
) {
  const event = store.learningEvents.insert(userId, {
    conceptId: input.conceptId,
    artifactId: input.artifactId ?? null,
    prompt: input.prompt,
    response: input.response,
    correct: input.correct,
    score: input.score ?? (input.correct ? 1 : 0),
    difficulty: input.difficulty ?? 0.5,
  } as never);

  store.edges.insert(userId, {
    fromType: "concept", fromId: input.conceptId,
    toType: "concept", toId: input.conceptId,
    kind: "practices", weight: 1,
    provenance: `graded attempt ${event.id}`,
  } as never);

  return {
    event,
    mastery: masteryFor(store, userId, input.conceptId),
  };
}
