/**
 * The Mistake Lab.
 *
 * A wrong answer is the most information-dense event in the whole system, and
 * almost every revision product throws it away — showing a red cross, a correct
 * answer, and moving on. Here every lost mark becomes a durable object with a
 * cause, a repair path and a review schedule, and repeated mistakes are treated
 * as a failure of the system rather than of the student.
 */

import {
  MARK_LOSS_LABELS,
  TECHNIQUE_LOSSES,
  type Attempt,
  type MarkLossCategory,
  type Question,
} from "./question";
import type { MistakeId, QuestionId, Timestamp, TopicId, Unit } from "./types";
import { daysBetween } from "./types";

export interface Mistake {
  id: MistakeId;
  questionId: QuestionId;
  topicIds: TopicId[];
  objectiveIds?: string[];
  category: MarkLossCategory;
  /** Marks actually lost to this cause on this question. */
  marksLost: number;
  /** What the student wrote. Kept verbatim — the diagnosis lives here. */
  studentAnswer: string;
  /** The mark-scheme point that was missed. */
  requiredPoint?: string;
  firstSeenAt: Timestamp;
  lastSeenAt: Timestamp;
  occurrences: number;
  /** Attempts since the mistake was last made. Drives "eliminated" status. */
  cleanRunsSince: number;
  status: MistakeStatus;
  /** Notes the student wrote when reviewing this. */
  reflection?: string;
  linkedCardId?: string;
}

export type MistakeStatus = "open" | "repairing" | "eliminated" | "recurring";

/**
 * Status rules. "Eliminated" requires three clean re-encounters, spaced — one
 * lucky correct answer is not evidence of repair, and claiming otherwise is the
 * fastest way to lose a student's trust.
 */
export function mistakeStatus(m: Pick<Mistake, "occurrences" | "cleanRunsSince">): MistakeStatus {
  if (m.cleanRunsSince >= 3) return "eliminated";
  if (m.occurrences >= 3) return "recurring";
  if (m.cleanRunsSince >= 1) return "repairing";
  return "open";
}

/** Derive mistakes from a marked attempt. Pure: no IO, no ids minted here. */
export function mistakesFromAttempt(
  q: Question,
  a: Attempt,
): Omit<Mistake, "id" | "firstSeenAt" | "occurrences" | "cleanRunsSince" | "status">[] {
  const answerText =
    a.response.kind === "text"
      ? a.response.text
      : a.response.kind === "numeric"
        ? String(a.response.value ?? "")
        : JSON.stringify(a.response);

  // Objectively-marked questions: a wrong choice maps to its own misconception.
  if (!a.ledger?.length) {
    if (a.score >= a.maxScore) return [];
    const chosen =
      a.response.kind === "choice"
        ? q.response?.choices?.find((c) => a.response.kind === "choice" && a.response.selected.includes(c.id))
        : undefined;
    return [
      {
        questionId: q.id,
        topicIds: q.topicIds,
        objectiveIds: q.objectiveIds,
        category: chosen?.misconception ? "misunderstanding" : "knowledge-gap",
        marksLost: a.maxScore - a.score,
        studentAnswer: answerText,
        requiredPoint: chosen?.misconception ?? q.markScheme.modelAnswer,
        lastSeenAt: a.submittedAt,
      },
    ];
  }

  // Ledger-marked: one mistake per missed mark-scheme point, carrying the
  // student's own classification of why it was missed.
  const byId = new Map((q.markScheme.points ?? []).map((p) => [p.id, p]));
  const out: Omit<Mistake, "id" | "firstSeenAt" | "occurrences" | "cleanRunsSince" | "status">[] = [];
  for (const e of a.ledger) {
    if (e.outcome === "hit" || e.outcome === "not-applicable") continue;
    const point = byId.get(e.pointId);
    if (!point) continue;
    const lost = e.outcome === "missed" ? point.marks : point.marks / 2;
    if (lost <= 0) continue;
    out.push({
      questionId: q.id,
      topicIds: q.topicIds,
      objectiveIds: q.objectiveIds,
      category: e.lossReason ?? "unknown",
      marksLost: lost,
      studentAnswer: answerText,
      requiredPoint: point.text,
      lastSeenAt: a.submittedAt,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregate diagnosis
// ---------------------------------------------------------------------------

export interface LossProfile {
  totalMarksLost: number;
  byCategory: { category: MarkLossCategory; label: string; marks: number; share: Unit }[];
  byTopic: { topicId: TopicId; marks: number }[];
  /** Fraction of losses that are technique rather than knowledge. */
  techniqueShare: Unit;
  /** The one finding worth acting on. */
  headline: string;
  /** What to actually do about it. */
  prescription: string;
}

export function buildLossProfile(mistakes: Mistake[]): LossProfile {
  const total = mistakes.reduce((s, m) => s + m.marksLost, 0);
  const cat = new Map<MarkLossCategory, number>();
  const top = new Map<TopicId, number>();
  for (const m of mistakes) {
    cat.set(m.category, (cat.get(m.category) ?? 0) + m.marksLost);
    for (const t of m.topicIds) top.set(t, (top.get(t) ?? 0) + m.marksLost / m.topicIds.length);
  }

  const byCategory = [...cat]
    .map(([category, marks]) => ({
      category,
      label: MARK_LOSS_LABELS[category],
      marks,
      share: total > 0 ? marks / total : 0,
    }))
    .sort((a, b) => b.marks - a.marks);

  const techniqueMarks = [...cat]
    .filter(([c]) => TECHNIQUE_LOSSES.has(c))
    .reduce((s, [, m]) => s + m, 0);
  const techniqueShare = total > 0 ? techniqueMarks / total : 0;

  const worst = byCategory[0];
  let headline = "Not enough marked work yet to see a pattern.";
  let prescription = "Complete and self-mark two more questions and a pattern will appear.";

  if (worst && total > 0) {
    headline = `Your largest single source of lost marks is “${worst.label}” — ${worst.marks.toFixed(0)} marks, ${Math.round(worst.share * 100)}% of everything you have lost.`;
    prescription = PRESCRIPTIONS[worst.category];
    if (techniqueShare > 0.55) {
      headline += ` Overall, ${Math.round(techniqueShare * 100)}% of your lost marks are technique, not knowledge.`;
      prescription =
        "Stop revising content. Your marks are being lost in how answers are written, and that is trainable in days rather than weeks — drill the specific move above.";
    }
  }

  return {
    totalMarksLost: total,
    byCategory,
    byTopic: [...top].map(([topicId, marks]) => ({ topicId, marks })).sort((a, b) => b.marks - a.marks),
    techniqueShare,
    headline,
    prescription,
  };
}

/** What to do about each cause. Specific, and short enough to actually do. */
export const PRESCRIPTIONS: Record<MarkLossCategory, string> = {
  "knowledge-gap":
    "Genuine content gaps. Write the topic from blank paper, correct it in a different colour, then re-test in 3 days.",
  misunderstanding:
    "You hold a working model that is wrong, which is why it survives re-reading. Compare your explanation against the mechanism line by line until you find the exact divergence.",
  "no-application":
    "Cover the context name in your answer. If the sentence still works for any other case, it earns nothing. Rewrite five past answers using a number, a constraint or a stated objective from the source.",
  "no-chain":
    "You are listing points instead of developing them. Drill three-link chains: cause → mechanism → consequence for this specific context. Twenty chains, five minutes each.",
  "no-judgement":
    "You are describing where the question demanded a decision. Write conclusions only — ten of them, no essays — until committing to an answer is automatic.",
  "insufficient-development":
    "Your answers are thinner than the marks available. Before writing, count the marks and plan that many developed points.",
  "command-word-misread":
    "You answered a different question from the one asked. Before every answer, circle the command word and write its AO ceiling in the margin.",
  "question-misread":
    "Read the question twice and underline the operative noun before writing. This costs 10 seconds and is the cheapest fix in the product.",
  "calculation-error":
    "Arithmetic under pressure. Re-do calculation sets to time, and always sanity-check the magnitude of the answer.",
  "formula-error":
    "The formula is being recalled wrongly or inverted. Drill the formula sheet to blank recall, including what each variable means.",
  "unit-error":
    "State the unit on every numerical answer, always. Add it to your pre-submission checklist.",
  "rounding-error":
    "Check the required precision before answering, and never round mid-calculation.",
  "data-misread":
    "Before answering a data question, read the axis labels, units and any footnote aloud.",
  "graph-error":
    "Practise reading and drawing this graph type from scratch, including axes and scale.",
  "weak-evidence":
    "Assertions without support earn nothing. Every claim needs a number or a quote from the source attached to it.",
  "poor-structure":
    "One point per paragraph. Examiners credit what they can find; a wall of text hides marks you actually earned.",
  incomplete:
    "You are running out of answer. Plan the shape before writing, and keep the last point brief rather than abandoning it.",
  "ran-out-of-time":
    "A timing problem, not a knowledge problem. Set a per-question alarm and stop mid-sentence when it fires.",
  careless:
    "You knew this. Build a 20-second end-of-question check: units, command word, did I answer what was asked.",
  unknown:
    "Classify the cause when you self-mark — the classification is where the value is, not the score.",
};

/**
 * Repair ladder for a single mistake. The order is deliberate: you cannot fix
 * an application failure with a harder question, and you cannot fix a knowledge
 * gap with a similar one.
 */
export interface RepairStep {
  kind: "explain" | "prerequisite" | "easier" | "similar" | "harder" | "card" | "drill";
  label: string;
  rationale: string;
}

export function repairLadder(category: MarkLossCategory): RepairStep[] {
  const base: RepairStep[] = [];
  if (
    category === "knowledge-gap" ||
    category === "misunderstanding" ||
    category === "formula-error"
  ) {
    base.push(
      { kind: "explain", label: "Re-derive the mechanism", rationale: "The gap is knowledge, so questions come after understanding, not before it." },
      { kind: "prerequisite", label: "Check the prerequisite", rationale: "Failures here are often caused one level down." },
      { kind: "easier", label: "One easier question", rationale: "Re-establish the pattern with the load reduced." },
      { kind: "similar", label: "One similar question", rationale: "Prove the repair held at the original difficulty." },
      { kind: "card", label: "Add a recall card", rationale: "Schedule it so the repair survives past this week." },
      { kind: "harder", label: "One harder question", rationale: "Confirm transfer rather than memorisation of this item." },
    );
  } else if (TECHNIQUE_LOSSES.has(category)) {
    base.push(
      { kind: "drill", label: "Isolate the move", rationale: "Technique is a skill: train it alone before reintegrating it." },
      { kind: "similar", label: "Rewrite this answer", rationale: "Apply the move to the answer that lost the marks." },
      { kind: "similar", label: "Two more of the same type", rationale: "Technique needs reps, not explanation." },
      { kind: "card", label: "Add the rule as a card", rationale: "Keep the rule available under exam pressure." },
    );
  } else {
    base.push(
      { kind: "explain", label: "See where it diverged", rationale: "Find the exact step, not the general topic." },
      { kind: "similar", label: "One similar question", rationale: "Test the repair immediately." },
      { kind: "card", label: "Add a recall card", rationale: "Protect against a repeat." },
    );
  }
  return base;
}

/** Mistakes that are overdue for a re-attempt, most costly first. */
export function dueForRedo(mistakes: Mistake[], now: Timestamp, limit = 10): Mistake[] {
  return mistakes
    .filter((m) => m.status !== "eliminated")
    .map((m) => {
      const age = daysBetween(m.lastSeenAt, now);
      const recurrencePenalty = m.occurrences >= 3 ? 2.2 : m.occurrences === 2 ? 1.5 : 1;
      return { m, urgency: m.marksLost * recurrencePenalty * Math.min(3, 1 + age / 7) };
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit)
    .map((x) => x.m);
}
