/**
 * Validating a diagnostic before a student sits it.
 *
 * A diagnostic is not a small exam. Its job is to tell apart several possible reasons
 * a student is going wrong, and a question every hypothesis answers the same way tells
 * us nothing while costing them a minute. That is measurable — expected information
 * gain, in bits — so it is measured here rather than trusted.
 *
 * This mirrors `tools/learning-sim/slatelearn/eig.py` and `SlateLearning`'s
 * `InformationGain`. The device runs the adaptive selection; the gateway's job is to
 * refuse to ship a set that cannot discriminate at all.
 */

const EPS = 1e-12;

export interface Hypothesis {
  id: string;
  label: string;
  prior: number;
  conceptIds: string[];
}

export interface Discrimination {
  hypothesisId: string;
  responses: Array<{ category: string; probability: number }>;
}

export interface DiagnosticQuestion {
  prompt: string;
  acceptableAnswers: string[];
  answerShape: string;
  workedSolution: string[];
  conceptIds: string[];
  difficulty: string;
  marks: number;
  unit?: string;
  significantFigures?: number;
  discriminates?: Discrimination[];
}

export interface DiagnosticProblem {
  code:
    | "noDiscrimination" | "missingHypothesis" | "probabilitiesDoNotSum"
    | "tooFewResponses" | "uninformative";
  detail: string;
}

/** Shannon entropy in bits. */
export function entropy(distribution: number[]): number {
  let h = 0;
  for (const p of distribution) if (p > EPS) h -= p * Math.log2(p);
  return h;
}

function normalise(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const keys = Object.keys(weights);
  if (total <= EPS) {
    const even = keys.length ? 1 / keys.length : 0;
    return Object.fromEntries(keys.map((k) => [k, even]));
  }
  return Object.fromEntries(keys.map((k) => [k, weights[k]! / total]));
}

export function priorMap(hypotheses: readonly Hypothesis[]): Record<string, number> {
  return normalise(Object.fromEntries(hypotheses.map((h) => [h.id, Math.max(0, h.prior)])));
}

function likelihoods(question: DiagnosticQuestion): Record<string, Record<string, number>> {
  const table: Record<string, Record<string, number>> = {};
  for (const entry of question.discriminates ?? []) {
    table[entry.hypothesisId] = Object.fromEntries(
      entry.responses.map((r) => [r.category, r.probability]),
    );
  }
  return table;
}

/** Bits of uncertainty about the cause this question is expected to remove. */
export function expectedInformationGain(
  prior: Record<string, number>,
  question: DiagnosticQuestion,
): number {
  const table = likelihoods(question);
  const categories = [...new Set(Object.values(table).flatMap((t) => Object.keys(t)))];
  if (categories.length < 2) return 0;

  const hPrior = entropy(Object.values(prior));
  let hPost = 0;

  for (const category of categories) {
    const marginal = Object.entries(prior)
      .reduce((sum, [h, p]) => sum + p * (table[h]?.[category] ?? 0), 0);
    if (marginal <= EPS) continue;
    const posterior = normalise(Object.fromEntries(
      Object.entries(prior).map(([h, p]) => [h, p * (table[h]?.[category] ?? 0)]),
    ));
    hPost += marginal * entropy(Object.values(posterior));
  }
  return Math.max(0, hPrior - hPost);
}

/** How much of the uncertainty the whole set could remove, if every question landed. */
export function bestAchievableGain(
  hypotheses: readonly Hypothesis[],
  questions: readonly DiagnosticQuestion[],
): number {
  const prior = priorMap(hypotheses);
  return Math.max(0, ...questions.map((q) => expectedInformationGain(prior, q)));
}

export interface ValidatedDiagnostic {
  hypotheses: Hypothesis[];
  questions: DiagnosticQuestion[];
  rejected: Array<{ prompt: string; problems: DiagnosticProblem[] }>;
  priorEntropyBits: number;
  bestQuestionBits: number;
  ok: boolean;
}

/**
 * A question must remove at least this much uncertainty to be worth a student's time.
 *
 * A tenth of a bit is a low bar deliberately: it rejects the genuinely useless while
 * keeping questions that only partly separate the hypotheses, which is most real ones.
 */
export const MIN_GAIN_BITS = 0.1;

export function validateDiagnostic(
  hypotheses: readonly Hypothesis[],
  questions: readonly DiagnosticQuestion[],
): ValidatedDiagnostic {
  const prior = priorMap(hypotheses);
  const ids = new Set(hypotheses.map((h) => h.id));
  const accepted: DiagnosticQuestion[] = [];
  const rejected: ValidatedDiagnostic["rejected"] = [];

  for (const question of questions) {
    const problems: DiagnosticProblem[] = [];
    const entries = question.discriminates ?? [];

    if (entries.length === 0) {
      problems.push({
        code: "noDiscrimination",
        detail: "The question says nothing about how each hypothesis would answer it.",
      });
    }

    for (const entry of entries) {
      if (!ids.has(entry.hypothesisId)) {
        problems.push({
          code: "missingHypothesis",
          detail: `Refers to a hypothesis that is not in the set: ${entry.hypothesisId}.`,
        });
      }
      if (entry.responses.length < 2) {
        problems.push({
          code: "tooFewResponses",
          detail: "A response distribution needs at least two possible answers.",
        });
      }
      const total = entry.responses.reduce((sum, r) => sum + r.probability, 0);
      if (Math.abs(total - 1) > 0.05) {
        problems.push({
          code: "probabilitiesDoNotSum",
          detail: `Probabilities for ${entry.hypothesisId} sum to ${total.toFixed(3)}, not 1.`,
        });
      }
    }

    // Every hypothesis must be covered, or the question cannot separate the ones it
    // left out from the ones it described.
    const covered = new Set(entries.map((e) => e.hypothesisId));
    for (const id of ids) {
      if (!covered.has(id)) {
        problems.push({
          code: "missingHypothesis",
          detail: `Does not say how "${id}" would answer, so it cannot rule it out.`,
        });
        break;
      }
    }

    if (problems.length === 0) {
      const gain = expectedInformationGain(prior, question);
      if (gain < MIN_GAIN_BITS) {
        problems.push({
          code: "uninformative",
          detail: `Expected to remove only ${gain.toFixed(3)} bits. Every hypothesis answers it much the same way.`,
        });
      }
    }

    if (problems.length === 0) accepted.push(question);
    else rejected.push({ prompt: question.prompt, problems });
  }

  return {
    hypotheses: [...hypotheses],
    questions: accepted,
    rejected,
    priorEntropyBits: entropy(Object.values(prior)),
    bestQuestionBits: accepted.length ? bestAchievableGain(hypotheses, accepted) : 0,
    // A diagnostic with nothing that discriminates is worse than no diagnostic: it
    // takes six minutes and returns a conclusion it did not earn.
    ok: accepted.length > 0,
  };
}
