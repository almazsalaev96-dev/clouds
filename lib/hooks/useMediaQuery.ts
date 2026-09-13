"use client";

import * as React from "react";

/**
 * Whether a media query matches, as React state.
 *
 * The one reason this exists is `inert`. The sidebar is a drawer on a phone
 * and a rail on a desk, and the difference is not cosmetic: a closed drawer
 * is off-screen and must be inert so nothing inside it can be tabbed to
 * while invisible, while a closed rail is a column of live buttons. CSS can
 * draw both; it cannot set an attribute, so the component has to know which
 * world it is in.
 *
 * `useSyncExternalStore` rather than an effect, so the value is right on the
 * first client render instead of flipping one frame in. The server has no
 * window and answers with the wide layout, which is the one whose mistakes
 * are least harmful for a frame: a rail briefly not-inert on a phone is a
 * column you cannot see and would have to tab to on purpose.
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
