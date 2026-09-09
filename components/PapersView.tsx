"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Eye, Pencil, Printer, Sparkles, Undo2 } from "lucide-react";
import type { Paper } from "@/lib/types";
import { db, deletePaper } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { cheapestAvailable, generatePaper } from "@/lib/generate";
import { cn } from "@/lib/utils";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton, SaveBadge } from "@/components/ui/primitives";
import { SectionIndex } from "@/components/SectionIndex";

const FORMATS: { id: Paper["format"]; label: string; hint: string }[] = [
  { id: "report", label: "Report", hint: "Summary, headed sections, conclusion" },
  { id: "essay", label: "Essay", hint: "Continuous argument, no headings" },
  { id: "notes", label: "Notes", hint: "Headed sections and tight bullets" },
];

/**
 * Papers are the printable end of the same markdown everything else uses.
 *
 * Export is the browser's own print pipeline rather than a PDF library: it
 * already hyphenates, breaks pages, embeds fonts and honours the user's paper
 * size, and it produces a file the user chose the name and location for. A
 * client-side renderer would be a megabyte of JavaScript to do that worse.
 */
export function PapersView({
  paperId,
  configured,
  onSelect,
  onNew,
  onBack,
}: {
  paperId: string | null;
  configured: Record<string, boolean>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const papers = useLiveQuery(() => db.papers.orderBy("updatedAt").reverse().toArray(), []);
  const paper = useLiveQuery(() => (paperId ? db.papers.get(paperId) : undefined), [paperId]);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  /** What "Draft it" replaced, so the most destructive button is reversible. */
  const [replaced, setReplaced] = React.useState<string | null>(null);
  const loadedFor = React.useRef<string | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  useAutoGrow(bodyRef, editing ? draft : "");

  React.useEffect(() => {
    if (paper && loadedFor.current !== paper.id) {
      loadedFor.current = paper.id;
      setDraft(paper.content);
      // A paper arriving from a note already has a body worth looking at.
      setEditing(!paper.content.trim());
      setNote(null);
    }
  }, [paper]);

  const autosave = useAutosave<Paper>(
    paperId,
    React.useCallback((id, patch) => {
      void db.papers.update(id, { ...patch, updatedAt: Date.now() });
    }, []),
  );
  const persist = autosave.save;

  if (!paper) {
    return (
      <SectionIndex
        title="Papers"
        newLabel="New paper"
        emptyTitle="No papers yet."
        emptyHint="A paper is the printable end of a note — pick a shape, let a model draft it from your material, then export it as a PDF."
        loading={papers === undefined}
        items={(papers ?? []).map((p) => ({
          id: p.id,
          title: p.title || "Untitled paper",
          preview: p.content.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim().slice(0, 120),
          meta: p.format,
          searchText: p.content,
        }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={async (id) => {
          const title = papers?.find((p) => p.id === id)?.title || "paper";
          offerUndo(title, await deletePaper(id));
        }}
      />
    );
  }

  const rewrite = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setNote(null);
    const out = await generatePaper(
      draft,
      paper.format,
      paper.title,
      cheapestAvailable(configured),
    );
    setBusy(false);
    if (!out) {
      setNote("Couldn't draft this one — check your API key, or add more source material.");
      return;
    }
    setReplaced(draft);
    setDraft(out);
    setEditing(false);
    await db.papers.update(paper.id, { content: out, updatedAt: Date.now() });
  };

  const undoDraft = async () => {
    if (replaced === null) return;
    setDraft(replaced);
    setEditing(true);
    await db.papers.update(paper.id, { content: replaced, updatedAt: Date.now() });
    setReplaced(null);
  };

  const exportMarkdown = () => {
    const front = [
      `# ${paper.title || "Untitled"}`,
      paper.subtitle && `_${paper.subtitle}_`,
      paper.author && `${paper.author}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const blob = new Blob([`${front}\n\n${draft}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(paper.title || "paper").replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-print mx-auto flex w-full max-w-[var(--measure-wide)] flex-wrap items-center gap-1 px-4 pt-3">
        <IconButton label="All papers" keys={["Esc"]} onClick={onBack}>
          <ChevronLeft size={16} />
        </IconButton>
        <div className="flex rounded-md border border-line-strong bg-canvas p-0.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              title={f.hint}
              onClick={() => db.papers.update(paper.id, { format: f.id, updatedAt: Date.now() })}
              className={cn(
                "tap inline-flex items-center rounded-[6px] px-2.5 py-1 text-xs transition-colors duration-[var(--dur-fast)]",
                paper.format === f.id
                  ? "bg-surface font-medium text-primary shadow-sm"
                  : "text-secondary hover:text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="mr-auto pl-2.5">
          <SaveBadge state={autosave.state} />
        </span>

        <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? <Eye size={13} /> : <Pencil size={13} />}
          {editing ? "Preview" : "Edit"}
        </Button>
        <Button size="sm" variant="ghost" onClick={rewrite} disabled={busy || !draft.trim()}>
          {busy ? <span className="think-orb" aria-hidden /> : <Sparkles size={13} />}
          Draft it
        </Button>
        {replaced !== null && (
          <Button size="sm" variant="ghost" onClick={undoDraft}>
            <Undo2 size={13} />
            Undo draft
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={exportMarkdown}>
          <Download size={13} />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            // Print the document, never the source. Leaving edit mode first is
            // the whole fix; the stylesheet covers a stray Cmd+P as well.
            setEditing(false);
            requestAnimationFrame(() => window.print());
          }}
        >
          <Printer size={13} />
          Print / PDF
        </Button>
      </div>

      {note && (
        <div className="no-print mx-auto mt-2 w-full max-w-[var(--measure-wide)] px-4">
          <p className="border-l-2 border-[var(--stop)] py-1 pl-3 text-sm text-primary anim-fade">
            {note}
          </p>
        </div>
      )}

      <div className="paper-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--measure-wide)] px-4 pb-16 pt-4">
          {/* A sheet, not a text box. Seeing the margins while you write is the
              difference between editing text and making a document. */}
          <article className="paper-sheet mx-auto w-full max-w-[210mm] rounded-lg border border-line bg-surface px-[18mm] py-[20mm] shadow-sm">
            <header className="paper-head mb-8">
              <input
                value={paper.title}
                onChange={(e) => {
                  persist(paper.id, { title: e.target.value });
                }}
                placeholder="Title"
                aria-label="Paper title"
                className="tap w-full bg-transparent text-2xl font-semibold tracking-[-0.02em] text-primary outline-none placeholder:text-tertiary"
              />
              <input
                value={paper.subtitle ?? ""}
                onChange={(e) => persist(paper.id, { subtitle: e.target.value })}
                placeholder="Subtitle"
                aria-label="Subtitle"
                className="tap mt-1 w-full bg-transparent text-base text-secondary outline-none placeholder:text-tertiary"
              />
              <div className="mt-3 flex items-baseline gap-3 text-xs text-tertiary">
                <input
                  value={paper.author ?? ""}
                  onChange={(e) => persist(paper.id, { author: e.target.value })}
                  placeholder="Author"
                  aria-label="Author"
                  className="tap w-40 bg-transparent outline-none placeholder:text-tertiary"
                />
                <span className="tnum">
                  {new Date(paper.updatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </header>

            {editing ? (
              <textarea
                ref={bodyRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  persist(paper.id, { content: e.target.value });
                }}
                placeholder={"Paste your material here, then press Draft it.\n\nOr write it yourself — markdown works."}
                className="min-h-[40vh] w-full resize-none overflow-hidden bg-transparent text-base leading-[1.65] text-primary outline-none placeholder:text-tertiary"
              />
            ) : draft.trim() ? (
              <Markdown content={draft} />
            ) : (
              <p className="text-sm text-tertiary">Nothing written yet.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
