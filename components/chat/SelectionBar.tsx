"use client";

import * as React from "react";
import { GraduationCap, MessageSquareQuote, Sparkles } from "lucide-react";

/**
 * What you can do with a few words of an answer, where you selected them.
 *
 * Reading an answer, the next question is nearly always about one part of
 * it — this sentence, that term — and the way to ask has been to retype
 * it. Select it instead and a small bar sits over the selection: *Explain*
 * asks about exactly that part, *Quote* puts it in the box with a `>` so
 * the question comes after it, *Card* makes a flashcard of it. Only over
 * an answer (the person's own words need none of this) and only while the
 * selection stands; it goes the moment the selection does.
 */
export function SelectionBar({
  root,
  onExplain,
  onQuote,
  onCard,
}: {
  /** The scrolling transcript the bar is positioned within. */
  root: React.RefObject<HTMLDivElement | null>;
  onExplain?: (text: string) => void;
  onQuote?: (text: string) => void;
  onCard?: (text: string) => void;
}) {
  const [at, setAt] = React.useState<{ x: number; y: number; text: string } | null>(null);

  React.useEffect(() => {
    let timer = 0;
    const read = () => {
      const sel = window.getSelection();
      const host = root.current;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !host) { setAt(null); return; }
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (text.length < 3 || text.length > 2_000) { setAt(null); return; }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
      /* Over an answer, in the transcript — not the box, not a user turn,
         not the code's own controls. */
      const msg = el?.closest(".msg");
      if (!msg || !host.contains(msg) || msg.getAttribute("data-role") !== "assistant") { setAt(null); return; }
      const r = range.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      if (!r.width && !r.height) { setAt(null); return; }
      setAt({ x: r.left - h.left + r.width / 2, y: r.top - h.top + host.scrollTop, text });
    };
    const onChange = () => { window.clearTimeout(timer); timer = window.setTimeout(read, 120); };
    document.addEventListener("selectionchange", onChange);
    return () => { document.removeEventListener("selectionchange", onChange); window.clearTimeout(timer); };
  }, [root]);

  if (!at) return null;
  const act = (fn?: (t: string) => void) => () => { const t = at.text; setAt(null); window.getSelection()?.removeAllRanges(); fn?.(t); };
  const btn = "btn-touch press focus-inset flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary";
  return (
    <div
      role="toolbar"
      aria-label="With the selected words"
      className="absolute z-20 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-0.5 rounded-full glass border border-line p-0.5 shadow-lg anim-pop"
      style={{ left: Math.max(96, Math.min(at.x, (root.current?.clientWidth ?? 400) - 96)), top: at.y }}
      /* The press must not clear the selection before it is read. */
      onMouseDown={(e) => e.preventDefault()}
    >
      {onExplain && <button type="button" onClick={act(onExplain)} className={btn}><Sparkles size={13} /> Explain</button>}
      {onQuote && <button type="button" onClick={act(onQuote)} className={btn}><MessageSquareQuote size={13} /> Quote</button>}
      {onCard && <button type="button" onClick={act(onCard)} className={btn}><GraduationCap size={13} /> Card</button>}
    </div>
  );
}
