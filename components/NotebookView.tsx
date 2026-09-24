"use client";

import { printMarkdown } from "@/lib/print";
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { whyItFailed } from "@/lib/complete";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, Download, Eye, Printer, GraduationCap, HelpCircle, Highlighter, Layers, Link2, ListTree,
  MessageSquare, Paperclip, Pencil, Scissors, SpellCheck2, Tags, X, Plus, BookMarked, ChevronDown } from "lucide-react";
import type { Note, Source } from "@/lib/types";
import { addCards, addSource, createDeck, createNote, db, deleteNote, deriveTitle, removeSource, sourcesOf } from "@/lib/db";
import { backlinksTo, outlineOf, readLink, readingTime, tagsIn, withLinks } from "@/lib/links";
import { makeCloze } from "@/lib/study";
import { rank, select } from "@/lib/retrieve";
import { PAGE_TEMPLATES } from "@/lib/pageTemplates";
import { offerUndo } from "@/lib/undo";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { draftCards, makeFromSources, reviseCanvas } from "@/lib/generate";
import { citeScore, extractCitations, findIn, type Citation } from "@/lib/cite";
import { extractPdf, isPdf } from "@/lib/pdf";
import { Markdown } from "@/components/chat/Markdown";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { DiffView } from "@/components/DiffView";
import { Button, SaveBadge } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";
import { plainLine } from "@/lib/plain";
import { PACK, packMarkdown, packOf, packSourceOf, packTitle, sourceName } from "@/lib/revision";
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

/**
 * Revision notes, which is not any of the other four.
 *
 * Lessons teach, a summary accounts for a book, terms define and questions
 * test. None of them is the thing a student actually wants the night before:
 * the topic, ranked — what must be known exactly, the formula with its
 * symbols named, the mistake everyone makes, how it is asked, and four
 * questions to find out whether any of it went in.
 *
 * The callout markers are not decoration and are named here on purpose: the
 * renderer draws them (`components/chat/Callout.tsx`), so the page comes back
 * looking like notes rather than like an essay about the notes. A model left
 * to itself writes prose, and prose is what nobody revises from.
 */
const REVISION = [
  "Replace this page with revision notes on the source.",
  "Not a summary and not a lesson. Notes somebody revises from: dense, ranked, and scannable in five minutes.",
  "In this order:",
  "- a one-line statement of what the topic is actually about;",
  "- **What you must know** — five to nine bullets, each one a thing that could be asked and marked;",
  "- **Key terms** — the term, then what it means as this source uses it, one line each;",
  "- **How it works** — the idea in plain words, with one worked example and the working shown;",
  "- **Check yourself** — four questions, then their answers under a sub-heading, not omitted.",
  "Use these callouts where they earn their place, and nowhere else:",
  "> [!key] a fact that has to be remembered exactly",
  "> [!formula] a formula, with every symbol named underneath it",
  "> [!mistake] the thing people reliably get wrong, and what to do instead",
  "> [!exam] how this is actually asked, and what earns the marks",
  "At most six callouts in the whole page. A page where everything is highlighted has nothing highlighted.",
  "No preamble, no table of contents, no heading that only names what a section was about. Say nothing you did not get from the source, and where the source is unclear say so rather than inventing a resolution.",
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
  onAsked,
  onSelect,
  onNew,
  onBack,
  onAsk,
  onToChat,
}: {
  noteId: string | null;
  configured: Record<string, boolean>;
  /** An instruction to carry out on this page, sent from elsewhere. */
  ask?: { text: string; nonce: number };
  /** Said once it has been carried out, so it is not delivered twice. */
  onAsked?: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
  /** A passage, taken to the chat with a question about it. */
  onAsk?: (question: string) => void;
  /** Into the chat, from an empty notebook: the answers that will be kept here are written there. */
  onToChat?: () => void;
}) {
  // No default value: `undefined` has to keep meaning "not back yet", or the
  // index cannot tell an empty library from an unanswered query.
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray(), []);
  const note = useLiveQuery(() => (noteId ? db.notes.get(noteId) : undefined), [noteId]);
  const [preview, setPreview] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  /* The same fact one render earlier, for anything that has to know now rather
     than at the next paint. */
  const busyRef = React.useRef(false);
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
  const previewRef = React.useRef<HTMLDivElement>(null);
  const loadedFor = React.useRef<string | null>(null);
  /**
   * Words somebody has drawn a line under, and the sentence they sit in.
   *
   * The move a highlighter makes, and the one every tool built for notes has
   * settled on: the passage you are looking at is the thing you want to ask
   * about, or the fact you want to be asked again later. Read from the
   * browser's own selection inside the preview, and cleared the moment it
   * is. */
  const [picked, setPicked] = React.useState<{ text: string; sentence: string; x: number; y: number } | null>(null);
  /**
   * A question put to every page at once.
   *
   * The thing the grounded tools are for, and the thing a pile of pages
   * cannot do for you: "what did I write about the Krebs cycle" answered
   * from the pages, with each claim quoting the page it came from — and
   * the quote checked against the page by this app, so a citation the model
   * made up is shown as one. The pages most likely to hold the answer go
   * in first, because a notebook can be bigger than a request.
   */
  const [question, setQuestion] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [answer, setAnswer] = React.useState<{ body: string; citations: Citation[]; from: { id: string; title: string }[] } | null>(null);
  /** Narrow the index to one tag, or to none. */
  const [tag, setTag] = React.useState<string | null>(null);
  /* One pass over the pages for both the chips and the filter, rather than
     two regex walks of every page on every keystroke into the ask box. And
     the tag in force is the chosen one only while it still exists: delete
     the last page carrying it and the filter would otherwise hold an empty
     list open with no chip left to press. */
  const tagged = React.useMemo(() => {
    const byId = new Map<string, string[]>();
    for (const n of notes ?? []) byId.set(n.id, tagsIn(n.content));
    const counts = new Map<string, number>();
    for (const list of byId.values()) for (const t of list) counts.set(t, (counts.get(t) ?? 0) + 1);
    return {
      byId,
      counts: [...counts.entries()].map(([t, n]) => ({ tag: t, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)),
    };
  }, [notes]);
  const activeTag = tag && tagged.counts.some((c) => c.tag === tag) ? tag : null;

  useAutoGrow(textareaRef, preview ? "" : draft);

  // Load once per note, so a keystroke never races the live query that the
  // same keystroke caused.
  React.useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      loadedFor.current = note.id;
      setDraft(note.content);
      /* A page with writing on it opens as it reads — headings, lists,
         tables — not as the marks that make them. The "# " and "- " at the
         start of every line were the first thing a page showed. Edit is
         one press, top right; an empty page opens ready to type. */
      setPreview(Boolean(note.content.trim()));
      setProposal(null);
      setNotice(null);
      setInstruction("");
      setOpenCite(null);
      /* On a desk the caret is a gift; on a phone opening a page to read it
         must not raise the keyboard over it. */
      if (!window.matchMedia?.("(pointer: coarse)").matches) requestAnimationFrame(() => textareaRef.current?.focus());
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
  /** The instruction now waiting, and which page it was typed about. */
  const askedForRef = React.useRef<{ nonce: number; key: string } | null>(null);
  React.useEffect(() => {
    if (!ask || ask.nonce === askedRef.current || !note) return;
    // The page it was typed about, remembered the moment it arrives.
    if (askedForRef.current?.nonce !== ask.nonce) askedForRef.current = { nonce: ask.nonce, key: note.id };
    /* Not while something else is arriving: the nonce used to be marked
       consumed before `run` was called, and `run` returns immediately when it
       is busy, so a sentence typed during a long generation was taken and
       silently dropped. The ref rather than the state, which is a render
       behind; `busy` stays in the dependencies so this runs again the moment
       the room is free. And if you have moved to another page in the meantime
       it is dropped rather than carried out here. */
    if (busyRef.current) return;
    const meant = askedForRef.current.key === note.id;
    askedRef.current = ask.nonce;
    askedForRef.current = null;
    if (meant && ask.text === "/pack") {
      /* Handed from Study with nothing attached yet: ask for the file, and
         make the pack the moment it lands. */
      packOnAttach.current = true;
      setNotice("Attach the chapter — a PDF or a text file — and the pack is made the moment it lands.");
      /* Best effort: a picker opened from an effect only opens while the
         press that got us here still counts as a gesture. The notice and
         the attach control cover the case where it does not. */
      fileRef.current?.click();
    } else if (meant) {
      setInstruction(ask.text);
      void run(ask.text);
    }
    /* Said out loud, so the sentence is not delivered a second time — this view
       takes it on the nonce alone, and leaving it set in the parent meant
       coming back to the notebook later rewrote whatever page was open. */
    onAsked?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.nonce, note?.id, busy]);

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
  /**
   * The page, turned into cards you will actually be asked again.
   *
   * The gap this closes is the whole argument for a notebook living inside
   * an assistant rather than beside one. Revision notes are read once and
   * then sit there; the thing that makes them stick is being asked, later,
   * at the point you are about to forget — which is a scheduler and a table,
   * and is already in this app one room over. Without this the two rooms
   * never meet and the notebook is a copybook.
   */
  const makeCards = async () => {
    if (busyRef.current || !note) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const drafts = await draftCards(draft.slice(0, 20_000), { about: note.title, modelId });
      if (!drafts?.length) {
        setNotice("Nothing usable came back — there may not be enough on the page yet.");
        return;
      }
      const deck = await createDeck(note.title || "This page", "note");
      const n = await addCards(deck.id, drafts, "note");
      setNotice(`${n} card${n === 1 ? "" : "s"} made — they are in Study.`);
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /**
   * The pack: three pages and a deck out of what is attached.
   *
   * Not "replace this page" three times. A pack is a set — the organiser to
   * pin up, the Cornell notes to cover and answer, the questions to sit
   * under time — and a set wants to be pages beside each other, named for
   * the source, that come back as one file. See lib/revision.ts for why
   * these three and not a summary.
   */
  const runPack = async () => {
    if (busyRef.current || !note || !sources.length) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const source = sourceName(sources);
    const made: Note[] = [];
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      for (const recipe of PACK) {
        setNotice(`Writing the ${recipe.label.toLowerCase()}…`);
        setLive("");
        const raw = await makeFromSources(
          recipe.instruction,
          sources.map((x) => ({ name: x.name, text: x.text })),
          modelId,
          undefined,
          {
            signal: ctrl.signal,
            onText: setLive,
            onMoved: (why: string) => setNotice(`${why} — asked another model instead.`),
            /* A book too long for one call is read in parts first, and that
               takes a while: say so, with a count, rather than sit silent. */
            onPart: (done: number, total: number) =>
              setNotice(done < total ? `Reading the whole of it — part ${done + 1} of ${total}…` : "Read it all. Writing…"),
            onRead: ({ sampled }: { parts: number; sampled: string[] }) => {
              if (sampled.length) setNotice(`${sampled.join(", ")} is very long — read in an even spread of parts across it. Writing…`);
            },
          },
        );
        if (stopped()) {
          setNotice(made.length ? `Stopped after ${made.length} page${made.length === 1 ? "" : "s"}.` : "Stopped. Nothing was made.");
          return;
        }
        if (!raw) continue;
        const { text: body, citations } = extractCitations(raw, sources);
        const page = await createNote({
          title: packTitle(source, recipe),
          content: body,
          citations,
          madeAt: Date.now(),
          madeFrom: sources.map((x) => x.id),
          sourceConversationId: note.sourceConversationId,
        });
        made.push(page);
      }
      /* Cards from the organiser: it is the ranked list of what can be
         asked, which is what a deck should be made of. */
      const organiser = made.find((m) => m.title.endsWith("Knowledge organiser"));
      let cards = 0;
      if (organiser) {
        setNotice("Making the cards…");
        const drafts = await draftCards(organiser.content.slice(0, 20_000), { about: source, modelId }).catch(() => null);
        if (drafts?.length) {
          const deck = await createDeck(source, "pack");
          cards = await addCards(deck.id, drafts, "pack");
        }
      }
      if (!made.length) {
        setNotice("Nothing usable came back. Try again, or attach a clearer source.");
        return;
      }
      setNotice(
        `${made.length} page${made.length === 1 ? "" : "s"}${cards ? ` and ${cards} card${cards === 1 ? "" : "s"}` : ""} made — ` +
          `the pages are in the Notebook${cards ? ", the cards in Study" : ""}. Download the pack from any of its pages.`,
      );
      onSelect(made[0].id);
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setLive("");
      busyRef.current = false;
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!packOnAttach.current || !sources.length || busyRef.current) return;
    packOnAttach.current = false;
    void runPack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length]);

  /** The pack this page is part of, if it is part of one. */
  const pack = React.useMemo(() => (note ? packOf(note, notes ?? []) : []), [note, notes]);

  /** The pack as one file, with how to use it on the front. */
  const downloadPack = () => {
    if (!note || !pack.length) return;
    const source = note.title.split(" — ")[0];
    const blob = new Blob([packMarkdown(source, pack)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${source.replace(/[^\w-]+/g, "-").toLowerCase()}-revision-pack.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async (text: string, label?: string) => {
    // The ref, claimed in the same tick: `busy` is a render behind, so two
    // presses in one frame both read false and both sent a request.
    if (!text.trim() || busyRef.current || !note) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    busyRef.current = true;
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
          {
            signal: ctrl.signal,
            onText: setLive,
            onMoved: (why: string) => setNotice(`${why} — asked another model instead.`),
            /* A book too long for one call is read in parts first, and that
               takes a while: say so, with a count, rather than sit silent. */
            onPart: (done: number, total: number) =>
              setNotice(done < total ? `Reading the whole of it — part ${done + 1} of ${total}…` : "Read it all. Writing…"),
            onRead: ({ sampled }: { parts: number; sampled: string[] }) => {
              if (sampled.length) setNotice(`${sampled.join(", ")} is very long — read in an even spread of parts across it. Writing…`);
            },
          },
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
        onMoved: (why: string) => setNotice(`${why} — asked another model instead.`),
        onText: setLive,
      });
      if (stopped()) setNotice("Stopped. The page is unchanged.");
      else if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ for: note.id, content: out, note: label ?? text });
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      abortRef.current = null;
      setLive(null);
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Read a file in and keep it. PDFs get their text pulled out; the rest
      are read as text, which covers markdown, plain notes and source. */
  /** Set by the Study room's "Make a revision pack": the next source makes one. */
  const packOnAttach = React.useRef(false);

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
    if (readLink(href)) {
      e.preventDefault();
      void onLinkClick(href);
      return;
    }
    const m = href.match(/^#armi-cite-(\d+)$/);
    if (!m) return;
    e.preventDefault();
    const found = (note?.citations ?? []).find((c) => c.n === Number(m[1]));
    if (found) setOpenCite(found);
  };

  React.useEffect(() => {
    if (!preview) return;
    const onUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      const box = previewRef.current;
      if (!sel || !text || !box || sel.rangeCount === 0 || !box.contains(sel.anchorNode)) {
        setPicked(null);
        return;
      }
      /* The sentence around the words, for a cloze. The nearest block's
         text, split the way a person would, and the piece that has the
         selection in it. */
      const block = (sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as Element))
        ?.closest("p, li, td, h1, h2, h3, h4, blockquote");
      const whole = block?.textContent ?? text;
      const sentence =
        whole.split(/(?<=[.!?])\s+/).find((piece) => piece.includes(text)) ?? whole;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const home = box.getBoundingClientRect();
      setPicked({ text, sentence: sentence.trim(), x: rect.left + rect.width / 2 - home.left, y: rect.top - home.top });
    };
    const clear = () => setPicked(null);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    document.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onUp);
      document.removeEventListener("scroll", clear, true);
    };
  }, [preview]);

  /* Every page, for resolving links and for the list of what points here.
     The index already holds them; nothing more is read. */
  const pages = React.useMemo(() => (notes ?? []).map((n) => ({ id: n.id, title: n.title, content: n.content })), [notes]);
  const backlinks = React.useMemo(() => (note ? backlinksTo(note, pages) : []), [note, pages]);
  const outline = React.useMemo(() => outlineOf(draft), [draft]);

  /**
   * A link, pressed.
   *
   * To a page that exists: open it. To one that does not: make it, named as
   * the link named it, and open that — so a link is never broken, it is
   * either a page or the beginning of one. Sharing the citation handler,
   * because both are anchors the renderer drew and one listener on the
   * container is the whole mechanism.
   */
  const onLinkClick = async (href: string): Promise<boolean> => {
    const target = readLink(href);
    if (!target) return false;
    if (target.kind === "note") onSelect(target.id);
    else {
      const made = await createNote({ title: target.title, content: `# ${target.title}\n\n` });
      onSelect(made.id);
    }
    return true;
  };

  /** Scroll the preview to its nth heading, or put the caret on that line. */
  const jumpTo = (index: number) => {
    if (preview) {
      const heads = previewRef.current?.querySelectorAll("h1, h2, h3, h4");
      heads?.[index]?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    let seen = -1;
    let at = 0;
    let inFence = false;
    for (const line of draft.split("\n")) {
      if (/^\s*```/.test(line)) inFence = !inFence;
      else if (!inFence && /^#{1,4}\s/.test(line) && ++seen === index) break;
      at += line.length + 1;
    }
    ta.focus();
    ta.setSelectionRange(at, at);
    const lineHeight = 26;
    ta.scrollIntoView({ block: "nearest" });
    window.scrollTo({ top: Math.max(0, ta.getBoundingClientRect().top + window.scrollY + (draft.slice(0, at).split("\n").length - 3) * lineHeight) });
  };

  /* A sentence from the page, with the words you chose taken out of it,
     straight into Study. No model: the sentence is already written, and
     the fact to remember is the one you pointed at. */
  const clozeFromPick = async () => {
    if (!picked || !note) return;
    const made = makeCloze(picked.sentence, picked.text);
    if (!made) {
      setNotice("Choose words inside one sentence to make a card from it.");
      return;
    }
    const deck =
      (await db.decks.where("updatedAt").above(0).toArray()).find((d) => d.name === (note.title || "This page")) ??
      (await createDeck(note.title || "This page", "note"));
    const n = await addCards(deck.id, [made], "note");
    setNotice(n ? "Card made — it is in Study." : "That card is already in the deck.");
    setPicked(null);
    window.getSelection()?.removeAllRanges();
  };

  const askNotebook = async () => {
    const q = question.trim();
    if (!q || asking) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    const all = (notes ?? []).filter((n) => n.content.trim());
    if (!all.length) {
      setNotice("There is nothing written down yet to ask about.");
      return;
    }
    /* The parts of the pages that bear on the question, chosen by the same
       retrieval the projects use: every page whole while it all fits, and
       the relevant paragraphs from across the notebook when it does not. A
       notebook can be larger than a request, and the pages that never
       mention the subject are not where the answer is. Two hundred thousand
       characters is room for a term's notes. */
    /* Named uniquely. Two pages called the same thing — two untitled ones,
       most often — would be one source to the retrieval and one page to a
       citation, and a quote from the second would be checked against the
       first and marked as not found. */
    const seen = new Map<string, number>();
    const named = all.map((n) => {
      const base = n.title || "Untitled note";
      const k = (seen.get(base) ?? 0) + 1;
      seen.set(base, k);
      return { n, name: k === 1 ? base : `${base} (${k})` };
    });
    const chosen = select(q, named.map((x) => ({ name: x.name, text: x.n.content })), 200_000);
    /* Most relevant first. The model reads the pages in the order they are
       given and leans on the early ones; the page about the question should
       be the first it sees, and the ones that never mention it last. */
    const order = rank(q, chosen.map((c, i) => ({ source: c.name, index: i, text: c.text })), chosen.length).map((c) => c.index);
    const picked = [...order.map((i) => chosen[i]), ...chosen.filter((_, i) => !order.includes(i))];
    const ranked = picked.map((p) => named.find((x) => x.name === p.name)!.n);
    /* The source the citations are checked against is the page as picked —
       the excerpt, where it was one — so a quote from a paragraph that was
       not sent cannot be claimed to have come from it. */
    const sources: Source[] = picked.map((p, i) => ({
      id: ranked[i].id, noteId: ranked[i].id, name: p.name, text: p.text, size: p.text.length, addedAt: ranked[i].updatedAt,
    }));
    setAsking(true);
    setNotice(null);
    setAnswer(null);
    try {
      const raw = await makeFromSources(
        `Answer this question from the pages: ${q}\n\nA short answer — a paragraph or two, or a list if the question wants one. If the pages do not answer it, say so in one line rather than guessing. A […] in a page marks something left out between two parts of it; it is not the writer's words.`,
        sources.map((x) => ({ name: x.name, text: x.text })),
        modelId,
        200_000,
      );
      if (!raw) {
        setNotice("Nothing usable came back. Try asking it differently.");
        return;
      }
      const { text: body, citations } = extractCitations(raw, sources);
      const cited = new Set(citations.map((c) => c.sourceId));
      setAnswer({ body, citations, from: ranked.filter((n) => cited.has(n.id)).map((n) => ({ id: n.id, title: n.title || "Untitled note" })) });
      const score = citeScore(citations);
      if (score.missing) setNotice(`${score.missing} of ${score.total} citation${score.total === 1 ? "" : "s"} could not be found on the page it names — marked with a “?”.`);
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setAsking(false);
    }
  };

  /* The answer as a page, for the ones worth keeping. */
  const keepAnswer = async () => {
    if (!answer) return;
    const made = await createNote({
      title: question.trim().slice(0, 80),
      content: `# ${question.trim()}\n\n${answer.body}`,
      citations: answer.citations,
    });
    onSelect(made.id);
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
      <>
      {openCite && <CitePanel cite={openCite} onClose={() => setOpenCite(null)} />}
      <SectionIndex
        title="Notebook"
        newLabel="New page"
        right={<RevisePicker configured={configured} />}
        emptyTitle="Nothing written down yet."
        emptyHint="Pages are markdown: text you can send back to a model, export, and still read in a year."
        loading={notes === undefined}
        waysIn={[
          { label: "New page", icon: <Plus size={12} />, onPick: onNew },
          ...(onToChat ? [{ label: "Keep an answer from a chat", icon: <MessageSquare size={12} />, onPick: onToChat }] : []),
        ]}
        /* The box that asks the pages is not shown until there are pages:
           "what did I write about the Krebs cycle?" over an empty notebook
           is a question with one answer, and a box that invites it is the
           room pretending to be fuller than it is. */
        lead={notes && notes.length > 0 && (
          <div className="mb-4">
            <MessageBar
              value={question}
              onChange={setQuestion}
              onSubmit={() => void askNotebook()}
              placeholder="Ask your notebook — “what did I write about the Krebs cycle?”"
              ariaLabel="Ask your notebook"
              canSend={Boolean(question.trim()) && !asking}
              busy={asking}
              className="glass"
            />
            {asking && <p className="sheen mt-2 text-sm font-medium">Reading the pages</p>}
            {notice && <p className="mt-2 text-sm text-warning">{notice}</p>}
            {answer && (
              <div className="mt-3 rounded-xl border border-line bg-surface p-4" aria-label="The answer">
                <div onClick={(e) => {
                  const href = (e.target as HTMLElement).closest("a")?.getAttribute("href") ?? "";
                  const m = href.match(/^#armi-cite-(\d+)$/);
                  if (!m) return;
                  e.preventDefault();
                  const found = answer.citations.find((c) => c.n === Number(m[1]));
                  if (found) setOpenCite(found);
                }}>
                  <Markdown content={answer.body} />
                </div>
                {/* Which pages it drew on, each a press away, and the way to
                    keep the answer if it turned out to be one worth having. */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  {answer.from.length > 0 && <span className="text-xs text-faint">From</span>}
                  {answer.from.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onSelect(f.id)}
                      className="tap focus-inset rounded-full border border-line bg-field px-2.5 py-1 text-xs text-secondary hover:border-line-strong hover:text-primary"
                    >
                      {f.title}
                    </button>
                  ))}
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void keepAnswer()}>Keep as a page</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnswer(null)}>Close</Button>
                  </span>
                </div>
              </div>
            )}
            {/* The tags, wherever they were written, as a row that narrows
                the list. Only once there are two — one tag is a label, not a
                way of finding anything. */}
            {(tagged.counts.length >= 2 || activeTag) && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tags">
                {tagged.counts.slice(0, 16).map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setTag(activeTag === t.tag ? null : t.tag)}
                    aria-pressed={activeTag === t.tag}
                    className={cn(
                      "tap focus-inset rounded-full border px-2.5 py-1 text-xs transition-colors duration-[var(--dur-fast)]",
                      activeTag === t.tag ? "border-accent bg-accent-subtle text-accent" : "border-line bg-surface text-secondary hover:border-line-strong hover:text-primary",
                    )}
                  >
                    #{t.tag} <span className="tnum text-faint">{t.n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        items={[...(notes ?? [])]
          .filter((n) => !activeTag || (tagged.byId.get(n.id) ?? []).includes(activeTag))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((n) => ({
            id: n.id,
            title: n.title || "Untitled note",
            /* The first heading is the title, so the preview starts after it. */
            preview: plainLine(n.content.replace(/^\s*#[^\n]*\n?/, "")),
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
      </>
    );
  }

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All pages">
        <span className="mr-auto flex items-center gap-2.5">
          <span className="text-xs text-tertiary tnum">
            {words} word{words === 1 ? "" : "s"}
            {words >= 200 && <span className="text-faint"> · {readingTime(draft)}</span>}
          </span>
          <SaveBadge state={autosave.state} />
        </span>
        <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil size={13} /> : <Eye size={13} />}
          {preview ? "Edit" : "Preview"}
        </Button>
        <Button size="sm" variant="ghost" onClick={exportMarkdown} aria-label="Download as Markdown">
          <Download size={13} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { if (!printMarkdown(note.title || "Untitled", draft)) setNotice("The browser blocked the print window. Allow pop-ups for this page and try again."); }} aria-label="Save as PDF">
          <Printer size={13} />
          PDF
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
              <span className="eyebrow text-faint">
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
              className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-[1.6] text-tertiary"
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
          {/* `paper-scroll` and `paper-sheet` are what the print stylesheet
              knows this page by: on paper the scroller has to unroll and the
              sheet has to lose its column, its margins and its ground. */}
          <div className="paper-scroll min-h-0 flex-1 overflow-y-auto">
            {/* A page is read properly, re-read and kept, so it is set as a
                document rather than as a conversation: a step up in size and
                leading, and a column a shade wider. */}
            <div data-read="doc" className="paper-sheet mx-auto w-full max-w-[var(--measure)] px-4 pb-8 pt-4">
              {/* Whether this is still an account of what it was made from.
                  Not a warning about the page being wrong — it may be fine —
                  but the one fact a reader cannot work out for themselves. */}
              {stale && (
                <p className="mb-3 rounded-lg border border-line bg-inset px-3 py-2 text-xs text-warning">
                  {stale} since this page was made. What is on it still says what it said then.
                </p>
              )}
              {/* Somewhere to stand on a long page. Read from the text, so it
                  is there while editing too, and only once there is enough
                  page for it to be worth the room. */}
              {outline.length >= 3 && (
                <nav aria-label="On this page" className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {outline.map((h) => (
                    <button
                      key={h.index}
                      onClick={() => jumpTo(h.index)}
                      className={cn(
                        "focus-inset rounded-sm text-left text-tertiary hover:text-primary hover:underline",
                        h.level >= 3 && "pl-2 text-faint",
                      )}
                    >
                      {h.text}
                    </button>
                  ))}
                </nav>
              )}
              {preview ? (
                draft.trim() ? (
                  <div ref={previewRef} onClick={onCiteClick} className="relative">
                    <Markdown content={withLinks(draft, pages)} />
                    {/* The offer, over the words. Three things a passage can
                        become, and nothing that needs a menu. */}
                    {picked && (
                      <div
                        role="toolbar"
                        aria-label="Do something with the selection"
                        className="glass anim-menu absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border border-line p-0.5 shadow-lg"
                        style={{ left: Math.max(90, picked.x), top: Math.max(0, picked.y - 6) }}
                      >
                        {onAsk && (
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              onAsk(`From my notes on ${note.title || "this page"}:\n\n> ${picked.text}\n\nExplain this — what it means, why it is true, and what people get wrong about it.`);
                              setPicked(null);
                            }}
                            className="focus-inset flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-secondary hover:bg-subtle hover:text-primary"
                          >
                            <MessageSquare size={11} />
                            Ask
                          </button>
                        )}
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void clozeFromPick()}
                          className="focus-inset flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-secondary hover:bg-subtle hover:text-primary"
                        >
                          <Layers size={11} />
                          Card
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-tertiary">Nothing to preview yet.</p>
                )
              ) : !draft.trim() ? (
                <>
                  {/* A shape to start in, offered only while there is nothing
                      to lose. Three structures students are taught and never
                      remember to type. */}
                  <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Start from a shape">
                    {PAGE_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onChange(t.body);
                          requestAnimationFrame(() => textareaRef.current?.focus());
                        }}
                        title={t.blurb}
                        className="tap focus-inset rounded-full border border-line bg-surface px-3 py-1 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={"Title\n\nStart writing…"}
                    spellCheck
                    aria-label="Page content"
                    className="bare min-h-[50vh] w-full resize-none overflow-hidden bg-transparent font-sans text-base leading-[1.65] text-primary outline-none placeholder:text-tertiary"
                  />
                </>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={"Title\n\nStart writing…"}
                  spellCheck
                  aria-label="Page content"
                  // Field-sizing keeps the box exactly as tall as the text, so the
                  // page scrolls rather than a box inside the page.
                  className="bare min-h-[50vh] w-full resize-none overflow-hidden bg-transparent font-sans text-base leading-[1.65] text-primary outline-none placeholder:text-tertiary"
                />
              )}
              {/* Every page that names this one. The half of linking no
                  editor gives you for free, and the reason a notebook is a
                  shape rather than a pile. */}
              {backlinks.length > 0 && (
                <aside className="mt-8 border-t border-line pt-3" aria-label="Linked from">
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-faint">
                    <Link2 size={11} />
                    Linked from
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {backlinks.map((b) => (
                      <li key={b.id}>
                        <button
                          onClick={() => onSelect(b.id)}
                          className="tap focus-inset rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-secondary hover:border-line-strong hover:text-primary"
                        >
                          {b.title || "Untitled note"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          </div>

          <div className="composer-dock no-print shrink-0 px-4 pt-2">
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
                    {pack.length > 0 && (
                      <>
                      <NoteChip busy={false} icon={<Download size={12} />} onClick={downloadPack}>
                        Download the pack
                      </NoteChip>
                      <NoteChip busy={false} icon={<Printer size={12} />} onClick={() => { const source = packSourceOf(note.title) ?? note.title; const pages = packOf(note, notes ?? []); printMarkdown(`${source} — revision pack`, packMarkdown(source, pages.length ? pages : [note])); }}>
                        Save the pack as PDF
                      </NoteChip>
                      </>
                    )}
                    {sources.length ? (
                      <>
                        {/* The pack stays out, because it is what somebody
                            with a chapter and an exam actually came for. The
                            six single pages that are its parts sit behind one
                            press. They were seven chips across two rows —
                            a wall the eye had to read before it could find
                            the one it wanted, on a bar that is meant to be a
                            line you type into. The composer had already
                            settled this: tools are chosen from a menu, not
                            left staring. */}
                        <NoteChip busy={busy} icon={<BookMarked size={12} />} onClick={() => void runPack()}>
                          Revision pack
                        </NoteChip>
                        <NoteMenu
                          busy={busy}
                          label="More ways to use this"
                          items={[
                            { name: "Revision notes", blurb: "The material rewritten as notes to revise from.", icon: <Highlighter size={15} />, run: () => void run(REVISION, "Revision notes") },
                            { name: "Make lessons", blurb: "A short course, a lesson a section.", icon: <GraduationCap size={15} />, run: () => void run(LESSONS, "Make lessons") },
                            { name: "Summarise it", blurb: "The whole thing on one page.", icon: <BookOpen size={15} />, run: () => void run(SUMMARY, "Summarise it") },
                            { name: "Key terms", blurb: "Each term, and what it means as this source uses it.", icon: <Tags size={15} />, run: () => void run(TERMS, "Key terms") },
                            { name: "Questions", blurb: "Exam-style questions, with answers.", icon: <HelpCircle size={15} />, run: () => void run(QUESTIONS, "Questions") },
                            { name: "Make cards", blurb: "Flashcards into a deck, ready to study.", icon: <Layers size={15} />, run: () => void makeCards() },
                          ]}
                        />
                      </>
                    ) : (
                      <>
                        <NoteChip busy={busy} icon={<Scissors size={12} />} onClick={() => void run("Tighten this. Cut every word that is not doing work, and keep every fact.", "Tighten")}>
                          Tighten
                        </NoteChip>
                        <NoteMenu
                          busy={busy}
                          label="More ways to edit this"
                          items={[
                            { name: "Proofread", blurb: "Spelling, grammar and punctuation. Nothing else.", icon: <SpellCheck2 size={15} />, run: () => void run("Fix the spelling, grammar and punctuation. Change nothing else — not the wording, not the structure.", "Proofread") },
                            { name: "Add structure", blurb: "Headings where the page has grown long enough to need them.", icon: <ListTree size={15} />, run: () => void run("Add headings and a little structure where the page has grown long enough to need them. Do not rewrite the prose.", "Add structure") },
                          ]}
                        />
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
                      /* The word is hidden on a phone, so the name is on the
                         button itself, or the paperclip is a mute icon. */
                      aria-label={reading ? "Reading…" : sources.length ? "Add another" : "Read something"}
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
          <span className="eyebrow text-faint">
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

/**
 * The rest of what a page can be turned into, behind one press.
 *
 * The same shape as the composer's + menu — a trigger that looks like the
 * chips beside it, a panel that names each thing with a line of what it
 * does — so the two rooms teach one habit rather than two.
 */
function NoteMenu({
  busy,
  label,
  items,
}: {
  busy: boolean;
  label: string;
  items: { name: string; blurb: string; icon: React.ReactNode; run: () => void }[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          disabled={busy}
          aria-label={label}
          className={cn(
            "tap focus-inset inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)]",
            "hover:border-line-strong hover:text-primary disabled:opacity-50",
            open && "border-line-strong text-primary",
          )}
        >
          More
          <ChevronDown size={12} className="text-tertiary" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
        >
          {items.map((it) => (
            <button
              key={it.name}
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              <span className="mt-0.5 shrink-0 text-tertiary">{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block">{it.name}</span>
                <span className="block text-xs text-tertiary">{it.blurb}</span>
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
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

