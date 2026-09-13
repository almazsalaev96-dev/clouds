"use client";

import * as React from "react";

/**
 * One delete, one way back.
 *
 * Confirmation dialogs are a poor guard: they interrupt every delete including
 * the hundreds you meant, which trains you to dismiss them, so by the time the
 * one you did not mean arrives you are already clicking through. Undo costs
 * nothing on the deletes you meant and rescues the one you did not — and it is
 * the only guard that also covers a misclick you did not notice until the row
 * was gone.
 *
 * The rule this enforces: a delete may not reach the database until something
 * has captured enough to put it back.
 */

export interface UndoEntry {
  id: number;
  /** The word before the label: `Deleted "Costs of a nested loop"`. */
  verb: string;
  /** What it happened to. A title, usually. */
  label: string;
  /**
   * Absent when there is nothing to put back.
   *
   * Added for the one case that is not a delete and belongs in the same place:
   * the app refusing to remember something, which is a sentence to read rather
   * than an act to reverse. It goes here because this bar is already where the
   * eye is after you press send — a refusal in a corner is a refusal nobody
   * saw, and "it didn't keep that" is exactly the thing you must not learn a
   * week later.
   */
  restore?: () => Promise<void>;
  /** The button's word, when there is a button. "Undo" unless something fits better. */
  action?: string;
  /** How long it stays. Longer for anything that is a sentence rather than a title. */
  ms: number;
}

type Listener = (entry: UndoEntry | null) => void;

/** How long a way back stays open. Long enough to notice, short enough to end. */
export const UNDO_MS = 8000;

/** And how long something you have to *read* stays. A sentence is not a title. */
export const READ_MS = 13000;

let current: UndoEntry | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

function clear() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  current = null;
  emit();
}

/**
 * Offer a way back from something already done.
 *
 * Only one is held at a time. A second delete replaces the first rather than
 * stacking, because a queue of undos is a thing you have to read, and by then
 * the moment to use it has passed.
 */
export function offerUndo(label: string, restore: () => Promise<void>) {
  announce({ verb: "Deleted", label, restore, ms: UNDO_MS });
}

/**
 * The general form: say what happened, and offer the way back if there is one.
 *
 * Same single slot as `offerUndo`, for the same reason — two of these on
 * screen is a queue, and a queue is a thing you have to read before you can
 * act on the one you wanted.
 */
export function announce(entry: Omit<UndoEntry, "id" | "ms"> & { ms?: number }) {
  if (timer) clearTimeout(timer);
  const ms = entry.ms ?? (entry.restore ? UNDO_MS : READ_MS);
  current = { ...entry, ms, id: ++seq };
  emit();
  timer = setTimeout(clear, ms);
}

export async function takeUndo() {
  const entry = current;
  if (!entry?.restore) return;
  const { restore } = entry;
  clear();
  await restore();
}

export function dismissUndo() {
  clear();
}

export function useUndo(): UndoEntry | null {
  return React.useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}
