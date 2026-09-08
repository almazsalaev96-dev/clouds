"use client";

import * as React from "react";
import { RotateCcw, X } from "lucide-react";
import { UNDO_MS, dismissUndo, takeUndo, useUndo } from "@/lib/undo";

/**
 * The way back from the last delete.
 *
 * It sits above the composer rather than in a corner, because a rescue you do
 * not see is not a rescue, and the composer is where the eye already is. The
 * bar carries its own clock as a draining line: a countdown you can read is
 * the difference between "I have a moment" and "was that gone already?".
 *
 * ⌘Z takes it while it is open — the shortcut everyone tries first.
 */
export function UndoBar() {
  const entry = useUndo();

  React.useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void takeUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);

  if (!entry) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        // Keyed by id so a second delete restarts the animation rather than
        // inheriting the first one's remaining time.
        key={entry.id}
        className="pointer-events-auto relative flex max-w-[min(30rem,100%)] items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface py-2 pl-3.5 pr-2 shadow-lg anim-pop"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-secondary">
          Deleted <span className="text-primary">{entry.label}</span>
        </span>
        <button
          onClick={() => void takeUndo()}
          className="focus-inset flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
        >
          <RotateCcw size={13} />
          Undo
        </button>
        <button
          onClick={dismissUndo}
          aria-label="Dismiss"
          className="ctl focus-inset flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-lg text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <X size={14} />
        </button>

        {/* The clock, drawn rather than counted. */}
        <span
          aria-hidden
          className="undo-clock absolute inset-x-0 bottom-0 h-px origin-left bg-[var(--accent)]"
          style={{ animationDuration: `${UNDO_MS}ms` }}
        />
      </div>
    </div>
  );
}
