"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardPaste, FileText, Globe, Upload, X } from "lucide-react";
import { addSource, db } from "@/lib/db";
import { extractPdf, isPdf } from "@/lib/pdf";
import { titleMatches } from "@/lib/notebook";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Way = "upload" | "web" | "paste" | "pages";

/**
 * Bringing sources into a notebook, four ways: a file, a web page, text
 * pasted in, or one of your own pages — which is the one a notebook app
 * that lives apart from your notes cannot offer.
 */
export function AddSources({ notebookId, onClose, onAdded }: {
  notebookId: string;
  onClose: () => void;
  onAdded: (names: string[]) => void;
}) {
  const [way, setWay] = React.useState<Way>("upload");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState("");
  const [pasteName, setPasteName] = React.useState("");
  const [pasteText, setPasteText] = React.useState("");
  const [q, setQ] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pages = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(300).toArray(), [], []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const files = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    const names: string[] = [];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      try {
        if (isPdf(f)) {
          const got = await extractPdf(f);
          if (got.imageOnly) { problems.push(`${f.name} is a scan with no text in it`); continue; }
          await addSource(notebookId, { name: f.name, text: got.text, pages: got.pages, size: f.size });
        } else {
          const text = await f.text();
          if (!text.trim()) { problems.push(`${f.name} is empty`); continue; }
          await addSource(notebookId, { name: f.name, text, size: f.size });
        }
        names.push(f.name);
      } catch {
        problems.push(`${f.name} could not be read`);
      }
    }
    setBusy(false);
    if (problems.length) setError(`${problems.join("; ")}.`);
    if (names.length) onAdded(names);
  };

  const web = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/read-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const got = (await res.json()) as { ok: boolean; message?: string; title?: string; text?: string; url?: string };
      if (!got.ok || !got.text) { setError(got.message ?? "That page could not be read."); return; }
      await addSource(notebookId, { name: got.title || url.trim(), text: got.text, url: got.url });
      onAdded([got.title || url.trim()]);
    } catch {
      setError("That page could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    const name = pasteName.trim() || `${text.split("\n")[0].slice(0, 50)}…`;
    await addSource(notebookId, { name, text });
    onAdded([name]);
  };

  const fromPage = async (id: string) => {
    const page = await db.notes.get(id);
    if (!page?.content.trim()) { setError("That page is empty."); return; }
    await addSource(notebookId, { name: page.title || "Untitled page", text: page.content });
    onAdded([page.title || "Untitled page"]);
  };

  const shown = titleMatches(q, (pages ?? []).filter((n) => n.id !== notebookId && n.content.trim()).map((n) => ({ id: n.id, title: n.title || "Untitled" })), 10);
  const WAYS: { id: Way; label: string; icon: React.ReactNode }[] = [
    { id: "upload", label: "Upload", icon: <Upload size={14} /> },
    { id: "web", label: "Website", icon: <Globe size={14} /> },
    { id: "paste", label: "Paste text", icon: <ClipboardPaste size={14} /> },
    { id: "pages", label: "My pages", icon: <FileText size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-0 sm:items-start sm:p-4 sm:pt-[10vh]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Add sources" className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-line bg-canvas shadow-2xl sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 text-base font-medium text-primary">Add sources</h2>
          <button onClick={onClose} aria-label="Close" className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"><X size={15} /></button>
        </header>
        <div className="p-4">
          <p className="mb-3 text-sm text-tertiary">Answers, the audio overview and everything the Studio makes come from these — and only these.</p>
          <div role="tablist" aria-label="How to add" className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-subtle p-1">
            {WAYS.map((w) => (
              <button
                key={w.id}
                role="tab"
                aria-selected={way === w.id}
                onClick={() => { setWay(w.id); setError(null); }}
                className={cn("ctl-h [--ctl:2.25rem] focus-ring flex items-center justify-center gap-1.5 rounded-lg text-xs transition-colors", way === w.id ? "bg-surface font-medium text-primary shadow-sm" : "text-tertiary hover:text-primary")}
              >
                {w.icon}<span className="hidden sm:inline">{w.label}</span><span className="sm:hidden">{w.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {way === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void files(e.dataTransfer.files); }}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center"
            >
              <Upload size={20} className="text-tertiary" aria-hidden />
              <p className="text-sm text-secondary">Drop files here, or</p>
              <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "Choose files"}</Button>
              <p className="text-xs text-faint">PDF, text or Markdown · several at once</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.md,.markdown,.txt,.rtf,.csv,text/*,application/pdf"
                aria-label="Choose files to add as sources"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => { void files(e.target.files); e.target.value = ""; }}
              />
            </div>
          )}

          {way === "web" && (
            <form onSubmit={(e) => { e.preventDefault(); void web(); }} className="space-y-2">
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                placeholder="https://…"
                aria-label="Web address"
                className="field w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-primary outline-none focus:border-[var(--accent)]"
              />
              <p className="text-xs text-faint">The text of the page is read once and kept here. Pages behind a login cannot be read.</p>
              <div className="flex justify-end"><Button size="sm" variant="primary" type="submit" disabled={busy || !url.trim()}>{busy ? "Reading…" : "Add"}</Button></div>
            </form>
          )}

          {way === "paste" && (
            <form onSubmit={(e) => { e.preventDefault(); void paste(); }} className="space-y-2">
              <input
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                placeholder="Name (optional)"
                aria-label="Source name"
                className="field w-full rounded-xl border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
              />
              <textarea
                autoFocus
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={7}
                placeholder="Paste the text here"
                aria-label="Pasted text"
                className="field w-full resize-none rounded-xl border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
              />
              <div className="flex justify-end"><Button size="sm" variant="primary" type="submit" disabled={!pasteText.trim()}>Add</Button></div>
            </form>
          )}

          {way === "pages" && (
            <div>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a page…"
                aria-label="Find a page"
                className="field w-full rounded-xl border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
              />
              <ul className="mt-2 max-h-64 overflow-y-auto" aria-label="Your pages">
                {shown.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => void fromPage(p.id)} className="tap focus-inset flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-secondary hover:bg-subtle hover:text-primary">
                      <FileText size={14} className="shrink-0 text-tertiary" aria-hidden />
                      <span className="truncate">{p.title}</span>
                    </button>
                  </li>
                ))}
                {!shown.length && <li className="px-2.5 py-2 text-sm text-tertiary">No page with words on it by that name.</li>}
              </ul>
            </div>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        </div>
      </section>
    </div>
  );
}
