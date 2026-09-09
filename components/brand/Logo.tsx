"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { A_BAR, A_LEFT, A_RIGHT, DISPLAY, GRID, WORD } from "./geometry";

/**
 * The Armi identity.
 *
 * French, in the sense the word actually carries in typography: Didot, cut in
 * Paris in the 1780s, and the engraved register every maison has set its name
 * in since. A vertical axis, stems that go heavy while the joins go to a
 * hairline, flat unbracketed serifs, and the whole thing letterspaced wide
 * enough that the word reads as an object rather than as a label.
 *
 * That register also happens to be the right answer to the brief. A fountain
 * pen on cream deckle paper is not asking for a software logotype; it is
 * asking for something engraved. And the palette was already halfway there —
 * Manela is paper, not white.
 *
 * There are two cuts, which is not a compromise but standard practice: a
 * display cut for anywhere the name is the subject, and a small cut for UI
 * chrome, because a hairline at 16px is a third of a pixel and a screen
 * cannot draw it.
 */

/* ------------------------------------------------------------- display ---- */

/**
 * The name, set. `tone="rule"` adds the hairlines above and below — the
 * engraved treatment, for anywhere the word is standing alone rather than
 * sitting in a row of interface.
 */
export function Wordmark({
  height = 26,
  tone = "plain",
  className,
}: {
  height?: number;
  tone?: "plain" | "rule";
  className?: string;
}) {
  const inner = WORD.reduce((n, l) => n + l.width, 0) + DISPLAY.tracking * (WORD.length - 1);
  const pad = tone === "rule" ? 34 : 0;
  const w = inner;
  const h = DISPLAY.height + pad * 2;

  let x = 0;
  return (
    <svg
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      role="img"
      aria-label="Armi"
      className={cn("shrink-0", className)}
      style={{ width: (w / h) * height }}
    >
      {tone === "rule" && (
        <>
          {/* Two hairlines at the weight of the letters' own thins, so the
              rules read as part of the setting rather than as a box drawn
              around it. */}
          <rect x="0" y="6" width={w} height="4" fill="currentColor" />
          <rect x="0" y={h - 10} width={w} height="4" fill="currentColor" />
        </>
      )}
      <g transform={`translate(0 ${pad})`}>
        {WORD.map((letter, i) => {
          const at = x;
          x += letter.width + DISPLAY.tracking;
          return (
            <g key={i} transform={`translate(${at} 0)`}>
              {letter.paths.map((d, j) => (
                <path key={j} d={d} fill="currentColor" />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------- small ---- */

/**
 * The A alone, at the small cut. Same skeleton and the same thick/thin logic
 * as the display A; no serifs, less contrast, because at this size those are
 * not legible detail but noise.
 */
export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path d={A_LEFT} fill="currentColor" />
      <path d={A_RIGHT} fill="currentColor" />
      <path d={A_BAR} fill="currentColor" />
    </svg>
  );
}

/**
 * Mark plus name, for the sidebar. The name is set in the interface font here
 * rather than drawn: at 15px the display cut would be illegible and the small
 * cut has no lowercase, and a lockup that lies about which cut it is is worse
 * than one that simply sets the word.
 */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-primary", className)}>
      <Mark size={17} />
      <span
        className="text-[15px] font-medium"
        style={{ letterSpacing: `${0.13 * (GRID.stem / 11)}em` }}
      >
        ARMI
      </span>
    </span>
  );
}
