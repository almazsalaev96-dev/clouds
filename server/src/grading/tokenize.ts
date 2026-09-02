/**
 * Tokeniser for student-written mathematics.
 *
 * Deliberately forgiving about how a person actually writes: `2x`, `3(x+1)`, `2 1/2`,
 * unicode minus, `×`, `÷`, `√`, `π`, superscripts. Being strict here would mean marking
 * a correct answer wrong because of a character, which is the single worst thing a
 * grader can do.
 */

export type TokenType =
  | "number" | "ident" | "op" | "lparen" | "rparen" | "comma" | "relation" | "eof";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
}

export class LexError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = "LexError";
    this.position = position;
  }
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Fold the many ways a person types the same symbol into one canonical form. */
export function normalise(input: string): string {
  // Superscripts first: NFKC folds x² to x2, which silently changes the meaning of
  // the answer. Convert to explicit `^` before any compatibility normalisation runs.
  let s = input.replace(new RegExp(`[${SUPERSCRIPT}]+`, "g"), (m) =>
    "^" + [...m].map((ch) => String(SUPERSCRIPT.indexOf(ch))).join(""));
  s = s.normalize("NFKC");
  s = s
    .replace(/[−‒–—―]/g, "-")   // various dashes -> minus
    .replace(/[×⋅∙·]/g, "*")          // × ⋅ ∙ · -> *
    .replace(/[÷]/g, "/")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[≠]/g, "!=")
    .replace(/[√]/g, "sqrt")
    .replace(/[π]/g, "pi")
    .replace(/[∞]/g, "Infinity")
    .replace(/[‘’“”]/g, "")
    .replace(/ /g, " ");
  // Unicode vulgar fractions that survived NFKC as "1⁄2"
  s = s.replace(/⁄/g, "/");
  return s.trim();
}

const RELATIONS = ["<=", ">=", "!=", "==", "=", "<", ">"];
const OPERATORS = ["+", "-", "*", "/", "^", "%", "!"];

export function tokenize(input: string): Token[] {
  const s = normalise(input);
  const out: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }

    // number: 12, 12.5, .5, 1e-3
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j]!)) j++;
      if (s[j] === ".") { j++; while (j < s.length && /[0-9]/.test(s[j]!)) j++; }
      if ((s[j] === "e" || s[j] === "E") &&
          (/[0-9]/.test(s[j + 1] ?? "") ||
           ((s[j + 1] === "+" || s[j + 1] === "-") && /[0-9]/.test(s[j + 2] ?? "")))) {
        j += 2;
        while (j < s.length && /[0-9]/.test(s[j]!)) j++;
      }
      out.push({ type: "number", value: s.slice(i, j), start: i });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) j++;
      out.push({ type: "ident", value: s.slice(i, j), start: i });
      i = j;
      continue;
    }

    const rel = RELATIONS.find((r) => s.startsWith(r, i));
    if (rel) { out.push({ type: "relation", value: rel, start: i }); i += rel.length; continue; }

    if (OPERATORS.includes(ch)) { out.push({ type: "op", value: ch, start: i }); i++; continue; }
    if (ch === "(" || ch === "[" || ch === "{") { out.push({ type: "lparen", value: ch, start: i }); i++; continue; }
    if (ch === ")" || ch === "]" || ch === "}") { out.push({ type: "rparen", value: ch, start: i }); i++; continue; }
    if (ch === "," || ch === ";") { out.push({ type: "comma", value: ",", start: i }); i++; continue; }

    throw new LexError(`Unexpected character ${JSON.stringify(ch)}`, i);
  }

  out.push({ type: "eof", value: "", start: s.length });
  return out;
}
