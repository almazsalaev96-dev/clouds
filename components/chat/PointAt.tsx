"use client";

import * as React from "react";
import { HelpCircle, MessageSquareQuote, Quote, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Select a sentence in an answer and ask about that sentence.
 *
 * The thing a reader is worst at is describing what they do not understand.
 * "I don't follow the bit about the cache" costs them a paragraph to write,
 * arrives ambiguous, and is answered by an assistant that has to guess which
 * bit. Pointing at it costs a drag: the selection *is* the description, and it
 * is exact.
 *
 * Which is why every frontier product grew this gesture in the same eighteen
 * months, and why it is worth building before anything more elaborate — it
 * removes the whole context-setting burden from the one moment the reader is
 * least able to carry it.
 *
 * ## Why it does not wrap the text in a span
 *
 * The obvious implementation puts a `<mark>` around the selection. That means
 * mutating the DOM that react-markdown owns, which breaks on the next render,
 * and splitting text nodes across element boundaries, which breaks whenever
 * the selection crosses one — a phrase that starts in a sentence and ends
 * inside `<strong>` is the common case, not the edge case.
 *
 * The CSS Custom Highlight API exists for exactly this: a Range is registered
 * with the browser and painted via `::highlight()`, with no element created
 * and nothing in the tree to go stale. Where it is unsupported the selection's
 * own colour does the job and nothing is lost.
 */
export type PointAction = "explain" | "simpler" | "why" | "ask";

const ACTIONS: { id: PointAction; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "explain", label: "Explain", icon: <MessageSquareQuote size={13} />, hint: "Explain this part" },
  { id: "simpler", label: "Simpler", icon: <Sparkles size={13} />, hint: "Say this more simply" },
  { id: "why", label: "Why", icon: <HelpCircle size={13} />, hint: "Why is this so?" },
  { id: "ask", label: "Ask", icon: <Quote size={13} />, hint: "Ask your own question about this" },
];

/** What each action becomes, with the selection quoted rather than described. */
export function promptFor(action: PointAction, quote: string): string {
  const q = `> ${quote.trim().replace(/\n+/g, "\n> ")}`;
  switch (action) {
    case "explain":
      return `${q}\n\nExplain this part. Assume I followed the rest — go at what this says and why it is true, not at the surrounding argument.`;
    case "simpler":
      return `${q}\n\nSay this more simply. Keep everything it means; lose the vocabulary that is doing the work of being precise rather than the work of being understood.`;
    case "why":
      return `${q}\n\nWhy is this so? Give the reason it holds, and the case where it would not.`;
    case "ask":
      return `${q}\n\n`;
  }
}

const HIGHLIGHT = "armi-point";

export function PointAt({
  scope,
  onAct,
}: {
  /** The element selections must fall inside — the transcript, not the page. */
  scope: React.RefObject<HTMLElement | null>;
  onAct: (action: PointAction, quote: string) => void;
}) {
  const [at, setAt] = React.useState<{ x: number; y: number; quote: string } | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    /* `keep` drops the toolbar but leaves the mark: scrolling away from a
       sentence you just asked about should not un-say which one it was. Only a
       new selection or Escape takes the mark off. */
    const clear = (keep = false) => {
      setAt(null);
      if (keep) return;
      try {
        CSS.highlights?.delete(HIGHLIGHT);
      } catch {
        /* no Custom Highlight API here; the native selection colour stands in */
      }
    };

    const read = () => {
      const sel = window.getSelection();
      const root = scope.current;
      if (!sel || sel.isCollapsed || !root) return clear();

      const range = sel.getRangeAt(0);
      /* Inside the transcript, and inside an *answer* — pointing at your own
         question to ask about it is a loop, and pointing at the model picker
         is a misfire. */
      const node = range.commonAncestorContainer;
      const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
      if (!el || !root.contains(el) || !el.closest(".prose")) return clear();

      const quote = sel.toString().trim();
      // Two words is the floor. A stray click-drag selects one and the bar
      // appearing over it reads as the interface twitching.
      if (quote.length < 8 || quote.split(/\s+/).length < 2) return clear();

      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return clear();
      /* A selection can be scrolled out of sight — you drag, the answer grows
         under you, the words move. There is nothing to point at off-screen, so
         the bar goes rather than hovering over the edge of the window. */
      if (r.bottom < 0 || r.top > window.innerHeight) return clear();

      try {
        if (CSS.highlights) CSS.highlights.set(HIGHLIGHT, new Highlight(range.cloneRange()));
      } catch {
        /* as above */
      }
      setAt({ x: r.left + r.width / 2, y: r.top, quote });
    };

    /* On pointer-up rather than on every selectionchange: a bar that chases a
       drag in progress is a bar in the way of the drag.

       Except its own. Pressing a button on the toolbar is a pointer-up like
       any other, and left unguarded it re-read a selection that the press had
       just released and wiped the mark the press existed to place — the
       feature clearing itself at the moment of being used. */
    const onUp = (e: PointerEvent) => {
      if (e.target instanceof Node && barRef.current?.contains(e.target)) return;
      window.setTimeout(read, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return clear();
      if (e.shiftKey || e.key === "ArrowLeft" || e.key === "ArrowRight") window.setTimeout(read, 0);
    };
    document.addEventListener("pointerup", onUp);
    document.addEventListener("keyup", onKey);
    const hide = () => clear(true);
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", hide);
      document.removeEventListener("scroll", hide, true);
      try {
        CSS.highlights?.delete(HIGHLIGHT);
      } catch {
        /* as above */
      }
    };
  }, [scope]);

  if (!at) return null;

  const act = (id: PointAction) => {
    onAct(id, at.quote);
    setAt(null);
    /* The native selection goes and the registered one stays. This is what the
       Custom Highlight API is actually for here: while the browser's own blue
       is on the words, it paints over ours and ours does nothing — but the
       moment the selection is released, the mark is the only thing left saying
       which sentence the answer coming back is about. You asked about a
       clause; the clause stays lit while you read the reply. */
    window.getSelection()?.removeAllRanges();
  };

  /* Above the selection where there is room, below it where there is not, and
     never off the side. Fixed rather than absolute: the transcript scrolls and
     a bar that scrolls with it lags behind by a frame at every wheel tick. */
  const above = at.y > 96;
  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Ask about the selected text"
      className={cn(
        "glass anim-pop no-print fixed z-40 flex items-center gap-0.5 rounded-xl border border-line p-1",
        "[box-shadow:var(--shadow-lg)]",
      )}
      style={{
        /* Centred on the selection, and never past an edge. The clamp has to
           account for the half-width the translate takes back, or a selection
           near the right margin puts half the bar outside the window. */
        left: `clamp(11rem, ${Math.round(at.x)}px, calc(100vw - 11rem))`,
        top: `clamp(3.5rem, ${Math.round(above ? at.y - 8 : at.y + 28)}px, calc(100vh - 4rem))`,
        translate: above ? "-50% -100%" : "-50% 0",
      }}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          onClick={() => act(a.id)}
          aria-label={a.hint}
          className="tap focus-inset flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <span className="text-tertiary">{a.icon}</span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
