/**
 * The universal question model.
 *
 * One shape serves every subject and every board. Subject-specific behaviour
 * (calculations, essays, diagram labelling, code tracing, translation) is
 * expressed through `type` + `response` + `marking`, never through a parallel
 * hierarchy of question classes.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Question data and attempt data are separate records. A question is
 *     versioned content; an attempt is immutable history. Editing a question
 *     must never rewrite what a student did last March.
 *
 *  2. Written answers are marked against a *ledger of mark-scheme points*. The
 *     student (or the AI, or a teacher) resolves each point to hit / partial /
 *     missed. This is not a fallback for having no AI — self-marking against a
 *     real mark scheme is the highest-value activity in written subjects,
 *     because the object of assessment is the marker's model of a good answer.
 *     AI marking pre-fills the ledger; it does not replace it.
 */

import type {
  AttemptId,
  ObjectiveId,
  PaperId,
  QuestionId,
  SkillId,
  SyllabusId,
  Timestamp,
  TopicId,
  Unit,
} from "./types";

export type QuestionType =
  | "mcq"
  | "multi-select"
  | "numeric"
  | "short-answer"
  | "structured"
  | "essay"
  | "calculation"
  | "data-response"
  | "cloze"
  | "match"
  | "order"
  | "label-diagram"
  | "graph-read"
  | "code-trace"
  | "translation"
  | "true-false";

/** Types the machine can mark exactly, with no AI and no human judgement. */
export const OBJECTIVE_TYPES: ReadonlySet<QuestionType> = new Set<QuestionType>([
  "mcq",
  "multi-select",
  "numeric",
  "cloze",
  "match",
  "order",
  "label-diagram",
  "true-false",
]);

export function isObjectivelyMarkable(type: QuestionType): boolean {
  return OBJECTIVE_TYPES.has(type);
}

/** Where a question came from, and whether we are allowed to show it. */
export type SourceKind =
  | "past-paper"        // reproduced under licence, or linked out to the board
  | "specimen"
  | "original"          // written for Lodestar by a human
  | "user"              // written by this student
  | "ai-generated"      // generated, then validated — always labelled in the UI
  | "textbook";         // referenced, not reproduced

export type LicenceStatus =
  | "owned"             // we hold the rights
  | "licensed"          // licensed for display
  | "public-domain"
  | "link-only"         // must NOT be reproduced; link to the official source
  | "user-owned";       // the student's own upload; private to them

export interface QuestionSource {
  kind: SourceKind;
  licence: LicenceStatus;
  year?: number;
  session?: string;      // e.g. "May/June"
  paperVariant?: string; // e.g. "22"
  questionNumber?: string;
  /** Official URL. Required for link-only material. */
  url?: string;
  attribution?: string;
}

/**
 * Difficulty is multi-dimensional. "Hard" is not one thing: a question can be
 * conceptually trivial and arithmetically brutal, or vice versa, and the
 * adaptive engine must be able to tell those apart when choosing what to serve
 * a student who is failing on arithmetic but strong on concepts.
 */
export interface Difficulty {
  /** 0..1 across every axis. */
  knowledge: Unit;
  reasoning: Unit;
  calculation: Unit;
  language: Unit;
  steps: Unit;
  unfamiliarContext: Unit;
  /** Convenience scalar, derived. Do not author by hand. */
  overall?: Unit;
}

export function overallDifficulty(d: Difficulty): Unit {
  if (d.overall !== undefined) return d.overall;
  // Reasoning and step-count dominate perceived difficulty in exam conditions;
  // language and unfamiliar context matter but less. Weights sum to 1.
  return (
    0.22 * d.knowledge +
    0.3 * d.reasoning +
    0.16 * d.calculation +
    0.1 * d.language +
    0.14 * d.steps +
    0.08 * d.unfamiliarContext
  );
}

export const EVEN_DIFFICULTY: Difficulty = {
  knowledge: 0.5,
  reasoning: 0.5,
  calculation: 0.5,
  language: 0.5,
  steps: 0.5,
  unfamiliarContext: 0.5,
};

// ---------------------------------------------------------------------------
// Mark schemes
// ---------------------------------------------------------------------------

/**
 * A single creditable point in a mark scheme. `alternatives` captures the
 * "accept also" wording real mark schemes carry, so self-marking is fair.
 */
export interface MarkPoint {
  id: string;
  /** What must appear in the answer to earn this. */
  text: string;
  marks: number;
  aoCode?: string;
  /** Wordings that also earn the mark. */
  alternatives?: string[];
  /** Wordings that explicitly do NOT earn it — the trap. */
  rejects?: string[];
  /** Only creditable if another point was earned first (e.g. own-figure rule). */
  requires?: string[];
  /** Skill this point exercises, so mark loss maps onto a trainable skill. */
  skillId?: SkillId;
}

/** Level-of-response marking, used by essays and extended answers. */
export interface MarkLevel {
  level: number;
  name: string;
  marksFrom: number;
  marksTo: number;
  descriptor: string;
  aoCode?: string;
  /** Concrete signals a marker looks for at this level. */
  indicators?: string[];
}

export interface MarkScheme {
  totalMarks: number;
  style: "points" | "levels" | "hybrid";
  points?: MarkPoint[];
  levels?: MarkLevel[];
  /** Worked answer or exemplar. Shown after an attempt, never before. */
  modelAnswer?: string;
  /** An answer that looks right and is not — the most instructive artefact. */
  nearMissAnswer?: string;
  examinerNotes?: string;
  /** For numeric questions. */
  acceptedValues?: { value: number; tolerance?: number; unit?: string }[];
  /** Accept an answer derived correctly from an earlier wrong figure. */
  ownFigureRule?: boolean;
}

// ---------------------------------------------------------------------------
// Response specifications — how the student answers
// ---------------------------------------------------------------------------

export interface Choice {
  id: string;
  text: string;
  correct?: boolean;
  /** Why a student picks this wrong option. Powers targeted feedback. */
  misconception?: string;
}

export interface ClozeBlank {
  id: string;
  accepted: string[];
  caseSensitive?: boolean;
}

export interface MatchPair {
  leftId: string;
  left: string;
  rightId: string;
  right: string;
}

export interface ResponseSpec {
  choices?: Choice[];
  blanks?: ClozeBlank[];
  pairs?: MatchPair[];
  /** For "order" questions: correct sequence of item ids. */
  sequence?: { id: string; text: string }[];
  /** Suggested answer length for written responses, in words. */
  suggestedWords?: number;
  /** Show a working/rough-work pane. */
  workingSpace?: boolean;
  unit?: string;
}

// ---------------------------------------------------------------------------
// The question
// ---------------------------------------------------------------------------

export interface Question {
  id: QuestionId;
  syllabusId: SyllabusId;
  /** Content version. Attempts pin the version they were answered against. */
  version: number;
  type: QuestionType;
  source: QuestionSource;

  paperId?: PaperId;
  topicIds: TopicId[];
  objectiveIds?: ObjectiveId[];
  skillIds?: SkillId[];

  commandWord?: string;
  /** Marks per AO for this specific question, when the pack knows them. */
  aoMarks?: Record<string, number>;

  marks: number;
  /** Expected working time in seconds; drives the timing analyser. */
  timeSeconds: number;

  /** Shared case study / source material shown above the prompt. */
  stimulus?: {
    title?: string;
    body: string;
    /** Reference to a shared insert used by several questions. */
    insertId?: string;
    imageUrl?: string;
    table?: { headers: string[]; rows: string[][] };
  };

  prompt: string;
  response?: ResponseSpec;
  markScheme: MarkScheme;
  difficulty: Difficulty;

  /** Concepts a student must already hold to have a chance here. */
  prerequisiteTopicIds?: TopicId[];
  /** Known ways students go wrong. Feeds the Mistake Lab taxonomy. */
  commonErrors?: { label: string; description: string; errorType?: string }[];
  hints?: string[];

  /** Content-quality provenance — see docs/CONTENT-QUALITY.md. */
  quality?: {
    reviewStatus: "draft" | "machine-checked" | "human-reviewed" | "published";
    lastVerified?: Timestamp;
    verifiedBy?: string;
    confidence?: Unit;
  };

  tags?: string[];
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

/** How each mark-scheme point resolved for one attempt. */
export type PointOutcome = "hit" | "partial" | "missed" | "not-applicable";

export interface LedgerEntry {
  pointId: string;
  outcome: PointOutcome;
  awarded: number;
  /** Why the mark was lost — the single most valuable field in the product. */
  lossReason?: MarkLossCategory;
  note?: string;
}

/**
 * The taxonomy of *why* a mark was lost. Percentage scores tell a student they
 * are at 72%; this tells them their problem is that they never explain the
 * mechanism — which is actionable, trainable, and transfers across topics.
 */
export type MarkLossCategory =
  | "knowledge-gap"
  | "misunderstanding"
  | "no-application"
  | "no-chain"          // stated a point, never developed a consequence
  | "no-judgement"      // no evaluation where evaluation was required
  | "insufficient-development"
  | "command-word-misread"
  | "question-misread"
  | "calculation-error"
  | "formula-error"
  | "unit-error"
  | "rounding-error"
  | "data-misread"
  | "graph-error"
  | "weak-evidence"
  | "poor-structure"
  | "incomplete"
  | "ran-out-of-time"
  | "careless"
  | "unknown";

export const MARK_LOSS_LABELS: Record<MarkLossCategory, string> = {
  "knowledge-gap": "Didn't know it",
  misunderstanding: "Understood it wrongly",
  "no-application": "Generic — not tied to this context",
  "no-chain": "Point made, consequence never developed",
  "no-judgement": "No judgement where judgement was required",
  "insufficient-development": "Too thin for the marks available",
  "command-word-misread": "Answered a different command word",
  "question-misread": "Misread the question",
  "calculation-error": "Arithmetic slip",
  "formula-error": "Wrong or inverted formula",
  "unit-error": "Missing or wrong units",
  "rounding-error": "Rounding or significant figures",
  "data-misread": "Misread the data",
  "graph-error": "Graph read or drawn wrongly",
  "weak-evidence": "Assertion without evidence",
  "poor-structure": "Right content, unreadable structure",
  incomplete: "Ran out of answer",
  "ran-out-of-time": "Ran out of time",
  careless: "Knew it, lost it carelessly",
  unknown: "Unclassified",
};

/** Loss categories that are technique, not knowledge. These transfer. */
export const TECHNIQUE_LOSSES: ReadonlySet<MarkLossCategory> = new Set<MarkLossCategory>([
  "no-application",
  "no-chain",
  "no-judgement",
  "insufficient-development",
  "command-word-misread",
  "question-misread",
  "poor-structure",
  "ran-out-of-time",
  "careless",
  "unit-error",
  "rounding-error",
]);

export type MarkedBy = "self" | "ai" | "teacher" | "auto";

export interface Attempt {
  id: AttemptId;
  questionId: QuestionId;
  /** Version of the question actually answered. */
  questionVersion: number;
  startedAt: Timestamp;
  submittedAt: Timestamp;
  /** Seconds actually spent. */
  timeSpent: number;

  /** The raw response, shape depending on question type. */
  response: AttemptResponse;

  /** Confidence *before* seeing the outcome. Drives calibration analytics. */
  confidence?: 1 | 2 | 3 | 4;

  score: number;
  maxScore: number;
  markedBy: MarkedBy;
  markedAt?: Timestamp;
  /** Point-by-point resolution. Empty for objectively-marked types. */
  ledger?: LedgerEntry[];
  /** Level awarded, for level-of-response marking. */
  levelAwarded?: number;
  aoScores?: Record<string, { earned: number; available: number }>;

  /** Context this attempt happened in — practice, mock, review, mistake redo. */
  mode: AttemptMode;
  sessionId?: string;
  /** Set when this is a re-attempt of a question previously answered. */
  retryOf?: AttemptId;
  flaggedForReview?: boolean;
  studentNote?: string;
}

export type AttemptMode =
  | "diagnostic"
  | "practice"
  | "adaptive"
  | "review"
  | "mistake-redo"
  | "mock"
  | "timed"
  | "challenge"
  | "easy-win"
  | "interleaved"
  | "transfer";

export type AttemptResponse =
  | { kind: "choice"; selected: string[] }
  | { kind: "numeric"; value: number | null; working?: string; unit?: string }
  | { kind: "text"; text: string; working?: string }
  | { kind: "cloze"; values: Record<string, string> }
  | { kind: "match"; pairs: Record<string, string> }
  | { kind: "order"; sequence: string[] }
  | { kind: "skipped" };

export function attemptFraction(a: Attempt): Unit {
  return a.maxScore > 0 ? a.score / a.maxScore : 0;
}

/** Marks lost on an attempt, grouped by why they were lost. */
export function lossBreakdown(a: Attempt): Map<MarkLossCategory, number> {
  const out = new Map<MarkLossCategory, number>();
  for (const e of a.ledger ?? []) {
    if (e.outcome === "hit" || e.outcome === "not-applicable") continue;
    const cat = e.lossReason ?? "unknown";
    out.set(cat, (out.get(cat) ?? 0) + Math.max(0, marksOf(e)));
  }
  return out;
}

function marksOf(e: LedgerEntry): number {
  // Awarded is what the student got; the loss is the remainder of that point.
  // Callers that need the point's face value should join against the scheme.
  return e.outcome === "missed" ? 1 : e.outcome === "partial" ? 0.5 : 0;
}

/**
 * Objective marking. Exact, deterministic, no AI, no judgement.
 * Returns null when the type is not objectively markable, so callers must
 * route to the ledger rather than silently reporting a wrong score.
 */
export function markObjectively(
  q: Question,
  response: AttemptResponse,
): { score: number; maxScore: number; detail: string[] } | null {
  if (!isObjectivelyMarkable(q.type)) return null;
  const detail: string[] = [];

  switch (q.type) {
    case "mcq":
    case "true-false": {
      if (response.kind !== "choice") return null;
      const correct = (q.response?.choices ?? []).filter((c) => c.correct).map((c) => c.id);
      const picked = response.selected;
      const ok = picked.length === 1 && correct.includes(picked[0]!);
      if (!ok && picked[0]) {
        const chosen = q.response?.choices?.find((c) => c.id === picked[0]);
        if (chosen?.misconception) detail.push(chosen.misconception);
      }
      return { score: ok ? q.marks : 0, maxScore: q.marks, detail };
    }

    case "multi-select": {
      if (response.kind !== "choice") return null;
      const choices = q.response?.choices ?? [];
      const correct = new Set(choices.filter((c) => c.correct).map((c) => c.id));
      const picked = new Set(response.selected);
      let hits = 0;
      let falsePositives = 0;
      for (const c of choices) {
        if (picked.has(c.id) && correct.has(c.id)) hits++;
        if (picked.has(c.id) && !correct.has(c.id)) falsePositives++;
      }
      const net = Math.max(0, hits - falsePositives);
      const perMark = correct.size > 0 ? q.marks / correct.size : 0;
      return { score: Math.min(q.marks, net * perMark), maxScore: q.marks, detail };
    }

    case "numeric": {
      if (response.kind !== "numeric" || response.value === null) {
        return { score: 0, maxScore: q.marks, detail: ["No value entered."] };
      }
      const accepted = q.markScheme.acceptedValues ?? [];
      for (const a of accepted) {
        const tol = a.tolerance ?? Math.abs(a.value) * 0.001;
        if (Math.abs(response.value - a.value) <= tol) {
          if (a.unit && response.unit && a.unit !== response.unit) {
            detail.push(`Value correct but unit should be ${a.unit}.`);
            return { score: Math.max(0, q.marks - 1), maxScore: q.marks, detail };
          }
          return { score: q.marks, maxScore: q.marks, detail };
        }
      }
      // A very common real pattern: right arithmetic, forgot to ×100.
      for (const a of accepted) {
        if (Math.abs(response.value * 100 - a.value) < 0.01) {
          detail.push("Correct ratio, but the question asked for a percentage — multiply by 100.");
        }
        if (Math.abs(response.value / 100 - a.value) < 0.0001) {
          detail.push("You multiplied by 100 when the answer was already a ratio.");
        }
        if (a.value !== 0 && Math.abs(response.value - 1 / a.value) < 1e-6) {
          detail.push("That is the reciprocal — check whether the formula is inverted.");
        }
      }
      return { score: 0, maxScore: q.marks, detail };
    }

    case "cloze": {
      if (response.kind !== "cloze") return null;
      const blanks = q.response?.blanks ?? [];
      let hits = 0;
      for (const b of blanks) {
        const given = (response.values[b.id] ?? "").trim();
        const match = b.accepted.some((acc) =>
          b.caseSensitive ? acc === given : acc.toLowerCase() === given.toLowerCase(),
        );
        if (match) hits++;
      }
      const perMark = blanks.length ? q.marks / blanks.length : 0;
      return { score: hits * perMark, maxScore: q.marks, detail };
    }

    case "match": {
      if (response.kind !== "match") return null;
      const pairs = q.response?.pairs ?? [];
      let hits = 0;
      for (const p of pairs) if (response.pairs[p.leftId] === p.rightId) hits++;
      const perMark = pairs.length ? q.marks / pairs.length : 0;
      return { score: hits * perMark, maxScore: q.marks, detail };
    }

    case "order": {
      if (response.kind !== "order") return null;
      const seq = (q.response?.sequence ?? []).map((s) => s.id);
      // Credit adjacency, not just exact position: a student who has the right
      // ordering logic but starts one step late deserves most of the marks.
      let adjacent = 0;
      for (let i = 0; i < seq.length - 1; i++) {
        const a = response.sequence.indexOf(seq[i]!);
        const b = response.sequence.indexOf(seq[i + 1]!);
        if (a !== -1 && b !== -1 && b === a + 1) adjacent++;
      }
      const denom = Math.max(1, seq.length - 1);
      return { score: (adjacent / denom) * q.marks, maxScore: q.marks, detail };
    }

    case "label-diagram": {
      if (response.kind !== "cloze") return null;
      return markObjectively({ ...q, type: "cloze" }, response);
    }

    default:
      return null;
  }
}

/** Total marks available in a scheme's point list — the ledger's denominator. */
export function schemeTotal(ms: MarkScheme): number {
  if (ms.points?.length) return ms.points.reduce((s, p) => s + p.marks, 0);
  return ms.totalMarks;
}

/** Score a completed ledger. */
export function scoreLedger(ms: MarkScheme, ledger: LedgerEntry[]): number {
  const byId = new Map((ms.points ?? []).map((p) => [p.id, p]));
  let total = 0;
  for (const e of ledger) {
    const p = byId.get(e.pointId);
    if (!p) continue;
    if (e.outcome === "hit") total += p.marks;
    else if (e.outcome === "partial") total += p.marks / 2;
  }
  return Math.min(total, ms.totalMarks);
}
