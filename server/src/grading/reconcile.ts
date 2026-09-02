/**
 * When the grader and the model disagree, the grader wins.
 *
 * This is the rule that makes "AI marked my homework" trustworthy. A language model
 * asked whether `-3/2` equals `-1.5` is usually right and occasionally not, and the
 * student cannot tell which run they got. Arithmetic can tell, every time, so
 * arithmetic decides the verdict and the model is left to do the part it is actually
 * better at: explaining what went wrong and what to do next.
 */

import type { GradeResult, Verdict } from "./grade.ts";

export interface ModelJudgement {
  verdict: "correct" | "partiallyCorrect" | "incorrect" | "unclear";
  whatIsRight: string;
  whatToFix: string;
  errorType: string;
  errorConfidence: number;
  conceptIds: string[];
  suggestedAssistance: string;
  nextAction: { kind: string; label: string; conceptId?: string };
  firstProblemStep?: number;
}

export interface ReconciledCheck extends ModelJudgement {
  verdict: "correct" | "partiallyCorrect" | "incorrect" | "unclear";
  /** Which component decided the verdict, surfaced so the UI can be honest about it. */
  decidedBy: "grader" | "model" | "agreement";
  /** True when the model's verdict was discarded. Logged; a spike here means a problem. */
  modelOverruled: boolean;
  graderReason: string | null;
  confidence: number;
}

export function reconcile(grader: GradeResult, model: ModelJudgement): ReconciledCheck {
  // The grader abstained: essays, prose, diagrams, unreadable input. The model is the
  // only judge available, and its confidence is reported rather than dressed up.
  if (grader.verdict === "abstain") {
    return {
      ...model,
      decidedBy: "model",
      modelOverruled: false,
      graderReason: grader.reason,
      confidence: Math.min(model.errorConfidence, 0.85),
    };
  }

  const graderVerdict = grader.verdict as Verdict & ModelJudgement["verdict"];
  const agrees = model.verdict === graderVerdict;

  if (agrees) {
    return {
      ...model,
      decidedBy: "agreement",
      modelOverruled: false,
      graderReason: grader.reason,
      confidence: 1,
    };
  }

  // Disagreement. Keep the model's teaching, replace its verdict, and repair the
  // parts of its explanation that only made sense under the verdict we just discarded.
  const corrected: ReconciledCheck = {
    ...model,
    verdict: graderVerdict,
    decidedBy: "grader",
    modelOverruled: true,
    graderReason: grader.reason,
    confidence: 1,
  };

  if (graderVerdict === "correct") {
    corrected.whatToFix = "";
    corrected.errorType = "unknown";
    corrected.errorConfidence = 0;
    corrected.whatIsRight = model.whatIsRight ||
      "This is right. It is written differently from the model answer, which is fine.";
    corrected.nextAction = { kind: "moveOn", label: "Next question" };
    delete corrected.firstProblemStep;
  }

  // The grader worked out *how* it missed. That beats a model's guess at the cause,
  // so it replaces the error classification rather than sitting beside it.
  if (graderVerdict !== "correct" && grader.nearMiss) {
    corrected.errorType = grader.nearMiss.suggestedErrorType;
    corrected.errorConfidence = 0.9;
    corrected.whatToFix = grader.nearMiss.detail;
  }

  return corrected;
}

/**
 * Even when they agree on the verdict, a near miss the grader identified is more
 * specific than anything the model inferred, so it is promoted.
 */
export function enrich(check: ReconciledCheck, grader: GradeResult): ReconciledCheck {
  if (!grader.nearMiss || check.verdict === "correct") return check;
  return {
    ...check,
    errorType: grader.nearMiss.suggestedErrorType,
    errorConfidence: Math.max(check.errorConfidence, 0.9),
    whatToFix: check.whatToFix.includes(grader.nearMiss.detail)
      ? check.whatToFix
      : `${grader.nearMiss.detail} ${check.whatToFix}`.trim(),
  };
}
