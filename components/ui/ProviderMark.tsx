"use client";

import type { ProviderId } from "@/lib/types";

/**
 * A geometric mark per provider — enough to tell four sources apart at a
 * glance, without borrowing anyone's logo or reaching for an emoji. Each is a
 * single shape, drawn in currentColor, so it inherits type color and never
 * fights the text it sits beside.
 */
export function ProviderMark({ provider, size = 12 }: { provider: ProviderId; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true } as const;

  switch (provider) {
    case "anthropic":
      // Converging strokes.
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M2.5 9.5 5 2.5M9.5 9.5 7 2.5" />
        </svg>
      );
    case "openai":
      // Ring.
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="6" cy="6" r="3.6" />
        </svg>
      );
    case "google":
      // Four quadrants.
      return (
        <svg {...common} fill="currentColor">
          <path d="M6 1.5c0 1.9-1.3 3.2-3.2 3.2h-.3v2.6h.3c1.9 0 3.2 1.3 3.2 3.2v.3h2.6v-.3c0-1.9 1.3-3.2 3.2-3.2h.2V4.7h-.2C7.8 4.7 6.5 3.4 6.5 1.5v-.2H6z" opacity=".9" />
        </svg>
      );
    case "deepseek":
      // Diamond.
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M6 2.2 9.8 6 6 9.8 2.2 6z" />
        </svg>
      );
  }
}
