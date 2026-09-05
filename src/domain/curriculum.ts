/**
 * The curriculum model.
 *
 * Deliberately board-agnostic. Cambridge is a *configuration*, not a hardcoded
 * assumption: assessment objectives, command words, paper structures and grade
 * scales all live in data, so Edexcel/AQA/OCR/IB packs drop in without touching
 * a line of engine code.
 *
 *   Qualification → ExamBoard → Syllabus(+version) → Paper → Topic → Subtopic
 *                → LearningObjective → Skill → CommandWord → Question
 */

import type { ObjectiveId, PaperId, SkillId, SyllabusId, TopicId, Unit } from "./types";

export type QualificationLevel =
  | "igcse"
  | "o-level"
  | "as-level"
  | "a-level"
  | "ib-dp"
  | "other";

export interface Qualification {
  id: string;
  level: QualificationLevel;
  title: string;
  /** e.g. "Cambridge International AS & A Level" */
  awardingDescription: string;
  /** Ordered best-to-worst, e.g. ["A*","A","B",...]. Drives target-grade UI. */
  gradeScale: string[];
}

export interface ExamBoard {
  id: string;
  name: string;
  shortName: string;
  country?: string;
  website?: string;
}

/**
 * An assessment objective. Weightings are per-paper because that is how every
 * board publishes them, and because the *derived per-paper mark split* is the
 * single most decision-relevant number a student can see.
 */
export interface AssessmentObjective {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Fraction of each paper's raw marks, keyed by PaperId. Values are 0..1. */
  weightByPaper: Record<string, Unit>;
}

/**
 * Command words are first-class. Each carries the highest AO it can reach,
 * which is the difference between a wasted paragraph and full marks.
 */
export interface CommandWord {
  word: string;
  definition: string;
  /** Board-official definition verbatim, when the pack supplies one. */
  officialDefinition?: string;
  /** AO codes reachable by this command word, e.g. ["AO1","AO2","AO3"]. */
  aoCeiling: string[];
  /** What the examiner is actually looking for. */
  expects: string;
  /** Skeleton the student should write to. */
  answerStructure: string[];
  weakExample?: string;
  strongExample?: string;
  /** The mistake this command word most often provokes. */
  trap?: string;
}

export interface PaperSection {
  code: string;
  name: string;
  description?: string;
  marks: number;
  questionCount?: number;
  /** e.g. "choose 1 of 2" */
  choice?: string;
}

export interface Paper {
  id: PaperId;
  syllabusId: SyllabusId;
  code: string;
  name: string;
  /** Minutes. */
  durationMinutes: number;
  rawMarks: number;
  /** Fraction of the whole qualification, 0..1. */
  weightOfQualification: Unit;
  /** Which stage this paper belongs to, for AS-only vs full A Level students. */
  stage: "as" | "a2" | "combined";
  sections: PaperSection[];
  /** Calculator, formula sheet, case-study insert, etc. */
  materials?: string[];
  notes?: string;
}

export interface LearningObjective {
  id: ObjectiveId;
  code: string;
  statement: string;
  topicId: TopicId;
  /** Which AOs this objective is normally assessed against. */
  aoCodes?: string[];
  /** Objectives that must be secure before this one is worth attempting. */
  prerequisites?: ObjectiveId[];
  /** Board stage: AS-only content vs A Level extension. */
  stage?: "as" | "a2";
}

export interface Topic {
  id: TopicId;
  syllabusId: SyllabusId;
  code: string;
  title: string;
  /** Parent topic for subtopics; undefined for top-level sections. */
  parentId?: TopicId;
  summary?: string;
  stage?: "as" | "a2";
  /** Papers this topic can be assessed on. Drives paper-targeted revision. */
  paperIds?: PaperId[];
  /**
   * Examination weight 0..1 — how much of the qualification's marks historically
   * depend on this topic. Packs may leave it undefined; the engine then falls
   * back to an even split across siblings.
   */
  examWeight?: Unit;
  /** Concepts that must be secure first, expressed as topic ids. */
  prerequisites?: TopicId[];
}

/**
 * A transferable skill (as opposed to a piece of knowledge). This is the axis
 * most revision products ignore, and the one that decides top grades: a student
 * can know every topic and still be unable to build a causal chain.
 */
export interface Skill {
  id: SkillId;
  name: string;
  description: string;
  /** AO code this skill principally serves. */
  aoCode?: string;
  /** How to practise it in isolation. */
  drill?: string;
}

export interface SyllabusVersion {
  /** e.g. "2026-2028" */
  label: string;
  firstExamYear: number;
  lastExamYear: number;
  /** Human-readable list of what changed from the previous version. */
  changes?: string[];
  removedTopics?: string[];
  addedTopics?: string[];
  supersededBy?: string;
}

export interface GradeThreshold {
  session: string;
  paperCode?: string;
  /** Grade → minimum raw mark. */
  thresholds: Record<string, number>;
  maxMark: number;
  sourceUrl?: string;
}

export interface Syllabus {
  id: SyllabusId;
  code: string;
  title: string;
  subject: string;
  qualificationId: string;
  examBoardId: string;
  version: SyllabusVersion;
  papers: Paper[];
  assessmentObjectives: AssessmentObjective[];
  commandWords: CommandWord[];
  topics: Topic[];
  objectives: LearningObjective[];
  skills: Skill[];
  gradeThresholds?: GradeThreshold[];
  /** Official links. Lodestar links out; it does not republish. */
  officialResources?: { label: string; url: string; kind: string }[];
}

// ---------------------------------------------------------------------------
// Derived views — computed, never stored, always explainable.
// ---------------------------------------------------------------------------

/**
 * Convert published AO percentages into raw marks per paper.
 *
 * This is the most load-bearing derivation in the product. A student who sees
 * "AO3 is 40% of Paper 4" reads it as trivia; a student who sees "AO3 is 8 of
 * the 20 marks in this essay" changes how they write. Same data, different
 * behaviour.
 */
export function aoMarkSplit(
  syllabus: Syllabus,
  paperId: PaperId,
): { aoCode: string; marks: number; fraction: Unit }[] {
  const paper = syllabus.papers.find((p) => p.id === paperId);
  if (!paper) return [];
  return syllabus.assessmentObjectives
    .map((ao) => {
      const fraction = ao.weightByPaper[paperId] ?? 0;
      return { aoCode: ao.code, marks: Math.round(fraction * paper.rawMarks), fraction };
    })
    .filter((row) => row.fraction > 0);
}

/** AO split for a single question of `marks` marks on a given paper. */
export function aoSplitForQuestion(
  syllabus: Syllabus,
  paperId: PaperId,
  marks: number,
): { aoCode: string; marks: number }[] {
  return aoMarkSplit(syllabus, paperId).map((row) => ({
    aoCode: row.aoCode,
    marks: Math.round(row.fraction * marks),
  }));
}

/** Whole-qualification AO totals, in raw marks. */
export function aoTotals(syllabus: Syllabus): { aoCode: string; marks: number }[] {
  const totals = new Map<string, number>();
  for (const paper of syllabus.papers) {
    for (const row of aoMarkSplit(syllabus, paper.id)) {
      totals.set(row.aoCode, (totals.get(row.aoCode) ?? 0) + row.marks);
    }
  }
  return [...totals].map(([aoCode, marks]) => ({ aoCode, marks }));
}

/** Minutes available per mark on a paper — the timing discipline number. */
export function minutesPerMark(paper: Paper): number {
  return paper.durationMinutes / paper.rawMarks;
}

/** Topics that have no parent — the top-level syllabus sections. */
export function rootTopics(syllabus: Syllabus): Topic[] {
  return syllabus.topics.filter((t) => !t.parentId);
}

export function childTopics(syllabus: Syllabus, parentId: TopicId): Topic[] {
  return syllabus.topics.filter((t) => t.parentId === parentId);
}

/** Every descendant of a topic, inclusive of the topic itself. */
export function topicSubtree(syllabus: Syllabus, topicId: TopicId): Topic[] {
  const out: Topic[] = [];
  const walk = (tid: TopicId) => {
    const t = syllabus.topics.find((x) => x.id === tid);
    if (!t) return;
    out.push(t);
    for (const c of childTopics(syllabus, tid)) walk(c.id);
  };
  walk(topicId);
  return out;
}

/**
 * Exam weight for a topic, falling back to an even split among siblings when a
 * pack has not supplied one. Always returns a usable number so the priority
 * engine never has to special-case incomplete content.
 */
export function effectiveExamWeight(syllabus: Syllabus, topic: Topic): Unit {
  if (topic.examWeight !== undefined) return topic.examWeight;
  const siblings = topic.parentId
    ? childTopics(syllabus, topic.parentId)
    : rootTopics(syllabus);
  const unweighted = siblings.filter((s) => s.examWeight === undefined);
  const claimed = siblings.reduce((sum, s) => sum + (s.examWeight ?? 0), 0);
  const remaining = Math.max(0, 1 - claimed);
  return unweighted.length ? remaining / unweighted.length : 0;
}

/**
 * Exam weight of a topic as a share of the WHOLE qualification.
 *
 * `effectiveExamWeight` is relative to a topic's siblings, which is the natural
 * way to author content ("these four subtopics split their parent evenly") but
 * the wrong number for ranking: a leaf that is half of a small section is not
 * half of the paper. This walks the ancestor chain and multiplies, so a leaf
 * three levels down reports its true share of the marks.
 */
export function absoluteExamWeight(syllabus: Syllabus, topic: Topic): Unit {
  let weight = effectiveExamWeight(syllabus, topic);
  let current = topic;
  const guard = new Set<TopicId>([topic.id]);
  while (current.parentId) {
    const parent = syllabus.topics.find((t) => t.id === current.parentId);
    // Defensive: a malformed pack could describe a cycle, and an infinite loop
    // in a ranking function would take the whole page down.
    if (!parent || guard.has(parent.id)) break;
    guard.add(parent.id);
    weight *= effectiveExamWeight(syllabus, parent);
    current = parent;
  }
  return weight;
}

export function findCommandWord(syllabus: Syllabus, word: string): CommandWord | undefined {
  const needle = word.trim().toLowerCase();
  return syllabus.commandWords.find((c) => c.word.toLowerCase() === needle);
}
