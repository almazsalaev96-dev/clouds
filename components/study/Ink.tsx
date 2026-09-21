"use client";

import * as React from "react";
import { INK, eraseAt, pathOf, widthOf, type Stroke, type Tool } from "@/lib/ink";
import { cn } from "@/lib/utils";

/**
 * The page you can write on.
 *
 * One element holds the picture of the page and, over it, everything drawn
 * on it: the ink, the box being dragged, the words the model pointed at, the
 * marks it put beside your working. Every one of those is kept in the page's
 * own coordinates and drawn as SVG over a `viewBox` of 0..1, so the layer
 * fits the page at any width and a stroke stays on its word.
 *
 * ## Pen, finger, mouse
 *
 * A pencil is a pen pointer, and it is what this was built for: pressure is
 * read from every sample, including the ones the browser coalesced between
 * frames, so a fast stroke is a curve rather than a chain of segments.
 * Safari makes pen and touch exclusive — while the pencil is down a resting
 * palm does nothing — so palm rejection is the browser's, not ours. Once a
 * pen has been seen, a finger goes back to what a finger does on a page,
 * which is scroll it; until one has been, the finger is the pencil, because
 * on a phone or a plain tablet it is the only one there is. A mouse draws
 * while its button is down.
 */
export interface Box { x: number; y: number; w: number; h: number }

export function Ink({
  src,
  alt,
  tool,
  strokes,
  onStrokes,
  onBox,
  onPen,
  box,
  dragging,
  highlights,
  marks,
  disabled,
  className,
}: {
  src: string | null;
  alt: string;
  tool: Tool;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
  /** A region dragged out with the point tool, or null for a tap. */
  onBox: (b: Box | null) => void;
  /** The first time a pen touches the page. */
  onPen?: () => void;
  /** The region kept for the next question. */
  box: Box | null;
  /** The region being dragged right now. */
  dragging?: Box | null;
  /** Words the model pointed at, lit for a moment. */
  highlights?: Box[];
  /** A tick or a cross beside each step of your working. */
  marks?: { x: number; y: number; ok: boolean; n: number }[];
  disabled?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState<Stroke | null>(null);
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = React.useState(800);
  const penSeen = React.useRef(false);
  const erasing = React.useRef(false);

  /* Stroke widths are in thousandths of the page, and SVG draws them in
     screen pixels with `non-scaling-stroke`; the page's width on screen is
     the conversion, and it changes with the window. */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width || 800));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const pressureOf = (e: PointerEvent | React.PointerEvent) =>
    e.pointerType === "pen" ? Math.min(1, Math.max(0.05, e.pressure || 0.5)) : 0.5;

  /* Whether this pointer draws at all. A finger after a pen has been seen
     is for scrolling; the browser gets it back untouched. */
  const drawsWith = (e: React.PointerEvent) => {
    if (disabled) return false;
    if (e.pointerType === "pen") {
      if (!penSeen.current) { penSeen.current = true; onPen?.(); }
      return true;
    }
    if (e.pointerType === "touch") return !penSeen.current;
    return e.buttons === 1 || e.button === 0;
  };

  const down = (e: React.PointerEvent) => {
    if (!drawsWith(e)) return;
    const p = at(e);
    if (!p) return;
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* synthetic events have no capture */ }
    if (tool === "point") {
      drag.current = p;
      onBox(null);
      return;
    }
    if (tool === "erase") {
      erasing.current = true;
      onStrokes(eraseAt(strokes, p.x, p.y, 0.012));
      return;
    }
    e.preventDefault();
    setLive({ id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, tool, points: [p.x, p.y, pressureOf(e)] });
  };

  const move = (e: React.PointerEvent) => {
    if (tool === "point") {
      if (!drag.current) return;
      const p = at(e);
      if (!p) return;
      onDrag(drag.current, p);
      return;
    }
    if (tool === "erase") {
      if (!erasing.current) return;
      const p = at(e);
      if (p) onStrokes(eraseAt(strokes, p.x, p.y, 0.012));
      return;
    }
    if (!live) return;
    /* Every sample, not only the one per frame the browser dispatches. */
    const samples: (PointerEvent | React.PointerEvent)[] =
      typeof (e.nativeEvent as PointerEvent).getCoalescedEvents === "function"
        ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
        : [];
    const list = samples.length ? samples : [e];
    const add: number[] = [];
    for (const s of list) {
      const p = at(s);
      if (p) add.push(p.x, p.y, pressureOf(s));
    }
    if (add.length) setLive((l) => (l ? { ...l, points: [...l.points, ...add] } : l));
  };

  const [dragBox, setDragBox] = React.useState<Box | null>(null);
  const onDrag = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    setDragBox({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
  };

  const up = () => {
    if (tool === "point") {
      const d = dragBox;
      drag.current = null;
      setDragBox(null);
      /* A tap is not a selection. Below this it is somebody scrolling. */
      if (d && d.w >= 0.03 && d.h >= 0.02) onBox(d);
      return;
    }
    if (tool === "erase") { erasing.current = false; return; }
    if (!live) return;
    const done = live;
    setLive(null);
    onStrokes([...strokes, done]);
  };

  const cancel = () => { setLive(null); drag.current = null; setDragBox(null); erasing.current = false; };

  const px = (s: Stroke) => (widthOf(s) / 1000) * width;
  const showing = dragging ?? dragBox;

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      /* Until a pen has been seen the finger is the pencil, so the page
         must not scroll under it; after one has, a finger scrolls and the
         pen draws, and the browser keeps the two apart. */
      style={{ touchAction: penSeen.current ? "pan-y pinch-zoom" : "none" }}
      data-tool={tool}
      className={cn(
        "relative select-none",
        tool === "pen" || tool === "hi" ? "cursor-crosshair" : tool === "erase" ? "cursor-cell" : "cursor-crosshair",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} draggable={false} className="w-full rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)]" />
      ) : (
        <div className="skeleton aspect-[1/1.414] w-full rounded-lg border border-line" aria-label="Drawing the page" />
      )}

      <svg
        aria-label={strokes.length ? `${strokes.length} strokes of ink` : "Nothing drawn yet"}
        role="img"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {/* Highlighter under the pen: a marker does not go over the writing. */}
        {[...strokes, ...(live ? [live] : [])].filter((s) => s.tool === "hi").map((s) => (
          <path key={s.id} d={pathOf(s)} fill="none" stroke={INK.hi} strokeWidth={px(s)} strokeLinecap="butt" strokeLinejoin="round" opacity={0.38} style={{ mixBlendMode: "multiply" }} vectorEffect="non-scaling-stroke" />
        ))}
        {[...strokes, ...(live ? [live] : [])].filter((s) => s.tool === "pen").map((s) => (
          <path key={s.id} d={pathOf(s)} fill="none" stroke={INK.pen} strokeWidth={px(s)} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {/* The words it pointed at. */}
        {(highlights ?? []).map((h, i) => (
          <rect key={i} x={h.x - 0.004} y={h.y - 0.004} width={h.w + 0.008} height={h.h + 0.008} rx={0.004} fill="rgb(var(--accent-2-rgb) / 0.28)" stroke="rgb(var(--accent-2-rgb) / 0.9)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="anim-fade" data-highlight />
        ))}
      </svg>

      {/* What you are dragging, and what you dragged. HTML rather than SVG so
          the border stays 2px at every width. */}
      {(showing || box) && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-sm border-2",
            showing ? "border-[var(--accent-2)] bg-[rgb(var(--accent-2-rgb)/0.12)]" : "border-accent bg-[rgb(var(--accent-rgb)/0.10)]",
          )}
          style={rect(showing ?? box!)}
        />
      )}

      {/* A tick or a cross beside each step. Numbered, because the marks
          are placed down the side of the region in the order of the steps
          and the numbers are how they tie back to the words beside them. */}
      {(marks ?? []).map((m) => (
        <span
          key={m.n}
          aria-label={`Step ${m.n}: ${m.ok ? "holds" : "does not hold"}`}
          className={cn(
            "anim-rise pointer-events-none absolute flex h-5 min-w-5 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-semibold text-white shadow-[var(--shadow-sm)]",
            m.ok ? "bg-[var(--success)]" : "bg-[var(--danger)]",
          )}
          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
        >
          {m.ok ? "✓" : "✗"}<span className="opacity-80">{m.n}</span>
        </span>
      ))}
    </div>
  );
}

const rect = (n: Box) => ({
  left: `${n.x * 100}%`,
  top: `${n.y * 100}%`,
  width: `${n.w * 100}%`,
  height: `${n.h * 100}%`,
});
