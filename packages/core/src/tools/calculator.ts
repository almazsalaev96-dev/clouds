/**
 * Arithmetic evaluation (§32).
 *
 * A recursive-descent parser rather than `eval`. Tool input arrives from model
 * output, which is untrusted by construction — `eval` there is arbitrary code
 * execution in the server process. This parser can only ever produce a number,
 * which is the whole point.
 *
 * The supported surface is deliberately small: the arithmetic that shows up in
 * the work this product supports (ratios, percentages, elasticity, growth),
 * and nothing else.
 */

import type { Result } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";

type Token =
  | { kind: "number"; value: number }
  | { kind: "op"; value: string }
  | { kind: "name"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  sqrt: ([x]) => Math.sqrt(x),
  abs: ([x]) => Math.abs(x),
  round: ([x, d = 0]) => {
    const f = 10 ** d;
    return Math.round(x * f) / f;
  },
  floor: ([x]) => Math.floor(x),
  ceil: ([x]) => Math.ceil(x),
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  ln: ([x]) => Math.log(x),
  log: ([x, base = 10]) => Math.log(x) / Math.log(base),
  exp: ([x]) => Math.exp(x),
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/**
 * A comma means two different things depending on where it appears: a
 * thousands separator in `1,250,000`, and an argument separator in
 * `max(1, 250)`. Disambiguated by tracking whether the innermost open bracket
 * belongs to a function call, so pasted financial figures work without
 * breaking multi-argument functions.
 */
function tokenize(input: string): Result<Token[]> {
  const tokens: Token[] = [];
  /** One entry per open bracket: true when it opened a function call. */
  const bracketIsCall: boolean[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const inCallArgs = bracketIsCall[bracketIsCall.length - 1] === true;
      // Only read grouped digits as one number when a comma here cannot be an
      // argument separator.
      const grouped = inCallArgs
        ? null
        : /^\d{1,3}(?:,\d{3})+(?:\.\d+)?/.exec(input.slice(i));
      const match = grouped ?? /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(input.slice(i));
      if (!match) return fail("invalid_input", `Could not read a number at position ${i}.`);
      tokens.push({ kind: "number", value: Number(match[0].replace(/,/g, "")) });
      i += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(input.slice(i))!;
      tokens.push({ kind: "name", value: match[0].toLowerCase() });
      i += match[0].length;
      continue;
    }
    if (ch === "(") {
      bracketIsCall.push(tokens[tokens.length - 1]?.kind === "name");
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") { bracketIsCall.pop(); tokens.push({ kind: "rparen" }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    if ("+-*/^%".includes(ch)) {
      // "**" is the same operator as "^".
      if (ch === "*" && input[i + 1] === "*") {
        tokens.push({ kind: "op", value: "^" });
        i += 2;
        continue;
      }
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    return fail("invalid_input", `"${ch}" is not something this calculator understands.`);
  }
  return ok(tokens);
}

export function evaluateExpression(input: string): Result<number> {
  if (!input || input.trim().length === 0) {
    return fail("invalid_input", "There is no expression to evaluate.");
  }
  const lexed = tokenize(input);
  if (!lexed.ok) return lexed;
  const tokens = lexed.value;
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];

  // expression := term (('+' | '-') term)*
  function parseExpression(): Result<number> {
    let left = parseTerm();
    if (!left.ok) return left;
    for (;;) {
      const t = peek();
      if (t?.kind !== "op" || (t.value !== "+" && t.value !== "-")) break;
      pos++;
      const right = parseTerm();
      if (!right.ok) return right;
      left = ok(t.value === "+" ? left.value + right.value : left.value - right.value);
    }
    return left;
  }

  // term := unary (('*' | '/' | '%') unary)*
  function parseTerm(): Result<number> {
    let left = parseUnary();
    if (!left.ok) return left;
    for (;;) {
      const t = peek();
      if (t?.kind !== "op" || !["*", "/", "%"].includes(t.value)) break;
      pos++;
      const right = parseUnary();
      if (!right.ok) return right;
      if ((t.value === "/" || t.value === "%") && right.value === 0) {
        return fail("invalid_input", "That expression divides by zero.");
      }
      left = ok(
        t.value === "*" ? left.value * right.value
        : t.value === "/" ? left.value / right.value
        : left.value % right.value,
      );
    }
    return left;
  }

  function parseUnary(): Result<number> {
    const t = peek();
    if (t?.kind === "op" && (t.value === "-" || t.value === "+")) {
      pos++;
      const operand = parseUnary();
      if (!operand.ok) return operand;
      return ok(t.value === "-" ? -operand.value : operand.value);
    }
    return parsePower();
  }

  // power := primary ('^' unary)?   — right-associative
  function parsePower(): Result<number> {
    const base = parsePrimary();
    if (!base.ok) return base;
    const t = peek();
    if (t?.kind === "op" && t.value === "^") {
      pos++;
      const exponent = parseUnary();
      if (!exponent.ok) return exponent;
      return ok(base.value ** exponent.value);
    }
    return base;
  }

  function parsePrimary(): Result<number> {
    const t = peek();
    if (!t) return fail("invalid_input", "The expression ends unexpectedly.");

    if (t.kind === "number") {
      pos++;
      return ok(t.value);
    }
    if (t.kind === "lparen") {
      pos++;
      const inner = parseExpression();
      if (!inner.ok) return inner;
      if (peek()?.kind !== "rparen") {
        return fail("invalid_input", "A closing bracket is missing.");
      }
      pos++;
      return ok(inner.value);
    }
    if (t.kind === "name") {
      pos++;
      if (peek()?.kind === "lparen") {
        const fn = FUNCTIONS[t.value];
        if (!fn) return fail("invalid_input", `"${t.value}" is not a function this calculator knows.`);
        pos++;
        const args: number[] = [];
        if (peek()?.kind !== "rparen") {
          for (;;) {
            const arg = parseExpression();
            if (!arg.ok) return arg;
            args.push(arg.value);
            if (peek()?.kind === "comma") { pos++; continue; }
            break;
          }
        }
        if (peek()?.kind !== "rparen") {
          return fail("invalid_input", "A closing bracket is missing.");
        }
        pos++;
        const value = fn(args);
        if (!Number.isFinite(value)) {
          return fail("invalid_input", `${t.value}() is not defined for those inputs.`);
        }
        return ok(value);
      }
      const constant = CONSTANTS[t.value];
      if (constant === undefined) {
        return fail("invalid_input", `"${t.value}" is not a value this calculator knows.`);
      }
      return ok(constant);
    }
    return fail("invalid_input", "The expression is malformed.");
  }

  const result = parseExpression();
  if (!result.ok) return result;
  if (pos !== tokens.length) {
    return fail("invalid_input", "There is unexpected content after the expression.");
  }
  if (!Number.isFinite(result.value)) {
    return fail("invalid_input", "That expression does not produce a finite number.");
  }
  return ok(cleanFloat(result.value));
}

/**
 * Binary floating point makes `log(1000)` come back as 2.9999999999999996 and
 * `0.1 + 0.2` as 0.30000000000000004. Showing a user either of those from
 * something labelled "calculator" reads as a bug, so results are rounded to 12
 * significant figures — well beyond any precision this product's arithmetic
 * needs, and short of where the noise lives.
 */
function cleanFloat(n: number): number {
  const rounded = Number(n.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}
