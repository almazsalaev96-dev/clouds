/**
 * The sums that never needed a model.
 *
 * Arithmetic is not intelligence, it is arithmetic. Sending `948392 × 73` to a
 * language model costs money and latency to get back a digit string produced by
 * a process that is not doing the sum; it is predicting what the sum looks
 * like. Usually right. Not always, and you cannot tell which from looking.
 *
 * So a question that is only a sum is answered here, exactly, by a calculator,
 * and the app says that is what happened. Which puts the whole weight of the
 * feature on that one word — **exactly**. An earlier version of this file said
 * it and was not: `123456789 * 987654321` came back as 121,932,631,112,635,260
 * when the answer ends 269, because the product had passed 2^53 and a double
 * had quietly rounded it. A calculator that is wrong is worse than no
 * calculator, and a calculator that is wrong *while captioned "this way it is
 * exact"* is worse than that. Integer arithmetic therefore runs in BigInt and
 * is exact at any size; the float path is used only where a fraction is
 * genuinely involved, and it declines rather than print digits it cannot stand
 * behind.
 *
 * Deliberately not `eval`, and deliberately not a general expression language.
 * This parses one grammar and refuses everything else — a calculator that
 * quietly accepts `fetch(...)` because it was easier to write is not a feature,
 * it is a hole.
 *
 * And it refuses much that *is* in the grammar. `9/11` and `24/7` and
 * `12/25/2024` and `555-1234` are all valid expressions and none of them is a
 * sum; they are a date, an idiom, a date and a phone number. So an expression
 * only counts as a question when it is asked like one — with a lead-in phrase,
 * or with a space beside an operator. `2 + 2` is a sum. `2+2` on its own goes
 * to a model, which costs a fraction of a penny and cannot mistake a date for a
 * division.
 *
 * With one exception, which is where the rule earns its keep: for the shapes
 * that are *also* something else — digits joined by `/` or `-` and nothing
 * more — a lead-in is not enough and the spaces are required. "what is 9/11" is
 * a question about a day in 2001, and the only reason it ever came back as
 * `0.818181818182` is that somebody thought "what is" settled the matter. The
 * price is that "what is 10/2" goes to a model too. `10/2` and `9/11` are the
 * same shape wearing different hats and nothing in here can tell them apart, so
 * the choice is which way to be wrong, and a fraction of a penny is the cheaper
 * side by a distance.
 */

export interface Sum {
  /** What it is, formatted the way a person writes numbers. */
  text: string;
  value: number;
  /**
   * True when `text` is the answer rather than a rounding of it.
   *
   * The caption beside a calculator answer says "this way it is exact", and
   * for `948392 × 73` it is. For `1 ÷ 3` the printed `0.333333333333` is
   * twelve significant figures of a number that does not end, and claiming
   * exactness about it spends the credibility the integer path earns. One
   * flag, so the sentence can be true in both cases.
   */
  exact: boolean;
}

/**
 * The phrases that announce a sum.
 *
 * Written once and used twice, because two copies of this list is two copies
 * that drift: `ASKING` strips a lead-in off the front, `askedAsASum` asks
 * whether there was one, and a phrase added to one and not the other is a
 * question that parses and is then refused for never having been asked.
 *
 * The apostrophe class covers the curly one, because iOS and macOS substitute
 * it by default and "what’s 2 + 2" typed on a phone is the same question as on
 * a keyboard.
 */
const LEAD_IN_ALTS = "what(?:['’]s| is)|calculate|compute|how much is|=";
const LEAD_IN = new RegExp(`^\\s*(?:${LEAD_IN_ALTS})`, "i");

/* A question that is nothing but a sum. */
const ASKING = new RegExp(
  `^\\s*(?:${LEAD_IN_ALTS})?\\s*([-+\\d\\s.,()*/×÷^%·]+?)\\s*[?=]?\\s*$`,
  "i",
);

/**
 * A string of digits joined by `/` or `-` and nothing else.
 *
 * `9/11`, `24/7`, `12/25/2024`, `2024-12-25`, `555-1234`, `555-555-1234`. Every
 * one parses as arithmetic and not one of them is arithmetic — they are two
 * dates, an idiom, a date and two phone numbers. Only `/` and `-` appear here
 * because only `/` and `-` have this second life; nobody has ever written a
 * date with a `*` in it.
 */
const ALSO_SOMETHING_ELSE = /^\d{1,4}([-/])\d{1,4}(?:\1\d{1,4})?$/;

/**
 * Asked like a question, rather than merely parseable as one.
 *
 * What separates a sum from a string of digits with punctuation in it is not
 * the characters, it is how it was typed: people put spaces around operators
 * when they mean arithmetic and they do not when they mean a date. That, or a
 * lead-in phrase — "what is", "calculate" — which says outright that a sum was
 * what was wanted.
 *
 * Except where the lead-in changes nothing, which is the case that took two
 * passes to get right. "what is 9/11" is not a division asked politely; it is a
 * question about a day in 2001, and answering `0.818181818182` is the single
 * most embarrassing thing this file could do. So for the shapes that are also
 * something else the lead-in is not accepted and the spaces are required:
 * "what is 9 / 11" is arithmetic and gets an answer, "what is 9/11" goes to a
 * model. The cost of that rule is that "what is 10/2" goes to a model too,
 * because `10/2` and `9/11` are the same shape wearing different hats and
 * nothing here can tell them apart. A model answers it for a fraction of a
 * penny and cannot mistake September for a division, which is the better end of
 * the trade in both directions.
 */
function askedAsASum(whole: string, body: string): boolean {
  // Spaces beside an operator: typed by somebody who meant arithmetic.
  if (/\s[-+*/×÷^%·]|[-+*/×÷^%·]\s/.test(body)) return true;
  if (!LEAD_IN.test(whole)) return false;
  return !ALSO_SOMETHING_ELSE.test(body.trim());
}

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
      const raw = src.slice(i, j);
      /* Commas are thousands separators or they are nothing.
         A decimal comma is a real ambiguity — "1,5" is one and a half to most
         of the world and fifteen hundredths to the rest — and guessing is how a
         calculator gives a confidently wrong answer. The previous rule only
         caught one or two digits after the comma, so `3,1415 * 2` was read as
         31415 × 2 and answered 62,830: a European writing π got a number six
         thousand times too big, captioned exact. Every comma must now sit in a
         real grouping position or the whole thing is refused. */
      if (raw.includes(",") && !/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(raw)) return null;
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

/**
 * A number that is still exactly itself.
 *
 * Integers are carried as BigInt so a product of two nine-digit numbers is the
 * product and not the nearest double to it. A fraction turns the value into a
 * float and, from there, the answer is only offered if it is one this can
 * stand behind.
 */
type Val = { int: bigint } | { num: number };
const isInt = (v: Val): v is { int: bigint } => "int" in v;
const asNum = (v: Val): number => (isInt(v) ? Number(v.int) : v.num);

/* An exponent big enough to matter is an exponent nobody typed on purpose, and
   BigInt will happily spend a minute and a gigabyte on it. */
const MAX_EXP = 1024;

/* Recursive descent.
   expr   := term (('+' | '-') term)*
   term   := power (('*' | '/' | '%') power)*
   power  := atom ('^' power)?            right-associative, as in maths
   unary  := '-'? unary | power
   atom   := number | '(' expr ')'

   Unary sits *above* power, which is the whole of the fix for `-2^2`. With it
   below, the sign folded into the base and the answer was 4; everywhere that
   writes mathematics — including Python and every calculator on a desk — reads
   it as −(2²) = −4. */
function parse(tokens: string[]): Val | null {
  let at = 0;
  const peek = () => tokens[at];
  const eat = (t: string) => (tokens[at] === t ? (at++, true) : false);

  const atom = (): Val | null => {
    if (eat("(")) {
      const v = expr();
      if (v === null || !eat(")")) return null;
      return v;
    }
    const t = peek();
    if (t === undefined || !/^[\d.]/.test(t)) return null;
    at++;
    if (/^\d+$/.test(t)) return { int: BigInt(t) };
    const n = Number(t);
    return Number.isFinite(n) ? { num: n } : null;
  };

  const power = (): Val | null => {
    const base = atom();
    if (base === null) return null;
    if (!eat("^")) return base;
    const exp = unary();
    if (exp === null) return null;
    if (isInt(base) && isInt(exp) && exp.int >= 0n) {
      if (exp.int > BigInt(MAX_EXP)) return null;
      return { int: base.int ** exp.int };
    }
    const r = asNum(base) ** asNum(exp);
    return Number.isFinite(r) ? { num: r } : null;
  };

  const unary = (): Val | null => {
    if (eat("-")) {
      const v = unary();
      if (v === null) return null;
      return isInt(v) ? { int: -v.int } : { num: -v.num };
    }
    if (eat("+")) return unary();
    return power();
  };

  /**
   * A quotient that did not come out even, to the precision a double holds.
   *
   * Not `Number(a) / Number(b)`. Both of those conversions can overflow to
   * `Infinity` independently, and `1 / Infinity` is `0` — which is finite,
   * which passes every check, and which is how `1 / 10^400` used to be
   * answered "0" in bold with the word *exact* underneath it. Scaling in BigInt
   * keeps the leading significant digits of the real quotient and hands the
   * double something it can actually hold; a true value too small to survive
   * that is declined rather than rounded to nothing.
   */
  const divide = (a: bigint, b: bigint): Val | null => {
    const SCALE = 10n ** 24n;
    const q = (a * SCALE) / b;
    const r = Number(q) / 1e24;
    if (!Number.isFinite(r)) return null;
    if (r === 0 && a !== 0n) return null;
    return { num: r };
  };

  const binary = (a: Val, b: Val, op: string): Val | null => {
    if (isInt(a) && isInt(b)) {
      if (op === "+") return { int: a.int + b.int };
      if (op === "-") return { int: a.int - b.int };
      if (op === "*") return { int: a.int * b.int };
      if (op === "/") {
        if (b.int === 0n) return null;
        // Exact when it divides evenly; otherwise it is genuinely a fraction.
        if (a.int % b.int === 0n) return { int: a.int / b.int };
        return divide(a.int, b.int);
      }
      if (op === "%") {
        if (b.int === 0n) return null;
        return { int: a.int % b.int };
      }
    }
    const x = asNum(a), y = asNum(b);
    /* An operand that has left the range of a double takes the answer with it,
       and quietly: `Number(10n ** 400n)` is `Infinity`, so a float `1 / 10^400`
       came back as a finite, exact-looking, entirely wrong 0. Refused at the
       operand rather than at the result, because that is where the information
       was lost. */
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const r = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : op === "/" ? x / y : x % y;
    if (!Number.isFinite(r)) return null;
    // Two non-zero numbers whose product or quotient underflowed to nothing.
    if (r === 0 && x !== 0 && y !== 0 && (op === "*" || op === "/")) return null;
    return { num: r };
  };

  const term = (): Val | null => {
    let v = unary();
    if (v === null) return null;
    for (;;) {
      const op = peek();
      if (op !== "*" && op !== "/" && op !== "%") return v;
      at++;
      const r = unary();
      if (r === null) return null;
      v = binary(v, r, op);
      if (v === null) return null;
    }
  };

  const expr = (): Val | null => {
    let v = term();
    if (v === null) return null;
    for (;;) {
      const op = peek();
      if (op !== "+" && op !== "-") return v;
      at++;
      const r = term();
      if (r === null) return null;
      v = binary(v, r, op);
      if (v === null) return null;
    }
  };

  const value = expr();
  return at === tokens.length ? value : null;
}

/** Grouped the way a person writes a number, at any size. */
function groupInt(n: bigint): string {
  const neg = n < 0n;
  const digits = (neg ? -n : n).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return (neg ? "-" : "") + out;
}

/**
 * Written the way a person writes a number — or not written at all.
 *
 * The float branch only speaks when it has something it can stand behind. A
 * double stops representing consecutive integers past 2^53 and stops holding
 * twelve significant figures long before it stops printing them, so anything in
 * that territory is declined rather than dressed up with thousands separators
 * and the word "exact".
 */
/** Whether printing this needed a rounding. */
function rounded(v: Val): boolean {
  return !isInt(v) && Number(v.num.toPrecision(12)) !== v.num;
}

function say(v: Val): string | null {
  if (isInt(v)) {
    /* Exact and unsayable are not the same thing. `10^400` is an integer this
       file computed correctly, and it is also four hundred digits of wall with
       commas in it, and `Sum.value` — which is a `number` — would be `Infinity`
       beside it. A result that cannot be carried in the shape this returns is
       not returned. */
    if (!Number.isFinite(Number(v.int))) return null;
    return groupInt(v.int);
  }
  const n = v.num;
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= Number.MAX_SAFE_INTEGER) return null;
  /* Floats carry their own noise: 0.1 + 0.2 is 0.30000000000000004, and an
     answer that prints that is technically correct and useless. Rounded to
     twelve significant figures, which for a value under 2^53 cannot eat a digit
     to the left of the point. */
  const r = Number(n.toPrecision(12));
  // -0 is zero. Nobody writes the sign of nothing.
  return (Object.is(r, -0) ? 0 : r).toLocaleString("en-US", { maximumFractionDigits: 12 });
}

/**
 * A sum, if that is all it is.
 *
 * Returns null for everything else — including things that merely contain a
 * sum, like "what is 2+2 and why", which is a question and belongs to a model.
 */
export function solve(question: string): Sum | null {
  if (question.length > 200) return null;
  const m = ASKING.exec(question);
  if (!m) return null;
  const body = m[1];
  // At least one operator: a bare number is not a sum, it is a number.
  if (!/[-+*/×÷^%·]/.test(body)) return null;
  if (!askedAsASum(question, body)) return null;
  const tokens = lex(body);
  if (!tokens) return null;
  const value = parse(tokens);
  if (value === null) return null;
  const text = say(value);
  if (text === null) return null;
  const n = asNum(value);
  return { value: Object.is(n, -0) ? 0 : n, text, exact: !rounded(value) };
}
