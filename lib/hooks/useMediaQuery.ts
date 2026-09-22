"use client";

import * as React from "react";

/**
 * Whether a media query matches, as React state.
 *
 * It began as the sidebar's way of knowing whether it was a phone drawer
 * (inert when closed) or a desk rail (live when closed). The rail is gone —
 * closed is closed on every width now — and what is left using this is
 * the Study room asking whether the pointer is fine enough for hover.
 *
 * `useSyncExternalStore` rather than an effect, so the value is right on the
 * first client render instead of flipping one frame in. The server has no
 * window and answers with the wide layout, which is the one whose mistakes
 * are least harmful for a frame.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
