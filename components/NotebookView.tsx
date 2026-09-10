"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Eye, ListTree, Pencil, Scissors, SpellCheck2 } from "lucide-react";
import type { Note } from "@/lib/types";
import { db, deleteNote, deriveTitle } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { reviseCanvas } from "@/lib/generate";
import { Markdown } from "@/components/chat/Markdown";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { DiffView } from "@/components/CanvasView";
import { Button, SaveBadge } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";
import { cn } from "@/lib/utils";

/**
 * The notebook.
 *
 * A page is markdown, edited in place. There is no rich-text layer, no toolbar
 * and no block menu, because the same text has to survive being sent to a
 * model, exported, and read back a year later — and markdown is the only
 * format that does all three without a converter in between.
 *
 * It has the same box at the bottom as every other room. It used to be the one
 * place in the app where there was nothing to type into — you could write a
 * page here and you could send it nowhere, which made the notebook the only
 * room where the model was not in the room. A revision arrives the way it does
 * on a canvas: as the page, with a diff, kept or discarded.
 */
export function NotebookView({
  noteId,
  configured,
  onSelect,
  onNew,
  onBack,
}: {
  noteId: string | null;
  configured: Record<string, boolean>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  // No default value: `undefined` has to keep meaning "not back yet", or the
  // index cannot tell an empty library from an unanswered query.
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray(), []);
  const note = useLiveQuery(() => (noteId ? db.notes.get(noteId) : undefined), [noteId]);
  const [preview, setPreview] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [proposal, setProposal] = React.useState<{ content: string; note: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const reviseModel = useReviseModel(configured);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const loadedFor = React.useRef<string | null>(null);

  useAutoGrow(textareaRef, preview ? "" : draft);

  // Load once per note, so a keystroke never races the live query that the
  // same keystroke caused.
  React.useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      loadedFor.current = note.id;
      setDraft(note.content);
      setPreview(false);
      setProposal(null);
      setNotice(null);
      setInstruction("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [note]);

  const autosave = useAutosave<Note>(
    noteId,
    React.useCallback((id, patch) => {
      void db.notes.update(id, { ...patch, updatedAt: Date.now() });
    }, []),
  );

  const onChange = (value: string) => {
    setDraft(value);
    if (note) autosave.save(note.id, { content: value, title: deriveTitle(value, "") });
  };

  /* The same revise the canvas does, on the same terms: the draft rather than
     the saved copy, because revising a version you can see and the model
     cannot is the fastest way to lose an edit. */
  const run = async (text: string) => {
    if (!text.trim() || busy || !note) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const out = await reviseCanvas(draft, text, "doc", undefined, modelId);
      if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ content: out, note: text });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!proposal || !note) return;
    setDraft(proposal.content);
    autosave.save(note.id, { content: proposal.content, title: deriveTitle(proposal.content, "") });
    setProposal(null);
    setInstruction("");
  };

  const exportMarkdown = () => {
    if (!note) return;
    const blob = new Blob([draft], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(note.title || "note").replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!note) {
    return (
      <SectionIndex
        title="Notebook"
        newLabel="New page"
        emptyTitle="Nothing written down yet."
        emptyHint="Keep an answer from a chat, or start from a blank page. Pages are markdown — the same text you can send back to a model, export, and still read in a year."
        loading={notes === undefined}
        items={[...(notes ?? [])]
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((n) => ({
            id: n.id,
            title: n.title || "Untitled note",
            preview: n.content.replace(/^#.*$/m, "").replace(/\s+/g, " ").trim().slice(0, 120),
            meta: new Date(n.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            pinned: n.pinned,
            searchText: n.content,
          }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={async (id) => {
          const title = notes?.find((n) => n.id === id)?.title || "note";
          offerUndo(title, await deleteNote(id));
        }}
        onTogglePin={(id) => {
          const note = (notes ?? []).find((n) => n.id === id);
          if (note) void db.notes.update(id, { pinned: !note.pinned });
        }}
      />
    );
  }

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All pages">
        <span className="mr-auto flex items-center gap-2.5">
          <span className="text-xs text-tertiary tnum">
            {words} word{words === 1 ? "" : "s"}
          </span>
          <SaveBadge state={autosave.state} />
        </span>
        <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil size={13} /> : <Eye size={13} />}
          {preview ? "Edit" : "Preview"}
        </Button>
        <Button size="sm" variant="ghost" onClick={exportMarkdown}>
          <Download size={13} />
        </Button>
      </DetailBar>


      {proposal ? (
        <DiffView
          before={draft}
          after={proposal.content}
          note={proposal.note}
          onAccept={accept}
          onReject={() => setProposal(null)}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-8 pt-4">
              {preview ? (
                draft.trim() ? (
                  <Markdown content={draft} />
                ) : (
                  <p className="text-sm text-tertiary">Nothing to preview yet.</p>
                )
              ) : (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={"# Title\n\nStart writing. Markdown works — headings, lists, tables, code, $math$."}
                  spellCheck
                  aria-label="Page content"
                  // Field-sizing keeps the box exactly as tall as the text, so the
                  // page scrolls rather than a box inside the page.
                  className="min-h-[50vh] w-full resize-none overflow-hidden bg-transparent font-sans text-base leading-[1.65] text-primary outline-none placeholder:text-tertiary"
                />
              )}
            </div>
          </div>

          <div className="composer-dock shrink-0 px-4 pt-2">
            <div className="mx-auto w-full max-w-[var(--measure)]">
              {notice && (
                <p className="mb-2 rounded-lg bg-subtle px-3 py-1.5 text-xs text-secondary">{notice}</p>
              )}
              <MessageBar
                value={instruction}
                onChange={setInstruction}
                onSubmit={() => void run(instruction)}
                busy={busy}
                ariaLabel="Ask for a change"
                placeholder="Ask for a change — “tighten the second section”"
                above={
                  <div
                    className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-3"
                    role="group"
                    aria-label="Shortcuts"
                  >
                    <NoteChip busy={busy} icon={<Scissors size={12} />} onClick={() => void run("Tighten this. Cut every word that is not doing work, and keep every fact.")}>
                      Tighten
                    </NoteChip>
                    <NoteChip busy={busy} icon={<SpellCheck2 size={12} />} onClick={() => void run("Fix the spelling, grammar and punctuation. Change nothing else — not the wording, not the structure.")}>
                      Proofread
                    </NoteChip>
                    <NoteChip busy={busy} icon={<ListTree size={12} />} onClick={() => void run("Add headings and a little structure where the page has grown long enough to need them. Do not rewrite the prose.")}>
                      Add structure
                    </NoteChip>
                  </div>
                }
                right={<RevisePicker configured={configured} />}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The same chip the canvas uses, kept here so the notebook owns its own row. */
function NoteChip({
  children,
  icon,
  busy,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "tap focus-inset inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)]",
        "hover:border-line-strong hover:text-primary disabled:opacity-50",
      )}
    >
      <span className="text-tertiary">{icon}</span>
      {children}
    </button>
  );
}

/** Saving a chat answer into a note — used from the message action row. */
export async function saveToNote(text: string, conversationId?: string): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    title: deriveTitle(text, "Saved from chat"),
    content: text,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    sourceConversationId: conversationId,
  };
  await db.notes.add(note);
  return note;
}
