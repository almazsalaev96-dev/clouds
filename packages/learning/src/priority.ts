/**
 * Exam-value prioritisation — "what should I study right now?"
 *
 * Most revision advice fails because it ranks topics by how uncomfortable they feel.
 * This ranks them by **marks recoverable per hour**, which is the only number that
 * actually moves a grade:
 *
 *     value = marksAtStake × (1 − P(correct)) × urgency × confidenceRisk
 *     score = value ÷ estimatedHours
 *
 * `marksAtStake` comes from the syllabus model — for Cambridge that is the paper
 * weighting times the assessment-objective weighting, so an objective that carries
 * 18 raw marks outranks one that carries 4 even if both feel equally shaky.
 */

export interface ObjectiveSnapshot {
  objectiveId: string;
  label: string;
  /** Raw marks this objective is worth across the whole qualification. */
  marksAtStake: number;
  /** Current P(correct) on an average item, 0..1. */
  probability: number;
  /** Hours of work estimated to move this objective to target. */
  estimatedHours?: number;
  /** Epoch ms it was last practised, null if never. */
  lastPractised?: number | null;
  /**
   * Mean stated confidence on this objective, 0..1. Confident-but-wrong is the
   * most expensive failure mode in an exam, so it gets a multiplier.
   */
  meanConfidence?: number;
}

export interface PrioritisedObjective extends ObjectiveSnapshot {
  /** Expected raw marks currently being lost on this objective. */
  marksAtRisk: number;
  /** Marks recoverable per hour of work. */
  score: number;
  /** One-line explanation the UI can show verbatim. */
  why: string;
}

export interface PriorityOptions {
  now: number;
  /** Epoch ms of the exam, used to weight urgency. Omit for no deadline pressure. */
  examAt?: number;
  /** Target probability we are trying to reach on every objective. */
  target?: number;
}

export function prioritise(
  objectives: readonly ObjectiveSnapshot[],
  options: PriorityOptions,
): PrioritisedObjective[] {
  const target = options.target ?? 0.9;

  return objectives
    .map((o) => {
      const gap = Math.max(0, target - o.probability);
      const marksAtRisk = o.marksAtStake * gap;
      const hours = Math.max(o.estimatedHours ?? estimateHours(gap), 0.1);

      // Neglect: an objective untouched for a long time is riskier than its
      // probability suggests, because that probability is stale.
      const neverPractised = o.lastPractised == null;
      const daysSince = neverPractised
        ? 30
        : Math.max(0, (options.now - (o.lastPractised as number)) / 86_400_000);
      const neglect = 1 + Math.min(daysSince, 60) / 60;

      // Confident-but-wrong: the learner will not revise this on their own.
      const blindSpot =
        o.meanConfidence != null && o.meanConfidence - o.probability > 0.15 ? 1.4 : 1;

      const urgency = examUrgency(options.now, options.examAt);
      const score = (marksAtRisk * neglect * blindSpot * urgency) / hours;

      return {
        ...o,
        marksAtRisk,
        score,
        why: explain(o, marksAtRisk, blindSpot > 1, neverPractised ? null : daysSince),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Deadline pressure. Far from the exam, everything is equally urgent (1.0); close
 * to it, urgency rises so the plan stops optimising for next year's retention.
 */
export function examUrgency(now: number, examAt?: number): number {
  if (examAt == null) return 1;
  const days = (examAt - now) / 86_400_000;
  if (days <= 0) return 1;
  if (days > 120) return 1;
  return 1 + (120 - days) / 120; // ramps 1 → 2 over the final four months
}

function estimateHours(gap: number): number {
  // Rough: closing a 0.5 probability gap on one objective is about 2 hours of work.
  return Math.max(0.25, gap * 4);
}

function explain(
  o: ObjectiveSnapshot,
  marksAtRisk: number,
  blindSpot: boolean,
  daysSince: number | null,
): string {
  const marks = `${marksAtRisk.toFixed(1)} marks at risk`;
  if (blindSpot) return `${marks} — you rate yourself higher here than you score`;
  if (daysSince === null) return `${marks} — not started yet`;
  if (daysSince >= 21) return `${marks} — not practised in ${Math.round(daysSince)} days`;
  if (o.probability < 0.5) return `${marks} — weakest area`;
  return `${marks}`;
}
