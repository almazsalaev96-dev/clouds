/**
 * The sums that never needed a model.
 *
 * "Работай с AI там, где нужен интеллект" — and arithmetic is not intelligence,
 * it is arithmetic. Sending `948392 × 73` to a language model costs money and
 * latency to get back a digit string produced by a process that is not doing
 * the sum; it is predicting what the sum looks like. Usually right. Not always,
 * and you cannot tell which from looking.
 *
 * So a question that is only a sum is answered here, exactly, by a calculator,
 * and the app says that is what happened. It is a small feature that stands for
 * a large principle: a system that routes between models should also know when
 * the right route is no model at all.
 *
 * Deliberately not `eval`, and deliberately not a general expression language.
 * This parses one grammar — numbers, the five operators, parentheses, a
 * trailing percent — and refuses everything else. A calculator that quietly
 * accepts `fetch(...)` because it was easier to write is not a feature, it is
 * a hole; and one that answers "what is 3 in binary" by returning 3 is worse
 * than one that declines, because it looks like it worked.
 */

export interface Sum {
  /** Exactly what it is, formatted the way a person writes numbers. */
  text: string;
  value: number;
}

/* A question that is nothing but a sum. Words like "what is" and a trailing
   question mark are allowed because that is how people ask; anything with
   other words in it is a question about arithmetic rather than a sum, and
   belongs to a model. */
const ASKING = /^\s*(?:what(?:'s| is)|calculate|compute|how much is|=)?\s*([-+\d\s.,()*/×÷^%·]+?)\s*[?=]?\s*$/i;

/** Tokens, or nothing if anything in there is not part of the grammar. */
function lex(src: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.,]/.test(src[j])) j++;
      /* Thousands separators are how the number was written, not part of it.
         A decimal comma is a real ambiguity and this refuses rather than
         guesses: "1,5" means one and a half to most of the world and fifteen
         hundredths of nothing to the rest, and picking one silently is how a
         calculator gives a confidently wrong answer. */
      const raw = src.slice(i, j);
      if (/,\d{1,2}(?!\d)/.test(raw) && !/,\d{3}/.test(raw)) return null;
      const n = raw.replace(/,/g, "");
      if (!/^\d*\.?\d+$|^\d+\.$/.test(n)) return null;
      out.push(n);
      i = j;
      continue;
    }
    if ("+-*/^%()".includes(c)) { out.push(c); i++; continue; }
    if (c === "×" || c === "·") { out.push("*"); i++; continue; }
    if (c === "÷") { out.push("/"); i++; continue; }
    return null;
  }
  return out.length ? out : null;
}

/* Recursive descent, smallest grammar that covers how people write sums.
   expr   := term (('+' | '-') term)*
   term   := power (('*' | '/' | '%') power)*
   power  := unary ('^' power)?            right-associative, as in maths
   unary  := '-'? atom
   atom   := number | '(' expr ')' */
function parse(tokens: string[]): number | null {
  let at = 0;
  const peek = () => tokens[at];
  const eat = (t: string) => (tokens[at] === t ? (at++, true) : false);

  const atom = (): number | null => {
    if (eat("(")) {
      const v = expr();
      if (v === null || !eat(")")) return null;
      return v;
    }
    const t = peek();
    if (t === undefined || !/^[\d.]/.test(t)) return null;
    at++;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const unary = (): number | null => {
    if (eat("-")) {
      const v = unary();
      return v === null ? null : -v;
    }
    if (eat("+")) return unary();
    return atom();
  };

  const power = (): number | null => {
    const base = unary();
    if (base === null) return null;
    if (eat("^")) {
      const exp = power();
      return exp === null ? null : base ** exp;
    }
    return base;
  };

  const term = (): number | null => {
    let v = power();
    if (v === null) return null;
    for (;;) {
      if (eat("*")) {
        const r = power();
        if (r === null) return null;
        v *= r;
      } else if (eat("/")) {
        const r = power();
        if (r === null) return null;
        // Division by zero is not an answer, and Infinity is not one either.
        if (r === 0) return null;
        v /= r;
      } else if (eat("%")) {
        const r = power();
        if (r === null) return null;
        if (r === 0) return null;
        v %= r;
      } else return v;
    }
  };

  const expr = (): number | null => {
    let v = term();
    if (v === null) return null;
    for (;;) {
      if (eat("+")) {
        const r = term();
        if (r === null) return null;
        v += r;
      } else if (eat("-")) {
        const r = term();
        if (r === null) return null;
        v -= r;
      } else return v;
    }
  };

  const value = expr();
  return at === tokens.length ? value : null;
}

/** Written the way a person writes a number, not the way a float prints. */
function say(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return n.toLocaleString("en-US");
  /* Floats carry their own noise: 0.1 + 0.2 is 0.30000000000000004, and an
     answer that prints that is technically correct and useless. Rounded to
     twelve significant figures, which is well inside what a double can hold
     and well outside what anybody asked for. */
  const r = Number(n.toPrecision(12));
  return r.toLocaleString("en-US", { maximumFractionDigits: 12 });
}

/**
 * A sum, if that is all it is.
 *
 * Returns null for everything else — including things that contain a sum, like
 * "what is 2+2 and why", which is a question and belongs to a model.
 */
export function solve(question: string): Sum | null {
  if (question.length > 200) return null;
  const m = ASKING.exec(question);
  if (!m) return null;
  const body = m[1];
  // At least one operator: a bare number is not a sum, it is a number.
  if (!/[-+*/×÷^%·]/.test(body)) return null;
  const tokens = lex(body);
  if (!tokens) return null;
  const value = parse(tokens);
  if (value === null || !Number.isFinite(value)) return null;
  return { value, text: say(value) };
}
