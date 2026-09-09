"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  A_BAR, A_LEFT, A_RIGHT, GRID, I_DOT, I_STEM,
  M_ARCH_1, M_ARCH_2, M_STEM, OFFSET, R_SHOULDER, R_STEM,
} from "./geometry";

/**
 * The Armi identity.
 *
 * The thing worth keeping from a fountain pen is not the cursive — it is the
 * modulation. A nib is thin where it lifts and thick where it presses, and
 * that contrast is what makes handwriting look considered. Script itself is a
 * poor wordmark: it collapses to mush at 16px in a sidebar, and it claims the
 * work was done by a hand, which is the wrong claim for this product.
 *
 * So the letterforms are geometric and the contrast is calligraphic. The A is
 * drawn with a light left diagonal and a heavy right one, the way a broad nib
 * at a fixed angle actually behaves. Everything after it is monoline at the
 * weight the A averages, so the A reads as the display letter it is rather
 * than as an inconsistency.
 *
 * Exactly one thing in the whole identity carries colour: the dot on the i.
 * In a single-colour lockup it becomes ink and nothing is lost, which is the
 * test any accent has to pass.
 */

/** The A alone. The app icon, the favicon, and the first letter of the word. */
export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <MarkPaths />
    </svg>
  );
}

function MarkPaths() {
  return (
    <>
      <path d={A_LEFT} fill="currentColor" />
      <path d={A_RIGHT} fill="currentColor" />
      <path d={A_BAR} fill="currentColor" />
    </>
  );
}

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: GRID.stem,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/**
 * The full word. `tone="ink"` draws it in one colour for stamps, print and
 * anywhere the accent would be wrong.
 */
export function Wordmark({
  height = 24,
  tone = "duo",
  className,
}: {
  height?: number;
  tone?: "duo" | "ink";
  className?: string;
}) {
  return (
    <svg
      height={height}
      viewBox={`0 0 ${GRID.wordWidth} ${GRID.height}`}
      fill="none"
      role="img"
      aria-label="Armi"
      className={cn("shrink-0", className)}
      style={{ width: (GRID.wordWidth / GRID.height) * height }}
    >
      <MarkPaths />
      <g transform={`translate(${OFFSET.r} 0)`} {...strokeProps}>
        <path d={R_STEM} />
        <path d={R_SHOULDER} />
      </g>
      <g transform={`translate(${OFFSET.m} 0)`} {...strokeProps}>
        <path d={M_STEM} />
        <path d={M_ARCH_1} />
        <path d={M_ARCH_2} />
      </g>
      <g transform={`translate(${OFFSET.i} 0)`}>
        <path d={I_STEM} {...strokeProps} />
        <circle
          cx={I_DOT.cx}
          cy={I_DOT.cy}
          r={I_DOT.r}
          fill={tone === "duo" ? "var(--brand-accent, currentColor)" : "currentColor"}
        />
      </g>
    </svg>
  );
}
