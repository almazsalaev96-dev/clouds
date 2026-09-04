/**
 * Pratt parser for school mathematics.
 *
 * Handles what students actually write rather than what a grammar would prefer:
 * implicit multiplication (`2x`, `3(x+1)`, `(x+1)(x+2)`, `xy`), postfix `!` and `%`,
 * function application without brackets (`sin x`), and comma-separated solution sets.
 *
 * Precedence note: implicit multiplication has the *same* precedence as `*` and `/` and
 * associates left, so `1/2x` parses as `(1/2)·x`. This matches every mainstream CAS.
 */

import type { Node } from "./ast.ts";
import { tokenize, type Token } from "./tokenize.ts";

export class ParseError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = "ParseError";
    this.position = position;
  }
}

export const FUNCTIONS = new Set([
  "sqrt", "cbrt", "abs", "exp", "ln", "log", "log10", "log2",
  "sin", "cos", "tan", "asin", "acos", "atan", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "sec", "csc", "cot",
  "floor", "ceil", "round", "sign", "min", "max", "mod", "gcd", "lcm",
  "nCr", "nPr", "fact", "atan2",
]);

export const CONSTANTS = new Map<string, number>([
  ["pi", Math.PI], ["tau", Math.PI * 2], ["e", Math.E],
  ["Infinity", Infinity], ["inf", Infinity],
]);

/** Multi-letter names that are one variable, not a product of letters. */
export const WORD_VARIABLES = new Set([
  "theta", "phi", "alpha", "beta", "gamma", "delta", "epsilon", "lambda",
  "mu", "sigma", "omega", "rho", "tau2", "psi", "chi", "eta", "zeta", "kappa", "nu",
]);

const REL_OPS = new Set(["=", "<", ">", "<=", ">=", "!=", "=="]);

class Parser {
  private i = 0;
  private readonly toks: Token[];
  constructor(toks: Token[]) { this.toks = toks; }

  private peek(): Token { return this.toks[this.i]!; }
  private next(): Token { return this.toks[this.i++]!; }
  private at(type: string, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  private expect(type: string, what: string): Token {
    if (!this.at(type)) {
      throw new ParseError(`Expected ${what} but found ${JSON.stringify(this.peek().value)}`,
        this.peek().start);
    }
    return this.next();
  }

  parseTop(): Node {
    const items: Node[] = [this.parseRelation()];
    while (this.at("comma")) { this.next(); items.push(this.parseRelation()); }
    if (!this.at("eof")) {
      throw new ParseError(`Unexpected ${JSON.stringify(this.peek().value)}`, this.peek().start);
    }
    return items.length === 1 ? items[0]! : { kind: "list", items };
  }

  private parseRelation(): Node {
    const left = this.parseExpr(0);
    if (this.at("relation")) {
      const op = this.next().value;
      if (!REL_OPS.has(op)) throw new ParseError(`Unknown relation ${op}`, this.i);
      const right = this.parseExpr(0);
      const norm = op === "==" ? "=" : op;
      return { kind: "rel", op: norm as "=" | "<" | ">" | "<=" | ">=" | "!=", left, right };
    }
    return left;
  }

  /** Binding powers: +,- = 10; *,/,implicit,% = 20; unary = 30; ^ = 40 (right assoc). */
  private parseExpr(minBp: number): Node {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();

      if (t.type === "op" && (t.value === "+" || t.value === "-")) {
        if (10 < minBp) break;
        this.next();
        left = { kind: "bin", op: t.value as "+" | "-", left, right: this.parseExpr(11) };
        continue;
      }
      if (t.type === "op" && (t.value === "*" || t.value === "/")) {
        if (20 < minBp) break;
        this.next();
        left = { kind: "bin", op: t.value as "*" | "/", left, right: this.parseExpr(21) };
        continue;
      }
      if (t.type === "op" && t.value === "^") {
        if (40 < minBp) break;
        this.next();
        // right-associative: 2^3^2 == 2^(3^2)
        left = { kind: "bin", op: "^", left, right: this.parseExpr(40) };
        continue;
      }
      if (this.startsImplicitProduct()) {
        if (20 < minBp) break;
        left = { kind: "bin", op: "*", left, right: this.parseExpr(21) };
        continue;
      }
      break;
    }
    return left;
  }

  /** `2x`, `3(x+1)`, `(x+1)(x+2)`, `2sqrt(3)` — juxtaposition means multiply. */
  private startsImplicitProduct(): boolean {
    const t = this.peek();
    if (t.type === "number" || t.type === "lparen") return true;
    if (t.type === "ident") return true;
    return false;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t.type === "op" && t.value === "-") { this.next(); return { kind: "neg", arg: this.parseExpr(30) }; }
    if (t.type === "op" && t.value === "+") { this.next(); return this.parseUnary(); }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type === "op" && t.value === "%") {
        // Postfix percent. `mod(a, b)` exists for the modulo people actually mean
        // when they mean modulo, and `50%` is far commoner in a school answer.
        this.next();
        node = { kind: "bin", op: "*", left: node, right: { kind: "num", value: 0.01 } };
        continue;
      }
      if (t.type === "op" && t.value === "!") {
        this.next();
        node = { kind: "call", name: "fact", args: [node] };
        continue;
      }
      break;
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();

    if (t.type === "number") { this.next(); return { kind: "num", value: Number(t.value) }; }

    if (t.type === "lparen") {
      this.next();
      // Brackets may hold a solution set: `{2, -3}`, `(2, -3)`.
      const items: Node[] = [this.parseRelation()];
      while (this.at("comma")) { this.next(); items.push(this.parseRelation()); }
      this.expect("rparen", "a closing bracket");
      return items.length === 1 ? items[0]! : { kind: "list", items };
    }

    if (t.type === "ident") {
      this.next();
      const name = t.value;

      if (FUNCTIONS.has(name)) {
        if (this.at("lparen")) {
          this.next();
          const args: Node[] = [];
          if (!this.at("rparen")) {
            args.push(this.parseExpr(0));
            while (this.at("comma")) { this.next(); args.push(this.parseExpr(0)); }
          }
          this.expect("rparen", "a closing bracket");
          return { kind: "call", name, args };
        }
        // `sin x`, `sqrt 2` — bracket-free application binds tightly.
        return { kind: "call", name, args: [this.parseExpr(30)] };
      }

      if (CONSTANTS.has(name)) return { kind: "num", value: CONSTANTS.get(name)! };
      if (WORD_VARIABLES.has(name) || name.length === 1) return { kind: "var", name };

      // `xy` is x·y, not a variable called "xy". In school mathematics variables are
      // single letters, and reading `xy` as one symbol marks correct work wrong.
      if (/^[A-Za-z]+$/.test(name)) {
        let node: Node = { kind: "var", name: name[0]! };
        for (const ch of name.slice(1)) {
          node = { kind: "bin", op: "*", left: node, right: { kind: "var", name: ch } };
        }
        return node;
      }
      return { kind: "var", name };
    }

    throw new ParseError(`Unexpected ${JSON.stringify(t.value || "end of input")}`, t.start);
  }
}

export function parse(input: string): Node {
  const trimmed = input.trim();
  if (!trimmed) throw new ParseError("Empty expression", 0);
  return new Parser(tokenize(trimmed)).parseTop();
}

/** Parse without throwing — the grader abstains rather than guessing on bad input. */
export function tryParse(input: string): { ok: true; node: Node } | { ok: false; error: string } {
  try {
    return { ok: true, node: parse(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
