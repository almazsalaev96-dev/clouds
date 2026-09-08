"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Eye, Layers, Pencil, Printer } from "lucide-react";
import type { Note } from "@/lib/types";
import { db, deriveTitle } from "@/lib/db";
import { generateCards, cheapestAvailable } from "@/lib/generate";
import { newCard } from "@/lib/study";
import { createDeck, createPaper } from "@/lib/db";
import { debounce } from "@/lib/utils";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { Markdown } from "@/components/chat/Markdown";
import { Button } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";

/**
 * A note is markdown, edited in place. There is no rich-text layer, no toolbar
 * and no block menu, because the same text has to survive being sent to a
 * model, laid out as a paper, and cut into flashcards — and markdown is the
 * only format that does all three without a converter in between.
 */
export function NotesView({
  noteId,
  configured,
  onSelect,
  onNew,
  onBack,
  onOpenDeck,
  onOpenPaper,
}: {
  noteId: string | null;
  configured: Record<string, boolean>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
  onOpenDeck: (id: string) => void;
  onOpenPaper: (id: string) => void;
}) {
  const notes = useLiveQuery(
    () => db.notes.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Note[],
  );
  const note = useLiveQuery(() => (noteId ? db.notes.get(noteId) : undefined), [noteId]);
  const [preview, setPreview] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState<null | "cards" | "paper">(null);
  const [result, setResult] = React.useState<string | null>(null);
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
      setResult(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [note]);

  const persist = React.useMemo(
    () =>
      debounce((id: string, content: string) => {
        void db.notes.update(id, {
          content,
          title: deriveTitle(content, ""),
          updatedAt: Date.now(),
        });
      }, 400),
    [],
  );

  const onChange = (value: string) => {
    setDraft(value);
    if (note) persist(note.id, value);
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

  const makeCards = async () => {
    if (!note || !draft.trim()) return;
    setBusy("cards");
    setResult(null);
    const drafts = await generateCards(draft, { modelId: cheapestAvailable(configured), count: 12 });
    setBusy(null);
    if (!drafts?.length) {
      setResult("Couldn't turn this into cards — check your API key, or add more to the note.");
      return;
    }
    const deck = await createDeck(note.title || "Untitled note", { sourceNoteId: note.id });
    await db.cards.bulkAdd(drafts.map((c) => newCard(deck.id, c.front, c.back)));
    onOpenDeck(deck.id);
  };

  const makePaper = async () => {
    if (!note || !draft.trim()) return;
    setBusy("paper");
    setResult(null);
    const paper = await createPaper({
      title: note.title || "Untitled",
      content: draft,
      format: "report",
    });
    setBusy(null);
    onOpenPaper(paper.id);
  };

  if (!note) {
    return (
      <SectionIndex
        title="Notes"
        newLabel="New note"
        emptyTitle="Nothing written down yet."
        emptyHint="Keep an answer from a chat, or start from a blank page. Notes are markdown, and they feed the flashcards and papers."
        items={[...(notes ?? [])]
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((n) => ({
            id: n.id,
            title: n.title || "Untitled note",
            preview: n.content.replace(/^#.*$/m, "").replace(/\s+/g, " ").trim().slice(0, 120),
            meta: new Date(n.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            pinned: n.pinned,
          }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={(id) => void db.notes.delete(id)}
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
      <DetailBar onBack={onBack} backLabel="All notes">
        <span className="mr-auto text-xs text-tertiary tnum">
          {words} word{words === 1 ? "" : "s"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil size={13} /> : <Eye size={13} />}
          {preview ? "Edit" : "Preview"}
        </Button>
        <Button size="sm" variant="ghost" onClick={makeCards} disabled={busy !== null || !draft.trim()}>
          {busy === "cards" ? <span className="think-orb" aria-hidden /> : <Layers size={13} />}
          Flashcards
        </Button>
        <Button size="sm" variant="ghost" onClick={makePaper} disabled={busy !== null || !draft.trim()}>
          {busy === "paper" ? <span className="think-orb" aria-hidden /> : <Printer size={13} />}
          Make paper
        </Button>
        <Button size="sm" variant="ghost" onClick={exportMarkdown}>
          <Download size={13} />
        </Button>
      </DetailBar>

      {result && (
        <div className="mx-auto mt-2 w-full max-w-[var(--measure)] px-4">
          <p className="border-l-2 border-[var(--stop)] py-1 pl-3 text-sm text-primary anim-fade">
            {result}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
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
              // Field-sizing keeps the box exactly as tall as the text, so the
              // page scrolls rather than a box inside the page.
              className="min-h-[60vh] w-full resize-none overflow-hidden bg-transparent font-sans text-base leading-[1.65] text-primary outline-none placeholder:text-tertiary"
            />
          )}
        </div>
      </div>
    </div>
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
    tags: [],
    sourceConversationId: conversationId,
  };
  await db.notes.add(note);
  return note;
}
