"use client";

import * as React from "react";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismissUndo, takeUndo, useUndo } from "@/lib/undo";

/**
 * What just happened, and the way back from it where there is one.
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
    if (!entry?.restore) return;
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
        className="glass pointer-events-auto relative flex max-w-[min(25rem,100%)] items-center gap-3 overflow-hidden rounded-md border border-line py-3 pl-4 pr-3 shadow-lg anim-toast"
      >
        {/* One line and clipped for a delete, where the label is a title and
            the sentence around it is three words. Wrapped for anything you
            have to read — a refusal truncated at the width of the bar is a
            refusal that does not say why, which is the only part that matters. */}
        <span className={cn("min-w-0 flex-1 text-sm text-secondary", entry.restore ? "truncate" : "text-pretty")}>
          {entry.verb} <span className="text-primary">{entry.label}</span>
        </span>
        {entry.restore && (
          <button
            onClick={() => void takeUndo()}
            className="focus-inset flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
          >
            <RotateCcw size={13} />
            {entry.action ?? "Undo"}
          </button>
        )}
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
          style={{ animationDuration: `${entry.ms}ms` }}
        />
      </div>
    </div>
  );
}
