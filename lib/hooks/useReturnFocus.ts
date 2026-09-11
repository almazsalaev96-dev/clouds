"use client";

import { useCallback, useRef } from "react";

/**
 * Gives focus back to whatever opened a dialog, when the dialog closes.
 *
 * Radix restores focus to its `<Dialog.Trigger>`, and none of the dialogs here
 * has one: Settings opens from a sidebar button, the palette from Ctrl+K, the
 * shortcut sheet from `?`. With no trigger the ref it restores to is null, the
 * restore has nowhere to land, and focus falls to `<body>` — which for anyone
 * navigating by keyboard means closing a dialog puts them back at the top of
 * the document, every time, with the whole page to tab through again.
 *
 * The capture has to happen while rendering rather than in an effect. React
 * commits the dialog's tree and Radix moves focus into it before any effect of
 * ours could run, and a parent's effect runs after its children's — so by the
 * time we could look, the answer is already gone. During the render that opens
 * it, `document.activeElement` is still the opener.
 *
 * Pass the returned handler to `Dialog.Content`'s `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const from = useRef<HTMLElement | null>(null);

  // Captured on the opening render and held until the handler below spends it.
  // Clearing it when `open` goes false would be too early: React renders the
  // closing state before Radix unmounts the content, so the answer would be
  // gone by the time anything asked for it.
  if (typeof document !== "undefined" && open && !from.current) {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) from.current = el;
  }

  return useCallback((e: Event) => {
    const el = from.current;
    // A control can be gone by the time its dialog closes — deleting a
    // conversation from the palette removes the row that opened it.
    if (!el?.isConnected) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
  }, []);
}
