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
    case "moonshot":
      // A crescent, for the one named after a moonshot.
      return (
        <svg {...common} fill="currentColor">
          <path d="M8.9 8.6A4.1 4.1 0 0 1 5.2 2.1a4.6 4.6 0 1 0 5 7.4 4.1 4.1 0 0 1-1.3-.9z" />
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
