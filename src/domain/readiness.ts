/**
 * Exam readiness and grade forecasting.
 *
 * The hard constraint on this file: **never claim certainty the evidence does
 * not support.** A student who is told "you are on for an A*" and gets a B has
 * been actively harmed, and every subsequent number the product shows becomes
 * noise to them. So every forecast here carries a range, an explicit confidence,
 * and a plain statement of what it is *not* accounting for.
 *
 * Readiness is deliberately multi-dimensional. A student can have full syllabus
 * coverage and still be nowhere near ready because they cannot finish a paper in
 * time; the aggregate number hides exactly the thing they need to fix, so the
 * dimensions are always shown alongside it.
 */

import { clamp01, estimate, type Estimate, type Timestamp, type Unit } from "./types";
import type { Mastery } from "./mastery";
import type { GradeThreshold, Syllabus } from "./curriculum";

export interface ReadinessDimension {
  key: ReadinessKey;
  label: string;
  score: Unit;
  weight: number;
  /** Evidence count behind this dimension. Low ⇒ shown as provisional. */
  observations: number;
  because: string;
  /** What would move it most. */
  nextStep: string;
}

export type ReadinessKey =
  | "coverage"
  | "mastery"
  | "retention"
  | "application"
  | "technique"
  | "timing"
  | "consistency"
  | "mock";

export type ReadinessVerdict = "not-ready" | "building" | "almost-ready" | "ready";

export interface Readiness {
  score: Unit;
  verdict: ReadinessVerdict;
  dimensions: ReadinessDimension[];
  /** The dimension holding the score down most, weighted by its weight. */
  limitingDimension: ReadinessDimension | null;
  confidence: Unit;
  /** Honest statement of what this number does and does not know. */
  caveats: string[];
}

export interface ReadinessInput {
  /** Topic-level mastery across the syllabus. */
  topicMastery: { topicId: string; examWeight: Unit; mastery: Mastery }[];
  /** Fraction of syllabus objectives with any evidence at all. */
  syllabusCoverage: Unit;
  /** Mean retention across topics with evidence. */
  meanRetention: Unit;
  /** Fraction of AO2 (application) marks earned in marked work. */
  applicationRate?: { earned: number; available: number };
  /** Fraction of AO3+AO4 (analysis + evaluation) marks earned. */
  techniqueRate?: { earned: number; available: number };
  /** Ratio of time taken to time available on timed work. <=1 is good. */
  timingRatio?: number;
  /** Completed full mock papers, most recent last. */
  mocks: { at: Timestamp; fraction: Unit; paperId?: string }[];
  totalObjectives: number;
}

const WEIGHTS: Record<ReadinessKey, number> = {
  coverage: 0.12,
  mastery: 0.24,
  retention: 0.14,
  application: 0.12,
  technique: 0.16,
  timing: 0.08,
  consistency: 0.06,
  mock: 0.08,
};

export function computeReadiness(input: ReadinessInput): Readiness {
  const dims: ReadinessDimension[] = [];
  const caveats: string[] = [];

  // --- coverage ------------------------------------------------------------
  dims.push({
    key: "coverage",
    label: "Syllabus coverage",
    score: clamp01(input.syllabusCoverage),
    weight: WEIGHTS.coverage,
    observations: Math.round(input.syllabusCoverage * input.totalObjectives),
    because: `${Math.round(input.syllabusCoverage * 100)}% of syllabus objectives have been tested at least once.`,
    nextStep: "Attempt one question on each untested objective — even a failed attempt converts an unknown into a measurement.",
  });

  // --- mastery (exam-weighted, not a plain average) ------------------------
  const totalWeight = input.topicMastery.reduce((s, t) => s + t.examWeight, 0) || 1;
  const weightedMastery =
    input.topicMastery.reduce((s, t) => s + t.mastery.score * t.examWeight, 0) / totalWeight;
  const observed = input.topicMastery.reduce((s, t) => s + t.mastery.observations, 0);
  dims.push({
    key: "mastery",
    label: "Weighted mastery",
    score: clamp01(weightedMastery),
    weight: WEIGHTS.mastery,
    observations: observed,
    because: "Mastery across topics, weighted by how many marks each topic is worth — not a flat average.",
    nextStep: "Work the highest marks-per-hour topic on your priority list.",
  });

  // --- retention -----------------------------------------------------------
  dims.push({
    key: "retention",
    label: "Retention",
    score: clamp01(input.meanRetention),
    weight: WEIGHTS.retention,
    observations: input.topicMastery.filter((t) => t.mastery.observations > 0).length,
    because: `Estimated ${Math.round(input.meanRetention * 100)}% average probability of recalling studied material cold today.`,
    nextStep: "Clear the review queue — this dimension responds within days.",
  });

  // --- application ---------------------------------------------------------
  const appRate = ratio(input.applicationRate);
  dims.push({
    key: "application",
    label: "Application",
    score: appRate.value,
    weight: WEIGHTS.application,
    observations: input.applicationRate?.available ?? 0,
    because: appRate.known
      ? `You earn ${Math.round(appRate.value * 100)}% of the application marks available in marked work.`
      : "No marked work yet that carries application marks.",
    nextStep: "Rewrite three past answers so every claim carries a number or constraint from the source material.",
  });

  // --- technique (analysis + evaluation) -----------------------------------
  const techRate = ratio(input.techniqueRate);
  dims.push({
    key: "technique",
    label: "Analysis & evaluation",
    score: techRate.value,
    weight: WEIGHTS.technique,
    observations: input.techniqueRate?.available ?? 0,
    because: techRate.known
      ? `You earn ${Math.round(techRate.value * 100)}% of the higher-order marks available.`
      : "No marked work yet that carries analysis or evaluation marks.",
    nextStep: "Drill the skill in isolation: write conclusions only, ten of them, no full essays.",
  });

  // --- timing --------------------------------------------------------------
  const timingKnown = input.timingRatio !== undefined;
  const timingScore = timingKnown ? clamp01(1 - Math.max(0, input.timingRatio! - 1) / 0.6) : 0.5;
  dims.push({
    key: "timing",
    label: "Timing",
    score: timingScore,
    weight: WEIGHTS.timing,
    observations: timingKnown ? 1 : 0,
    because: timingKnown
      ? input.timingRatio! <= 1
        ? `You finish timed work in ${Math.round(input.timingRatio! * 100)}% of the time available.`
        : `You are taking ${Math.round((input.timingRatio! - 1) * 100)}% longer than the paper allows.`
      : "No timed work recorded, so timing is assumed neutral rather than measured.",
    nextStep: "Sit one section under strict time and stop dead when the clock runs out.",
  });

  // --- consistency ---------------------------------------------------------
  const fractions = input.mocks.map((m) => m.fraction);
  const consistency =
    fractions.length >= 2
      ? clamp01(1 - stdev(fractions) / 0.25)
      : 0.5;
  dims.push({
    key: "consistency",
    label: "Consistency",
    score: consistency,
    weight: WEIGHTS.consistency,
    observations: fractions.length,
    because:
      fractions.length >= 2
        ? `Across ${fractions.length} mocks your scores vary by about ${Math.round(stdev(fractions) * 100)} percentage points.`
        : "Fewer than two mocks, so consistency is assumed neutral rather than measured.",
    nextStep: "Sit another full paper. Two data points are the minimum for a trend.",
  });

  // --- mock performance ----------------------------------------------------
  const recentMocks = input.mocks.slice(-3);
  const mockScore = recentMocks.length
    ? clamp01(recentMocks.reduce((s, m) => s + m.fraction, 0) / recentMocks.length)
    : 0;
  dims.push({
    key: "mock",
    label: "Mock performance",
    score: mockScore,
    weight: WEIGHTS.mock,
    observations: input.mocks.length,
    because: recentMocks.length
      ? `Averaging ${Math.round(mockScore * 100)}% across your last ${recentMocks.length} mock${recentMocks.length === 1 ? "" : "s"}.`
      : "No full mock papers completed. This is the strongest single predictor available, and it is missing.",
    nextStep: "Sit one full paper under real conditions. Nothing else evidences readiness as well.",
  });

  // --- aggregate -----------------------------------------------------------
  const score = clamp01(dims.reduce((s, d) => s + d.score * d.weight, 0));

  const verdict: ReadinessVerdict =
    score >= 0.85 ? "ready" : score >= 0.7 ? "almost-ready" : score >= 0.45 ? "building" : "not-ready";

  const limiting = dims.reduce<ReadinessDimension | null>((worst, d) => {
    const deficit = (1 - d.score) * d.weight;
    if (!worst) return d;
    return deficit > (1 - worst.score) * worst.weight ? d : worst;
  }, null);

  // --- honesty -------------------------------------------------------------
  if (input.mocks.length === 0)
    caveats.push("No full mock has been sat, so this figure rests entirely on question-level work. Treat it as provisional.");
  if (input.syllabusCoverage < 0.6)
    caveats.push(`Only ${Math.round(input.syllabusCoverage * 100)}% of the syllabus has been tested — untested material is assumed unlearned, not assumed fine.`);
  if (!timingKnown) caveats.push("Timing has never been measured under exam conditions.");
  caveats.push("This measures your work inside Lodestar. It cannot see revision done elsewhere, and it cannot see exam-day conditions.");

  const evidenceVolume = dims.reduce((s, d) => s + d.observations, 0);
  const confidence = clamp01(
    (Math.min(1, evidenceVolume / 120) * 0.6 +
      Math.min(1, input.mocks.length / 3) * 0.25 +
      input.syllabusCoverage * 0.15),
  );

  return { score, verdict, dimensions: dims, limitingDimension: limiting, confidence, caveats };
}

export const VERDICT_COPY: Record<ReadinessVerdict, { label: string; meaning: string }> = {
  "not-ready": { label: "Not ready", meaning: "Significant gaps remain. This is normal at this stage — the plan exists to close them." },
  building: { label: "Building", meaning: "Real foundations, incomplete coverage. Keep following the priority order." },
  "almost-ready": { label: "Almost ready", meaning: "One or two dimensions are holding you back. They are named below." },
  ready: { label: "Ready", meaning: "Coverage, recall, technique and timing all stand up. Maintain rather than expand." },
};

// ---------------------------------------------------------------------------
// Grade forecasting
// ---------------------------------------------------------------------------

export interface GradeForecast {
  /**
   * False when there is not yet enough evidence to project anything. The UI
   * must render "not enough evidence yet" rather than a grade in that case.
   *
   * This flag exists because of a real failure: with no attempts recorded, the
   * mastery model correctly reports a low score — it starts from a sceptical
   * prior — and mapping that through grade thresholds produced a confident
   * "projected U" for a student who had not yet answered a single question.
   * That is not a cautious estimate, it is a false statement, and it is exactly
   * the kind of number that makes a student stop trusting everything else on
   * the page.
   */
  sufficient: boolean;
  /** Most likely grade given current evidence, or "—" when insufficient. */
  central: string;
  /** Plausible range, e.g. ["A","A*"]. Never a single number. */
  range: [string, string];
  /** Probability the target is reached, 0..1 — always a range in the copy. */
  targetProbability: Estimate<Unit>;
  /** Predicted raw percentage, with an interval. */
  percentage: { central: number; low: number; high: number };
  method: string;
  caveats: string[];
}

/**
 * Forecast from readiness plus mock evidence.
 *
 * Method, stated plainly because a student is entitled to know how a number
 * about their future was produced:
 *
 *   1. Start from exam-weighted mastery, which is difficulty-aware.
 *   2. Shrink toward mock performance where mocks exist — real papers under
 *      real time are much better evidence than question-level practice.
 *   3. Widen the interval in proportion to how little evidence there is.
 *   4. Map the interval onto published grade thresholds where the pack has
 *      them; otherwise report percentages only and say so.
 */
/** Minimum evidence before any grade is projected at all. */
export const MIN_OBSERVATIONS_FOR_FORECAST = 8;

export function forecastGrade(
  readiness: Readiness,
  input: ReadinessInput,
  syllabus: Syllabus,
  targetGrade: string,
): GradeForecast {
  const masteryDim = readiness.dimensions.find((d) => d.key === "mastery")!;
  const caveats = [...readiness.caveats];

  // Refuse to project from nothing. A prior is not a measurement, and
  // presenting one as a predicted grade is worse than showing no grade.
  const observations = masteryDim.observations;
  if (observations < MIN_OBSERVATIONS_FOR_FORECAST && input.mocks.length === 0) {
    const need = MIN_OBSERVATIONS_FOR_FORECAST - observations;
    return {
      sufficient: false,
      central: "—",
      range: ["—", "—"],
      targetProbability: estimate(
        0,
        0,
        [
          observations === 0
            ? "No questions have been answered yet, so there is nothing to project from."
            : `Only ${observations} question${observations === 1 ? " has" : "s have"} been answered. About ${need} more will produce a first estimate.`,
          "Lodestar will not turn a starting assumption into a predicted grade — that would be a statement about your future made from no evidence.",
        ],
        observations,
      ),
      percentage: { central: 0, low: 0, high: 0 },
      method: "Not enough evidence to forecast.",
      caveats: [
        "No grade is being projected because too little work has been recorded.",
        "Answer and self-mark a handful of questions, and a projection with a range will appear.",
      ],
    };
  }

  const mocks = input.mocks.slice(-3);
  const mockMean = mocks.length ? mocks.reduce((s, m) => s + m.fraction, 0) / mocks.length : null;

  // Question-level practice systematically overestimates exam performance:
  // no time pressure, no unfamiliar case, no fatigue. Discount it.
  const practiceProxy = clamp01(masteryDim.score * 0.86);

  const mockWeight = mocks.length === 0 ? 0 : mocks.length === 1 ? 0.5 : mocks.length === 2 ? 0.68 : 0.8;
  const central = mockMean === null ? practiceProxy : practiceProxy * (1 - mockWeight) + mockMean * mockWeight;

  // Interval width falls as evidence accumulates. Never narrower than ±4 points.
  const width = Math.max(0.04, 0.2 * (1 - readiness.confidence) + 0.04);
  const low = clamp01(central - width);
  const high = clamp01(central + width);

  const thresholds = pickThresholds(syllabus);
  const gradeAt = (pct: Unit) => gradeFromPercentage(pct, thresholds, syllabus);

  const centralGrade = gradeAt(central);
  const lowGrade = gradeAt(low);
  const highGrade = gradeAt(high);

  const scale = qualificationGradeScale(syllabus);
  const targetIdx = scale.indexOf(targetGrade);
  const centralIdx = scale.indexOf(centralGrade);

  // Probability of hitting target: how much of the interval sits at or above it.
  let p = 0.5;
  if (targetIdx !== -1 && centralIdx !== -1) {
    const thresholdPct = percentageForGrade(targetGrade, thresholds);
    if (thresholdPct !== null) {
      // Treat the interval as roughly normal with sd = width/1.6.
      const sd = Math.max(0.02, width / 1.6);
      p = clamp01(1 - normalCdf((thresholdPct - central) / sd));
    } else {
      p = centralIdx <= targetIdx ? 0.6 : 0.3;
    }
  }

  if (!thresholds.length) {
    caveats.push(
      "No official grade thresholds are loaded for this syllabus, so grades are approximated from percentage bands. Load real thresholds for a sharper estimate.",
    );
  } else {
    caveats.push(
      "Grades are mapped using historical thresholds. Thresholds move every session — they are a guide, never a promise.",
    );
  }
  caveats.push("This is a projection from your recorded work, not a prediction of your result.");

  return {
    sufficient: true,
    central: centralGrade,
    range: [lowGrade, highGrade],
    targetProbability: estimate(
      p,
      readiness.confidence,
      [
        `Central estimate ${Math.round(central * 100)}%, plausible range ${Math.round(low * 100)}–${Math.round(high * 100)}%.`,
        mocks.length
          ? `Weighted ${Math.round(mockWeight * 100)}% toward your ${mocks.length} recent mock${mocks.length === 1 ? "" : "s"}, which are better evidence than untimed practice.`
          : "No mocks recorded, so this rests on question-level practice, which flatters real exam performance.",
        `Interval width reflects ${Math.round(readiness.confidence * 100)}% evidence confidence.`,
      ],
      masteryDim.observations,
    ),
    percentage: {
      central: Math.round(central * 100),
      low: Math.round(low * 100),
      high: Math.round(high * 100),
    },
    method:
      "Exam-weighted mastery, discounted for exam conditions, shrunk toward mock performance, mapped through published grade thresholds.",
    caveats,
  };
}

function pickThresholds(syllabus: Syllabus): GradeThreshold[] {
  return syllabus.gradeThresholds ?? [];
}

export function qualificationGradeScale(syllabus: Syllabus): string[] {
  const fromThresholds = syllabus.gradeThresholds?.[0]
    ? Object.keys(syllabus.gradeThresholds[0].thresholds)
    : [];
  if (fromThresholds.length) return fromThresholds;
  return ["A*", "A", "B", "C", "D", "E", "U"];
}

/** Average threshold percentage for a grade across loaded sessions. */
export function percentageForGrade(grade: string, thresholds: GradeThreshold[]): number | null {
  const values = thresholds
    .map((t) => {
      const mark = t.thresholds[grade];
      return mark !== undefined && t.maxMark > 0 ? mark / t.maxMark : null;
    })
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function gradeFromPercentage(
  pct: Unit,
  thresholds: GradeThreshold[],
  syllabus: Syllabus,
): string {
  const scale = qualificationGradeScale(syllabus);
  if (thresholds.length) {
    for (const grade of scale) {
      const t = percentageForGrade(grade, thresholds);
      if (t !== null && pct >= t) return grade;
    }
    return scale[scale.length - 1] ?? "U";
  }
  // Fallback bands, clearly approximate.
  const bands: [number, string][] = [
    [0.8, "A*"], [0.7, "A"], [0.6, "B"], [0.5, "C"], [0.4, "D"], [0.3, "E"],
  ];
  for (const [min, g] of bands) if (pct >= min) return g;
  return "U";
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ratio(r?: { earned: number; available: number }): { value: Unit; known: boolean } {
  if (!r || r.available === 0) return { value: 0, known: false };
  return { value: clamp01(r.earned / r.available), known: true };
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Abramowitz–Stegun approximation; adequate for a UI-facing probability. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
