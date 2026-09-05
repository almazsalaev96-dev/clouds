/**
 * Student state.
 *
 * Local-first by default: everything a student generates lives in their own
 * browser (IndexedDB) and is exportable as a single JSON file. No account, no
 * server, no database is required to use Lodestar, and no study data leaves the
 * device unless the student turns on an AI feature — which sends only the
 * specific context that feature needs, never the whole store.
 *
 * The shape is deliberately flat and serialisable so that the same records can
 * later be written to Postgres row-for-row without a migration of meaning. See
 * `db/schema.sql` and docs/ARCHITECTURE.md ("Persistence seam").
 */

import type { Attempt, MarkLossCategory } from "@/domain/question";
import type { Mistake } from "@/domain/mistakes";
import type { MemoryState } from "@/domain/scheduling";
import type { LearningEvent } from "@/domain/events";
import type { Timestamp } from "@/domain/types";

export const STORE_VERSION = 1;

export interface SubjectEnrolment {
  syllabusId: string;
  packId: string;
  /** Full A Level, or AS only — changes which papers and topics are in scope. */
  stage: "as" | "a-level" | "igcse" | "full";
  targetGrade: string;
  /** Student's own estimate at onboarding. Never used as evidence, only shown. */
  selfEstimatedGrade?: string;
  examDate?: string;
  examSession?: string;
  /** Topics the student flagged as hard at onboarding — a prior, not a measurement. */
  selfFlaggedWeakTopicIds?: string[];
  addedAt: Timestamp;
  archived?: boolean;
}

export interface StudentProfile {
  displayName?: string;
  /** Minutes available per weekday, index 0 = Sunday. */
  weeklyMinutes: number[];
  preferredStudyTimes?: string[];
  subjects: SubjectEnrolment[];
  onboardedAt?: Timestamp;
  /** Student-chosen name for the tutor. */
  tutorName?: string;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  fontScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
  dyslexiaFriendly: boolean;
  /** Ask for a confidence rating before revealing each answer. */
  confidenceRating: boolean;
  /** Interleave topics inside practice sessions. */
  interleave: boolean;
  /** Show the working/rough-work pane by default. */
  showWorking: boolean;
  aiEnabled: boolean;
  /** Delay self-marking to the next day, which retains better. */
  delayedMarking: boolean;
  locale: string;
  explanationLanguage?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  fontScale: 1,
  reducedMotion: false,
  highContrast: false,
  dyslexiaFriendly: false,
  confidenceRating: true,
  interleave: true,
  showWorking: true,
  aiEnabled: false,
  delayedMarking: false,
  locale: "en",
};

export interface StoredCard {
  id: string;
  syllabusId?: string;
  topicIds: string[];
  kind: string;
  front: string;
  back: string;
  clozeText?: string;
  hint?: string;
  source?: string;
  /** Where the card came from — mistakes get scheduled more aggressively. */
  origin: "authored" | "mistake" | "note" | "generated";
  createdAt: Timestamp;
  suspended?: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  syllabusId?: string;
  topicIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags?: string[];
  /** Links to the question or mistake that prompted the note. */
  sourceRef?: { kind: "question" | "mistake" | "lesson" | "document"; id: string };
}

export interface MockRecord {
  id: string;
  syllabusId: string;
  paperId: string;
  startedAt: Timestamp;
  submittedAt?: Timestamp;
  minutesAllowed: number;
  minutesUsed: number;
  questionIds: string[];
  /** Per-question outcome; attempts themselves live in `attempts`. */
  score: number;
  maxScore: number;
  /** Seconds spent per question id, for the timing analyser. */
  timePerQuestion: Record<string, number>;
  flagged: string[];
  completed: boolean;
}

export interface MissionState {
  date: string;
  completedItemIds: string[];
  generatedFrom: string;
}

export interface StudentState {
  version: number;
  profile: StudentProfile;
  settings: Settings;
  attempts: Attempt[];
  mistakes: Mistake[];
  /** Card memory states keyed by card id. */
  memory: Record<string, MemoryState>;
  /** Cards the student or the system created (pack cards live in content). */
  cards: StoredCard[];
  notes: Note[];
  mocks: MockRecord[];
  events: LearningEvent[];
  missions: MissionState[];
  /** Recommendation feedback, so dismissals actually change future advice. */
  feedback: { at: Timestamp; kind: string; subject: string; useful: boolean; note?: string }[];
  updatedAt: Timestamp;
}

export function emptyState(now: Timestamp): StudentState {
  return {
    version: STORE_VERSION,
    profile: { weeklyMinutes: [30, 45, 45, 45, 45, 45, 60], subjects: [] },
    settings: { ...DEFAULT_SETTINGS },
    attempts: [],
    mistakes: [],
    memory: {},
    cards: [],
    notes: [],
    mocks: [],
    events: [],
    missions: [],
    feedback: [],
    updatedAt: now,
  };
}

/** Categories the student can pick when self-marking. Ordered by frequency. */
export const SELF_MARK_REASONS: MarkLossCategory[] = [
  "no-chain",
  "no-application",
  "no-judgement",
  "insufficient-development",
  "knowledge-gap",
  "misunderstanding",
  "command-word-misread",
  "question-misread",
  "calculation-error",
  "formula-error",
  "unit-error",
  "poor-structure",
  "ran-out-of-time",
  "careless",
];
