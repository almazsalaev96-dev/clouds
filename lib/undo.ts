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
  /** Reads after "Deleted": `Deleted "Costs of a nested loop".` */
  label: string;
  restore: () => Promise<void>;
}

type Listener = (entry: UndoEntry | null) => void;

/** How long a way back stays open. Long enough to notice, short enough to end. */
export const UNDO_MS = 8000;

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
  if (timer) clearTimeout(timer);
  current = { id: ++seq, label, restore };
  emit();
  timer = setTimeout(clear, UNDO_MS);
}

export async function takeUndo() {
  const entry = current;
  if (!entry) return;
  clear();
  await entry.restore();
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
