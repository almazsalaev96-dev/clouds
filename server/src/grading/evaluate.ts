/** Numeric evaluation. Domain errors are reported, never silently turned into NaN. */

import type { Node } from "./ast.ts";

export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = "DomainError"; }
}

export type Env = Readonly<Record<string, number>>;

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new DomainError("factorial needs a non-negative integer");
  if (n > 170) return Infinity;
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

const UNARY: Record<string, (x: number) => number> = {
  sqrt: (x) => { if (x < 0) throw new DomainError("square root of a negative number"); return Math.sqrt(x); },
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: (x) => { if (x <= 0) throw new DomainError("log of a non-positive number"); return Math.log(x); },
  log: (x) => { if (x <= 0) throw new DomainError("log of a non-positive number"); return Math.log10(x); },
  log10: (x) => { if (x <= 0) throw new DomainError("log of a non-positive number"); return Math.log10(x); },
  log2: (x) => { if (x <= 0) throw new DomainError("log of a non-positive number"); return Math.log2(x); },
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: (x) => { if (x < -1 || x > 1) throw new DomainError("asin outside [-1, 1]"); return Math.asin(x); },
  acos: (x) => { if (x < -1 || x > 1) throw new DomainError("acos outside [-1, 1]"); return Math.acos(x); },
  atan: Math.atan,
  arcsin: (x) => UNARY.asin!(x), arccos: (x) => UNARY.acos!(x), arctan: Math.atan,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  fact: factorial,
};

const NARY: Record<string, (args: number[]) => number> = {
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  mod: ([a, b]) => { if (!b) throw new DomainError("mod by zero"); return a! % b!; },
  atan2: ([a, b]) => Math.atan2(a!, b!),
  gcd: (a) => a.reduce((x, y) => gcd(x, y)),
  lcm: (a) => a.reduce((x, y) => (x * y) / (gcd(x, y) || 1)),
  nCr: ([n, r]) => factorial(n!) / (factorial(r!) * factorial(n! - r!)),
  nPr: ([n, r]) => factorial(n!) / factorial(n! - r!),
};

export function evaluate(node: Node, env: Env = {}): number {
  switch (node.kind) {
    case "num":
      return node.value;

    case "var": {
      const val = env[node.name];
      if (val === undefined) throw new DomainError(`unknown variable ${node.name}`);
      return val;
    }

    case "neg":
      return -evaluate(node.arg, env);

    case "bin": {
      const l = evaluate(node.left, env);
      const r = evaluate(node.right, env);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/":
          if (r === 0) throw new DomainError("division by zero");
          return l / r;
        case "%":
          if (r === 0) throw new DomainError("mod by zero");
          return l % r;
        case "^": {
          if (l < 0 && !Number.isInteger(r)) {
            throw new DomainError("negative base with a fractional exponent");
          }
          if (l === 0 && r < 0) throw new DomainError("zero to a negative power");
          return Math.pow(l, r);
        }
      }
      break;
    }

    case "call": {
      const args = node.args.map((a) => evaluate(a, env));
      const nary = NARY[node.name];
      if (nary) return nary(args);
      const unary = UNARY[node.name];
      if (unary) {
        if (args.length !== 1) throw new DomainError(`${node.name} takes one argument`);
        return unary(args[0]!);
      }
      throw new DomainError(`unknown function ${node.name}`);
    }

    case "rel":
      throw new DomainError("a relation has no single value; compare its sides instead");

    case "list":
      throw new DomainError("a list has no single value");
  }
  throw new DomainError("unevaluable expression");
}

/** Evaluate, or report why not. Used by the sampler, which must not throw per point. */
export function tryEvaluate(node: Node, env: Env):
  { ok: true; value: number } | { ok: false; reason: string } {
  try {
    const value = evaluate(node, env);
    if (!Number.isFinite(value)) return { ok: false, reason: "not finite" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
