"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, Download, Eye, GraduationCap, HelpCircle, ListTree, Paperclip, Pencil,
  Scissors, SpellCheck2, Tags, X,
} from "lucide-react";
import type { Note } from "@/lib/types";
import { db, deleteNote, deriveTitle } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { reviseCanvas } from "@/lib/generate";
import { extractPdf, isPdf } from "@/lib/pdf";
import { Markdown } from "@/components/chat/Markdown";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { DiffView } from "@/components/CanvasView";
import { Button, SaveBadge } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";
import { cn } from "@/lib/utils";

/**
 * What to do with a book.
 *
 * These are the whole feature. "Summarise this" gets you a summary from any
 * model on any day; what makes a page worth keeping is being asked for the
 * right shape — a lesson that teaches rather than a heading that names, a
 * question that can be got wrong rather than one whose answer is the previous
 * sentence. Each one says what it must not do as well as what it must, because
 * the failure mode of all four is a table of contents wearing a costume.
 */
const LESSONS = [
  "Turn the source into a course of lessons, and replace this page with it.",
  "Work out the real sequence first: what has to be understood before what. Order the lessons that way, not by the order the source happens to present things.",
  "Give each lesson a heading that names the idea, then, in this order:",
  "- one sentence on what it lets you do that you could not do before;",
  "- the idea itself, explained in plain words, long enough to actually land;",
  "- a worked example with the working shown, taken from the source where there is one and invented in the same spirit where there is not;",
  "- two or three things to try, with the answers at the end of the lesson, not omitted.",
  "Six to ten lessons. Fewer and deeper beats more and thinner.",
  "Do not write a table of contents. Do not write a lesson that only says what the section of the book was about — a lesson that can be read without teaching anything is not a lesson.",
  "Markdown, headings and prose. Say nothing you did not get from the source, and where the source is unclear, say that rather than inventing a resolution.",
].join("\n");

const SUMMARY = [
  "Replace this page with a summary of the source.",
  "Lead with the argument: what it claims, and what it is arguing against. Then how it supports that, in the order the support actually builds.",
  "Keep the specifics — the numbers, names, dates and examples that carry the argument. A summary that drops every particular is a description of the shape of a book rather than an account of it.",
  "Mark clearly anything the source itself leaves open or admits it cannot show.",
  "Markdown. No preamble about what you are about to do.",
].join("\n");

const TERMS = [
  "Replace this page with the vocabulary of the source.",
  "Every term someone would have to know to read this and follow it, defined as the source uses it — not as a dictionary would.",
  "One line each: the term, then what it means here, then, where it helps, what it is often confused with.",
  "Group them by the part of the subject they belong to, and order the groups the way someone learning would meet them.",
  "Leave out words that are only difficult and not load-bearing.",
].join("\n");

const QUESTIONS = [
  "Replace this page with questions that test whether the source has been understood.",
  "Fifteen or so, ordered from recall to application to judgement.",
  "Every question must be answerable from the source, and every answer must be given, under the question, with the reasoning — not a bare key at the bottom.",
  "No question whose answer is the sentence before it, and none that can be got right by recognising a word. A good question makes it possible to be wrong for an interesting reason.",
  "Markdown.",
].join("\n");

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
  /**
   * A book, or a paper, or a chapter — whatever you want the page made out of.
   *
   * Held for the session and not written to the database. What is worth
   * keeping is the lessons, and they end up in the page like anything else you
   * wrote there; storing the source as well would double the size of a
   * notebook to keep a copy of a file you already have.
   */
  const [source, setSource] = React.useState<{ name: string; text: string; pages?: number } | null>(null);
  const [reading, setReading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
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
      setSource(null);
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
  /* `label` is what this will be called afterwards — on the diff, and in the
     page's history. The chips send three sentences of instruction and mean one
     word, and "Turn the source into a course of lessons, and replace this…"
     as a heading is the prompt leaking into the record of what happened. */
  const run = async (text: string, label?: string) => {
    if (!text.trim() || busy || !note) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      /* The source goes as reference material, generously sliced. The page
         itself is still what comes back — asking for lessons rewrites the
         page, it does not append the book to it. */
      const out = await reviseCanvas(
        draft,
        text,
        "doc",
        undefined,
        modelId,
        source ? [{ name: source.name, content: source.text }] : undefined,
        120_000,
      );
      if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ content: out, note: label ?? text });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  /** Read a file into the session. PDFs get their text pulled out; the rest
      are read as text, which covers markdown, plain notes and source. */
  const attach = async (file: File) => {
    setReading(true);
    setNotice(null);
    try {
      if (isPdf(file)) {
        const got = await extractPdf(file);
        if (got.imageOnly) {
          setNotice(`${file.name} is a scan — pictures of pages with no text in them. There is nothing to read.`);
          return;
        }
        setSource({ name: file.name, text: got.text, pages: got.pages });
      } else {
        const text = await file.text();
        if (!text.trim()) {
          setNotice(`${file.name} is empty.`);
          return;
        }
        setSource({ name: file.name, text });
      }
    } catch {
      setNotice(`Could not read ${file.name}.`);
    } finally {
      setReading(false);
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
        emptyHint="Keep an answer from a chat, start from a blank page, or hand it a book: attach a PDF and it will turn it into lessons, a summary, the vocabulary, or questions that test whether you followed it. Pages are markdown — the same text you can send back to a model, export, and still read in a year."
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
                    {/* What you can do changes with what is on the page. With a
                        book attached the page is not a draft to tidy, it is an
                        empty seat in front of the material — so the offer is
                        lessons, not proofreading. */}
                    {source ? (
                      <>
                        <NoteChip busy={busy} icon={<GraduationCap size={12} />} onClick={() => void run(LESSONS, "Make lessons")}>
                          Make lessons
                        </NoteChip>
                        <NoteChip busy={busy} icon={<BookOpen size={12} />} onClick={() => void run(SUMMARY, "Summarise it")}>
                          Summarise it
                        </NoteChip>
                        <NoteChip busy={busy} icon={<Tags size={12} />} onClick={() => void run(TERMS, "Key terms")}>
                          Key terms
                        </NoteChip>
                        <NoteChip busy={busy} icon={<HelpCircle size={12} />} onClick={() => void run(QUESTIONS, "Questions")}>
                          Questions
                        </NoteChip>
                      </>
                    ) : (
                      <>
                        <NoteChip busy={busy} icon={<Scissors size={12} />} onClick={() => void run("Tighten this. Cut every word that is not doing work, and keep every fact.", "Tighten")}>
                          Tighten
                        </NoteChip>
                        <NoteChip busy={busy} icon={<SpellCheck2 size={12} />} onClick={() => void run("Fix the spelling, grammar and punctuation. Change nothing else — not the wording, not the structure.", "Proofread")}>
                          Proofread
                        </NoteChip>
                        <NoteChip busy={busy} icon={<ListTree size={12} />} onClick={() => void run("Add headings and a little structure where the page has grown long enough to need them. Do not rewrite the prose.", "Add structure")}>
                          Add structure
                        </NoteChip>
                      </>
                    )}
                  </div>
                }
                left={
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.md,.markdown,.txt,.rtf,text/*,application/pdf"
                      aria-label="Choose something to read"
                      tabIndex={-1}
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) await attach(f);
                      }}
                    />
                    {source ? (
                      <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-inset py-1 pl-2.5 pr-1 text-sm">
                        <BookOpen size={13} className="shrink-0 text-[var(--accent-2)]" />
                        <span className="min-w-0 truncate text-secondary">{source.name}</span>
                        <span className="shrink-0 text-xs text-faint tnum">
                          {source.pages ? `${source.pages}p` : `${Math.round(source.text.length / 1000)}k`}
                        </span>
                        <button
                          onClick={() => setSource(null)}
                          aria-label={`Put ${source.name} away`}
                          className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded-full text-tertiary transition-colors duration-[var(--dur-fast)] hover:text-primary"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={reading}
                        className="btn-touch ctl-h focus-inset flex shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:opacity-50"
                      >
                        <Paperclip size={16} />
                        <span className="hidden sm:inline">{reading ? "Reading…" : "Read something"}</span>
                      </button>
                    )}
                  </>
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
