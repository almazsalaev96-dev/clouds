"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { highlight, normalizeLang } from "@/lib/highlighter";
import { cn } from "@/lib/utils";

/**
 * A code editor, rather than a textarea with a monospace font on it.
 *
 * The trick is old and it is the right one: a `<pre>` holding the highlighted
 * copy, and a transparent `<textarea>` laid exactly on top of it. The browser
 * keeps the caret, the selection, undo, spellcheck-off, IME, autoscroll and
 * every keyboard convention it already knows; all this adds is the colour
 * underneath. Reimplementing a text input to get syntax highlighting is how
 * you end up with an editor that cannot do ⌥← or a Korean keyboard.
 *
 * Everything about the two layers has to agree to the pixel — family, size,
 * line height, tab size, padding, letter spacing — or the caret drifts a
 * little further from the glyph on every line. They are set once, here, in one
 * object used by both.
 */

const TAB = "  ";

/* The modifier, named the way the machine names it. "Ctrl+F" on a Mac is a
   shortcut nobody has, and a hint that is wrong is worse than no hint. */
const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "") ? "⌘" : "Ctrl+";

/** Shiki hands back a whole document; the editor supplies its own <pre>. */
function inner(html: string): string {
  const m = html.match(/<code[^>]*>([\s\S]*)<\/code>/);
  return m ? m[1] : html;
}

/* One set of numbers. The current-line band and the scroll-to-line maths are
   derived from these rather than repeating them, because a band that sits a
   pixel off the glyph is worse than no band at all. */
const FONT_PX = 13;
const LEADING = 1.7;
const LINE_H = FONT_PX * LEADING;
const PAD_Y = 12;
const PAD_X = 16;

const SHARED: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: `${FONT_PX}px`,
  lineHeight: String(LEADING),
  tabSize: 2,
  letterSpacing: 0,
  padding: `${PAD_Y}px ${PAD_X}px`,
  whiteSpace: "pre",
  wordBreak: "normal",
  overflowWrap: "normal",
};

export interface Jump {
  line: number;
  /** Bumped by the caller so the same line can be jumped to twice. */
  nonce: number;
}

/** What is highlighted, in characters and in lines. */
export interface Selection {
  start: number;
  end: number;
  fromLine: number;
  toLine: number;
}

export function CodeEditor({
  value,
  lang,
  onChange,
  onBlur,
  jump,
  onSelect,
  ariaLabel = "Canvas content",
  className,
}: {
  value: string;
  lang?: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  /** Put the caret on a line and scroll to it — the console does this. */
  jump?: Jump;
  /** What is highlighted right now, so a change can be asked for just that. */
  onSelect?: (sel: Selection | null) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [caret, setCaret] = React.useState({ line: 1, col: 1 });
  const [focused, setFocused] = React.useState(false);
  const [finding, setFinding] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [at, setAt] = React.useState(0);
  const areaRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const findRef = React.useRef<HTMLInputElement>(null);

  const lines = React.useMemo(() => value.split("\n"), [value]);
  const normalized = React.useMemo(() => normalizeLang(lang), [lang]);

  /* Highlighting is a worker round trip, so it lags a keystroke. The plain
     text underneath is what shows until it lands — never a blank pre, which
     would make typing look like it was deleting the file. */
  React.useEffect(() => {
    if (!normalized) {
      setHtml(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      void highlight(value, normalized).then((out) => {
        if (live) setHtml(out ? inner(out) : null);
      });
    }, 90);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value, normalized]);

  // The gutter is outside the horizontal scroller so numbers stay put when a
  // long line scrolls sideways; that costs one line of vertical sync.
  const syncGutter = () => {
    if (gutterRef.current && scrollRef.current) {
      gutterRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  const updateCaret = React.useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart);
    const nl = upto.lastIndexOf("\n");
    setCaret({ line: upto.split("\n").length, col: upto.length - nl });

    /* Selections shorter than this are a double-click on a word or a caret
       being dragged, not "change this part" — offering to rewrite them would
       put a bar on screen every time somebody selects a variable name. */
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (!onSelect) return;
    if (end - start < 12) {
      onSelect(null);
      return;
    }
    const fromLine = el.value.slice(0, start).split("\n").length;
    const toLine = el.value.slice(0, end).split("\n").length;
    onSelect({ start, end, fromLine, toLine });
  }, [onSelect]);

  /* Find. A file past fifty lines without it is a file you scroll through
     hunting, and every editor in the world answers this key. */
  const matches = React.useMemo(() => {
    if (!query) return [] as number[];
    const out: number[] = [];
    const hay = value.toLowerCase();
    const needle = query.toLowerCase();
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
    return out;
  }, [value, query]);

  const goTo = React.useCallback(
    (index: number) => {
      const el = areaRef.current;
      const hit = matches[index];
      if (!el || hit === undefined) return;
      el.setSelectionRange(hit, hit + query.length);
      const line = value.slice(0, hit).split("\n").length;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = Math.max(
          0,
          (line - 1) * LINE_H - scrollRef.current.clientHeight / 3,
        );
        syncGutter();
      }
      // The box keeps focus: you type, it moves, you type more. Enter is what
      // steps through, and stepping through should not cost a click back.
      findRef.current?.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, query, value],
  );

  React.useEffect(() => {
    if (finding && matches.length) goTo(Math.min(at, matches.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, matches.length, finding]);

  const openFind = React.useCallback(() => {
    const el = areaRef.current;
    // Whatever is selected is what you were probably looking for.
    const picked = el ? el.value.slice(el.selectionStart, el.selectionEnd) : "";
    if (picked && picked.length < 80 && !picked.includes("\n")) setQuery(picked);
    setAt(0);
    setFinding(true);
    requestAnimationFrame(() => findRef.current?.select());
  }, []);

  const closeFind = React.useCallback(() => {
    setFinding(false);
    areaRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!jump || !areaRef.current) return;
    const el = areaRef.current;
    const before = value.split("\n").slice(0, Math.max(0, jump.line - 1)).join("\n");
    const at = before.length + (jump.line > 1 ? 1 : 0);
    const end = at + (value.split("\n")[jump.line - 1]?.length ?? 0);
    el.focus();
    el.setSelectionRange(at, end);
    // Put the line a third of the way down rather than at the very top, where
    // there is no context above it.
    const lineHeight = LINE_H;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (jump.line - 1) * lineHeight - scrollRef.current.clientHeight / 3);
      syncGutter();
    }
    updateCaret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.nonce]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openFind();
      return;
    }
    /* Escape lets the keyboard out. Tab has to indent in a code editor, which
       means it cannot also move focus — so Escape is the way out, the same
       bargain every editor on the web makes, and it is announced in the hint
       under the box rather than left to be discovered. */
    if (e.key === "Escape") {
      el.blur();
      return;
    }
    if (e.key !== "Tab") return;
    e.preventDefault();

    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const startOfFirst = v.lastIndexOf("\n", a - 1) + 1;
    const spansLines = v.slice(a, b).includes("\n");

    if (!spansLines && !e.shiftKey) {
      const next = v.slice(0, a) + TAB + v.slice(b);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(a + TAB.length, a + TAB.length));
      return;
    }

    const endOfLast = v.indexOf("\n", b) === -1 ? v.length : v.indexOf("\n", b);
    const block = v.slice(startOfFirst, endOfLast);
    const shifted = block
      .split("\n")
      .map((l) => (e.shiftKey ? l.replace(new RegExp(`^ {1,${TAB.length}}`), "") : TAB + l))
      .join("\n");
    onChange(v.slice(0, startOfFirst) + shifted + v.slice(endOfLast));
    const delta = shifted.length - block.length;
    requestAnimationFrame(() => el.setSelectionRange(startOfFirst, endOfLast + delta));
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {finding && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-1.5 anim-fade">
          <Search size={13} className="shrink-0 text-tertiary" />
          <input
            ref={findRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); closeFind(); }
              else if (e.key === "Enter") {
                e.preventDefault();
                if (!matches.length) return;
                // Shift-Enter goes back, which is what every find bar does.
                setAt((n) => (e.shiftKey ? (n - 1 + matches.length) : (n + 1)) % matches.length);
              }
            }}
            placeholder="Find in this file"
            aria-label="Find in this file"
            className="focus-inset min-w-0 flex-1 bg-transparent font-mono text-xs text-primary outline-none placeholder:text-tertiary"
          />
          <span className="shrink-0 text-[11px] text-faint tnum">
            {matches.length ? `${Math.min(at, matches.length - 1) + 1} of ${matches.length}` : query ? "none" : ""}
          </span>
          <button
            onClick={() => matches.length && setAt((n) => (n - 1 + matches.length) % matches.length)}
            disabled={!matches.length}
            aria-label="Previous match"
            className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded text-tertiary hover:text-primary disabled:opacity-40"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => matches.length && setAt((n) => (n + 1) % matches.length)}
            disabled={!matches.length}
            aria-label="Next match"
            className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded text-tertiary hover:text-primary disabled:opacity-40"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={closeFind}
            aria-label="Close find"
            className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded text-tertiary hover:text-primary"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={gutterRef}
          aria-hidden
          className="shrink-0 select-none overflow-hidden border-r border-line bg-inset/40 text-right text-faint"
          style={{ ...SHARED, padding: "12px 8px", minWidth: `${String(lines.length).length + 2}ch` }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                "tnum transition-colors duration-[var(--dur-fast)]",
                focused && i + 1 === caret.line && "font-medium text-secondary",
              )}
            >
              {i + 1}
            </div>
          ))}
          {/* One blank line of run-out, matching the editor's. */}
          <div>&nbsp;</div>
        </div>

        <div ref={scrollRef} onScroll={syncGutter} className="relative min-h-0 flex-1 overflow-auto">
          <div className="relative w-max min-w-full">
            {/* The line you are on, marked the way every editor marks it: a
                band, not a border, so it never moves a glyph sideways. */}
            {focused && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]"
                style={{ top: PAD_Y + (caret.line - 1) * LINE_H, height: LINE_H }}
              />
            )}
            <pre
              aria-hidden
              className="m-0 text-primary"
              style={SHARED}
              {...(html
                ? { dangerouslySetInnerHTML: { __html: html + "\n" } }
                : { children: value + "\n" })}
            />
            <textarea
              ref={areaRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                updateCaret();
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              onKeyDown={onKeyDown}
              onKeyUp={updateCaret}
              onClick={updateCaret}
              onSelect={updateCaret}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={ariaLabel}
              aria-describedby="code-editor-hint"
              className="absolute inset-0 resize-none overflow-hidden bg-transparent text-transparent caret-[var(--text-primary)] outline-none"
              style={SHARED}
            />
          </div>
        </div>
      </div>

      {/* What an editor says about itself: where you are, and how much there
          is. The Escape hint lives here because the alternative is a keyboard
          user trapped in a box that eats Tab. */}
      <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-1 text-[11px] text-faint">
        <span className="tnum">
          Ln {caret.line}, Col {caret.col}
        </span>
        <span className="tnum">
          {lines.length} line{lines.length === 1 ? "" : "s"}
        </span>
        {normalized && <span className="uppercase tracking-[0.06em]">{normalized}</span>}
        <span id="code-editor-hint" className="ml-auto hidden sm:inline">
          Tab indents · {MOD}F finds · Esc leaves the editor
        </span>
      </div>
    </div>
  );
}
