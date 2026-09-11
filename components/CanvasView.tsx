"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Braces, Bug, Check, Eye, FileCode2, FilePlus2, FileText, FileType2, History,
  LayoutTemplate, MessageSquareCode, Palette, Pencil, Play, RotateCcw,
  Maximize2, Minimize2, MousePointerClick, ScanSearch, Scroll, Terminal, TextSelect, X,
  CalendarRange, CheckCheck, ListChecks, Sparkles, Timer, Wand2,
} from "lucide-react";
import type { Canvas, CanvasFile, CanvasVersion } from "@/lib/types";
import {
  addCanvasFile, createCanvas, createWebCanvas, db, deleteCanvas, deleteCanvasFile,
  filesOfCanvas, pushVersion, revertCanvas, versionsOf,
} from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { useSettings } from "@/lib/store";
import {
  checkChange,
  explainCode,
  fixInstruction,
  nameOf,
  planChanges,
  standingRules,
  reviewCode,
  reviseElement,
  reviseCanvas,
  reviseSelection,
  type Picked,
  type PlanStep,
  type Progress,
} from "@/lib/generate";
import { collapse, diffStat, lineDiff, type DiffOp } from "@/lib/diff";
import { assembleWeb, ENTRY, locate, runToken, webTemplate } from "@/lib/web";
import { MakeRow } from "@/components/MakeRow";
import { DiffView } from "@/components/DiffView";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { CodeEditor, type Jump, type Selection } from "@/components/CodeEditor";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton, Kbd, SaveBadge } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";

/**
 * The canvas: a document you and the model both write to.
 *
 * A chat answer longer than a screen is not help, it is homework — you read
 * it, find the three lines that changed, and paste them somewhere by hand. So
 * a revision here comes back as *the document*, and the only question you have
 * to answer is whether to keep it.
 *
 * Which is why nothing a model produces lands without being shown first. The
 * diff is not a nicety: handing the pen to something that rewrites the whole
 * file is only safe if you can see what it touched, and if you cannot, people
 * accept anyway and a quiet deletion in the middle of a working file ships.
 *
 * A canvas comes in three shapes. A document is prose. A code file is one
 * file. A **web app** is a folder — markup, styling and behaviour — that runs
 * in a sandboxed frame beside the editor, with its console piped back out, so
 * the loop from "change this" to "see it" never leaves the room.
 */

const LANGS = ["ts", "tsx", "js", "py", "go", "rs", "sql", "sh", "html", "css", "json", "md"];

const LANG_OF: Record<string, string> = {
  html: "html", htm: "html", css: "css", js: "js", mjs: "js", jsx: "js",
  ts: "ts", tsx: "tsx", json: "json", svg: "html", md: "md",
};

const langOfName = (name: string) => LANG_OF[name.split(".").pop()?.toLowerCase() ?? ""] ?? "txt";

/** A mark per kind of file, so the tab strip is scannable at a glance. */
function FileMark({ lang }: { lang: string }) {
  const size = 12;
  if (lang === "html") return <FileType2 size={size} />;
  if (lang === "css") return <Palette size={size} />;
  if (lang === "json") return <Braces size={size} />;
  if (lang === "md" || lang === "txt") return <FileText size={size} />;
  return <FileCode2 size={size} />;
}

/* ----------------------------------------------------------------- index -- */

export function CanvasView({
  canvasId,
  configured,
  seed,
  ask,
  onSelect,
  onNew,
  onFocus,
  onBack,
  onAsked,
}: {
  canvasId: string | null;
  configured: Record<string, boolean>;
  /** Typed into "ask for a change" when a canvas has just been made from a
      starter, so the next step is a sentence to finish rather than a blank. */
  seed?: string;
  /** An instruction to carry out here, sent from elsewhere. */
  ask?: { text: string; nonce: number };
  /** Said once it has been carried out, so it is not delivered twice. */
  onAsked?: () => void;
  onSelect: (id: string, seed?: string) => void;
  onNew: () => void;
  /** Raised while a made thing has the window to itself. */
  onFocus?: (on: boolean) => void;
  onBack: () => void;
}) {
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().toArray(), []);
  const canvas = useLiveQuery(() => (canvasId ? db.canvases.get(canvasId) : undefined), [canvasId]);
  /* Every project, by id, so the index can say which one a canvas is in. One
     query for the list rather than one per row. */
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectName = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p.name || "Untitled project"])),
    [projects],
  );

  if (!canvas) {
    return (
      <SectionIndex
        title="Code"
        newLabel="New canvas"
        emptyTitle="No canvases yet."
        emptyHint="A canvas is a document you and the model both edit. Ask for a change and it comes back revised in place, with a diff, instead of pasted into the conversation."
        loading={canvases === undefined}
        lead={<Starters onSelect={onSelect} />}
        items={(canvases ?? []).map((c) => ({
          id: c.id,
          title: c.title || "Untitled",
          preview:
            c.kind === "web"
              ? "A web app — markup, styling and behaviour"
              : (c.content.split("\n").find((l) => l.trim()) ?? "Empty"),
          /* Which project it is in, when it is in one — the fact that changes
             what an edit here will obey, so it belongs on the row rather than
             two screens away. */
          meta: [
            c.projectId ? projectName.get(c.projectId) : undefined,
            c.kind === "web" ? "web app" : c.kind === "code" ? (c.lang ?? "code") : "doc",
          ]
            .filter(Boolean)
            .join(" · "),
          searchText: c.content,
        }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={async (id) => {
          const title = canvases?.find((c) => c.id === id)?.title || "canvas";
          offerUndo(title, await deleteCanvas(id));
        }}
      />
    );
  }

  return (
    <Editor
      key={canvas.id}
      canvas={canvas}
      configured={configured}
      seed={seed}
      ask={ask}
      onAsked={onAsked}
      onFocus={onFocus}
      onBack={onBack}
    />
  );
}

/**
 * What you can start. Three tiles rather than one button, because the three
 * shapes are not variations of a setting you would go looking for — they are
 * different rooms, and the only moment anyone is deciding between them is now.
 */
function Starters({ onSelect }: { onSelect: (id: string, seed?: string) => void }) {
  const start = [
    {
      icon: <LayoutTemplate size={16} />,
      title: "Web app",
      blurb: "A page that runs beside the editor.",
      make: async () => (await createWebCanvas(webTemplate(), { title: "Counter" })).id,
    },
    {
      icon: <MessageSquareCode size={16} />,
      title: "Code file",
      blurb: "One file, any language.",
      make: async () => (await createCanvas({ kind: "code", lang: "ts" })).id,
    },
    {
      icon: <FileText size={16} />,
      title: "Document",
      blurb: "Markdown you can print.",
      make: async () => (await createCanvas({ kind: "doc", title: "Untitled" })).id,
    },
  ];

  return (
    <div className="mb-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {start.map((s) => (
          <button
            key={s.title}
            onClick={async () => onSelect(await s.make())}
            className="lift focus-inset tap flex flex-col items-start gap-0.5 rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
          >
            <span className="text-accent">{s.icon}</span>
            <span className="mt-1 text-sm font-medium text-primary">{s.title}</span>
            <span className="text-xs text-tertiary">{s.blurb}</span>
          </button>
        ))}
      </div>

      {/* And the five that are already something. An empty folder is a fair
          place to start only if you already know what you are building. */}
      <p className="eyebrow mb-2 mt-5 text-faint">Or make one of these</p>
      <MakeRow onSelect={onSelect} />
    </div>
  );
}

/* ---------------------------------------------------------------- editor -- */

type Mode = "edit" | "preview" | "run";

function Editor({
  canvas,
  configured,
  seed,
  ask,
  onFocus,
  onBack,
  onAsked,
}: {
  canvas: Canvas;
  configured: Record<string, boolean>;
  seed?: string;
  /** An instruction to carry out here, sent from elsewhere. */
  ask?: { text: string; nonce: number };
  /** Said once it has been carried out, so it is not delivered twice. */
  onAsked?: () => void;
  /** The window belongs to the made thing now; the app gets out of the way. */
  onFocus?: (on: boolean) => void;
  onBack: () => void;
}) {
  const web = canvas.kind === "web";
  const files = useLiveQuery(() => (web ? filesOfCanvas(canvas.id) : []), [canvas.id, web], []);

  const [activeFileId, setActiveFileId] = React.useState<string | null>(null);
  const activeFile: CanvasFile | undefined =
    files.find((f) => f.id === activeFileId) ?? files[0];

  /* The one piece of text on screen, whichever shape the canvas is. Everything
     below — the editor, the diff, the history, the revise box — works on this
     and never has to know whether it came from a row or from the canvas. */
  const doc = web
    ? {
        key: activeFile?.id ?? "none",
        name: activeFile?.name ?? "",
        lang: activeFile?.lang,
        content: activeFile?.content ?? "",
        fileName: activeFile?.name,
      }
    : { key: canvas.id, name: canvas.title, lang: canvas.lang, content: canvas.content, fileName: undefined };

  const [draft, setDraft] = React.useState(doc.content);
  const [mode, setMode] = React.useState<Mode>(web ? "run" : "edit");
  /* Seeded, not empty, when this canvas was just made from a starter: the
     half-sentence the starter belongs to, with the caret after it. A blank box
     under a working demo asks "now what"; a sentence to finish answers it. */
  const [instruction, setInstruction] = React.useState(seed ?? "");
  const reviseModel = useReviseModel(configured);
  const [busy, setBusy] = React.useState<false | "revise" | "explain" | "review" | "plan" | "check">(false);
  /* The same fact as `busy`, one render earlier — see `begin` below, which is
     what claims it. Read by anything that has to know *now* rather than at the
     next paint. */
  const busyRef = React.useRef(false);

  /* An instruction handed over from somewhere else — ⌘K, typed while you were
     looking at this file. Seeding the box and leaving it there would make the
     command a navigation with a side effect; the whole point is that you said
     what you wanted and it happened. Run once per arrival, keyed on the nonce,
     because a re-render is not a second request. */
  const askedRef = React.useRef<number | undefined>(undefined);
  /** The instruction now waiting, and which document it was typed about. */
  const askedForRef = React.useRef<{ nonce: number; key: string } | null>(null);
  React.useEffect(() => {
    if (!ask || ask.nonce === askedRef.current) return;
    /* Not before there is a file to change. On a cold open the canvas and its
       files arrive from two live queries, so for a frame or two the draft is
       the empty string — and an instruction that fired then asked a model to
       revise an empty file and offered the result as a diff against nothing. */
    if (!doc.key || doc.key === "none") return;
    // The document it was typed about, remembered the moment it arrives.
    if (askedForRef.current?.nonce !== ask.nonce) askedForRef.current = { nonce: ask.nonce, key: doc.key };
    /* Not while something else is arriving. The nonce used to be marked
       consumed before `run` was called, and `run` returns immediately when it
       is busy — so a sentence typed into ⌘K during a long revision was taken,
       marked as delivered, and silently dropped. The ref rather than the state,
       because the state is a render behind; the state stays in the deps, so
       this runs again the moment the room is free.

       And if you have moved to another file in the meantime, it is dropped
       rather than carried out here: "make this a loop" was about the file you
       were looking at when you said it. */
    if (busyRef.current) return;
    if (askedForRef.current.key !== doc.key) {
      askedRef.current = ask.nonce;
      askedForRef.current = null;
      onAsked?.();
      return;
    }
    askedForRef.current = null;
    askedRef.current = ask.nonce;
    setInstruction(ask.text);
    void run(ask.text);
    /* Said out loud, so the sentence is not delivered a second time. The two
       views take this on the nonce alone, and it used to sit in the parent
       until something else replaced it: ask for a change to one file, open
       another, and this component remounts with a fresh ref, sees a nonce it
       has never recorded, and rewrites the file you have only just opened. */
    onAsked?.();
    // `run` closes over most of this component and is rebuilt every render;
    // listing it would re-fire the instruction on the next keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.nonce, doc.key, busy]);
  /* Using the thing rather than building it. A deck of cards, a timer, a quiz
     — these are made once and then used, and everything that helps you make
     one is in the way of using it. */
  const [focused, setFocused] = React.useState(false);
  /* What is highlighted in the editor. When there is something, a change is
     asked for that alone rather than for the file — which is the difference
     between "make this a loop" costing six lines and costing four hundred. */
  const [selection, setSelection] = React.useState<Selection | null>(null);
  /* Pointing at the running page. `picking` is the mode — crosshair on, clicks
     caught rather than delivered — and `picked` is what came back from it. */
  /* What is arriving, while it arrives, and the way to stop it.
     Every one of these calls was already a stream; it was being poured into a
     buffer nobody could see, so a four-hundred-line revision was forty seconds
     of a screen with no way to tell thinking from hung. */
  const [live, setLive] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  const [picking, setPicking] = React.useState(false);
  const [picked, setPicked] = React.useState<Picked | null>(null);

  const enterFocus = React.useCallback(() => {
    setMode("run");
    /* Disarmed on the way in. "Use it" is the mode for using the thing, and a
       picker still listening in the capture phase turns every click in it into
       a selection rather than a press — a timer you cannot start, a quiz you
       cannot answer, with a crosshair for a cursor and no visible chrome to
       explain it. */
    setPicking(false);
    setPicked(null);
    setFocused(true);
    onFocus?.(true);
  }, [onFocus]);

  const leaveFocus = React.useCallback(() => {
    setFocused(false);
    onFocus?.(false);
  }, [onFocus]);

  /* Escape leaves, because a screen with one way out and no visible chrome has
     to answer the key everybody presses. The listener is on the document
     rather than a wrapper: focus is usually inside the frame by then, and a
     frame on an opaque origin does not bubble its keys to us. */
  React.useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Captured and stopped. The app's own Escape backs you out of the item
         you are in, and without this one press did both: it handed the window
         back *and* left the canvas, so the thing you were using vanished
         behind the list it came from. While something has the window, Escape
         means one thing. */
      e.preventDefault();
      e.stopPropagation();
      leaveFocus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focused, leaveFocus]);

  // Leaving the canvas while focused would strand the app with no chrome.
  React.useEffect(() => () => onFocus?.(false), [onFocus]);
  /* What was there before the proposal, and what was asked for. Kept so the
     change can be checked against the request rather than admired on its own:
     a reviewer handed only the result reviews the result. */
  /* `file` is set only when the change belongs somewhere other than the file
     you are looking at — pointing at a button and asking for it to be smaller
     is a stylesheet change made from the markup tab. The diff shows that file
     and accepting writes to it. */
  const [proposal, setProposal] = React.useState<
    { content: string; note: string; before: string; file?: string } | null
  >(null);
  const [report, setReport] = React.useState<{ kind: ReportKind; text: string } | null>(null);
  /* The plan, when one has been asked for. Separate from `report` because its
     steps are pressable and a report is prose. */
  const [plan, setPlan] = React.useState<{ summary: string; steps: PlanStep[]; done: string[] } | null>(null);
  /* Standing rules for this canvas. Held in state as well as in the row so the
     textarea stays responsive; written through on close. */
  const [rulesOpen, setRulesOpen] = React.useState(false);

  /* The project this canvas belongs to, if it belongs to one.
     A project already held instructions every chat inside it could see; its
     own code could not, which made the conventions you wrote for the thing you
     were building the one context missing from every edit to it. */
  const project = useLiveQuery(
    () => (canvas.projectId ? db.projects.get(canvas.projectId) : undefined),
    [canvas.projectId],
  );
  /* Widest first, narrowest last, so the file can overrule the project. */
  const rules = React.useMemo(
    () =>
      standingRules({
        projectName: project?.name,
        projectInstructions: project?.instructions,
        fileRules: canvas.rules,
      }) ?? "",
    [project?.name, project?.instructions, canvas.rules],
  );
  /** Only what was typed for this file — the box edits that, not the project's. */
  const fileRules = canvas.rules ?? "";
  const allProjects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [], []);
  const [showHistory, setShowHistory] = React.useState(false);
  const [versions, setVersions] = React.useState<CanvasVersion[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [jump, setJump] = React.useState<Jump | undefined>();

  /* Switching file is switching document: the draft follows, and anything
     half-decided about the old one is dropped rather than applied to the new.

     The selection was not dropped, and it is a pair of line numbers. Highlight
     lines 40–60 of app.js, open style.css, ask for a change — and the change
     was spliced into lines 40–60 of the stylesheet, which are different lines
     of a different file in a different language. The picked element is the
     same kind of stale: it names a run of the page as it was. */
  React.useEffect(() => {
    setDraft(doc.content);
    setProposal(null);
    setReport(null);
    setSelection(null);
    setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.key]);

  // A file edited elsewhere — reverted from history, accepted from a diff —
  // must show here too, but only when this editor is not the one typing.
  const savedRef = React.useRef(doc.content);
  React.useEffect(() => {
    if (doc.content !== savedRef.current) {
      savedRef.current = doc.content;
      setDraft(doc.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.content]);

  const autosave = useAutosave<{ content: string }>(
    doc.key,
    React.useCallback(
      (key, patch) => {
        savedRef.current = patch.content ?? savedRef.current;
        if (web) {
          void db.canvasFiles.update(key, { ...patch, updatedAt: Date.now() });
          void db.canvases.update(canvas.id, { updatedAt: Date.now() });
        } else {
          void db.canvases.update(key, { ...patch, updatedAt: Date.now() });
        }
      },
      [web, canvas.id],
    ),
  );

  const runnable = web || (canvas.kind === "code" && (canvas.lang === "html" || canvas.lang === "css"));

  const loadVersions = React.useCallback(async () => {
    setVersions(await versionsOf(canvas.id, doc.fileName));
  }, [canvas.id, doc.fileName]);

  React.useEffect(() => {
    if (showHistory) void loadVersions();
  }, [showHistory, loadVersions]);

  /** The rest of the folder, so a revision can see what it has to fit into. */
  const siblings = React.useMemo(
    () =>
      web
        ? files.filter((f) => f.id !== activeFile?.id).map((f) => ({ name: f.name, content: f.content }))
        : undefined,
    [web, files, activeFile?.id],
  );

  /**
   * The progress hook every call in this room shares.
   *
   * One controller at a time, replaced on each start: two overlapping requests
   * from one composer is not a state this room can get into, and a stack of
   * abort controllers to handle a case that cannot happen is machinery that
   * only ever goes wrong.
   */
  /**
   * Take the room, or find it taken.
   *
   * `busy` is state, and state is a render behind — so five handlers each
   * reading it from their own closure could all pass in the same frame, and
   * four of them never read it at all. That was not merely a second request
   * and a second bill. Everything here shares one abort controller and one
   * arriving-text buffer, so starting a review during a revision replaced the
   * revision's controller: Stop then pointed at the review, and the revision
   * carried on writing into a box the reader had just stopped.
   *
   * A ref, checked and claimed in the same tick, which is what "one at a time"
   * actually requires.
   */
  const begin = React.useCallback((kind: "revise" | "explain" | "review" | "plan" | "check") => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(kind);
    return true;
  }, []);

  const watching = React.useCallback((): Progress => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLive("");
    return { signal: ctrl.signal, onText: setLive };
  }, []);

  /**
   * Whether the thing that just finished was stopped rather than finished.
   *
   * It matters more than it looks. A stopped *prose* answer is most of an
   * answer and worth keeping; a stopped *file* is a file cut off in the middle,
   * and offering that as a complete replacement is how pressing stop deletes
   * the second half of somebody's code. Same abort, opposite handling.
   */
  const stopped = React.useCallback(() => Boolean(abortRef.current?.signal.aborted), []);

  const settle = React.useCallback(() => {
    abortRef.current = null;
    busyRef.current = false;
    setLive(null);
    setBusy(false);
  }, []);

  /**
   * Ask for a change.
   *
   * `label` is what this is called afterwards, on the diff and in the file's
   * history: a shortcut sends three sentences and means two words.
   *
   * `scope` is which thing the sentence is about. "auto" reads the room — a
   * picked element, then a selection, then the file — which is right for
   * something you typed, because you typed it while looking at what you had
   * picked. It is wrong for everything that carries its own meaning: "Add
   * comments" and "Fix the error" are about the file and nothing else, and
   * they used to be quietly re-aimed at whatever element happened to still be
   * outlined in the preview, so pressing Fix on a console error rewrote a
   * button instead.
   */
  const run = async (text: string, label?: string, scope: "auto" | "file" = "auto") => {
    if (!text.trim()) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    if (!begin("revise")) return;
    setNotice(null);
    setReport(null);
    try {
      // The draft, not the saved copy: revising a version of the file you can
      // see on screen but the model cannot is the fastest way to lose an edit.
      /* Pointed at something in the running page: the change is about that
         element, and it may not even belong in the file you are looking at. */
      if (picked && scope === "auto") {
        const all = files.map((f) => ({
          name: f.name,
          content: f.id === activeFile?.id ? draft : f.content,
        }));
        const hit = await reviseElement(all, picked, text, modelId, rules, watching());
        if (stopped()) {
          setNotice("Stopped. Nothing was changed.");
          return;
        }
        if (!hit) {
          setNotice("That didn't come back as a change to one file. Try saying it differently.");
          return;
        }
        const target = all.find((f) => f.name === hit.file);
        if (target && hit.content.trim() === target.content.trim()) {
          setNotice("It came back unchanged — the instruction may not apply to that element.");
          return;
        }
        setProposal({
          content: hit.content,
          note: label ?? `${nameOf(picked)} — ${text}`,
          before: target?.content ?? "",
          file: hit.file,
        });
        return;
      }

      const out = selection && scope === "auto"
        ? await reviseSelection(draft, selection, text, doc.lang, modelId, rules, watching())
        : /* `undefined` is perSibling left at its default. Rules ride behind it
             because the notebook calls this positionally with a much larger
             one, and reordering to make this call site prettier would quietly
             cut a book down to a folder's worth of context. */
          await reviseCanvas(draft, text, canvas.kind, doc.lang, modelId, siblings, undefined, rules, watching());
      /* A file that stopped arriving is a file with its end missing, and a
         diff of it would read as "the rest was deleted". Thrown away on
         purpose: stop should mean nothing happened, not half-happened. */
      if (stopped()) setNotice("Stopped. Nothing was changed.");
      else if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ content: out, note: label ?? text, before: draft });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      settle();
    }
  };

  const review = async () => {
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!begin("review")) return;
    setNotice(null);
    try {
      const out = await reviewCode(draft, doc.lang, modelId, siblings, rules, watching());
      /* Kept even when stopped. Half a review is half a review; half a file is
         a broken file. The difference is whether the thing is read or run. */
      if (out) {
        setReport({ kind: "review", text: out });
        if (stopped()) setNotice("Stopped — this is as far as it got.");
      } else setNotice(stopped() ? "Stopped." : "The model didn't return a review. Try again.");
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      settle();
    }
  };

  /**
   * Plan it before it touches anything.
   *
   * Deliberately clears the box it was asked from. The goal has moved into the
   * plan; leaving it sitting in the composer invites sending it a second time
   * as a whole-file rewrite, which is the exact thing planning was meant to
   * avoid doing by accident.
   */
  const makePlan = async () => {
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!begin("plan")) return;
    setNotice(null);
    setReport(null);
    try {
      const out = await planChanges(draft, instruction, canvas.kind, doc.lang, modelId, siblings, rules, watching());
      if (stopped()) setNotice("Stopped. No plan was made.");
      else if (!out) setNotice("The plan didn't come back in a usable shape. Try again.");
      else if (!out.steps.length)
        setNotice(out.summary || "It didn't find anything here worth changing.");
      else {
        setPlan({ ...out, done: [] });
        setInstruction("");
      }
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      settle();
    }
  };

  /* One step, sent as the edit it was written to be. Marked done when it has
     been *kept*, not when it has been asked for — a step whose diff you
     discarded did not happen, and a plan that says otherwise is lying about
     the state of the file. */
  const runStep = (step: PlanStep) => run(step.instruction, step.title);

  /**
   * Check the change before keeping it.
   *
   * Reviewing is a different task from writing, which is why this is worth a
   * second call rather than a longer first one: the same model that produced a
   * diff will, asked to check one, notice the call site it did not update.
   */
  const check = async () => {
    if (!proposal) return;
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!begin("check")) return;
    setNotice(null);
    try {
      const out = await checkChange(proposal.before, proposal.content, proposal.note, doc.lang, modelId, watching());
      if (out) {
        setReport({ kind: "check", text: out });
        if (stopped()) setNotice("Stopped — this is as far as it got.");
      } else setNotice(stopped() ? "Stopped." : "The check didn't come back. Try again.");
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      settle();
    }
  };

  /* An error the running page actually produced, turned into an edit.
     The nearest thing a browser has to "run the tests and fix what fails", and
     the reason it is worth having is that this is a real failure from a real
     execution rather than a reading of the code. It goes down the ordinary
     revision path, so it arrives as a diff like everything else. */
  const fixError = React.useCallback(
    (message: string, where?: string) => {
      setMode("edit");
      // The file, whatever is picked or selected: this is an error the whole
      // page produced, not a remark about six highlighted lines.
      void run(fixInstruction(message, where), "Fix the error", "file");
    },
    // `run` is redefined every render and depends on most of this component;
    // listing it would rebuild this on every keystroke in the composer, and
    // the preview takes it as a prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, rules, siblings, reviseModel, busy],
  );

  const explain = async () => {
    const modelId = reviseModel;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!begin("explain")) return;
    setNotice(null);
    try {
      setReport({
        kind: "explain",
        text: (await explainCode(draft, doc.lang, modelId, siblings, undefined, watching())) ?? "Nothing came back.",
      });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      settle();
    }
  };

  /* `into` names a file other than the one on screen. Everything that edits
     the file you are looking at leaves it out; a change aimed at an element
     names the file it belongs in, which is often the stylesheet while you are
     standing in the markup. */
  const commit = async (content: string, into?: string) => {
    const target = into ? files.find((f) => f.name === into) : activeFile;
    if (web && target) {
      await db.canvasFiles.update(target.id, { content, updatedAt: Date.now() });
      await db.canvases.update(canvas.id, { updatedAt: Date.now() });
    } else {
      await db.canvases.update(canvas.id, { content, updatedAt: Date.now() });
    }
    // Only the file on screen is the one autosave is tracking.
    if (!into || target?.id === activeFile?.id) savedRef.current = content;
  };

  const accept = async () => {
    if (!proposal) return;
    /* Record what was there before replacing it. Without this a canvas whose
       first change comes from the model has no version to go back to — the
       history starts at the rewrite, and "undo" has nothing to undo to.
       Identical states collapse, so this is free when the state is already
       recorded. */
    /* The file the change is actually about, which is the one whose history
       has to record it. Recording a stylesheet edit against the markup would
       put a version in the wrong file's timeline and leave the right one with
       no way back. */
    const into = proposal.file && proposal.file !== doc.name ? proposal.file : undefined;
    const name = into ?? doc.fileName;

    await pushVersion(canvas.id, proposal.before, "you", undefined, name);
    if (!into) setDraft(proposal.content);
    await commit(proposal.content, into);
    await pushVersion(canvas.id, proposal.content, "model", proposal.note, name);
    /* A step is ticked here and nowhere else: when its change was kept. Asking
       for it is not doing it, and a plan that ticks on the request would show
       a list of things done for a file that was never touched. */
    setPlan((p) =>
      p && p.steps.some((st) => st.title === proposal.note) && !p.done.includes(proposal.note)
        ? { ...p, done: [...p.done, proposal.note] }
        : p,
    );
    setProposal(null);
    setReport(null);
    setInstruction("");
    setSelection(null);
    /* The element is let go once its change is in. What you pointed at may not
       even exist in the shape you pointed at it any more, and a chip still
       claiming to be about it would aim the next request at a description of
       something that has been rewritten. */
    setPicked(null);
    void loadVersions();
  };

  const column = canvas.kind === "doc" ? "max-w-[var(--measure)]" : "max-w-[var(--measure-wide)]";

  /* Using it.
     Not a different tree — the same one with its chrome stood down. React
     reconciles by position, so returning a smaller tree here would unmount the
     preview and mount a new one, which reloads the iframe: the deck reshuffles
     and the timer starts again the moment you go full-screen. Everything
     below hides in place, and the frame never moves. */
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {focused && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-3">
          <button
            onClick={leaveFocus}
            className="pointer-events-auto tap focus-inset flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs text-secondary shadow-md backdrop-blur transition-colors duration-[var(--dur-fast)] hover:text-primary"
          >
            <Minimize2 size={13} />
            Done
            <Kbd keys={["Esc"]} />
          </button>
        </div>
      )}
      <div className={cn(focused && "hidden")}>
      <DetailBar onBack={onBack} backLabel="All canvases" wide={canvas.kind !== "doc"}>
        {/* On a phone the title and five controls do not fit on one line, and
            what loses the fight is the title — the one thing that says which
            file you are in. So the row wraps: name first, controls under it. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
          <input
            value={canvas.title}
            onChange={(e) => void db.canvases.update(canvas.id, { title: e.target.value })}
            aria-label="Canvas title"
            className="tap min-w-0 flex-1 basis-full bg-transparent text-sm font-medium text-primary outline-none sm:basis-0"
          />
          <div className="flex min-w-0 shrink-0 items-center gap-1">
            <SaveBadge state={autosave.state} />

            {canvas.kind === "code" && (
              <select
                value={canvas.lang ?? "ts"}
                onChange={(e) => void db.canvases.update(canvas.id, { lang: e.target.value })}
                aria-label="Language"
                className="ctl-h focus-inset h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-secondary"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}

            {/* While a revision is waiting, the only decision left is keep or
            discard — so the view controls step out of the way rather than
            offering modes that the diff is already overriding. */}
            {!proposal && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                >
                  {mode === "edit" ? <Eye size={13} /> : <Pencil size={13} />}
                  {mode === "edit" ? "Preview" : "Edit"}
                </Button>
                {runnable && (
                  <Button
                    size="sm"
                    variant={mode === "run" ? "secondary" : "ghost"}
                    onClick={() => setMode(mode === "run" ? "edit" : "run")}
                  >
                    <Play size={13} />
                    {mode === "run" ? "Stop" : "Run"}
                  </Button>
                )}
                {/* The other half of making something: using it. A deck is
                    made once and studied twenty times, and on the twentieth
                    the tab strip, the editor and the box for asking for
                    changes are all furniture standing between you and the
                    card. This hands the whole window over. */}
                {runnable && (
                  <Button size="sm" variant="ghost" onClick={() => enterFocus()}>
                    <Maximize2 size={13} />
                    Use it
                  </Button>
                )}
                {/* Which project this belongs to. A select rather than a
                    dialog: there are rarely many projects, the change is one
                    field, and anything heavier makes "put this where it
                    belongs" a task rather than a thought. */}
                <select
                  value={canvas.projectId ?? ""}
                  onChange={(e) =>
                    void db.canvases.update(canvas.id, {
                      projectId: e.target.value || undefined,
                      updatedAt: Date.now(),
                    })
                  }
                  aria-label="Project this belongs to"
                  className="tap focus-inset max-w-[9rem] shrink-0 truncate rounded-md border border-line bg-surface px-2 py-1 text-xs text-secondary outline-none"
                >
                  <option value="">No project</option>
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Untitled project"}
                    </option>
                  ))}
                </select>

                {/* Standing rules. In the header rather than the composer
                    because they are set once and then true, and a control for
                    a thing you do once a month sitting next to the box you
                    type in every minute is a control in the way. The dot says
                    there are some without opening it. */}
                <IconButton
                  label={rules ? "House rules (set)" : "House rules"}
                  active={rulesOpen}
                  onClick={() => setRulesOpen((v) => !v)}
                >
                  <span className="relative">
                    <Scroll size={15} />
                    {rules && (
                      <span
                        aria-hidden
                        className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)]"
                      />
                    )}
                  </span>
                </IconButton>
                <IconButton
                  label="Version history"
                  active={showHistory}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <History size={15} />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </DetailBar>
      </div>

      <div className={cn(focused && "hidden")}>
      {web && !proposal && (
        <FileTabs
          files={files}
          activeId={activeFile?.id ?? null}
          onSelect={setActiveFileId}
          onAdd={async (name) => {
            const f = await addCanvasFile(canvas.id, { name, lang: langOfName(name) });
            setActiveFileId(f.id);
          }}
          onDelete={async (f) => {
            if (f.name === ENTRY) {
              setNotice("index.html is the page itself — the folder has nothing to open without it.");
              return;
            }
            if (activeFile?.id === f.id) setActiveFileId(null);
            offerUndo(f.name, await deleteCanvasFile(f.id));
          }}
        />
      )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {notice && !focused && (
            <p className={cn("mx-auto w-full px-4 pt-2 text-xs text-warning anim-fade", column)}>
              {notice}
            </p>
          )}

          {proposal ? (
            <DiffView
              wide={canvas.kind !== "doc"}
              /* `proposal.before` rather than `draft`: a change aimed at an
                 element is a diff of the file it belongs in, which is not
                 necessarily the file the editor is showing. */
              before={proposal.before}
              after={proposal.content}
              note={proposal.file && proposal.file !== doc.name
                ? `${proposal.file} — ${proposal.note}`
                : proposal.note}
              onAccept={accept}
              onCheck={check}
              checking={busy === "check"}
              onReject={() => {
                setProposal(null);
                setReport(null);
              }}
            />
          ) : mode === "run" ? (
            web ? (
              <WebPreview
                files={files}
                draft={draft}
                activeName={doc.name}
                full={focused}
                onEscape={leaveFocus}
                onFix={fixError}
                picking={picking}
                onPicking={setPicking}
                onPicked={(p) => {
                  setPicked(p);
                  /* One press, one pick. Staying in the mode means the next
                     click anywhere replaces what you just chose, usually by
                     accident, and the thing you wanted is gone before you have
                     finished typing about it. */
                  setPicking(false);
                }}
                onOpenAt={(name, line) => {
                  const target = files.find((f) => f.name === name);
                  if (!target) return;
                  if (target.id !== activeFile?.id) setActiveFileId(target.id);
                  setMode("edit");
                  // After the file switch has landed and the draft has been
                  // replaced, or the caret goes to a line of the old file.
                  setTimeout(() => setJump({ line, nonce: Date.now() }), 60);
                }}
              />
            ) : (
              <DocPreview canvas={canvas} content={draft} />
            )
          ) : mode === "preview" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {/* A doc canvas is a document; a code canvas is code and sets its
                  own. The mode rides on the container so everything inside it —
                  prose, headings, the gaps between paragraphs — follows from
                  one declaration rather than from per-element sizes. */}
              <div data-read={canvas.kind === "doc" ? "doc" : undefined} className={cn("mx-auto w-full", column)}>
                {canvas.kind === "doc" ? (
                  <Markdown content={draft} />
                ) : (
                  <CodeBlock code={draft} lang={doc.lang} filename={doc.name || canvas.title} />
                )}
              </div>
            </div>
          ) : canvas.kind === "doc" ? (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autosave.save(doc.key, { content: e.target.value });
              }}
              onBlur={() => void pushVersion(canvas.id, draft, "you", undefined, doc.fileName)}
              spellCheck
              aria-label="Canvas content"
              className={cn(
                "mx-auto min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-4 text-base leading-[1.75] text-primary outline-none",
                column,
              )}
            />
          ) : (
            /* Code gets an editor, not a textarea with a monospace font on it:
               highlighted while you type, numbered down the side, and honest
               about where the caret is. Prose above keeps the plain box —
               line numbers on a paragraph are furniture. */
            <div className={cn("mx-auto flex min-h-0 w-full flex-1 flex-col", column)}>
              <CodeEditor
                value={draft}
                lang={doc.lang}
                jump={jump}
                onSelect={setSelection}
                onChange={(next) => {
                  setDraft(next);
                  autosave.save(doc.key, { content: next });
                }}
                onBlur={() => void pushVersion(canvas.id, draft, "you", undefined, doc.fileName)}
              />
            </div>
          )}

          {/* What is arriving, while it arrives. */}
          {busy && live !== null && <Live text={live} kind={busy} column={column} onStop={stop} />}

          {rulesOpen && !proposal && (
            <RulesPanel
              value={fileRules}
              project={project?.name}
              column={column}
              onChange={(next) => void db.canvases.update(canvas.id, { rules: next })}
              onClose={() => setRulesOpen(false)}
            />
          )}

          {plan && !proposal && (
            <PlanPanel
              plan={plan}
              column={column}
              busy={busy === "revise"}
              onStep={runStep}
              onClose={() => setPlan(null)}
            />
          )}

          {/* A check belongs *under the diff it is about*, which is the one
              report that shows while a proposal is up. Explanations and
              reviews are about the file and step aside when a change is
              waiting on a decision. */}
          {report && (!proposal || report.kind === "check") && (
            <Report kind={report.kind} text={report.text} column={column} onClose={() => setReport(null)} />
          )}

          {/* Asking for a change is the point of the room, and it is the same
              act as asking anything else — so it is the same box, with this
              room's controls in it rather than chat's. The one-press edits go
              in the tray above the line, where chat keeps its attachments:
              both are about the message rather than in it. */}
          {!proposal && (
            <div className={cn("composer-dock shrink-0 px-4 pt-2", focused && "hidden")}>
              <div className={cn("mx-auto w-full", column)}>
                <MessageBar
                  value={instruction}
                  onChange={setInstruction}
                  onSubmit={() => void run(instruction)}
                  busy={busy === "revise"}
                  canSend={!busy}
                  /* The send disc becomes stop, in place — the same control
                     chat has had all along, in a room that until now offered
                     nothing to press while it worked. */
                  streaming={Boolean(busy)}
                  onStop={stop}
                  ariaLabel="Ask for a change"
                  placeholder={
                    picked
                      ? `Change ${nameOf(picked)} — “make it smaller and calmer”`
                      : selection
                      ? "Change just these lines — “make this a loop”"
                      : canvas.kind === "doc"
                        ? "Ask for a change — “tighten the second section”"
                        : "Ask for a change — “add retry with backoff”"
                  }
                  above={
                    <Shortcuts
                      kind={canvas.kind}
                      busy={busy}
                      onRun={run}
                      onExplain={explain}
                      onReview={review}
                      onPlan={makePlan}
                      lang={doc.lang}
                    />
                  }
                  left={
                    /* What is about to change: the selection if there is one,
                       otherwise the file. Both are the same question — "what
                       will this touch" — and the box you are typing the
                       instruction into is the only place answering it helps. */
                    picked ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent-subtle py-1 pl-2.5 pr-1 text-sm text-accent">
                        <MousePointerClick size={13} className="shrink-0" />
                        <span className="max-w-[16rem] truncate text-xs">{nameOf(picked)}</span>
                        <button
                          onClick={() => setPicked(null)}
                          aria-label="Change the whole file instead"
                          className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)] hover:text-primary"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ) : selection ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent-subtle py-1 pl-2.5 pr-1 text-sm text-accent">
                        <TextSelect size={13} className="shrink-0" />
                        <span className="tnum text-xs">
                          {selection.fromLine === selection.toLine
                            ? `Line ${selection.fromLine}`
                            : `Lines ${selection.fromLine}–${selection.toLine}`}
                        </span>
                        <button
                          onClick={() => setSelection(null)}
                          aria-label="Change the whole file instead"
                          className="ctl focus-inset flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)] hover:text-primary"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ) : web && doc.name ? (
                      <span className="flex items-center gap-1.5 px-2 text-sm text-tertiary">
                        <FileMark lang={doc.lang ?? "txt"} />
                        <span className="truncate font-mono text-xs">{doc.name}</span>
                      </span>
                    ) : null
                  }
                  right={<RevisePicker configured={configured} />}
                />
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <VersionList
            versions={versions}
            label={web ? doc.name : undefined}
            onRevert={async (id) => {
              await revertCanvas(canvas.id, id);
              void loadVersions();
            }}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- shortcuts -- */

/**
 * The five one-press edits.
 *
 * Taken from ChatGPT's canvas, which settled on exactly this set: add
 * comments, add logs, fix bugs, port to a language, and one that explains
 * rather than edits. They are worth copying because they are the things
 * people ask for over and over, and typing "add comments explaining what each
 * function does" for the hundredth time is the app failing to notice a
 * pattern. Explain is the one that must never touch the file — a shortcut that
 * sometimes edits and sometimes does not is one nobody trusts with either.
 */
const PORTS = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C++", "SQL"];

function Shortcuts({
  kind,
  lang,
  busy,
  onRun,
  onExplain,
  onReview,
  onPlan,
}: {
  kind: Canvas["kind"];
  lang?: string;
  busy: false | "revise" | "explain" | "review" | "plan" | "check";
  /* "file" on every one of these: a chip carries its own meaning and it is
     always about the whole document. Left on "auto" they were re-aimed at
     whatever element was still outlined in the preview, so "Add comments"
     with a picked button rewrote the button. */
  onRun: (instruction: string, label?: string, scope?: "auto" | "file") => void;
  onExplain: () => void;
  onReview: () => void;
  onPlan: () => void;
}) {
  const [portOpen, setPortOpen] = React.useState(false);

  if (kind === "doc") {
    return (
      <Row>
        <Chip busy={busy === "revise"} onClick={() => onRun("Tighten this. Cut every word that is not doing work, and keep every fact.", "Tighten", "file")}>
          Tighten
        </Chip>
        <Chip busy={busy === "revise"} onClick={() => onRun("Fix the spelling, grammar and punctuation. Change nothing else — not the wording, not the structure.", "Proofread", "file")}>
          Proofread
        </Chip>
        <Chip busy={busy === "revise"} onClick={() => onRun("Add headings and a little structure where the document has grown long enough to need them. Do not rewrite the prose.", "Add structure", "file")}>
          Add structure
        </Chip>
        <Chip busy={busy === "plan"} onClick={onPlan}>
          <ListChecks size={12} />
          Plan
        </Chip>
        <Chip busy={busy === "explain"} onClick={onExplain}>
          Explain
        </Chip>
      </Row>
    );
  }

  return (
    <Row>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Add comments. Explain why the non-obvious parts are the way they are, not what each line does. Change no code.", "Add comments", "file")}
      >
        Add comments
      </Chip>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Add logging at the points that would tell someone what went wrong: inputs at each boundary, the value of anything the logic branches on, and errors. Change no behaviour.", "Add logs", "file")}
      >
        <Terminal size={12} />
        Add logs
      </Chip>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Find the bugs and fix them. Change only what is broken. If nothing is broken, return the file unchanged.", "Fix bugs", "file")}
      >
        <Bug size={12} />
        Fix bugs
      </Chip>

      <span className="relative">
        <Chip busy={false} onClick={() => setPortOpen((v) => !v)} aria-expanded={portOpen}>
          Port to…
        </Chip>
        {portOpen && (
          <>
            <span className="fixed inset-0 z-10" onClick={() => setPortOpen(false)} aria-hidden />
            <span className="glass absolute bottom-full left-0 z-20 mb-1 flex w-40 flex-col rounded-xl border border-line p-1 shadow-lg anim-pop">
              {PORTS.filter((p) => p.toLowerCase() !== lang?.toLowerCase()).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPortOpen(false);
                    onRun(
                      `Port this to ${p}. Keep the same behaviour, the same names, and the same structure where the language allows it. Return only the ported file.`,
                      `Port to ${p}`,
                      "file",
                    );
                  }}
                  className="focus-inset rounded-lg px-2.5 py-1.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  {p}
                </button>
              ))}
            </span>
          </>
        )}
      </span>

      {/* A review, not a rewrite. "Fix bugs" answers what is broken; this
          answers what someone who has to maintain it would say — the question
          you want before there is a bug rather than after. With Explain, one
          of the two shortcuts that never touches the file. */}
      <Chip busy={busy === "review"} onClick={onReview}>
        <ScanSearch size={12} />
        Review
      </Chip>
      {/* Before anything is touched. A review tells you what it thinks; a plan
          tells you what it would *do*, one pressable step at a time, and the
          expensive mistake is never a bad edit — it is a plausible edit to the
          wrong thing, noticed after it has landed. */}
      <Chip busy={busy === "plan"} onClick={onPlan}>
        <ListChecks size={12} />
        Plan
      </Chip>
      <Chip busy={busy === "explain"} onClick={onExplain}>
        Explain
      </Chip>
    </Row>
  );
}

/* The tray inside the box, above the line you type on — the same slot chat
   uses for attachments, and padded the same, so the whole thing reads as one
   object rather than a strip balanced on top of another one. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-3"
      role="group"
      aria-label="Shortcuts"
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  busy,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  busy: boolean;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="tap focus-inset inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-meta text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

/** What Explain came back with. Prose, never applied to anything. */
/** What a report is *about*, which is the only thing its heading says. */
type ReportKind = "explain" | "review" | "check";

const REPORT_TITLE: Record<ReportKind, string> = {
  explain: "Explanation",
  review: "Review",
  check: "Check of this change",
};

function Report({
  kind,
  text,
  column,
  onClose,
}: {
  kind: ReportKind;
  text: string;
  column: string;
  onClose: () => void;
}) {
  return (
    <div className={cn("mx-auto max-h-[38vh] w-full shrink-0 overflow-y-auto px-4", column)}>
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="eyebrow text-faint">
            {REPORT_TITLE[kind]}
          </span>
          <IconButton label={`Close ${kind}`} size={26} className="ml-auto" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <Markdown content={text} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ live -- */

/**
 * The answer arriving, rather than a spinner in front of it.
 *
 * Chat has had this from the beginning and everywhere else in the app was
 * built on the one-shot path, which is the right shape for generating a
 * conversation title and the wrong one for anything a person is sitting and
 * waiting for. The tokens were always coming a few at a time; they were being
 * put in a buffer nobody could see.
 *
 * The tail rather than the whole thing, pinned to the bottom. What is useful
 * while something is being written is the edge where it is being written —
 * scrolling back through what has already arrived is for afterwards, and a
 * pane that jumps to follow the text while you try to read the top of it is
 * worse than one that shows only the end.
 *
 * A count, because "is it doing anything" is the actual question and a moving
 * number answers it in a way a moving spinner does not: a spinner spins just
 * as smoothly when nothing is coming.
 */
function Live({
  text,
  kind,
  column,
  onStop,
}: {
  text: string;
  kind: "revise" | "explain" | "review" | "plan" | "check";
  column: string;
  onStop: () => void;
}) {
  const ref = React.useRef<HTMLPreElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  const WHAT: Record<typeof kind, string> = {
    revise: "Writing the change",
    explain: "Explaining",
    review: "Reading it",
    plan: "Working out what to do",
    check: "Checking the change",
  };

  return (
    <div className={cn("mx-auto w-full shrink-0 px-4 pt-2", column)}>
      <div className="rounded-xl border border-line bg-inset p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="think-orb shrink-0" aria-hidden />
          <span className="eyebrow text-faint">
            {WHAT[kind]}
          </span>
          <span className="tnum min-w-0 flex-1 text-xs text-tertiary">
            {text.length.toLocaleString()} characters
          </span>
          <button
            onClick={onStop}
            className="focus-inset shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
          >
            Stop
          </button>
        </div>
        <pre
          ref={ref}
          /* Announced as a live region but politely: the text changes several
             times a second, and a screen reader reading every token is not
             progress, it is noise you cannot escape. */
          aria-live="polite"
          aria-atomic="false"
          className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-[1.6] text-tertiary"
        >
          {text || "…"}
        </pre>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- rules -- */

/**
 * The things that are true of this file every time.
 *
 * `CLAUDE.md` for one canvas. The observation both terminal agents are built
 * on is that most of what you tell a model is not about the request at all —
 * it is the language, the framework, the conventions, the one thing nobody is
 * allowed to touch — and retyping it at the top of every message is how it
 * ends up half-said and then not said at all. Written once, it rides along
 * with every edit, every selection rewrite, every review and every plan.
 *
 * Written straight to the row on each keystroke rather than on close. A panel
 * with a save button is a panel you can lose work in by pressing Escape, and
 * the write is a field on a record that is already being written on every
 * revision. There is no undo here on purpose: rules are short, and a history
 * of them would be more machinery than the thing itself.
 */
function RulesPanel({
  value,
  project,
  column,
  onChange,
  onClose,
}: {
  value: string;
  /** Named when there is one, so it is clear these are the *second* layer. */
  project?: string;
  column: string;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={cn("mx-auto w-full shrink-0 px-4 pt-2", column)}>
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="eyebrow text-faint">
            House rules
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
            {project
              ? `Always in force, on top of what “${project}” already says.`
              : "Always in force — every edit, review and plan obeys these."}
          </span>
          <IconButton label="Close house rules" size={26} onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          aria-label="House rules for this file"
          placeholder={"Use TypeScript. No inline styles — the design system only.\nNever change the auth flow without saying why.\nEvery exported function gets a test."}
          className="w-full resize-y rounded-lg border border-line bg-inset px-3 py-2 text-meta leading-[1.6] text-primary outline-none placeholder:text-faint focus:border-accent"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ plan -- */

/**
 * A plan you can carry out a step at a time.
 *
 * The point of separating this from a review is that the steps are pressable.
 * A review hands you prose and leaves you to translate it back into a request,
 * and the translation is where the intent leaks: you read "the concat in the
 * loop is quadratic", type "make it faster", and get something else. Here the
 * request is already written, so approving a step is a press.
 *
 * One at a time, in order, each arriving as its own diff. "Do all of it" is
 * deliberately absent — a plan whose only button applies four changes at once
 * is a whole-file rewrite wearing a list, which is the thing planning exists
 * to stop you doing by accident.
 *
 * A step is ticked when its change was *kept*. A step whose diff you discarded
 * did not happen, and a list that says otherwise is lying about the file.
 */
function PlanPanel({
  plan,
  column,
  busy,
  onStep,
  onClose,
}: {
  plan: { summary: string; steps: PlanStep[]; done: string[] };
  column: string;
  busy: boolean;
  onStep: (step: PlanStep) => void;
  onClose: () => void;
}) {
  return (
    <div className={cn("mx-auto max-h-[38vh] w-full shrink-0 overflow-y-auto px-4", column)}>
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="eyebrow text-faint">
            Plan — nothing has changed yet
          </span>
          <IconButton label="Close plan" size={26} className="ml-auto" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        {plan.summary && <p className="mb-2 text-sm text-secondary">{plan.summary}</p>}
        <ol className="flex flex-col gap-1.5">
          {plan.steps.map((step, i) => {
            const done = plan.done.includes(step.title);
            return (
              <li
                key={`${step.title}-${i}`}
                className="flex items-start gap-2.5 rounded-lg border border-line bg-inset p-2.5"
              >
                <span
                  className={cn(
                    "tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-tiny",
                    done ? "bg-accent-subtle text-accent" : "bg-subtle text-tertiary",
                  )}
                  aria-hidden
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-primary">{step.title}</span>
                  {step.why && <span className="block text-xs text-tertiary">{step.why}</span>}
                </span>
                <button
                  onClick={() => onStep(step)}
                  disabled={busy}
                  /* Named for the step, not "Do this". Four buttons that read
                     identically are four buttons a screen reader cannot tell
                     apart, and the name is the only thing announced. */
                  aria-label={done ? `Do again: ${step.title}` : `Do this step: ${step.title}`}
                  /* nowrap, because "Do this" broke across two lines the
                     moment a step title was long enough to squeeze it. */
                  className="ctl focus-inset shrink-0 whitespace-nowrap rounded-full border border-line px-3 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:opacity-40"
                >
                  {done ? "Again" : "Do this"}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- files -- */

function FileTabs({
  files,
  activeId,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: CanvasFile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onDelete: (f: CanvasFile) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  return (
    <Segmented
      value={activeId ?? files[0]?.id ?? ""}
      indicatorClassName="rounded-lg"
      className="mx-auto flex w-full max-w-[var(--measure-wide)] shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-4 pb-1.5 pt-2"
    >
      {files.map((f) => {
        const on = f.id === (activeId ?? files[0]?.id);
        return (
          <span key={f.id} data-on={on} className="group relative shrink-0">
            <button
              onClick={() => onSelect(f.id)}
              aria-current={on}
              className={cn(
                "tap focus-inset flex items-center gap-1.5 rounded-lg py-1 pl-2.5 font-mono text-xs transition-colors duration-[var(--dur-fast)]",
                // The room for the close control is reserved whether or not it
                // is showing, so a tab never changes width under the pointer.
                f.name === ENTRY ? "pr-2.5" : "pr-7",
                // The fill travels between tabs rather than blinking from one
                // to the next; the button only changes the colour of its ink.
                on ? "text-primary" : "text-tertiary hover:bg-subtle hover:text-primary",
              )}
            >
              <span className={on ? "text-accent" : "text-faint"}>
                <FileMark lang={f.lang} />
              </span>
              {f.name}
            </button>
            {f.name !== ENTRY && (
              /* Inside the tab, at its right edge, the way every editor does
                 it — the old badge hung off the corner and read as damage. */
              <button
                onClick={() => onDelete(f)}
                aria-label={`Delete ${f.name}`}
                className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-faint opacity-0 transition-[opacity,color,background-color] duration-[var(--dur-fast)] hover:bg-subtle hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onAdd(name.trim());
            setName("");
            setAdding(false);
          }}
          className="shrink-0"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setAdding(false)}
            placeholder="about.html"
            aria-label="New file name"
            className="focus-inset h-7 w-28 rounded-lg border border-line bg-surface px-2 font-mono text-xs text-primary outline-none placeholder:text-tertiary"
          />
        </form>
      ) : (
        <IconButton label="Add a file" size={28} onClick={() => setAdding(true)}>
          <FilePlus2 size={13} />
        </IconButton>
      )}
    </Segmented>
  );
}

/**
 * Light or dark, as it stands right now — the same answer the boot script
 * writes onto the root, including when the setting is "system" and the machine
 * flips at sunset. The preview needs it as a value rather than as CSS, because
 * what it is styling lives in a frame the app's stylesheet cannot reach.
 */
function useResolvedTheme(): "light" | "dark" {
  const setting = useSettings((s) => s.theme);
  /* Read from the root, which the boot script stamped before first paint —
     not defaulted to light and corrected in an effect. That correction was a
     second value, and a second value here is a second srcDoc: every web
     preview loaded twice, ran its scripts twice, and put two of every console
     line in the drawer. Nothing about it looked wrong, which is why it took a
     frame-lifecycle trace to see. */
  const [theme, setTheme] = React.useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );
  React.useEffect(() => {
    if (setting !== "system") {
      setTheme(setting === "dark" ? "dark" : "light");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setting]);
  return theme;
}

/* --------------------------------------------------------------- preview -- */

interface Line {
  id: number;
  level: string;
  text: string;
  /** How many times in a row. A console that prints the same line five
      hundred times has told you one thing five hundred times. */
  count: number;
}

/**
 * The app, running.
 *
 * Sandboxed with `allow-scripts` and no `allow-same-origin`, so the page runs
 * on an opaque origin: it can execute its own code and reach nothing of this
 * app's — not the conversations, not the keys, not storage. A preview that can
 * read what is sitting beside it is not a preview.
 *
 * Its console is piped back out, which is the part that makes this usable
 * rather than a demo. An error inside a sandboxed frame is otherwise invisible
 * — no devtools panel points at it — and "it just doesn't work" with nothing
 * on screen is where people give up.
 */
function WebPreview({
  files,
  draft,
  activeName,
  onOpenAt,
  full,
  onEscape,
  onFix,
  picking,
  onPicking,
  onPicked,
}: {
  files: CanvasFile[];
  draft: string;
  activeName: string;
  /** Take me to where that error is. */
  onOpenAt: (name: string, line: number) => void;
  /** Using it rather than building it: no console, no margins, no border. */
  full?: boolean;
  /** Escape, pressed inside the frame and forwarded out by the bridge. */
  onEscape?: () => void;
  /** Hand this error, and where it happened, to an edit. */
  onFix?: (message: string, where?: string) => void;
  /** Crosshair on: the next click chooses an element instead of pressing it. */
  picking?: boolean;
  onPicking?: (on: boolean) => void;
  onPicked?: (p: Picked) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [open, setOpen] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const nextId = React.useRef(0);

  /* The file you are typing in is not saved yet, so the preview would run the
     copy from a keystroke ago. Debounced rather than live: re-running on every
     character makes a page that flickers and a counter that never counts. */
  const merged = React.useMemo(
    () => files.map((f) => (f.name === activeName ? { ...f, content: draft } : f)),
    [files, draft, activeName],
  );
  const settled = useDebounced(merged, 500);
  const theme = useResolvedTheme();
  /* The name of this run, computed from what is about to run. It goes into the
     page and comes back on every message, so a message from the run before
     this one can be told apart from a message from this one. */
  const run = React.useMemo(() => runToken(settled, nonce), [settled, nonce]);
  const { html: srcDoc, map } = React.useMemo(
    () => assembleWeb(settled, theme, run),
    [settled, theme, run],
  );
  const runRef = React.useRef(run);
  runRef.current = run;
  const mapRef = React.useRef(map);
  mapRef.current = map;
  const escapeRef = React.useRef(onEscape);
  escapeRef.current = onEscape;
  const pickedRef = React.useRef(onPicked);
  pickedRef.current = onPicked;
  const pickingRef = React.useRef(picking);
  pickingRef.current = picking;

  /* The mode, sent in rather than built in.
     Rebuilding `srcDoc` to turn the picker on would be a fresh load of the
     page: the counter resets, the deck reshuffles, the scroll goes back to the
     top — every time you reach for the thing that is supposed to let you point
     at what you are looking at. A message changes one variable inside a page
     that never reloads. */
  React.useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ __armiPick: 1, on: Boolean(picking) }, "*");
  }, [picking, srcDoc]);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Identified by window, not by origin: a sandboxed frame has none.
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as {
        __armiConsole?: number;
        __armiPicked?: number;
        __armiKey?: string;
        run?: string;
        level?: string;
        text?: string;
      };
      if (!d) return;
      // Not gated on the run: a key pressed a moment after a reload is still
      // the key you pressed, and Escape has to work on the first try.
      if (d.__armiKey === "Escape") return escapeRef.current?.();
      if (d.__armiPicked === 1) {
        /* Gated on the run like a console line: an element chosen in a version
           of the page you have already replaced is a description of markup
           that is no longer there. */
        if (d.run !== runRef.current) return;
        pickedRef.current?.(d as unknown as Picked);
        return;
      }
      if (d.__armiConsole !== 1) return;
      /* From the run being shown, or from nowhere. A reload racing a message
         already in flight used to leave an error from a version of the file
         you had already fixed sitting in the drawer under the new one. */
      if (d.run !== runRef.current) return;
      /* "line 76" means line 76 of the assembled page, which nobody wrote.
         Translated back to the file and line you are looking at. */
      const text = String(d.text ?? "").replace(/\(line (\d+)\)/, (whole, n: string) => {
        const at = locate(mapRef.current, Number(n));
        return at ? `(${at.name}:${at.line})` : whole;
      });
      const level = String(d.level ?? "log");
      /* Repeats collapse, the way a real console collapses them: the same
         line again is a count on the line you already have, not a second copy
         of it. A loop that logs five hundred times becomes one row that says
         so, and a message delivered twice by a frame reloading under you stops
         reading as two different things having gone wrong. */
      setLines((l) => {
        const last = l[l.length - 1];
        if (last && last.level === level && last.text === text) {
          return [...l.slice(0, -1), { ...last, count: last.count + 1 }];
        }
        return [...l.slice(-199), { id: nextId.current++, level, text, count: 1 }];
      });
      if (level === "error") setOpen(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // Registered once. Everything it needs that can change is read through a
    // ref, because re-registering on a prop change is how a message ends up
    // delivered twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every run starts with a clean console; keeping the last run's errors is
  // how you spend ten minutes chasing something you already fixed.
  React.useEffect(() => setLines([]), [srcDoc, nonce]);

  // Distinct errors, not repeats of one: a loop throwing the same thing on
  // every frame is one problem, and a badge reading 400 is not more useful.
  const errors = lines.filter((l) => l.level === "error").length;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col",
        full ? "p-0" : "mx-auto max-w-[var(--measure-wide)] px-4 py-3",
      )}
    >
      <iframe
        key={nonce}
        ref={frameRef}
        title="Preview"
        sandbox="allow-scripts allow-forms"
        srcDoc={srcDoc}
        /* Re-armed on load as well as on change. The effect above fires when
           React commits; the page inside starts listening when it parses, and
           on a reload those are not in that order — a message sent to a
           document that has not run its bridge yet reaches nobody, and the
           crosshair silently stops working after every edit. */
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { __armiPick: 1, on: Boolean(pickingRef.current) },
            "*",
          )
        }
        className={cn(
          "min-h-0 w-full flex-1 bg-white",
          !full && "rounded-lg border border-line",
        )}
      />

      {/* No console in a room you are using rather than building. The error
          count is a builder's instrument; someone studying a deck of cards has
          no use for it and every reason not to see it. */}
      <div className={cn("mt-2 shrink-0", full && "hidden")}>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            <Terminal size={13} />
            Console
            {lines.length > 0 && (
              <span
                className={cn(
                  "tnum rounded-full px-1.5 text-tiny",
                  errors
                    ? "bg-[var(--danger-subtle)] text-danger"
                    : "bg-subtle text-tertiary",
                )}
              >
                {errors || lines.length}
              </span>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)}>
            <RotateCcw size={13} />
            Reload
          </Button>
          {/* If you can see it you can choose it, and then say what to do with
              it. Everything else in this app lets you *describe* a change;
              this is the only thing that lets you indicate one, and describing
              "the blue button roughly in the middle" is a translation that
              loses more than it carries. */}
          {onPicking && (
            <Button
              size="sm"
              variant={picking ? "secondary" : "ghost"}
              onClick={() => onPicking(!picking)}
              aria-pressed={picking}
            >
              <MousePointerClick size={13} />
              {picking ? "Pick one" : "Point at it"}
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-line bg-inset p-2 font-mono text-xs leading-[1.6]">
            {lines.length === 0 ? (
              <p className="text-tertiary">Nothing logged yet.</p>
            ) : (
              lines.map((l) => (
                <p
                  key={l.id}
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    l.level === "error"
                      ? "text-danger"
                      : l.level === "warn"
                        ? "text-warning"
                        : "text-secondary",
                  )}
                >
                  {l.count > 1 && (
                    <span className="mr-1.5 rounded-full bg-subtle px-1.5 text-tiny text-tertiary tnum">
                      ×{l.count}
                    </span>
                  )}
                  <Where text={l.text} onOpenAt={onOpenAt} />
                  {/* The loop the terminal agents are built around — run, read
                      the failure, fix — as far as a browser can take it. There
                      is no shell here and there are no tests, but this page
                      genuinely ran and this error genuinely happened, which is
                      worth more than any amount of reading the code and
                      imagining what it would do. Errors only: a console.log is
                      not a thing to fix. */}
                  {l.level === "error" && onFix && (
                    <button
                      onClick={() => onFix(l.text, fileIn(l.text))}
                      aria-label={`Fix this error: ${l.text.slice(0, 80)}`}
                      className="focus-inset ml-2 rounded-full border border-line px-2 py-px align-middle font-sans text-tiny text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                    >
                      Fix this
                    </button>
                  )}
                </p>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The file a console line points at, for telling an edit where to look. */
function fileIn(text: string): string | undefined {
  return text.match(/\(([\w.-]+):(\d+)\)/)?.[0].slice(1, -1).replace(":", " line ");
}

/**
 * The `(app.js:2)` in a console line, as somewhere to go.
 *
 * The number is already mapped back to the file you wrote — leaving it as
 * plain text asks you to read it, remember it, find the tab, count the lines
 * and click. Every one of those steps is one the app can do.
 */
function Where({
  text,
  onOpenAt,
}: {
  text: string;
  onOpenAt: (name: string, line: number) => void;
}) {
  const m = text.match(/\(([\w.-]+):(\d+)\)/);
  if (!m) return <>{text}</>;
  const [whole, name, line] = m;
  const at = text.indexOf(whole);
  return (
    <>
      {text.slice(0, at)}
      <button
        onClick={() => onOpenAt(name, Number(line))}
        className="focus-inset rounded underline decoration-dotted underline-offset-2 hover:decoration-solid"
        title={`Open ${name} at line ${line}`}
      >
        {whole}
      </button>
      {text.slice(at + whole.length)}
    </>
  );
}

/** A single HTML or CSS file, run on its own. */
function DocPreview({ canvas, content }: { canvas: Canvas; content: string }) {
  const html = canvas.lang === "css" ? `<style>${content}</style><p>Styled sample text.</p>` : content;
  return (
    <div className="mx-auto min-h-0 w-full max-w-[var(--measure-wide)] flex-1 overflow-hidden px-4 py-3">
      {/* Sandboxed with no `allow-same-origin`, so the page cannot reach this
          app's storage, cookies or IndexedDB. It runs its own scripts and
          nothing else — a preview that can read the conversations sitting
          beside it is not a preview, it is an exploit. */}
      <iframe
        title="Preview"
        sandbox="allow-scripts"
        srcDoc={html}
        className="h-full w-full rounded-lg border border-line bg-white"
      />
    </div>
  );
}

/* -------------------------------------------------------------- versions -- */

function VersionList({
  versions,
  label,
  onRevert,
  onClose,
}: {
  versions: CanvasVersion[];
  /** Which file this history belongs to, when the canvas is a folder. */
  label?: string;
  onRevert: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className="glass hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-line md:flex">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <span className="truncate eyebrow text-faint">
          {label ? `History · ${label}` : "History"}
        </span>
        <IconButton label="Close history" size={26} className="ml-auto" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      {versions.length === 0 ? (
        <p className="px-3 py-4 text-xs text-tertiary">Nothing saved yet.</p>
      ) : (
        <ul className="p-1.5">
          {versions.map((v, i) => (
            <li key={v.id}>
              <button
                onClick={() => onRevert(v.id)}
                className="focus-inset lift group w-full rounded-lg px-2.5 py-2 text-left hover:bg-subtle"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-primary">
                    {i === 0 ? "Current" : v.by === "model" ? "Model" : "You"}
                  </span>
                  <span className="tnum ml-auto text-tiny text-faint">
                    {new Date(v.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {v.note && (
                  <span className="mt-0.5 block truncate text-tiny text-tertiary">{v.note}</span>
                )}
                {i > 0 && (
                  <span className="mt-1 hidden items-center gap-1 text-tiny text-accent group-hover:flex">
                    <RotateCcw size={10} />
                    Restore this
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/* ---------------------------------------------------------- from the chat -- */

/** Lift a code block or an answer out of a conversation and into a canvas. */
export async function toCanvas(
  content: string,
  opts: { title?: string; kind?: Canvas["kind"]; lang?: string; conversationId?: string } = {},
): Promise<Canvas> {
  return createCanvas({
    title: opts.title?.slice(0, 80) || "Untitled",
    kind: opts.kind ?? "code",
    lang: opts.lang,
    content,
    sourceConversationId: opts.conversationId,
  });
}

