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

/**
 * A part this small is never dropped for want of space.
 *
 * The mastery hints are a few hundred bytes and are the difference between the tutor
 * knowing this student has met the idea before and not. Letting fifteen kilobytes of
 * raw page text crowd them out because it sits higher in the priority list is exactly
 * backwards, so small parts get their own allowance and the large ones share the rest.
 */
const SMALL_PART_BYTES = 512;
/** Ceiling on that allowance, so a pile of small parts cannot consume the budget. */
const SMALL_RESERVE_FRACTION = 0.5;

export function assemble(parts: readonly ContextPart[], budgetBytes: number): BudgetResult {
  const ordered = [...parts]
    .filter((p) => p.text.trim().length > 0)
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.label.localeCompare(b.label));

  const included: ContextPartKind[] = [];
  const dropped: ContextPartKind[] = [];
  const truncated: ContextPartKind[] = [];

  const sized = ordered.map((part) => {
    const header = `## ${part.label}\n`;
    const full = `${header}${part.text.trim()}\n\n`;
    return { part, header, full, size: Buffer.byteLength(full, "utf8") };
  });

  // Allocation happens in two passes so that a small, high-value part is not starved
  // by a large one that merely sits higher in the priority list. Emission still
  // follows priority — only the claim on the budget is reordered.
  const isSmall = (size: number) => size <= SMALL_PART_BYTES;
  const smallReserve = Math.min(
    sized.filter((s) => isSmall(s.size)).reduce((total, s) => total + s.size, 0),
    Math.floor(budgetBytes * SMALL_RESERVE_FRACTION),
  );

  const emitted = new Map<ContextPartKind, string>();
  let usedSmall = 0;
  let usedLarge = 0;

  // Pass one: the small parts, cheapest first, so the most fit inside the reserve.
  for (const s of [...sized].filter((s) => isSmall(s.size)).sort((a, b) => a.size - b.size)) {
    if (usedSmall + s.size > smallReserve) continue;
    emitted.set(s.part.kind, s.full);
    usedSmall += s.size;
  }

  const largeBudget = Math.max(0, budgetBytes - usedSmall);

  // Pass two: everything else, in priority order, trimming and dropping as needed.
  for (const { part, header, full, size } of sized) {
    if (emitted.has(part.kind)) continue;

    if (usedLarge + size <= largeBudget) {
      emitted.set(part.kind, full);
      usedLarge += size;
      continue;
    }

    const remaining = largeBudget - usedLarge - Buffer.byteLength(header, "utf8") - 32;
    const canTruncate = part.truncatable !== false && remaining >= MIN_USEFUL_BYTES;

    if (canTruncate) {
      const body = clipToBytes(part.text.trim(), remaining);
      const piece = `${header}${body}\n[trimmed to fit]\n\n`;
      emitted.set(part.kind, piece);
      usedLarge += Buffer.byteLength(piece, "utf8");
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

  const chunks: string[] = [];
  for (const { part } of sized) {
    const piece = emitted.get(part.kind);
    if (piece === undefined) continue;
    chunks.push(piece);
    included.push(part.kind);
  }

  return {
    text: chunks.join(""),
    bytes: usedSmall + usedLarge,
    included,
    dropped,
    truncated,
  };
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
