/**
 * Shared primitives for the Lodestar domain.
 *
 * Everything in `src/domain` is pure TypeScript: no IO, no React, no browser
 * APIs. That is deliberate — the learning engines are the product, and they
 * must be testable, portable and inspectable in isolation. UI and persistence
 * depend on the domain; the domain depends on nothing.
 */

/** Branded ids so a TopicId can never be passed where a QuestionId is wanted. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type SyllabusId = Brand<string, "SyllabusId">;
export type PaperId = Brand<string, "PaperId">;
export type TopicId = Brand<string, "TopicId">;
export type ObjectiveId = Brand<string, "ObjectiveId">;
export type SkillId = Brand<string, "SkillId">;
export type QuestionId = Brand<string, "QuestionId">;
export type AttemptId = Brand<string, "AttemptId">;
export type CardId = Brand<string, "CardId">;
export type MistakeId = Brand<string, "MistakeId">;
export type NoteId = Brand<string, "NoteId">;
export type SessionId = Brand<string, "SessionId">;
export type UserId = Brand<string, "UserId">;

export const id = {
  syllabus: (s: string) => s as SyllabusId,
  paper: (s: string) => s as PaperId,
  topic: (s: string) => s as TopicId,
  objective: (s: string) => s as ObjectiveId,
  skill: (s: string) => s as SkillId,
  question: (s: string) => s as QuestionId,
  attempt: (s: string) => s as AttemptId,
  card: (s: string) => s as CardId,
  mistake: (s: string) => s as MistakeId,
  note: (s: string) => s as NoteId,
  session: (s: string) => s as SessionId,
  user: (s: string) => s as UserId,
};

/** ISO-8601 timestamp string. Stored as text everywhere for portability. */
export type Timestamp = string;

/** A 0..1 proportion. Never a percentage — convert only at the render edge. */
export type Unit = number;

export const clamp01 = (n: number): Unit => (n < 0 ? 0 : n > 1 ? 1 : n);
export const clamp = (n: number, lo: number, hi: number) =>
  n < lo ? lo : n > hi ? hi : n;

export const DAY_MS = 86_400_000;

export function daysBetween(a: Timestamp, b: Timestamp): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY_MS;
}

export function addDays(t: Timestamp, days: number): Timestamp {
  return new Date(new Date(t).getTime() + days * DAY_MS).toISOString();
}

export function todayKey(t: Timestamp = new Date().toISOString()): string {
  return t.slice(0, 10);
}

/**
 * An estimate the product is willing to show a student, always carrying its own
 * uncertainty and its own reason. Lodestar never renders a bare number that it
 * cannot explain — see `docs/ARCHITECTURE.md` ("Explainability contract").
 */
export interface Estimate<T = number> {
  value: T;
  /** 0..1. How much evidence stands behind this. Low confidence must be shown. */
  confidence: Unit;
  /** Human-readable justification, rendered by "Why am I seeing this?". */
  because: string[];
  /** How many observations the estimate rests on. */
  observations: number;
}

export function estimate<T>(
  value: T,
  confidence: Unit,
  because: string[],
  observations: number,
): Estimate<T> {
  return { value, confidence: clamp01(confidence), because, observations };
}
