/**
 * Shared primitives for the Lodestar domain.
 *
 * Everything in `src/domain` is pure TypeScript: no IO, no React, no browser
 * APIs. That is deliberate — the learning engines are the product, and they
 * must be testable, portable and inspectable in isolation. UI and persistence
 * depend on the domain; the domain depends on nothing.
 */

/**
 * Named id aliases.
 *
 * These were nominal (branded) types initially. They were relaxed to plain
 * string aliases deliberately: ids cross a filesystem boundary on every load
 * (packs are authored as YAML, where every id is a string) and a boundary into
 * persisted student state, so branding bought a little compile-time safety in
 * the engines at the cost of a cast on essentially every join. The names are
 * kept because they carry the documentation value, which was most of the point.
 */
export type SyllabusId = string;
export type PaperId = string;
export type TopicId = string;
export type ObjectiveId = string;
export type SkillId = string;
export type QuestionId = string;
export type AttemptId = string;
export type CardId = string;
export type MistakeId = string;
export type NoteId = string;
export type SessionId = string;
export type UserId = string;

/** Kept as explicit constructors so intent stays readable at call sites. */
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
