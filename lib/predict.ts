/**
 * The shape of a commitment gate, and the refusal to render a broken one.
 *
 * Split out of the component because it is not one: it is a parser over
 * untrusted text — a model's output — and the only interesting thing about it
 * is everything it declines. A gate with one option is not a question. A gate
 * whose answer points past the end of its own list is a gate that can never be
 * got right. A gate that is not JSON at all is a code fence somebody wrote by
 * hand. All three fall through to a plain code block, because a malformed gate
 * that ate the surrounding answer would be far worse than no gate.
 */
export interface PredictSpec {
  q: string;
  options: string[];
  /** Index of the right one. */
  answer: number;
  /** Shown after the choice, whichever way it went. */
  why?: string;
}

/** Parse the fence, or decline. A malformed gate must never eat the content. */
export function parsePredict(src: string): PredictSpec | null {
  try {
    const raw = JSON.parse(src) as Partial<PredictSpec>;
    if (typeof raw.q !== "string" || !raw.q.trim()) return null;
    if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 5) return null;
    if (!raw.options.every((o) => typeof o === "string" && o.trim())) return null;
    // `Number.isInteger`, not `typeof === "number"`. An answer of 1.5 clears
    // every bound and still names no option: `options[1.5]` is undefined and no
    // button's index will ever equal it, so the gate renders, takes the
    // reader's commitment, and tells them the right answer was `undefined`.
    if (!Number.isInteger(raw.answer) || raw.answer! < 0 || raw.answer! >= raw.options.length) return null;
    return { q: raw.q, options: raw.options, answer: raw.answer as number, why: typeof raw.why === "string" ? raw.why : undefined };
  } catch {
    return null;
  }
}

