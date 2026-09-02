/**
 * Are two answers the same answer?
 *
 * Symbolic equality is undecidable in general and a full CAS is a large dependency, so
 * this decides by **evaluation at many points**: two expressions that agree to machine
 * precision at dozens of independently chosen points are equal for every purpose a
 * marker cares about. The probability of two genuinely different school-level
 * expressions agreeing at 24 random points is negligible.
 *
 * Sampling is seeded from the expressions themselves, so grading the same pair twice
 * always gives the same verdict. A grader that is occasionally lenient is worse than a
 * strict one, because the student cannot learn what it wants.
 */

import { type Node, variables } from "./ast.ts";
import { tryEvaluate } from "./evaluate.ts";

export interface EquivalenceOptions {
  /** Relative tolerance for agreement at a sample point. */
  relativeTolerance?: number;
  absoluteTolerance?: number;
  samples?: number;
  /** Minimum points at which both sides had to be defined for a verdict. */
  minValidSamples?: number;
  range?: number;
}

export interface EquivalenceResult {
  equivalent: boolean;
  /** False when too few points were in both domains to be sure either way. */
  decided: boolean;
  validSamples: number;
  maxRelativeDifference: number;
  reason: string;
}

const DEFAULTS = {
  relativeTolerance: 1e-9,
  absoluteTolerance: 1e-12,
  samples: 64,
  minValidSamples: 12,
  range: 4.0,
};

/** mulberry32 — small, fast, and identical across runs and platforms. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function close(a: number, b: number, relTol: number, absTol: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  if (diff <= absTol) return true;
  return diff <= relTol * Math.max(Math.abs(a), Math.abs(b));
}

/**
 * Sample points avoid the integers where school expressions most often agree by
 * coincidence (x=0, x=1, x=-1), and include a few larger magnitudes so that a wrong
 * constant term or a wrong power cannot hide.
 */
function samplePoints(vars: string[], count: number, seed: number, range: number): Env[] {
  const rnd = seeded(seed);
  const out: Env[] = [];
  for (let i = 0; i < count; i++) {
    const env: Record<string, number> = {};
    const scale = i % 8 === 7 ? range * 25 : i % 4 === 3 ? range * 5 : range;
    for (const name of vars) {
      let x = (rnd() * 2 - 1) * scale;
      if (Math.abs(x) < 0.2) x += x >= 0 ? 0.7 : -0.7;
      if (i % 5 === 4) x = Math.abs(x); // keep some points inside sqrt/log domains
      env[name] = x;
    }
    out.push(env);
  }
  return out;
}

type Env = Readonly<Record<string, number>>;

export function equivalent(a: Node, b: Node, opts: EquivalenceOptions = {}): EquivalenceResult {
  const o = { ...DEFAULTS, ...opts };
  const vars = [...new Set([...variables(a), ...variables(b)])].sort();

  if (vars.length === 0) {
    const va = tryEvaluate(a, {});
    const vb = tryEvaluate(b, {});
    if (!va.ok || !vb.ok) {
      return {
        equivalent: false, decided: false, validSamples: 0, maxRelativeDifference: NaN,
        reason: !va.ok
          ? `expected side: ${va.reason}`
          : `student side: ${!vb.ok ? vb.reason : "undefined"}`,
      };
    }
    const same = close(va.value, vb.value, o.relativeTolerance, o.absoluteTolerance);
    const denom = Math.max(Math.abs(va.value), Math.abs(vb.value), 1e-300);
    return {
      equivalent: same, decided: true, validSamples: 1,
      maxRelativeDifference: Math.abs(va.value - vb.value) / denom,
      reason: same ? "numerically equal" : "different values",
    };
  }

  const seed = hash(vars.join(",")) ^ 0x5eed;
  const points = samplePoints(vars, o.samples, seed, o.range);
  let valid = 0;
  let worst = 0;
  let firstDisagreement = "";

  for (const env of points) {
    const va = tryEvaluate(a, env);
    const vb = tryEvaluate(b, env);
    if (!va.ok || !vb.ok) continue; // outside one domain: says nothing either way
    valid++;
    if (!close(va.value, vb.value, o.relativeTolerance, o.absoluteTolerance)) {
      const denom = Math.max(Math.abs(va.value), Math.abs(vb.value), 1e-300);
      const rel = Math.abs(va.value - vb.value) / denom;
      worst = Math.max(worst, rel);
      if (!firstDisagreement) {
        const at = vars.map((k) => `${k}=${env[k]!.toFixed(4)}`).join(", ");
        firstDisagreement = `differs at ${at}: ${va.value} vs ${vb.value}`;
      }
    }
  }

  if (valid < o.minValidSamples) {
    return {
      equivalent: false, decided: false, validSamples: valid, maxRelativeDifference: worst,
      reason: `only ${valid} of ${o.samples} sample points were defined for both sides`,
    };
  }
  if (firstDisagreement) {
    return {
      equivalent: false, decided: true, validSamples: valid, maxRelativeDifference: worst,
      reason: firstDisagreement,
    };
  }
  return {
    equivalent: true, decided: true, validSamples: valid, maxRelativeDifference: 0,
    reason: `agreed at all ${valid} defined sample points`,
  };
}

/**
 * Equations are equal when one is a non-zero multiple of the other.
 * `2x + 4 = 0` and `x + 2 = 0` are the same equation; `x = 2` and `x = 3` are not.
 */
export function equationsEquivalent(
  a: Extract<Node, { kind: "rel" }>,
  b: Extract<Node, { kind: "rel" }>,
  opts: EquivalenceOptions = {},
): EquivalenceResult {
  const o = { ...DEFAULTS, ...opts };
  if (a.op !== b.op) {
    return {
      equivalent: false, decided: true, validSamples: 0, maxRelativeDifference: NaN,
      reason: `different relations: ${a.op} vs ${b.op}`,
    };
  }
  const fa: Node = { kind: "bin", op: "-", left: a.left, right: a.right };
  const fb: Node = { kind: "bin", op: "-", left: b.left, right: b.right };

  // Identical residuals is the common case and needs no ratio reasoning.
  const direct = equivalent(fa, fb, opts);
  if (direct.equivalent) return direct;

  const vars = [...new Set([...variables(fa), ...variables(fb)])].sort();
  if (vars.length === 0) return direct;

  const points = samplePoints(vars, o.samples, hash(vars.join(",")) ^ 0xe0a7, o.range);
  let ratio: number | null = null;
  let valid = 0;
  for (const env of points) {
    const va = tryEvaluate(fa, env);
    const vb = tryEvaluate(fb, env);
    if (!va.ok || !vb.ok) continue;
    if (Math.abs(va.value) < 1e-12 && Math.abs(vb.value) < 1e-12) continue;
    if (Math.abs(vb.value) < 1e-12) {
      return {
        equivalent: false, decided: true, validSamples: valid, maxRelativeDifference: Infinity,
        reason: "one equation is satisfied where the other is not",
      };
    }
    const k = va.value / vb.value;
    valid++;
    if (ratio === null) { ratio = k; continue; }
    if (!close(k, ratio, 1e-7, 1e-10)) {
      return {
        equivalent: false, decided: true, validSamples: valid, maxRelativeDifference: Math.abs(k - ratio),
        reason: "not a constant multiple of one another",
      };
    }
  }
  if (ratio === null || valid < Math.min(o.minValidSamples, 6)) {
    return { ...direct, decided: false, reason: "not enough defined points to compare" };
  }
  if (Math.abs(ratio) < 1e-12) {
    return { equivalent: false, decided: true, validSamples: valid, maxRelativeDifference: Infinity,
      reason: "degenerate comparison" };
  }
  return {
    equivalent: true, decided: true, validSamples: valid, maxRelativeDifference: 0,
    reason: `same equation, scaled by ${ratio.toFixed(6)}`,
  };
}
