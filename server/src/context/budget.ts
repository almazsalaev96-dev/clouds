/**
 * The Context Engine's budgeting half.
 *
 * The tutor needs to know what "this" refers to, and it needs to not cost a fortune.
 * Both are the same problem: send the smallest set of facts that still makes the
 * question answerable. Parts are assembled in priority order and the budget is spent
 * from the top, so what gets dropped when a document is enormous is always the least
 * useful thing, never the question the student is actually looking at.
 */

export type ContextPartKind =
  | "focus" | "studentWork" | "questionText" | "attemptHistory" | "conversation"
  | "pageText" | "figures" | "neighbouringPages" | "masteryHints";

/** Lower number wins. Matches the table in docs/ARCHITECTURE.md section 5. */
export const PRIORITY: Record<ContextPartKind, number> = {
  focus: 0,
  studentWork: 1,
  questionText: 2,
  attemptHistory: 3,
  conversation: 4,
  pageText: 5,
  figures: 6,
  neighbouringPages: 7,
  masteryHints: 8,
};

/** Parts the tutor cannot do its job without; dropping one is a failure, not a trim. */
export const ESSENTIAL: ReadonlySet<ContextPartKind> = new Set(["focus", "studentWork", "questionText"]);

export interface ContextPart {
  kind: ContextPartKind;
  label: string;
  text: string;
  /** Parts that may be shortened rather than dropped entirely. */
  truncatable?: boolean;
}

export interface BudgetResult {
  text: string;
  bytes: number;
  included: ContextPartKind[];
  dropped: ContextPartKind[];
  truncated: ContextPartKind[];
}

/**
 * Below this, a fragment of a page is noise rather than context: it costs tokens, adds
 * nothing the tutor can reason from, and risks an answer built on half a sentence.
 * Parts that cannot be given at least this much are dropped instead of trimmed.
 */
const MIN_USEFUL_BYTES = 400;

export function assemble(parts: readonly ContextPart[], budgetBytes: number): BudgetResult {
  const ordered = [...parts]
    .filter((p) => p.text.trim().length > 0)
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.label.localeCompare(b.label));

  const included: ContextPartKind[] = [];
  const dropped: ContextPartKind[] = [];
  const truncated: ContextPartKind[] = [];
  const chunks: string[] = [];
  let used = 0;

  for (const part of ordered) {
    const header = `## ${part.label}\n`;
    const full = `${header}${part.text.trim()}\n\n`;
    const size = Buffer.byteLength(full, "utf8");

    if (used + size <= budgetBytes) {
      chunks.push(full);
      used += size;
      included.push(part.kind);
      continue;
    }

    const remaining = budgetBytes - used - Buffer.byteLength(header, "utf8") - 32;
    const canTruncate = part.truncatable !== false && remaining >= MIN_USEFUL_BYTES;

    if (canTruncate) {
      const body = clipToBytes(part.text.trim(), remaining);
      const piece = `${header}${body}\n[trimmed to fit]\n\n`;
      chunks.push(piece);
      used += Buffer.byteLength(piece, "utf8");
      included.push(part.kind);
      truncated.push(part.kind);
      continue;
    }

    if (ESSENTIAL.has(part.kind)) {
      // Something has gone wrong upstream: the thing the student is pointing at does
      // not fit. Say so rather than quietly answering about the wrong material.
      throw new ContextTooLarge(part.kind, size, budgetBytes);
    }
    dropped.push(part.kind);
  }

  return { text: chunks.join(""), bytes: used, included, dropped, truncated };
}

export class ContextTooLarge extends Error {
  readonly kind: ContextPartKind;
  readonly needed: number;
  readonly budget: number;
  constructor(kind: ContextPartKind, needed: number, budget: number) {
    super(`The ${kind} alone needs ${needed} bytes but the budget is ${budget}.`);
    this.name = "ContextTooLarge";
    this.kind = kind;
    this.needed = needed;
    this.budget = budget;
  }
}

/** Clip on a character boundary without splitting a multi-byte sequence. */
export function clipToBytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const buf = Buffer.from(text, "utf8").subarray(0, maxBytes);
  // Walk back off any partial UTF-8 sequence.
  let end = buf.length;
  while (end > 0 && (buf[end - 1]! & 0xc0) === 0x80) end--;
  if (end > 0 && (buf[end - 1]! & 0x80) !== 0) end--;
  return buf.subarray(0, end).toString("utf8");
}
