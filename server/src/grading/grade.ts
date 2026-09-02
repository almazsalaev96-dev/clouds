/**
 * The deterministic grader.
 *
 * This runs *before* any model call and its verdict is authoritative for anything
 * numeric, algebraic or dimensional. The model is asked why an answer is wrong and how
 * to teach it, never whether it is wrong when this module already knows.
 *
 * It also reports *how* the answer missed — sign flipped, factor of ten, degrees for
 * radians, right number wrong unit. That single field turns a generic "incorrect" into
 * a specific piece of teaching, and it does so without a model guessing.
 */

import { type Node, isRelation, toText, variables } from "./ast.ts";
import { equationsEquivalent, equivalent, type EquivalenceResult } from "./equivalence.ts";
import { tryEvaluate } from "./evaluate.ts";
import { tryParse } from "./parse.ts";
import { parseUnit, sameDimension, splitQuantity, type Unit } from "./units.ts";

export type AnswerShape =
  | "number" | "quantity" | "expression" | "equation" | "set" | "boolean" | "text";

export type Verdict = "correct" | "partiallyCorrect" | "incorrect" | "abstain";

export interface ExpectedAnswer {
  text: string;
  shape?: AnswerShape;
  /** Declared separately when the question demands a unit the answer text omits. */
  unit?: string;
  requireUnit?: boolean;
  tolerance?: { relative?: number; absolute?: number };
  significantFigures?: number;
}

export interface NearMiss {
  kind:
    | "signFlipped" | "reciprocal" | "offByFactor" | "squared" | "squareRooted"
    | "degreesForRadians" | "radiansForDegrees" | "roundingOnly"
    | "rightNumberWrongUnit" | "missingUnit" | "unitMismatch";
  detail: string;
  /** What to tell the model, in its own vocabulary, so classification is not guesswork. */
  suggestedErrorType:
    | "calculation" | "procedural" | "misconception" | "careless" | "interpretation";
}

export interface GradeResult {
  verdict: Verdict;
  matchedIndex: number | null;
  /** 1.0 when decided by arithmetic; lower only when the grader is unsure. */
  confidence: number;
  reason: string;
  nearMiss: NearMiss | null;
  normalisedSubmitted: string;
  parsed: boolean;
  detail?: Record<string, unknown>;
}

const abstain = (reason: string, submitted: string, parsed = false): GradeResult => ({
  verdict: "abstain", matchedIndex: null, confidence: 0, reason,
  nearMiss: null, normalisedSubmitted: submitted, parsed,
});

function inferShape(expectedText: string, declared?: AnswerShape): AnswerShape {
  if (declared) return declared;
  const p = tryParse(expectedText);
  if (!p.ok) return "text";
  if (p.node.kind === "list") return "set";
  if (isRelation(p.node)) return "equation";
  if (variables(p.node).size === 0) return "number";
  return "expression";
}

/** `x = 2, x = -3` and `2, -3` and `{2, -3}` are the same solution set. */
function asSolutionSet(node: Node): Node[] {
  const items = node.kind === "list" ? node.items : [node];
  return items.map((it) =>
    isRelation(it) && it.op === "=" && it.left.kind === "var" ? it.right : it);
}

function setsEquivalent(a: Node[], b: Node[], opts: object): EquivalenceResult {
  if (a.length !== b.length) {
    return {
      equivalent: false, decided: true, validSamples: 0, maxRelativeDifference: NaN,
      reason: `expected ${a.length} value(s), got ${b.length}`,
    };
  }
  const unmatched = [...b];
  for (const want of a) {
    const idx = unmatched.findIndex((got) => equivalent(want, got, opts).equivalent);
    if (idx < 0) {
      return {
        equivalent: false, decided: true, validSamples: 0, maxRelativeDifference: NaN,
        reason: `no submitted value matches ${toText(want)}`,
      };
    }
    unmatched.splice(idx, 1);
  }
  return {
    equivalent: true, decided: true, validSamples: a.length, maxRelativeDifference: 0,
    reason: "same set of values, order ignored",
  };
}

const FACTORS: Array<[number, string]> = [
  [10, "ten"], [100, "a hundred"], [1000, "a thousand"],
  [0.1, "a tenth"], [0.01, "a hundredth"], [0.001, "a thousandth"],
  [2, "two"], [0.5, "a half"], [60, "sixty"], [1 / 60, "a sixtieth"],
  [3600, "3600"], [1 / 3600, "1/3600"],
];

/** Why did it miss? Answered by arithmetic, not by asking a model to speculate. */
function findNearMiss(want: Node, got: Node, opts: object): NearMiss | null {
  const t = (n: Node, f: (x: Node) => Node) => f(n);
  const neg = (n: Node): Node => ({ kind: "neg", arg: n });
  const scale = (n: Node, k: number): Node =>
    ({ kind: "bin", op: "*", left: { kind: "num", value: k }, right: n });
  const recip = (n: Node): Node =>
    ({ kind: "bin", op: "/", left: { kind: "num", value: 1 }, right: n });
  const sq = (n: Node): Node =>
    ({ kind: "bin", op: "^", left: n, right: { kind: "num", value: 2 } });
  const rt = (n: Node): Node => ({ kind: "call", name: "sqrt", args: [n] });

  if (equivalent(want, t(got, neg), opts).equivalent) {
    return {
      kind: "signFlipped",
      detail: "The magnitude is right and the sign is wrong.",
      suggestedErrorType: "careless",
    };
  }
  for (const [k, word] of FACTORS) {
    if (equivalent(want, scale(got, k), opts).equivalent) {
      return {
        kind: k === Math.PI / 180 ? "degreesForRadians" : "offByFactor",
        detail: `Out by a factor of ${word}.`,
        suggestedErrorType: k === 10 || k === 100 || k === 1000 || k === 0.1
          ? "calculation" : "procedural",
      };
    }
  }
  if (equivalent(want, scale(got, Math.PI / 180), opts).equivalent) {
    return {
      kind: "degreesForRadians",
      detail: "The value is in degrees where radians were needed.",
      suggestedErrorType: "procedural",
    };
  }
  if (equivalent(want, scale(got, 180 / Math.PI), opts).equivalent) {
    return {
      kind: "radiansForDegrees",
      detail: "The value is in radians where degrees were needed.",
      suggestedErrorType: "procedural",
    };
  }
  if (equivalent(want, recip(got), opts).equivalent) {
    return {
      kind: "reciprocal",
      detail: "The answer is the reciprocal of the right one, so the fraction is inverted.",
      suggestedErrorType: "procedural",
    };
  }
  if (equivalent(want, sq(got), opts).equivalent) {
    return {
      kind: "squareRooted",
      detail: "A square root was taken that should not have been, or one step is missing.",
      suggestedErrorType: "procedural",
    };
  }
  if (equivalent(want, rt(got), opts).equivalent) {
    return {
      kind: "squared",
      detail: "The result was squared, or a square root was not taken.",
      suggestedErrorType: "procedural",
    };
  }
  return null;
}

function significantFigures(x: number): number {
  if (x === 0) return 1;
  const s = Math.abs(x).toExponential(15);
  const mantissa = s.slice(0, s.indexOf("e")).replace(".", "").replace(/0+$/, "");
  return Math.max(1, mantissa.length);
}

function roundToSigFigs(x: number, sf: number): number {
  if (x === 0) return 0;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const f = Math.pow(10, sf - 1 - mag);
  return Math.round(x * f) / f;
}

function gradeOne(submitted: string, expected: ExpectedAnswer): GradeResult {
  const shape = inferShape(expected.text, expected.shape);
  if (shape === "text") return abstain("free text is not decidable by arithmetic", submitted);

  if (shape === "boolean") {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[.!]$/, "");
    const yes = new Set(["true", "yes", "t", "y", "1"]);
    const no = new Set(["false", "no", "f", "n", "0"]);
    const w = norm(expected.text), g = norm(submitted);
    const wv = yes.has(w) ? true : no.has(w) ? false : null;
    const gv = yes.has(g) ? true : no.has(g) ? false : null;
    if (wv === null || gv === null) return abstain("not a yes/no answer", submitted);
    return {
      verdict: wv === gv ? "correct" : "incorrect",
      matchedIndex: wv === gv ? 0 : null, confidence: 1,
      reason: wv === gv ? "matches" : "opposite answer",
      nearMiss: null, normalisedSubmitted: g, parsed: true,
    };
  }

  const tol = {
    relativeTolerance: expected.tolerance?.relative ?? 1e-9,
    absoluteTolerance: expected.tolerance?.absolute ?? 1e-12,
  };

  // --- units -------------------------------------------------------------
  const wantsUnit = Boolean(expected.unit) || shape === "quantity";
  let submittedText = submitted;
  let expectedText = expected.text;
  let unitNote: NearMiss | null = null;

  if (wantsUnit) {
    const gotQ = splitQuantity(submitted);
    const wantQ = splitQuantity(expected.text);
    const wantUnitText = expected.unit ?? wantQ.unitText;
    const wantUnit: Unit | null = wantUnitText ? parseUnit(wantUnitText) : null;
    const gotUnit: Unit | null = gotQ.unitText ? parseUnit(gotQ.unitText) : null;

    if (wantUnit && !gotUnit) {
      if (expected.requireUnit !== false) {
        unitNote = {
          kind: "missingUnit",
          detail: `The number needs a unit (${wantUnitText}).`,
          suggestedErrorType: "careless",
        };
      }
    } else if (wantUnit && gotUnit) {
      if (!sameDimension(wantUnit.dim, gotUnit.dim)) {
        // A wrong dimension is a wrong answer, not a presentation slip: m/s and m/s^2
        // describe different physical quantities however right the number looks.
        return {
          verdict: "incorrect", matchedIndex: null, confidence: 1,
          reason: `${gotQ.unitText} does not measure the same quantity as ${wantUnitText}`,
          nearMiss: {
            kind: "unitMismatch",
            detail: `The unit measures the wrong quantity (${gotQ.unitText} for ${wantUnitText}).`,
            suggestedErrorType: "misconception",
          },
          normalisedSubmitted: submitted, parsed: true,
        };
      } else {
        // Same dimension, possibly different scale: compare in SI.
        const wv = tryParse(wantQ.magnitudeText);
        const gv = tryParse(gotQ.magnitudeText);
        if (wv.ok && gv.ok) {
          const a = tryEvaluate(wv.node, {});
          const b = tryEvaluate(gv.node, {});
          if (a.ok && b.ok) {
            const si1 = a.value * wantUnit.factor;
            const si2 = b.value * gotUnit.factor;
            const same = Math.abs(si1 - si2) <=
              Math.max(tol.absoluteTolerance, tol.relativeTolerance * Math.max(Math.abs(si1), Math.abs(si2)));
            if (same) {
              return {
                verdict: "correct", matchedIndex: 0, confidence: 1,
                reason: `equal after converting ${gotQ.unitText} to ${wantUnitText}`,
                nearMiss: null, normalisedSubmitted: submitted, parsed: true,
                detail: { siValue: si2 },
              };
            }
            const nm = Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(a.value))
              ? {
                  kind: "rightNumberWrongUnit" as const,
                  detail: `The number is right but ${gotQ.unitText} is not ${wantUnitText}.`,
                  suggestedErrorType: "procedural" as const,
                }
              : null;
            return {
              verdict: "incorrect", matchedIndex: null, confidence: 1,
              reason: `${si2} does not equal ${si1} in base units`,
              nearMiss: nm, normalisedSubmitted: submitted, parsed: true,
            };
          }
        }
      }
    }
    submittedText = gotQ.unitText ? gotQ.magnitudeText : submitted;
    expectedText = wantQ.unitText ? wantQ.magnitudeText : expected.text;
  }

  // --- structure ---------------------------------------------------------
  const want = tryParse(expectedText);
  if (!want.ok) return abstain(`the expected answer did not parse: ${want.error}`, submitted);
  const got = tryParse(submittedText);
  if (!got.ok) {
    return abstain(`could not read the answer: ${got.error}`, submitted);
  }

  let result: EquivalenceResult;
  if (shape === "set" || want.node.kind === "list" || got.node.kind === "list") {
    result = setsEquivalent(asSolutionSet(want.node), asSolutionSet(got.node), tol);
  } else if (isRelation(want.node) && isRelation(got.node)) {
    result = equationsEquivalent(want.node, got.node, tol);
  } else if (isRelation(want.node) !== isRelation(got.node)) {
    // `x = 5` answered as `5` is right in spirit and the student should be told so
    // rather than marked wrong for punctuation.
    const wantSide = isRelation(want.node) ? asSolutionSet(want.node) : [want.node];
    const gotSide = isRelation(got.node) ? asSolutionSet(got.node) : [got.node];
    result = setsEquivalent(wantSide, gotSide, tol);
  } else {
    result = equivalent(want.node, got.node, tol);
  }

  if (!result.decided) {
    return abstain(`could not decide: ${result.reason}`, submitted, true);
  }

  if (result.equivalent) {
    if (unitNote) {
      return {
        verdict: "partiallyCorrect", matchedIndex: 0, confidence: 1,
        reason: unitNote.detail, nearMiss: unitNote,
        normalisedSubmitted: submitted, parsed: true,
      };
    }
    // Significant figures are checked only after the value is already right.
    if (expected.significantFigures && variables(got.node).size === 0) {
      const gv = tryEvaluate(got.node, {});
      const wv = tryEvaluate(want.node, {});
      if (gv.ok && wv.ok) {
        const sf = significantFigures(gv.value);
        if (sf < expected.significantFigures &&
            roundToSigFigs(wv.value, expected.significantFigures) !== gv.value) {
          return {
            verdict: "partiallyCorrect", matchedIndex: 0, confidence: 1,
            reason: `rounded to ${sf} significant figures, ${expected.significantFigures} required`,
            nearMiss: {
              kind: "roundingOnly",
              detail: `Give the answer to ${expected.significantFigures} significant figures.`,
              suggestedErrorType: "careless",
            },
            normalisedSubmitted: submitted, parsed: true,
          };
        }
      }
    }
    return {
      verdict: "correct", matchedIndex: 0, confidence: 1, reason: result.reason,
      nearMiss: null, normalisedSubmitted: submitted, parsed: true,
    };
  }

  const near = unitNote ?? findNearMiss(want.node, got.node, tol);
  return {
    verdict: "incorrect", matchedIndex: null, confidence: 1, reason: result.reason,
    nearMiss: near, normalisedSubmitted: submitted, parsed: true,
    detail: { maxRelativeDifference: result.maxRelativeDifference },
  };
}

/**
 * Grade against any-of a list of acceptable answers. The best outcome across the list
 * wins: a student who matched the second acceptable form is simply correct.
 */
export function grade(submitted: string, expected: ExpectedAnswer[]): GradeResult {
  if (!submitted.trim()) {
    return { ...abstain("nothing was submitted", submitted), reason: "nothing was submitted" };
  }
  if (expected.length === 0) return abstain("no expected answer was supplied", submitted);

  const rank: Record<Verdict, number> = {
    correct: 3, partiallyCorrect: 2, incorrect: 1, abstain: 0,
  };
  let best: GradeResult | null = null;
  let bestIndex = 0;
  expected.forEach((e, i) => {
    const r = gradeOne(submitted, e);
    if (!best || rank[r.verdict] > rank[best.verdict]) { best = r; bestIndex = i; }
  });
  const out = best!;
  return { ...out, matchedIndex: out.verdict === "abstain" ? null : bestIndex };
}
