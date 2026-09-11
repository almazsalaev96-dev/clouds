"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, Download, Eye, GraduationCap, HelpCircle, ListTree, Paperclip, Pencil,
  Scissors, SpellCheck2, Tags, X,
} from "lucide-react";
import type { Note, Source } from "@/lib/types";
import { addSource, db, deleteNote, deriveTitle, removeSource, sourcesOf } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { makeFromSources, reviseCanvas } from "@/lib/generate";
import { citeScore, extractCitations, findIn, type Citation } from "@/lib/cite";
import { extractPdf, isPdf } from "@/lib/pdf";
import { Markdown } from "@/components/chat/Markdown";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { DiffView } from "@/components/DiffView";
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
  ask,
  onSelect,
  onNew,
  onBack,
}: {
  noteId: string | null;
  configured: Record<string, boolean>;
  /** An instruction to carry out on this page, sent from elsewhere. */
  ask?: { text: string; nonce: number };
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
  /**
   * A revision waiting to be accepted, and the page it is a revision *of*.
   *
   * `for` is not redundant with the open note. A proposal is component state
   * and the open note is a prop: switching pages while one is up leaves the
   * two disagreeing for as long as it takes an effect to run, and accepting in
   * that window wrote one page's text over another page. Carrying the id means
   * the check does not depend on the order React happens to do things in.
   *
   * `from` is the sources as they were when the model read them, not as they
   * are when the button is pressed. Adding a fourth book between the two and
   * then accepting used to record a page as made from four books, three of
   * which it was, and staleness is computed against that record.
   */
  const [proposal, setProposal] = React.useState<
    { for: string; content: string; note: string; citations?: Citation[]; from?: string[] } | null
  >(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  /* What is arriving, and the way to stop it. A page made from three sources
     is the longest wait in the app, and it was the emptiest. */
  const [live, setLive] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const stop = React.useCallback(() => abortRef.current?.abort(), []);
  const stopped = () => Boolean(abortRef.current?.signal.aborted);
  const reviseModel = useReviseModel(configured);
  /**
   * What the page is made out of. However many of them there are.
   *
   * These used to be one file held in memory for as long as you stayed on the
   * page — attach a book, get lessons, and the book was gone the moment you
   * left. Which made this a converter rather than a place: everything it
   * produced was cut loose from what it came from the instant it existed, so
   * the only question worth asking about a generated page — where did that
   * come from — had no answer.
   *
   * Kept now, and kept in full, because the text is the thing a claim gets
   * checked against. A source you cannot re-read is a citation you have to
   * take on trust, which is the thing this is for not doing.
   */
  const sources = useLiveQuery(
    () => (noteId ? sourcesOf(noteId) : Promise.resolve([] as Source[])),
    [noteId],
    [] as Source[],
  );
  /* The citations of the page as it stands, and the one being read. */
  const [openCite, setOpenCite] = React.useState<Citation | null>(null);
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
      setOpenCite(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [note]);

  const autosave = useAutosave<Note>(
    noteId,
    React.useCallback((id, patch) => {
      void db.notes.update(id, { ...patch, updatedAt: Date.now() });
    }, []),
  );

  /* An instruction handed over from ⌘K while you were looking at this page.
     Run once per arrival rather than on every render: a re-render is not a
     second request, and a page rewritten twice from one sentence is a page
     whose history now has a step nobody asked for. */
  const askedRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (!ask || ask.nonce === askedRef.current || !note) return;
    askedRef.current = ask.nonce;
    setInstruction(ask.text);
    void run(ask.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.nonce, note?.id]);

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
      /* Two different jobs wearing one box.
         With material in the room, this is "make me something out of what I
         brought", and what comes back has to be traceable to it. With none, it
         is the ordinary revision every other room does to the thing on screen.
         Sending the second down the first path would ask a model to cite a
         page against sources that do not exist. */
      if (sources.length) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLive("");
        const raw = await makeFromSources(
          text,
          sources.map((s) => ({ name: s.name, text: s.text })),
          modelId,
          undefined,
          { signal: ctrl.signal, onText: setLive },
        );
        /* A page cut off mid-sentence is not a page, and its citations are
           whatever happened to have arrived. Stop means nothing happened. */
        if (stopped()) {
          setNotice("Stopped. The page is unchanged.");
          return;
        }
        if (!raw) {
          setNotice("Nothing usable came back. Try saying it differently.");
          return;
        }
        /* Checked here rather than trusted. A citation the app has not looked
           for is a footnote, and a footnote nobody can check is decoration. */
        const { text: body, citations } = extractCitations(raw, sources);
        const score = citeScore(citations);
        setProposal({ for: note.id, content: body, note: label ?? text, citations, from: sources.map((s) => s.id) });
        /* Said separately, because they are different news. A missing quote
           means the page may be wrong; an unchecked one means this app could
           not tell, which is a smaller thing and must not be reported as the
           larger one. */
        const parts: string[] = [];
        if (score.missing) {
          parts.push(
            `${score.missing} of ${score.total} citation${score.total === 1 ? "" : "s"} could not be found in the sources`,
          );
        }
        if (score.unchecked) {
          parts.push(`${score.unchecked} could not be checked`);
        }
        if (parts.length) {
          setNotice(`${parts.join(", and ")} — those are marked with a “?”.`);
        }
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLive("");
      const out = await reviseCanvas(draft, text, "doc", undefined, modelId, undefined, 120_000, undefined, {
        signal: ctrl.signal,
        onText: setLive,
      });
      if (stopped()) setNotice("Stopped. The page is unchanged.");
      else if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ for: note.id, content: out, note: label ?? text });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      abortRef.current = null;
      setLive(null);
      setBusy(false);
    }
  };

  /** Read a file in and keep it. PDFs get their text pulled out; the rest
      are read as text, which covers markdown, plain notes and source. */
  const attach = async (file: File) => {
    if (!noteId) return;
    setReading(true);
    setNotice(null);
    try {
      if (isPdf(file)) {
        const got = await extractPdf(file);
        if (got.imageOnly) {
          setNotice(`${file.name} is a scan — pictures of pages with no text in them. There is nothing to read.`);
          return;
        }
        await addSource(noteId, { name: file.name, text: got.text, pages: got.pages, size: file.size });
      } else {
        const text = await file.text();
        if (!text.trim()) {
          setNotice(`${file.name} is empty.`);
          return;
        }
        await addSource(noteId, { name: file.name, text, size: file.size });
      }
    } catch {
      setNotice(`Could not read ${file.name}.`);
    } finally {
      setReading(false);
    }
  };

  const accept = () => {
    if (!proposal || !note) return;
    // The page this was a revision of, which is not always the page now open.
    if (proposal.for !== note.id) {
      setProposal(null);
      setNotice("That revision was for a different page, so it was not applied.");
      return;
    }
    setDraft(proposal.content);
    autosave.save(note.id, { content: proposal.content, title: deriveTitle(proposal.content, "") });
    /* What it was made from and when, written straight through rather than
       through autosave: this is not something the reader typed, and it has to
       be true of the page the moment the page is true. Together they answer
       "is this still an account of what it was made from" — a source added or
       removed since is a page that may now be wrong, and saying so costs less
       than a reader finding out.

       Only when this revision *has* sources behind it. An ordinary "make it
       shorter" used to write `citations: []` and clear both fields, so a page
       built from three books lost every citation in it, and its whole record
       of where it came from, to a request that had nothing to do with either.
       A revision that says nothing about provenance says nothing about it. */
    if (proposal.citations) {
      void db.notes.update(note.id, {
        citations: proposal.citations,
        madeAt: Date.now(),
        madeFrom: proposal.from ?? [],
      });
    }
    setProposal(null);
    setInstruction("");
  };

  /**
   * Whether the page still matches what it was made from.
   *
   * Only for pages that *were* made from something: a page you wrote yourself
   * has no such claim to be out of date about, and telling everyone their own
   * writing is stale is how a notice gets ignored.
   */
  const stale = React.useMemo(() => {
    const was = note?.madeFrom;
    if (!was || !note?.madeAt) return null;
    const now = new Set(sources.map((s) => s.id));
    const gone = was.filter((id) => !now.has(id)).length;
    const added = sources.filter((s) => !was.includes(s.id)).length;
    if (!gone && !added) return null;
    const parts: string[] = [];
    if (added) parts.push(`${added} source${added === 1 ? " was" : "s were"} added`);
    if (gone) parts.push(`${gone} ${gone === 1 ? "was" : "were"} removed`);
    return parts.join(" and ");
  }, [note?.madeFrom, note?.madeAt, sources]);

  /**
   * A citation, opened.
   *
   * Caught on the container rather than given to every marker, because the
   * markers are produced by the markdown renderer and are ordinary links by
   * the time they reach the page. One listener, and the href says which.
   */
  const onCiteClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href") ?? "";
    const m = href.match(/^#armi-cite-(\d+)$/);
    if (!m) return;
    e.preventDefault();
    const found = (note?.citations ?? []).find((c) => c.n === Number(m[1]));
    if (found) setOpenCite(found);
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


      {openCite && <CitePanel cite={openCite} onClose={() => setOpenCite(null)} />}

      {/* A word about the change, shown *with* the change.
          This used to live only in the composer, which is hidden while a diff
          is up — so "three of these citations could not be found" appeared at
          the exact moment it could not be read, and then vanished when you
          accepted. The one thing you need before deciding belongs where the
          deciding happens. */}
      {busy && live !== null && (
        <div className="mx-auto w-full max-w-[var(--measure)] shrink-0 px-4 pt-3">
          <div className="rounded-xl border border-line bg-inset p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="think-orb shrink-0" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                Writing the page
              </span>
              <span className="tnum min-w-0 flex-1 text-xs text-tertiary">
                {live.length.toLocaleString()} characters
              </span>
              <button
                onClick={stop}
                className="focus-inset shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                Stop
              </button>
            </div>
            <pre
              aria-live="polite"
              className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-tertiary"
            >
              {live || "…"}
            </pre>
          </div>
        </div>
      )}

      {proposal && notice && (
        <div className="mx-auto w-full max-w-[var(--measure)] shrink-0 px-4 pt-3">
          <p className="rounded-lg border border-[var(--warning)] bg-inset px-3 py-2 text-xs text-warning">
            {notice}
          </p>
        </div>
      )}

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
              {/* Whether this is still an account of what it was made from.
                  Not a warning about the page being wrong — it may be fine —
                  but the one fact a reader cannot work out for themselves. */}
              {stale && (
                <p className="mb-3 rounded-lg border border-line bg-inset px-3 py-2 text-xs text-warning">
                  {stale} since this page was made. What is on it still says what it said then.
                </p>
              )}
              {preview ? (
                draft.trim() ? (
                  <div onClick={onCiteClick}>
                    <Markdown content={draft} />
                  </div>
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
                /* Send becomes stop, in place — the same control chat has had
                   all along, in the room with the longest waits in the app. */
                streaming={busy}
                onStop={stop}
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
                    {sources.length ? (
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
                    {/* Every source, and always the way to add another. One
                        was the old limit and it was the wrong shape: things
                        worth understanding usually arrive as several files,
                        and a page made from three of them is the ordinary
                        case, not an advanced one. */}
                    {sources.map((src) => (
                      <span
                        key={src.id}
                        className="flex min-w-0 items-center gap-1.5 rounded-full bg-inset py-1 pl-2.5 pr-1 text-sm"
                      >
                        <BookOpen size={13} className="shrink-0 text-[var(--accent-2)]" />
                        <span className="min-w-0 max-w-[9rem] truncate text-secondary">{src.name}</span>
                        <span className="shrink-0 text-xs text-faint tnum">
                          {src.pages ? `${src.pages}p` : `${Math.round(src.text.length / 1000)}k`}
                        </span>
                        <button
                          onClick={async () => offerUndo(src.name, await removeSource(src.id))}
                          aria-label={`Put ${src.name} away`}
                          className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded-full text-tertiary transition-colors duration-[var(--dur-fast)] hover:text-primary"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={reading}
                      className="btn-touch ctl-h focus-inset flex shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:opacity-50"
                    >
                      <Paperclip size={16} />
                      <span className="hidden sm:inline">
                        {reading ? "Reading…" : sources.length ? "Add another" : "Read something"}
                      </span>
                    </button>
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
/**
 * The passage behind a claim.
 *
 * The whole point of the citation, and the reason it is worth the machinery:
 * a reader can go from a sentence on a generated page to the words in the file
 * it came from, in one press, without leaving the page or trusting anybody.
 *
 * A citation that could not be found gets a panel too, and it says so plainly
 * instead of quietly not opening. A failed check is information — it is the
 * one claim on the page a reader most needs to look at themselves — and a
 * marker that does nothing when pressed reads as a bug rather than a warning.
 */
function CitePanel({ cite, onClose }: { cite: Citation; onClose: () => void }) {
  /* Found, missing, or never checked — and the last of those is not a warning
     about the source, so it does not get the warning's colour. Painting "this
     quote was four words long" in the same red as "these words are not in the
     document" tells the reader the page is unsound when what happened is that
     this app declined to judge. */
  const unchecked = !cite.found && cite.why !== "missing" && cite.why !== undefined;
  return (
    <div className="mx-auto w-full max-w-[var(--measure)] shrink-0 px-4 pt-3">
      <div
        className={cn(
          "rounded-xl border bg-surface p-3",
          cite.found || unchecked ? "border-line" : "border-[var(--warning)]",
        )}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            {cite.found ? "In the source" : unchecked ? "Not checked" : "Not found in the source"}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
            {cite.sourceName}
            {cite.at?.page ? ` · around page ${cite.at.page}` : ""}
          </span>
          <button
            onClick={onClose}
            aria-label="Close the source"
            className="ctl focus-inset flex [--ctl:1.625rem] shrink-0 items-center justify-center rounded-full text-tertiary transition-colors duration-[var(--dur-fast)] hover:text-primary"
          >
            <X size={14} />
          </button>
        </div>

        {cite.found ? (
          <p className="max-h-40 overflow-y-auto text-sm leading-relaxed text-secondary">
            {/* The quoted words, marked inside the passage they came from, so
                you read them where they sit rather than on their own. */}
            {splitAround(cite.context ?? "", cite.quote).map((part, i) =>
              part.hit ? (
                <mark key={i} className="rounded bg-accent-subtle px-0.5 text-primary">
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        ) : (
          <>
            <p className="text-sm text-secondary">
              {cite.why === "short" ? (
                <>
                  Too few words to check. A quote this short turns up in almost any
                  document by chance, so finding it would not have meant anything —
                  this is not a claim that the sentence is wrong, only that nothing
                  here has confirmed it.
                </>
              ) : cite.why === "unnamed" ? (
                <>
                  No source to check it against. It named{" "}
                  {cite.sourceName === "unknown" ? "nothing" : <>&ldquo;{cite.sourceName}&rdquo;</>}, which
                  does not match one of the files on this page — so the quote was never
                  looked for, rather than looked for and missed.
                </>
              ) : (
                <>
                  These words are not in {cite.sourceName}. Whatever this sentence says, it
                  was not read there — treat it as the model&rsquo;s own and check it yourself.
                </>
              )}
            </p>
            <p className="mt-1.5 rounded-lg bg-inset px-2.5 py-1.5 text-sm text-tertiary">
              &ldquo;{cite.quote}&rdquo;
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** The quote inside its context, for marking it — matched loosely, shown exactly. */
function splitAround(context: string, quote: string): { text: string; hit: boolean }[] {
  const at = findIn(context, quote);
  if (!at) return [{ text: context, hit: false }];
  return [
    { text: context.slice(0, at.start), hit: false },
    { text: context.slice(at.start, at.end), hit: true },
    { text: context.slice(at.end), hit: false },
  ].filter((p) => p.text);
}

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

