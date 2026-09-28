"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, Plus, X } from "lucide-react";
import { db } from "@/lib/db";
import { titleMatches } from "@/lib/notebook";

/**
 * Choosing a page, from anywhere: to add a chat answer to the end of it,
 * or to start a new one. The pages most recently touched first, narrowed
 * as the name is typed.
 */
export function PagePicker({ title, onPick, onNew, onClose }: {
  title: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = React.useState("");
  const pages = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(300).toArray(), [], []);
  const shown = titleMatches(q, (pages ?? []).map((n) => ({ id: n.id, title: n.title || "Untitled" })), 12);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--bg-overlay)] p-4 pt-[12vh]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 text-sm font-medium text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"><X size={14} /></button>
        </header>
        <div className="p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) onPick(shown[0].id); }}
            placeholder="Find a page…"
            aria-label="Find a page"
            className="field w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
          />
          <ul className="mt-2 max-h-72 overflow-y-auto" aria-label="Pages">
            {shown.map((p) => (
              <li key={p.id}>
                <button onClick={() => onPick(p.id)} className="tap focus-inset flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-secondary hover:bg-subtle hover:text-primary">
                  <FileText size={14} className="shrink-0 text-tertiary" aria-hidden />
                  <span className="truncate">{p.title}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-2.5 py-2 text-xs text-tertiary">No page by that name.</li>}
          </ul>
          <button onClick={onNew} className="tap focus-inset mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-primary hover:bg-subtle">
            <Plus size={14} className="shrink-0 text-accent" aria-hidden /> A new page
          </button>
        </div>
      </section>
    </div>
  );
}
