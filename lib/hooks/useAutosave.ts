"use client";

import * as React from "react";

export type SaveState = "idle" | "pending" | "saved";

/**
 * Autosave that cannot lose the last thing you typed.
 *
 * A debounced write on its own is a trapdoor: the timer is still counting when
 * you hit Escape, switch sections, or close the tab, and those keystrokes never
 * reach the database. The fix is not a shorter timer — it is that every way out
 * of the editor flushes first:
 *
 *   - unmount (navigating away, closing the detail view)
 *   - the id changing (opening a different note while one is mid-write)
 *   - visibilitychange (switching tabs, locking the phone)
 *   - pagehide (closing the tab; `beforeunload` is unreliable on mobile)
 *
 * Patches accumulate rather than replace, so editing a title and then a body
 * inside one window writes both instead of the last one winning.
 *
 * It also reports its own state, because "your work is safe" is only reassuring
 * if you can see it. `saved` decays back to `idle` so the badge does not sit
 * there claiming a save that happened ten minutes ago.
 */
export function useAutosave<T extends object>(
  id: string | null,
  write: (id: string, patch: Partial<T>) => void,
  ms = 400,
) {
  const pending = React.useRef<Partial<T>>({});
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const settle = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = React.useState<SaveState>("idle");

  // Kept in a ref so flush() has a stable identity and the effect below does
  // not tear down its listeners on every render of the caller.
  const writeRef = React.useRef(write);
  writeRef.current = write;

  const flush = React.useCallback((forId: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    const patch = pending.current;
    pending.current = {};
    if (!forId || !Object.keys(patch).length) return;
    writeRef.current(forId, patch);
    setState("saved");
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setState("idle"), 1800);
  }, []);

  const save = React.useCallback(
    (forId: string, patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      setState("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(forId), ms);
    },
    [flush, ms],
  );

  React.useEffect(() => {
    if (!id) return;
    const onHide = () => flush(id);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      // Covers both unmount and the id changing: the outgoing id is the one
      // still closed over here, which is exactly the one with unwritten text.
      flush(id);
    };
  }, [id, flush]);

  React.useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  return { save, flush: () => flush(id), state };
}
