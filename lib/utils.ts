import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Whole seconds while waiting: a counter that flickers tenths reads as anxious. */
export const formatElapsed = (ms: number) => `${Math.floor(ms / 1000)}s`;

export function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const direct = t.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) return 800 - direct;
  // Subsequence fallback, rewarding matches that land on word boundaries.
  let ti = 0;
  let score = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    score += found === 0 || t[found - 1] === " " || t[found - 1] === "-" ? 10 : 3;
    ti = found + 1;
  }
  return score;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whether a keystroke came from inside an overlay.
 *
 * Global shortcut handlers do not know a dialog is open, and the consequences
 * are not cosmetic: Space is the standard key for activating a focused button,
 * so pressing Space on any control inside a dialog also revealed the flashcard
 * behind it, and 1-4 silently graded and rescheduled a card the user could not
 * see. Radix marks its layers, so the check is cheap and exact.
 */
export function inOverlay(e: Event): boolean {
  const target = e.target as HTMLElement | null;
  if (!target?.closest) return false;
  return Boolean(
    target.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]'),
  );
}
