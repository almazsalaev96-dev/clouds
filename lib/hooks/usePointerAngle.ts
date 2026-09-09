"use client";

import * as React from "react";

/**
 * The angle from an element's centre to the pointer, as a CSS variable.
 *
 * Used by the idle mark so its gradient leans toward wherever the cursor is —
 * the cheapest way to say "this is attending to you" without a face or a
 * voice. It is attention, not a pet: the mark never moves toward the cursor
 * or grows when approached, because a control that chases the pointer is
 * harder to click, and one that reacts to being *near* rather than *pressed*
 * teaches you to distrust what its states mean.
 *
 * Costs one passive listener on the window and one rAF-batched style write.
 * Does nothing at all where there is no pointer to track, so touch pays
 * nothing.
 */
export function usePointerAngle<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const write = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const deg = (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
      el.style.setProperty("--point-angle", `${deg.toFixed(1)}deg`);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      // One write per frame at most: pointermove fires far faster than the
      // screen refreshes, and a style write per event is work nobody sees.
      if (!frame) frame = requestAnimationFrame(write);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
