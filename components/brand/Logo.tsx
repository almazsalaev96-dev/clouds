"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Armi identity.
 *
 * A signature. The brief was a fountain pen on deckle paper, and what a pen
 * writes is not a logotype — it is a name in someone's hand. So the mark is
 * the word set in a copperplate script (Pinyon, the engraved round hand of
 * nineteenth-century correspondence), in the ink, with the last two letters in
 * the gold of the nib.
 *
 * It appears at most once per screen. A signature repeated is a watermark.
 *
 * There is no dot. The i is set as a dotless "ı" — the letter as a pen leaves
 * it when it does not come back up — so the word ends on the stroke rather
 * than on a punctuation mark. Nothing is drawn over the type, which also means
 * nothing to sit in the wrong place if the script ever fails to load.
 */

/** The name, set. */
export function Wordmark({
  height = 32,
  gold = true,
  className,
}: {
  /** Cap height of the A, in px. The word is about 2.6× as wide. */
  height?: number;
  /** The gold. Off where the mark sits on a coloured ground of its own. */
  gold?: boolean;
  className?: string;
}) {
  // Pinyon's ascenders run well above the cap; sizing the font at the height
  // asked for keeps the flourish inside the box the caller allotted.
  const size = height * 0.98;
  return (
    <span
      role="img"
      aria-label="Armi"
      className={cn("signature relative inline-block select-none whitespace-nowrap", className)}
      style={{ fontSize: size, height: size * 1.05, lineHeight: 1 }}
    >
      {/* Two tones, split at the halfway point of the word: the first half in
          the ink, the last two letters in the gold of the nib. Two spans and
          not one gradient, because a gradient needs `color: transparent` and
          `background-clip: text`, and in forced-colors mode that is a wordmark
          that renders as nothing at all. */}
      <span aria-hidden className="text-current">Ar</span>
      <span
        aria-hidden
        className={gold ? "text-[var(--accent-2)]" : "text-current"}
        // Pinyon joins its letters, and splitting the run drops the join
        // between the r and the m. Pulling the second half back by the width
        // of that connector puts it back.
        style={{ marginLeft: -size * 0.055 }}
      >
        m{"ı"}
      </span>
    </span>
  );
}

/**
 * The initial, for the app icon and anywhere the whole name would not fit.
 * Same script, same ink, and nothing beside it.
 */
export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("signature relative inline-flex shrink-0 items-end justify-center", className)}
      style={{ width: size, height: size, fontSize: size * 0.92, lineHeight: 1 }}
    >
      <span style={{ marginBottom: -size * 0.02 }}>A</span>
    </span>
  );
}

/**
 * The sidebar header.
 *
 * The signature, and bigger than it was. A copperplate script is all hairlines
 * and joins, and the first cut of this sat at 30px, where those joins fall
 * below a pixel and the name reads as a squiggle. The answer was never a
 * different typeface — it was more room.
 */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center text-primary", className)}>
      <Wordmark height={38} />
    </span>
  );
}
