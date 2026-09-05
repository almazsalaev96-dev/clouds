/**
 * The priority engine.
 *
 * This is the centre of the product. Everything else exists to feed it, and the
 * single question it answers is:
 *
 *     Of everything this student could do in the next 30 minutes,
 *     which action gains the most marks per minute spent?
 *
 * Not "which topic is least complete". Not "which is overdue". Completion is a
 * progress bar; marks-per-minute is the actual objective function of exam
 * preparation, and it produces materially different — sometimes surprising —
 * advice. It will tell a student to leave a topic they are bad at alone,
 * because it is worth four marks and would take six hours; and it will send
 * them to a topic they think they already know, because it is worth thirty
 * marks and is quietly decaying.
 *
 * Every component is separately reportable, because a recommendation a student
 * does not believe is a recommendation they will not follow. See
 * `explainPriority` — it is rendered verbatim by "Why am I seeing this?".
 */

import { clamp01, type TopicId, type Unit } from "./types";
import type { Mastery } from "./mastery";

export interface PriorityInput {
  topicId: TopicId;
  topicTitle: string;
  /** 0..1 share of the qualification's marks that depend on this topic. */
  examWeight: Unit;
  /** Total raw marks in the qualification, so weight converts to real marks. */
  qualificationMarks: number;
  mastery: Mastery;
  /** 0..1 probability of recall right now. */
  retention: Unit;
  /** Mastery implied by the student's target grade (e.g. A* ⇒ ~0.88). */
  targetMastery: Unit;
  /** Estimated minutes to move this topic one meaningful step. */
  estimatedMinutes: number;
  /**
   * How many *other* topics depend on this one. A weak prerequisite silently
   * caps everything downstream, so it is worth more than its own marks.
   */
  dependents: number;
  /** Days until the exam, if known. */
  daysToExam?: number;
  /** Marks actually lost on this topic in recorded attempts. */
  marksLostRecently?: number;
}

export interface PriorityScore {
  topicId: TopicId;
  /** Expected marks gained per hour of study. The rankable number. */
  marksPerHour: number;
  /** 0..1 normalised, for display. */
  normalised: Unit;
  components: {
    marksAtStake: number;
    gap: Unit;
    forgettingRisk: Unit;
    prerequisiteMultiplier: number;
    urgency: number;
    expectedGainMarks: number;
    hours: number;
  };
  because: string[];
  /** The single action that best addresses this topic right now. */
  action: RecommendedAction;
}

export type RecommendedAction =
  | "learn"          // no usable knowledge yet — start from explanation
  | "repair"         // knows fragments, holds a misconception
  | "practise"       // knowledge is there, application is not
  | "review"         // knowledge decaying, needs retrieval not teaching
  | "stretch"        // secure; push into unfamiliar contexts
  | "technique"      // knows the content, loses marks on how it is written
  | "maintain";      // exam-ready; light touch only

/**
 * Diminishing returns. Moving a topic from 20% to 40% mastery is much cheaper
 * than moving it from 80% to 95%, and a model that ignores this will always
 * over-recommend polishing strong topics.
 */
function expectedGain(current: Unit, target: Unit): Unit {
  if (current >= target) return 0;
  const room = target - current;
  // Effort rises steeply in the last quarter of the range.
  const tractability = 1 - Math.pow(current, 2.1);
  return clamp01(room * tractability);
}

export function scorePriority(input: PriorityInput): PriorityScore {
  const because: string[] = [];

  const marksAtStake = input.examWeight * input.qualificationMarks;

  const gap = expectedGain(input.mastery.score, input.targetMastery);
  const forgettingRisk = clamp01(1 - input.retention);

  // A prerequisite with many dependents is worth more than it looks. Sub-linear
  // so a hub topic does not swamp the ranking entirely.
  const prerequisiteMultiplier = 1 + Math.log2(1 + input.dependents) * 0.35;

  // Urgency: as the exam nears, unfixed weakness gets more urgent, and topics
  // that are already secure get *less* urgent — the opposite of a completion
  // model, which keeps nagging about finished work.
  let urgency = 1;
  if (input.daysToExam !== undefined) {
    if (input.daysToExam <= 0) urgency = 1;
    else if (input.daysToExam <= 7) urgency = 1.9;
    else if (input.daysToExam <= 21) urgency = 1.5;
    else if (input.daysToExam <= 60) urgency = 1.2;
  }

  // Marks the student is expected to recover by doing this work.
  const recoveryFromDecay = marksAtStake * forgettingRisk * input.mastery.score * 0.45;
  const recoveryFromLearning = marksAtStake * gap;
  const expectedGainMarks =
    (recoveryFromLearning + recoveryFromDecay) * prerequisiteMultiplier * urgency;

  const hours = Math.max(0.08, input.estimatedMinutes / 60);
  const marksPerHour = expectedGainMarks / hours;

  // --- explanation ---------------------------------------------------------
  because.push(
    `Worth about ${marksAtStake.toFixed(0)} marks of the qualification (${Math.round(input.examWeight * 100)}% of the total).`,
  );
  if (input.mastery.observations === 0) {
    because.push("You have never been tested on this, so the estimate is a prior, not a measurement.");
  } else {
    because.push(
      `Mastery ${Math.round(input.mastery.score * 100)}% against a target of ${Math.round(input.targetMastery * 100)}% — the limiting signal is ${input.mastery.limitingFactor}.`,
    );
  }
  if (forgettingRisk > 0.3) {
    because.push(
      `Recall has decayed to ${Math.round(input.retention * 100)}%, so roughly ${recoveryFromDecay.toFixed(1)} marks are currently at risk from forgetting alone.`,
    );
  }
  if (input.dependents > 0) {
    because.push(
      `${input.dependents} later topic${input.dependents === 1 ? "" : "s"} depend${input.dependents === 1 ? "s" : ""} on this, so weakness here caps them too.`,
    );
  }
  if (input.marksLostRecently && input.marksLostRecently > 0) {
    because.push(`You have lost ${input.marksLostRecently} marks here in recorded attempts.`);
  }
  if (urgency > 1.2) {
    because.push(`Weighted up because the exam is ${input.daysToExam} days away.`);
  }
  because.push(
    `Estimated ${Math.round(input.estimatedMinutes)} minutes to move it ⇒ about ${marksPerHour.toFixed(1)} marks per hour.`,
  );

  return {
    topicId: input.topicId,
    marksPerHour,
    normalised: 0, // filled by rankPriorities, which needs the whole set
    components: {
      marksAtStake,
      gap,
      forgettingRisk,
      prerequisiteMultiplier,
      urgency,
      expectedGainMarks,
      hours,
    },
    because,
    action: chooseAction(input),
  };
}

/**
 * Pick the action, not just the topic. "Study electrolysis" is useless advice;
 * "you know electrolysis but you never justify the half-equation — do six
 * explanation questions" is a session.
 */
export function chooseAction(input: PriorityInput): RecommendedAction {
  const m = input.mastery;
  if (m.observations === 0) return "learn";
  if (m.score < 0.3) return m.signals.ability < 0.25 ? "learn" : "repair";
  if (m.signals.retention < 0.55 && m.signals.ability > 0.55) return "review";
  if (m.score >= input.targetMastery && m.signals.retention > 0.8) return "maintain";
  if (m.signals.ability > 0.65 && m.signals.transfer < 0.45) return "stretch";
  if (m.signals.fluency < 0.45 && m.signals.ability > 0.6) return "technique";
  if (m.signals.consistency < 0.5) return "practise";
  return "practise";
}

export const ACTION_COPY: Record<RecommendedAction, { verb: string; blurb: string }> = {
  learn: { verb: "Learn", blurb: "Start from the explanation — there is no evidence to build on yet." },
  repair: { verb: "Repair", blurb: "Something is being held wrongly. Fix the mechanism before more questions." },
  practise: { verb: "Practise", blurb: "The knowledge is there. It needs reps under exam framing." },
  review: { verb: "Review", blurb: "You knew this. It is fading. Retrieve it, don't reread it." },
  stretch: { verb: "Stretch", blurb: "Secure on familiar questions. Push into unfamiliar contexts." },
  technique: { verb: "Technique", blurb: "You know it and still lose marks. That's a writing problem, not a knowledge one." },
  maintain: { verb: "Maintain", blurb: "Exam-ready. A light touch keeps it alive without wasting time." },
};

/** Rank a full set, normalising for display. */
export function rankPriorities(inputs: PriorityInput[]): PriorityScore[] {
  const scored = inputs.map(scorePriority);
  const max = Math.max(...scored.map((s) => s.marksPerHour), 0.0001);
  for (const s of scored) s.normalised = clamp01(s.marksPerHour / max);
  return scored.sort((a, b) => b.marksPerHour - a.marksPerHour);
}

/**
 * Mastery a target grade implies. Deliberately conservative: aiming for an A*
 * means being able to do the hard version reliably, not scraping the boundary.
 */
export function masteryForGrade(grade: string, gradeScale: string[]): Unit {
  const idx = gradeScale.indexOf(grade);
  if (idx === -1) return 0.75;
  // Top grade ⇒ 0.90, falling toward 0.45 at the bottom of the scale.
  const span = Math.max(1, gradeScale.length - 1);
  return clamp01(0.9 - (idx / span) * 0.45);
}
