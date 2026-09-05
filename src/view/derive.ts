/**
 * Derivations.
 *
 * This is the join between content (the same for everyone) and student state
 * (unique to one person). Every number the UI shows comes from here, computed
 * on demand from the attempt log rather than stored — which means a metric can
 * be improved retroactively over a student's whole history, and no component
 * can drift out of sync with another by incrementing its own counter.
 */

import {
  absoluteExamWeight,
  childTopics,
  effectiveExamWeight,
  minutesPerMark,
  rootTopics,
  topicSubtree,
  type Syllabus,
  type Topic,
} from "@/domain/curriculum";
import { computeMastery, retrievability, retentionState, type Mastery, type MasteryEvidence } from "@/domain/mastery";
import { masteryForGrade, rankPriorities, type PriorityInput, type PriorityScore } from "@/domain/priority";
import { computeReadiness, forecastGrade, type Readiness, type ReadinessInput } from "@/domain/readiness";
import { selectDue, newMemoryState, type MemoryState } from "@/domain/scheduling";
import { buildLossProfile, dueForRedo, type LossProfile } from "@/domain/mistakes";
import type { Attempt, Question } from "@/domain/question";
import { daysBetween, type Timestamp } from "@/domain/types";
import type { StudentState, SubjectEnrolment, StoredCard } from "@/store/types";
import type { ContentBundle } from "@/content/bundle";
import type { CardInput } from "@/content/schema";

export interface SubjectView {
  enrolment: SubjectEnrolment;
  syllabus: Syllabus;
  questions: Question[];
  topicMastery: Map<string, Mastery>;
  topicRetention: Map<string, number>;
  priorities: PriorityScore[];
  readiness: Readiness;
  forecast: ReturnType<typeof forecastGrade>;
  lossProfile: LossProfile;
  daysToExam?: number;
  dueCards: { card: CardInput | StoredCard; state: MemoryState; retrievability: number }[];
  openMistakes: number;
  coverage: number;
  attemptCount: number;
  /** Topics the student declined for today; they return tomorrow. */
  dismissedToday: number;
}

/** Attempts joined to their questions, restricted to one syllabus. */
export function attemptsForSyllabus(
  state: StudentState,
  bundle: ContentBundle,
  syllabusId: string,
): { attempt: Attempt; question: Question }[] {
  const byId = new Map(bundle.questions.map((q) => [q.id, q]));
  const out: { attempt: Attempt; question: Question }[] = [];
  for (const a of state.attempts) {
    const q = byId.get(a.questionId);
    if (q && q.syllabusId === syllabusId) out.push({ attempt: a, question: q });
  }
  return out;
}

/**
 * Mastery per topic, rolled up through the tree: a parent topic's mastery is
 * the exam-weighted mastery of its children, not a separate measurement.
 */
export function computeTopicMastery(
  syllabus: Syllabus,
  joined: { attempt: Attempt; question: Question }[],
  now: Timestamp,
  memory: Record<string, MemoryState>,
): Map<string, Mastery> {
  const result = new Map<string, Mastery>();
  const paper = syllabus.papers[0];
  const mpm = paper ? minutesPerMark(paper) : undefined;

  const evidenceByTopic = new Map<string, MasteryEvidence[]>();
  for (const { attempt, question } of joined) {
    for (const t of question.topicIds) {
      if (!evidenceByTopic.has(t)) evidenceByTopic.set(t, []);
      evidenceByTopic.get(t)!.push({ attempt, question });
    }
  }

  for (const topic of syllabus.topics) {
    const subtree = topicSubtree(syllabus, topic.id).map((t) => t.id);
    const evidence = subtree.flatMap((tid) => evidenceByTopic.get(tid) ?? []);
    const objectives = syllabus.objectives.filter((o) => subtree.includes(o.topicId)).length;
    const stability = averageStability(subtree, memory);
    result.set(
      topic.id,
      computeMastery(evidence, {
        now,
        totalObjectives: objectives || undefined,
        minutesPerMark: mpm,
        stabilityDays: stability,
      }),
    );
  }
  return result;
}

function averageStability(topicIds: string[], memory: Record<string, MemoryState>): number | undefined {
  const states = Object.entries(memory)
    .filter(([key]) => topicIds.some((t) => key.includes(t)))
    .map(([, v]) => v.stability);
  if (!states.length) return undefined;
  return states.reduce((s, v) => s + v, 0) / states.length;
}

export function computeTopicRetention(
  mastery: Map<string, Mastery>,
  now: Timestamp,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [topicId, m] of mastery) {
    if (!m.lastEvidenceAt) {
      out.set(topicId, 0);
      continue;
    }
    out.set(topicId, m.signals.retention || retrievability(7, daysBetween(m.lastEvidenceAt, now)));
  }
  return out;
}

/** How many other topics list this one as a prerequisite. */
export function dependentCount(syllabus: Syllabus, topicId: string): number {
  return syllabus.topics.filter((t) => t.prerequisites?.includes(topicId)).length;
}

/**
 * Estimated minutes to move a topic one meaningful step. Scales with how much
 * of the topic remains and how much material it contains, floored so nothing
 * looks free.
 */
export function estimateMinutes(syllabus: Syllabus, topic: Topic, mastery: Mastery): number {
  const objectives = syllabus.objectives.filter((o) => o.topicId === topic.id).length || 3;
  const remaining = Math.max(0.12, 1 - mastery.score);
  return Math.round(Math.max(12, Math.min(180, objectives * 9 * remaining + 12)));
}

export function buildPriorities(
  syllabus: Syllabus,
  enrolment: SubjectEnrolment,
  mastery: Map<string, Mastery>,
  retention: Map<string, number>,
  lossByTopic: Map<string, number>,
  now: Timestamp,
): PriorityScore[] {
  const qualificationMarks = syllabus.papers.reduce((s, p) => s + p.rawMarks, 0) || 100;
  const gradeScale = ["A*", "A", "B", "C", "D", "E", "U"];
  const targetMastery = masteryForGrade(enrolment.targetGrade, gradeScale);
  const daysToExam = enrolment.examDate ? Math.round(daysBetween(now, enrolment.examDate)) : undefined;

  // Rank leaf topics: "revise section 5" is not an action, "revise break-even" is.
  const leaves = syllabus.topics.filter((t) => childTopics(syllabus, t.id).length === 0);
  const scope = leaves.filter((t) => inScope(t, enrolment));

  const inputs: PriorityInput[] = scope.map((topic) => {
    const m = mastery.get(topic.id) ?? computeMastery([], { now });
    return {
      topicId: topic.id,
      topicTitle: topic.title,
      examWeight: absoluteExamWeight(syllabus, topic),
      qualificationMarks,
      mastery: m,
      retention: retention.get(topic.id) ?? 0,
      targetMastery,
      estimatedMinutes: estimateMinutes(syllabus, topic, m),
      dependents: dependentCount(syllabus, topic.id),
      daysToExam,
      marksLostRecently: lossByTopic.get(topic.id),
    };
  });

  return rankPriorities(inputs);
}

function inScope(topic: Topic, enrolment: SubjectEnrolment): boolean {
  if (enrolment.stage === "as" && topic.stage === "a2") return false;
  return true;
}

export function buildSubjectView(
  state: StudentState,
  bundle: ContentBundle,
  enrolment: SubjectEnrolment,
  now: Timestamp,
): SubjectView | null {
  const syllabus = bundle.syllabuses.find((s) => s.id === enrolment.syllabusId);
  if (!syllabus) return null;

  const questions = bundle.questions.filter((q) => q.syllabusId === syllabus.id);
  const joined = attemptsForSyllabus(state, bundle, syllabus.id);
  const topicMastery = computeTopicMastery(syllabus, joined, now, state.memory);
  const topicRetention = computeTopicRetention(topicMastery, now);

  const syllabusTopicIds = new Set(syllabus.topics.map((t) => t.id));
  const mistakes = state.mistakes.filter((m) => m.topicIds.some((t) => syllabusTopicIds.has(t)));
  const lossProfile = buildLossProfile(mistakes);
  const lossByTopic = new Map(lossProfile.byTopic.map((r) => [r.topicId, r.marks]));

  // "Not today" is a real control, not a sentiment survey: a topic the student
  // dismissed today is moved out of today's ranking entirely and returns
  // tomorrow. Advice that cannot be declined is nagging, and nagging gets the
  // whole page ignored.
  const today = now.slice(0, 10);
  const dismissedToday = new Set(
    state.feedback
      .filter((f) => f.kind === "priority-dismiss" && f.at.slice(0, 10) === today)
      .map((f) => f.subject)
      // Scope to this syllabus, or a dismissal in one subject would inflate
      // the "n dismissed today" count shown in every other subject's view.
      .filter((topicId) => syllabusTopicIds.has(topicId)),
  );
  const rankedAll = buildPriorities(syllabus, enrolment, topicMastery, topicRetention, lossByTopic, now);
  const priorities = rankedAll.filter((p) => !dismissedToday.has(p.topicId));

  // --- readiness ----------------------------------------------------------
  const leaves = syllabus.topics.filter((t) => childTopics(syllabus, t.id).length === 0);
  const leafIds = new Set(leaves.map((t) => t.id));

  /**
   * Syllabus coverage — what fraction of the syllabus has any evidence at all.
   *
   * Measured against learning objectives where a pack authors them, and against
   * leaf topics where it does not. The fallback matters: objective-level detail
   * is the last thing a pack author writes, and without it this previously
   * measured tested-objectives against a leaf-topic denominator — a set that is
   * always empty over a count that never is. It reported 0% to a student who
   * had answered questions across a dozen topics, and dragged their readiness
   * and grade projection down with it.
   */
  const hasAuthoredObjectives = syllabus.objectives.length > 0;
  const totalObjectives = hasAuthoredObjectives ? syllabus.objectives.length : leaves.length;
  const testedUnits = hasAuthoredObjectives
    ? new Set(joined.flatMap(({ question }) => question.objectiveIds ?? []))
    : new Set(joined.flatMap(({ question }) => question.topicIds.filter((t) => leafIds.has(t))));
  const coverage = totalObjectives ? Math.min(1, testedUnits.size / totalObjectives) : 0;

  const withEvidence = [...topicMastery.entries()].filter(([, m]) => m.observations > 0);
  const meanRetention = withEvidence.length
    ? withEvidence.reduce((s, [tid]) => s + (topicRetention.get(tid) ?? 0), 0) / withEvidence.length
    : 0;

  const aoTally = tallyAO(joined);
  const timing = timingRatio(joined, syllabus);

  const mocks = state.mocks
    .filter((m) => m.syllabusId === syllabus.id && m.completed)
    .map((m) => ({ at: m.submittedAt ?? m.startedAt, fraction: m.maxScore ? m.score / m.maxScore : 0, paperId: m.paperId }));

  const readinessInput: ReadinessInput = {
    topicMastery: leaves.map((t) => ({
      topicId: t.id,
      examWeight: absoluteExamWeight(syllabus, t),
      mastery: topicMastery.get(t.id) ?? computeMastery([], { now }),
    })),
    syllabusCoverage: coverage,
    meanRetention,
    applicationRate: aoTally.application,
    techniqueRate: aoTally.technique,
    timingRatio: timing,
    mocks,
    totalObjectives,
  };
  const readiness = computeReadiness(readinessInput);
  const forecast = forecastGrade(readiness, readinessInput, syllabus, enrolment.targetGrade);

  // --- due cards ----------------------------------------------------------
  const packCards = bundle.cards.filter((c) => c.syllabusId === syllabus.id);
  const ownCards = state.cards.filter((c) => c.syllabusId === syllabus.id && !c.suspended);
  const all: (CardInput | StoredCard)[] = [...packCards, ...ownCards];
  const dueCards = selectDue(
    all.map((c) => ({
      item: c,
      state: state.memory[c.id!] ?? newMemoryState(now, "origin" in c ? c.origin : "authored"),
      importance: averageImportance(syllabus, c.topicIds ?? []),
    })),
    now,
    200,
  ).map((d) => ({ card: d.item, state: d.state, retrievability: d.retrievability }));

  return {
    enrolment,
    syllabus,
    questions,
    topicMastery,
    topicRetention,
    priorities,
    readiness,
    forecast,
    lossProfile,
    daysToExam: enrolment.examDate ? Math.round(daysBetween(now, enrolment.examDate)) : undefined,
    dueCards,
    openMistakes: dueForRedo(mistakes, now, 999).length,
    coverage,
    attemptCount: joined.length,
    dismissedToday: dismissedToday.size,
  };
}

function averageImportance(syllabus: Syllabus, topicIds: string[]): number {
  if (!topicIds.length) return 0.5;
  const weights = topicIds.map((tid) => {
    const t = syllabus.topics.find((x) => x.id === tid);
    return t ? absoluteExamWeight(syllabus, t) : 0.1;
  });
  const mean = weights.reduce((s, w) => s + w, 0) / weights.length;
  // Normalise against an "average" topic: with ~25 leaf topics, a typical leaf
  // is worth 4% of the qualification, so 8% should read as clearly important.
  return Math.min(1, mean * 12);
}

/**
 * Split earned marks by assessment objective family. AO1/AO2 are knowledge and
 * application; AO3/AO4 are the higher-order marks that decide top grades. The
 * distinction matters because they need completely different remediation.
 */
function tallyAO(joined: { attempt: Attempt; question: Question }[]) {
  let appEarned = 0, appAvail = 0, techEarned = 0, techAvail = 0;
  for (const { attempt, question } of joined) {
    const ao = attempt.aoScores ?? inferAOScores(attempt, question);
    for (const [code, v] of Object.entries(ao)) {
      const upper = code.toUpperCase();
      if (upper.includes("2")) { appEarned += v.earned; appAvail += v.available; }
      if (upper.includes("3") || upper.includes("4")) { techEarned += v.earned; techAvail += v.available; }
    }
  }
  return {
    application: appAvail ? { earned: appEarned, available: appAvail } : undefined,
    technique: techAvail ? { earned: techEarned, available: techAvail } : undefined,
  };
}

/** Derive AO scores from the ledger when the attempt did not record them. */
function inferAOScores(attempt: Attempt, question: Question): Record<string, { earned: number; available: number }> {
  const out: Record<string, { earned: number; available: number }> = {};
  const points = question.markScheme.points ?? [];
  if (!points.length || !attempt.ledger?.length) {
    if (question.aoMarks) {
      const fraction = attempt.maxScore ? attempt.score / attempt.maxScore : 0;
      for (const [code, marks] of Object.entries(question.aoMarks)) {
        out[code] = { earned: marks * fraction, available: marks };
      }
    }
    return out;
  }
  const byId = new Map(points.map((p) => [p.id, p]));
  for (const entry of attempt.ledger) {
    const p = byId.get(entry.pointId);
    if (!p?.aoCode) continue;
    out[p.aoCode] ??= { earned: 0, available: 0 };
    out[p.aoCode]!.available += p.marks;
    out[p.aoCode]!.earned += entry.outcome === "hit" ? p.marks : entry.outcome === "partial" ? p.marks / 2 : 0;
  }
  return out;
}

/** Time actually taken versus the paper's own budget. */
function timingRatio(joined: { attempt: Attempt; question: Question }[], syllabus: Syllabus): number | undefined {
  const timed = joined.filter(({ attempt }) => attempt.mode === "mock" || attempt.mode === "timed");
  if (timed.length < 3) return undefined;
  const paper = syllabus.papers[0];
  if (!paper) return undefined;
  const budget = minutesPerMark(paper) * 60;
  const totalBudget = timed.reduce((s, { question }) => s + budget * question.marks, 0);
  const totalActual = timed.reduce((s, { attempt }) => s + attempt.timeSpent, 0);
  return totalBudget ? totalActual / totalBudget : undefined;
}

export { rootTopics, childTopics, retentionState };
