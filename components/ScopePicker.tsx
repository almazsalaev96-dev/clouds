"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, Search } from "lucide-react";
import { LONG, chosenLabel, matchTopic, outlineOf, pageCount, pagesLabel, pick, type Section } from "@/lib/scope";
import { partsOf } from "@/lib/digest";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * "This book is long — which part do you need?"
 *
 * Shown before a long text is read, wherever one is about to be: a book in
 * the chat, a source for the Studio, a document in the Tutor. The book's
 * own chapters with their pages, a line to type a topic into (which finds
 * the chapters about it, by what they say and not only by their titles),
 * and the whole book as the slower choice beside them. One press and only
 * that part is sent — seconds instead of minutes.
 */
export function ScopePicker({
  name,
  text,
  onPick,
  onWhole,
  hint,
  className,
}: {
  name: string;
  text: string;
  /** The chosen part as text, and a short name for it. */
  onPick: (text: string, label: string) => void;
  onWhole: () => void;
  /** A line under the buttons, where the place has something to add. */
  hint?: string;
  className?: string;
}) {
  const sections = React.useMemo(() => outlineOf(text), [text]);
  const pages = React.useMemo(() => pageCount(text), [text]);
  const wholeParts = React.useMemo(() => partsOf(text).length, [text]);
  const [query, setQuery] = React.useState("");
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set());
  const matched = React.useMemo(() => (query.trim().length >= 3 ? matchTopic(text, sections, query) : null), [text, sections, query]);
  const shown: Section[] = matched ?? sections;

  /* What was chosen for this book last time, by chapter title: somebody
     working through a textbook asks about the same chapter for a week. */
  const memoryKey = `armi.scope.${name}.${text.length}`;
  const last = React.useMemo(() => {
    try {
      const titles = JSON.parse(localStorage.getItem(memoryKey) ?? "[]") as string[];
      const found = sections.filter((s) => titles.includes(s.title));
      return found.length && found.length === titles.length ? found : [];
    } catch {
      return [];
    }
  }, [memoryKey, sections]);

  const toggle = (id: string) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const use = (ids: Set<string>) => {
    const parts = sections.filter((s) => ids.has(s.id));
    if (!parts.length) return;
    try { localStorage.setItem(memoryKey, JSON.stringify(parts.map((s) => s.title))); } catch { /* a convenience */ }
    onPick(pick(text, parts, name, pages), chosenLabel(parts));
  };
  const size = pages ? `${pages} pages` : `${Math.round(text.length / 1_800)} pages or so`;

  return (
    <section aria-label={`Which part of ${name}?`} className={cn("rounded-2xl border border-line bg-surface p-3.5", className)}>
      <div className="flex items-start gap-2.5">
        <BookOpen size={16} className="mt-0.5 shrink-0 text-[var(--accent-2)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">
            <span className="break-all">{name}</span> is long — {size}. Which part do you need?
          </p>
          <p className="mt-0.5 text-xs text-tertiary">Reading only that part takes seconds; the whole book takes a few minutes.</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-field px-2.5">
        <Search size={13} className="shrink-0 text-tertiary" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matched?.length) {
              e.preventDefault();
              use(new Set(matched.slice(0, 2).map((s) => s.id)));
            }
          }}
          aria-label="Find a topic"
          placeholder=""
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-primary outline-none"
        />
      </div>

      <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto" aria-label="Parts of the book">
        {shown.map((s) => (
          <li key={s.id}>
            <label className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle", chosen.has(s.id) && "bg-subtle")}>
              <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} className="size-4 shrink-0 accent-[var(--accent-fill)]" />
              <span className="min-w-0 flex-1 truncate text-primary">{s.title}</span>
              {pagesLabel(s) && <span className="shrink-0 text-xs text-tertiary tnum">{pagesLabel(s)}</span>}
            </label>
          </li>
        ))}
        {matched && !matched.length && <li className="px-2 py-2 text-xs text-tertiary">Nothing in the book matches that. Try another word.</li>}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {last.length > 0 && !chosen.size && !matched && (
          <Button size="sm" variant="secondary" onClick={() => use(new Set(last.map((s) => s.id)))} aria-label={`Same as last time: ${chosenLabel(last)}`}>
            Same as last time · <span className="max-w-[14rem] truncate">{chosenLabel(last)}</span>
          </Button>
        )}
        <Button size="sm" variant="primary" disabled={!chosen.size} onClick={() => use(chosen)}>
          {chosen.size ? `Use ${chosen.size === 1 ? "this part" : `these ${chosen.size} parts`}` : "Choose a part"}
        </Button>
        {matched && matched.length > 0 && !chosen.size && (
          <Button size="sm" variant="secondary" onClick={() => use(new Set(matched.slice(0, 2).map((s) => s.id)))}>
            Use the best match
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onWhole}>
          Whole book{wholeParts > 1 ? ` · ${wholeParts} parts, slower` : ""}
        </Button>
      </div>
      {hint && <p className="mt-2 text-xs text-tertiary">{hint}</p>}
    </section>
  );
}

export type Scoped = { text: string; label?: string; whole: boolean };

/**
 * Ask which part, from anywhere that is about to read a long text.
 *
 * `const text = await ask(name, text)` shows the picker in a dialog and
 * resolves with the part chosen (or the whole, if that was pressed), or
 * null if the dialog was closed. Text that is not long resolves at once,
 * untouched, so a caller can ask for every source without checking first.
 */
export function useScope() {
  const [req, setReq] = React.useState<{ name: string; text: string; resolve: (r: Scoped | null) => void } | null>(null);
  const ask = React.useCallback(
    (name: string, text: string): Promise<Scoped | null> =>
      text.length <= LONG ? Promise.resolve({ text, whole: true }) : new Promise((resolve) => setReq({ name, text, resolve })),
    [],
  );
  /** Every long source asked about in turn; null if any was cancelled. */
  const askAll = React.useCallback(
    async <T extends { name: string; text: string }>(sources: T[]): Promise<{ sources: T[]; label?: string } | null> => {
      const out: T[] = [];
      const labels: string[] = [];
      for (const s of sources) {
        const r = await ask(s.name, s.text);
        if (!r) return null;
        if (r.label) labels.push(r.label);
        out.push({ ...s, text: r.text });
      }
      return { sources: out, label: labels.join("; ") || undefined };
    },
    [ask],
  );
  const done = (r: Scoped | null) => {
    req?.resolve(r);
    setReq(null);
  };
  const element = req ? (
    <Dialog.Root open onOpenChange={(o) => { if (!o) done(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 anim-modal"
        >
          <Dialog.Title className="sr-only">Which part of {req.name}?</Dialog.Title>
          <ScopePicker
            name={req.name}
            text={req.text}
            className="shadow-lg"
            onPick={(text, label) => done({ text, label, whole: false })}
            onWhole={() => done({ text: req.text, whole: true })}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  ) : null;
  return { ask, askAll, element };
}
