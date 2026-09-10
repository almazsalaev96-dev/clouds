"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A segmented control whose selection slides.
 *
 * Every one of these in the app used to work by moving a background colour
 * from one button to another, which is not a transition at all — the old pill
 * vanishes and a new one appears somewhere else, and the eye has to find it
 * again. Something that travels the distance keeps the eye on it, and arrives
 * carrying the fact that the two options are next to each other.
 *
 * The indicator is one element, positioned from the live geometry of the
 * button that is on. Measured rather than calculated, because these controls
 * hold labels of different lengths in seven languages and a fixed 1/n stride
 * is wrong for all of them.
 *
 * The first paint does not animate. A control that slides into place while the
 * page is still arriving is a control announcing itself, and the answer to
 * "which one am I on" should be there before the question.
 */
export function Segmented({
  value,
  className,
  indicatorClassName,
  children,
  ...rest
}: {
  /** Changing this is what moves the indicator. */
  value: string;
  className?: string;
  indicatorClassName?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const settled = React.useRef(false);

  React.useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;

    /* Only when a number actually changed.
       A ResizeObserver fires once the moment you observe, so setting state
       unconditionally means: observe → fire → setState → render → effect →
       observe → fire → … A loop that never settles and never shows, because
       every frame it computes the same answer and re-renders anyway. It cost
       nothing visible and about a third of a second of main thread per
       revision, which is how it was caught: a test that had always had time
       to spare stopped having it. */
    const measure = () => {
      const on = host.querySelector<HTMLElement>("[data-on='true']");
      if (!on) {
        setBox((prev) => (prev === null ? prev : null));
        return;
      }
      /* Both axes, from the button.
         The first version pinned the indicator to the middle of the container
         — fine while everything is on one line, and 22px wrong the moment the
         row wraps, which it does in the composer at 390px. A control that
         marks the wrong option on a phone is worse than one that does not
         move at all. */
      const next = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
      setBox((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      );
    };

    measure();
    /* Fonts land after first paint and change every width in here, so a single
       measurement at mount is a pill that sits slightly wrong for the rest of
       the session on the one load where the font was not cached yet. */
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    for (const child of Array.from(host.children)) ro.observe(child);
    /* `children` is a fresh array on every render and belongs nowhere near
       this list; the observer above is what notices a child changing size, and
       `value` is what notices a different one being on. */
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  React.useEffect(() => {
    if (box) {
      const id = requestAnimationFrame(() => {
        settled.current = true;
      });
      return () => cancelAnimationFrame(id);
    }
  }, [box]);

  return (
    <div ref={ref} className={cn("relative isolate", className)} {...rest}>
      {box && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-0 -z-10 rounded-full bg-surface shadow-[var(--shadow-sm)]",
            settled.current &&
              "transition-[transform,width,height] duration-[var(--dur-enter)] ease-[var(--ease-spring)]",
            indicatorClassName,
          )}
          style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
        />
      )}
      {children}
    </div>
  );
}
