/**
 * The marker that turns a quotation into a ranked fact.
 *
 * Every room in this app could already ask a model for lessons, a summary,
 * key terms or questions, and every one of them came back as prose: correct,
 * complete, and a wall. Nobody revises from a wall. What revision notes have
 * that prose does not is *ranked* information — the fact that must be
 * remembered exactly, the formula with its symbols named, the mistake
 * everybody makes, the thing the examiner actually asks — each one visibly
 * not the same kind of thing as the paragraph around it.
 *
 * Markdown has one construct for that and models already write it unprompted:
 * GitHub's alert syntax, a blockquote whose first line is `[!KEY]`. Until now
 * it arrived as a quotation with `[!KEY]` visible inside it, which is worse
 * than not supporting it at all.
 *
 * Pure, and separate from the component that draws it, so the marker can be
 * tested without a browser and the same rule is used by both.
 */
export type CalloutKind = "key" | "formula" | "mistake" | "exam" | "recall" | "note" | "tip";

/** What each one is called where a person can see it. */
export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  key: "Must know",
  formula: "Formula",
  mistake: "Common mistake",
  exam: "In the exam",
  recall: "Ask yourself",
  note: "Note",
  tip: "Tip",
};

/**
 * The spellings a model might reach for, mapped onto the ones that are drawn.
 *
 * Deliberately small. Five kinds somebody revising can tell apart at a glance
 * beats a palette of tinted boxes that all mean "look here" — and GitHub's
 * own five are in here because a model that has never seen this app's prompt
 * still writes `[!IMPORTANT]` and should not have it rendered as a quote.
 */
const ALIASES: Record<string, CalloutKind> = {
  key: "key", important: "key", must: "key", remember: "key",
  formula: "formula", equation: "formula", definition: "formula",
  mistake: "mistake", warning: "mistake", caution: "mistake", careful: "mistake",
  exam: "exam", examiner: "exam", marks: "exam",
  recall: "recall", check: "recall", question: "recall",
  note: "note", info: "note",
  tip: "tip", hint: "tip",
};

/** `[!key]` at the start of a blockquote, however it is cased or spaced. */
export function calloutKind(text: string): CalloutKind | null {
  const m = /^\s*\[!\s*([a-z]+)\s*\]/i.exec(text);
  return m ? ALIASES[m[1].toLowerCase()] ?? null : null;
}

/** The same text with the marker taken off the front. */
export const withoutMarker = (text: string) =>
  text.replace(/^\s*\[!\s*[a-z]+\s*\]\s*\n?/i, "");
