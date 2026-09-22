"use client";

import { parseSlash } from "@/lib/slash";
import { actionSpecs, doingOf, keepUndo, runAction, undoAction, type ActionContext } from "@/lib/actions";
import { cleanRecap, covers, recapPrompt, recapSection, RECAP_TOKENS } from "@/lib/recap";
import type { Action } from "@/lib/types";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PanelLeft } from "lucide-react";
import type { ContentBlock, Message, Rating, RatingReason } from "@/lib/types";
import { rememberRequest } from "@/lib/memory";
import { asNote, type Outcome } from "@/lib/compute";
import { planTurn, withPast, worthRecording, type Plan } from "@/lib/decide";
import { AUTO_STYLE } from "@/lib/register";
import { useVoiceMode } from "@/lib/hooks/useVoiceMode";
import {
  addMemory, allMemories, createConversation, createNote, db, deepestLeaf, deleteConversation, pushVersion,
  addCards, complaints, createDeck, deleteDeck, markOutcome, pastFor, recordTurn,
  exportMarkdown, pathTo, addMessage, blockText, createCanvas, createWebCanvas, createProject,
  filesOf,
} from "@/lib/db";
import { composeSystemPrompt, composeTurnPrompt } from "@/lib/prompt";
import { rulesCount, rulesText } from "@/lib/rules";
import { examNote } from "@/lib/exam";
import { effortFor, taskOf } from "@/lib/task";
import { shapeFor } from "@/lib/shape";
import { lintAnswer } from "@/lib/lint";
import { visualFor } from "@/lib/visual";
import { allStyles, findStyle, isTeaching } from "@/lib/styles";
import { findMode, modeFor } from "@/lib/modes";
import { builtDocument, titleOf } from "@/lib/built";
import { AUTO, CALCULATOR, DEFAULT_MODEL_ID, PROVIDERS, estimateTokens, getModel } from "@/lib/models";
import {
  briefNote, briefPrompt, councilNote, councilPrompt, engineOf, getPreset, objectionNote,
  playerFor, playersFor, resolveCast, shapePlan, shortName, worthBriefing, worthConvening,
} from "@/lib/presets";
import { costOf, fitToContext } from "@/lib/context";
import { elsewhere, searcher } from "@/lib/route";
import { setConfigured as setConfiguredGlobal } from "@/lib/configured";
import { whyAvoided } from "@/lib/health";
import { cheapestAvailable, complete } from "@/lib/complete";
import { useSettings, useDrafts, paramsFor, paramsSet, type Section } from "@/lib/store";
import { useStream } from "@/lib/hooks/useStream";
import { cn, inOverlay } from "@/lib/utils";
import { offerUndo } from "@/lib/undo";
import { Sidebar } from "@/components/Sidebar";
import { CanvasView, toCanvas } from "@/components/CanvasView";

import { CreativeView } from "@/components/CreativeView";
import { saveToNote } from "@/lib/db";
import { InlineError } from "@/components/chat/Message";
import { TopBar } from "@/components/chat/TopBar";
import { promptFor } from "@/components/chat/PointAt";
import { SectionSkeleton } from "@/components/ui/SectionSkeleton";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { withTransition } from "@/lib/transition";
import { ENTRY } from "@/lib/web";
import dynamic from "next/dynamic";
import { IconButton, TooltipProvider } from "@/components/ui/primitives";
import { UndoBar } from "@/components/ui/UndoBar";
import { ArtifactPanel, ArtifactProvider, type Artifact } from "@/components/chat/ArtifactPanel";

// Neither of these is on the path to a first message, so neither belongs in
// the bundle the user waits for.
const CommandPalette = dynamic(
  () => import("@/components/chat/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const Settings = dynamic(() => import("@/components/chat/Settings").then((m) => m.Settings), {
  ssr: false,
});
/* Projects is a whole section behind a tab, and nobody's first act in this app
   is to open it. It was costing everyone who only ever chats the bytes to
   render a room they had not asked for — and the first load had drifted to a
   kilobyte inside its own budget, which is not a margin, it is a coincidence
   waiting to be spent by the next feature. */
/* The Code section — the editor, the diff, the sandboxed preview, the console
   — was in every first paint because the blank chat page borrowed one row of
   buttons from it. The row has its own module now, so this can be fetched by
   the people who open it. */
/* Same for the notebook. `saveToNote` moved into the database module, which is
   where two writes and a title belonged all along — exporting it from the view
   was what pinned the whole section into every chat.

   Measured before and after, because the obvious version of this trade is a
   bad one: making the *canvas* load on demand saved eleven kilobytes and put
   half a second onto pressing Code, which nobody would thank you for. These
   two are 138ms and 185ms to open, so they are free. */
const NotebookView = dynamic(
  () => import("@/components/NotebookView").then((m) => m.NotebookView),
  { ssr: false, loading: () => <SectionSkeleton title="Notebook" newLabel="New page" /> },
);
/* A list of keyboard shortcuts, shown when you press `?`. Nobody's first act
   is to read the manual, and it was in the bundle drawn before the first
   screen. */
/* Only ever on screen once something has been built, and it carries the
   page assembler with it. Nobody on their way to a first question pays for
   the machinery that runs a made thing. */
const MadePanel = dynamic(
  () => import("@/components/chat/MadePanel").then((m) => m.MadePanel),
  { ssr: false },
);

/* Its own chunk: a room most people will not open on their first visit,
   carrying a scheduler and a card generator nobody there needs yet. */
const StudyView = dynamic(
  () => import("@/components/StudyView").then((m) => m.StudyView),
  { ssr: false },
);

/* The unified index. Its own chunk for the same reason as the rooms it
   lists: a first question does not need the code that lists decks. */
const LibraryView = dynamic(
  () => import("@/components/LibraryView").then((m) => m.LibraryView),
  { ssr: false, loading: () => <SectionSkeleton title="Library" newLabel="New document" /> },
);

const ShortcutsOverlay = dynamic(
  () => import("@/components/ShortcutsOverlay").then((m) => m.ShortcutsOverlay),
  { ssr: false },
);
const ProjectsView = dynamic(
  () => import("@/components/ProjectsView").then((m) => m.ProjectsView),
  { ssr: false, loading: () => <SectionSkeleton title="Projects" newLabel="New project" /> },
);

/** What "Continue" sends. Phrased so the model picks up mid-sentence. */
const CONTINUE_PROMPT =
  "Continue exactly where you left off, from the last character you wrote. Do not repeat anything, and do not summarise what came before.";

/* What a thumbs-down reason tells the next attempt. Each is written as the
   instruction the reader would give if they had the patience to, which is
   the whole point of asking for a reason rather than a mark. */
const REASON_NOTE: Record<RatingReason, string> = {
  wrong: "The reader marked the previous answer to this as wrong. Work it out again from the start rather than restating it; where a step is uncertain, say so instead of choosing.",
  long: "The reader marked the previous answer to this as too long. Give the same answer in at most half the length — cut the packaging first, then the least useful detail, never the caveat that changes the answer.",
  off: "The reader marked the previous answer to this as not what they asked. Re-read the request and answer exactly that, and nothing adjacent to it.",
  unclear: "The reader marked the previous answer to this as unclear. Lead with the shortest true answer, then one concrete example, and stop.",
};

export default function Page() {
  const settings = useSettings();
  /* Not `useDrafts()`.
     This page writes a draft in exactly one place and never reads one, and
     subscribing to the store to do that put every keystroke in the composer
     through a re-render of this component — which rebuilds the transcript.
     At four hundred turns that was 217ms a character: the composer became
     unusable in exactly the conversations long enough to be worth keeping.
     Reading the store imperatively writes without listening. */

  const [activeId, setActiveId] = React.useState<string | null>(null);
  /* The next chat is temporary. Held here until a first message makes the
     conversation it belongs to, the way a pending project is. */
  const [pendingTemporary, setPendingTemporary] = React.useState(false);
  /* The next chat may search. Held the same way until a first message makes
     the conversation; after that it lives on the conversation itself. */
  const [pendingResearch, setPendingResearch] = React.useState(false);
  /* Learn, pressed before there is a thread to stamp it on. */
  const [pendingLearn, setPendingLearn] = React.useState(false);

  /* Reloading should not lose your place. The last conversation is written to
     settings on every change and read back once on mount — but only after
     confirming it still exists, because it may have been deleted in another
     tab, and opening a thread that is gone shows an empty transcript with no
     way to tell whether it failed to load or was always empty. */
  /* The two sections that are not on the path to a first message, fetched the
     moment nothing else is happening — off the critical path on the way in,
     and already in memory by the time anyone presses anything.
     `requestIdleCallback` is not in Safari's older versions, hence the
     timeout behind it. */
  React.useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const warm = () => {
      void import("@/components/NotebookView");
      void import("@/components/ProjectsView");
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const restored = React.useRef(false);
  React.useEffect(() => {
    if (restored.current) return;
    const id = useSettings.getState().lastConversationId;
    /* A reload is a leaving. Whatever temporary chats a closed tab did not
       get to delete are deleted now, before anything can show them. */
    void db.conversations
      .filter((c) => !!c.temporary)
      .primaryKeys()
      .then((ids) => Promise.all(ids.map((tid) => deleteConversation(tid))));
    if (!id) {
      restored.current = true;
      return;
    }
    let cancelled = false;
    void db.conversations.get(id).then((c) => {
      if (cancelled) return;
      restored.current = true;
      if (c && !c.archived && !c.temporary) setActiveId(id);
      else useSettings.getState().setLastConversation(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (restored.current) useSettings.getState().setLastConversation(activeId);
  }, [activeId]);

  /* Leaving a temporary chat is what deletes it. Not closing the tab, not a
     timer: the moment another thread (or none) is on screen, the temporary
     one is gone, and an answer still arriving into it is stopped rather
     than written to a row nobody can reach. */
  const prevActive = React.useRef<string | null>(null);
  const stopRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = activeId;
    if (!prev || prev === activeId) return;
    void db.conversations.get(prev).then((c) => {
      if (!c?.temporary) return;
      stopRef.current();
      void deleteConversation(prev);
    });
  }, [activeId]);
  const [configured, setConfigured] = React.useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  /* Opened once, mounted from then on.
     ---------------------------------------------------------------------
     The guard was there to keep the dynamic chunk out of the first load,
     which it does — but it also tore the whole Radix tree out in the same
     commit that closed the dialog, and Radix holds a closing overlay in the
     DOM precisely long enough for its exit animation to run. Nothing was
     left to animate, so two of the app's overlays vanished between frames
     while every other one eased away. Keeping a closed dialog mounted costs
     nothing and the chunk is still fetched on first press. */
  const everOpened = React.useRef({ palette: false, settings: false });
  if (paletteOpen) everOpened.current.palette = true;
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  if (settingsOpen) everOpened.current.settings = true;
  const [settingsTab, setSettingsTab] = React.useState<"keys" | "appearance" | "model" | "rules" | "styles" | "data" | "shortcuts">("keys");
  const [scrolled, setScrolled] = React.useState(false);
  const [artifact, setArtifact] = React.useState<Artifact | null>(null);
  /** Where j/k currently sit in the transcript. */
  const cursorRef = React.useRef(0);
  const [compareWith, setCompareWith] = React.useState<string[]>([]);
  const [canvasId, setCanvasId] = React.useState<string | null>(null);
  /* A deck opened from outside the room — the palette, a link. */
  const [deckId, setDeckId] = React.useState<string | null>(null);
  /* The thing this conversation built, running in a column beside it. */
  const [madeId, setMadeId] = React.useState<string | null>(null);
  /* The decision the running turn was sent with, waiting for its outcome.
     A ref rather than state: nothing renders from it, and it has to be
     readable by the finish callback without re-registering it. */
  const planRef = React.useRef<{
    plan: Plan;
    modelId: string;
    at: number;
    /** The cast member that checks this answer, chosen when it was sent. */
    checkWith?: string | null;
  } | null>(null);
  /* `verify` is defined below and the finish callback above needs it. */
  const verifyRef = React.useRef<((m: Message, pinned?: string) => void) | null>(null);
  /**
   * Questions whose answer has already been round the loop once.
   *
   * A revision is itself an answer, and an answer on these tactics is
   * checked — so without this the third model objects to the second draft,
   * the writer produces a fourth, and a question nobody is watching spends
   * the afternoon arguing with itself. One round, and then the disagreement
   * is the reader's to see rather than the app's to keep paying for.
   */
  const arguedRef = React.useRef<Set<string>>(new Set());
  /* The half-sentence a starter leaves in the canvas composer. Cleared as soon
     as you leave, so it seeds the canvas it was made for and no other. */
  const [canvasSeed, setCanvasSeed] = React.useState<string | undefined>();
  /* A made thing has the window. The sidebar and the top bar are the app
     talking about itself, and someone working through a deck of cards is not
     using the app, they are using the thing the app made. */
  const [inUse, setInUse] = React.useState(false);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [noteId, setNoteId] = React.useState<string | null>(null);
  const [comparing, setComparing] = React.useState<{
    /**
     * Which conversation this belongs to.
     *
     * A comparison left standing when you start a new chat used to re-mount
     * against the next conversation the moment one existed — both columns
     * firing again, at a question nobody had asked, billed to the person's
     * key, under a thread they had just opened. It is a fact about one
     * thread and is now drawn only in that thread.
     */
    conversationId: string;
    parentId: string;
    history: Message[];
    modelIds: string[];
    /** What to call each column, where they are one model answering twice. */
    labels?: string[];
    /** The same brief for every column, where the tactic bought one. */
    turnPrompt?: string;
  } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  /* --- Theme and density live on the root element, applied before paint by
         the inline script and kept in sync here. ------------------------- */
  React.useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(max-width: 767px)").matches) settings.setSidebar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* `data-theme` always carries a resolved value, so there is one dark palette
     rather than one per selector. On "system" that means following the OS while
     it changes — someone whose machine flips at sunset should not have to
     reload. */
  React.useEffect(() => {
    const root = document.documentElement;
    if (settings.density === "comfortable") delete root.dataset.density;
    else root.dataset.density = settings.density;
  }, [settings.density]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (settings.theme !== "system") {
      root.dataset.theme = settings.theme;
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme = mq.matches ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  React.useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured ?? {});
        /* And where the one-shot calls can read it. They run outside React
           and decide which engine to use and where to go when one refuses;
           without this they saw an installation whose keys live in the
           server's environment as one with no keys at all. */
        setConfiguredGlobal(d.configured ?? {});
      })
      .catch(() => {
        setConfigured({});
        setConfiguredGlobal({});
      });
  }, []);

  /* --- Data ------------------------------------------------------------- */

  const conversation = useLiveQuery(
    () => (activeId ? db.conversations.get(activeId) : undefined),
    [activeId],
  );

  const allMessages = useLiveQuery(
    () => (activeId ? db.messages.where("conversationId").equals(activeId).toArray() : []),
    [activeId],
    [] as Message[],
  );

  const path = React.useMemo(
    () => pathTo(allMessages ?? [], conversation?.leafId ?? null),
    [allMessages, conversation?.leafId],
  );

  React.useEffect(() => {
    cursorRef.current = Math.max(0, path.length - 1);
  }, [activeId, path.length]);

  const contextTokens = React.useMemo(
    () => path.reduce((n, m) => n + estimateTokens(blockText(m.content)), 0),
    [path],
  );

  const hasAnyKey =
    Object.values(configured).some(Boolean) || Object.values(settings.keys).some(Boolean);

  const modelUsable = React.useCallback(
    (id: string) => {
      /* Through the tactic first: an Armi model is usable when *something* it
         can run on has a key, which is not the same question as whether one
         particular engine does. */
      const p = getModel(engineOf(id, { configured, keys: settings.keys })).provider;
      return Boolean(configured[p] || settings.keys[p]);
    },
    [configured, settings.keys],
  );

  const conversationCount = useLiveQuery(() => db.conversations.count(), [], 0);
  const customStyles = useLiveQuery(() => db.styles.orderBy("updatedAt").toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [], []);

  /* --- Titles are generated quietly, on the cheapest model with a key, and
         never block anything the user is doing. -------------------------- */
  const generateTitle = React.useCallback(
    async (conversationId: string, firstUserText: string) => {
      // Nothing can answer: a thread keeps the name it derived from its first
      // line, which is the cosmetic loss this whole path is allowed to take.
      const modelId = cheapestAvailable(configured);
      if (!modelId) return;
      // A missing title is a cosmetic loss and must never surface as an error —
      // including when the call fails outright, which it now can: `complete`
      // raises a dropped connection rather than handing back the fragment that
      // arrived, and this is called with `void`, so a rejection here would
      // reach the console as an unhandled one over nothing that matters.
      const title = await complete(
        `Give this conversation a title of at most six words. Reply with the title alone — no quotes, no punctuation at the end.\n\n${firstUserText.slice(0, 800)}`,
        { modelId, maxTokens: 64, temperature: 0.3 },
      ).catch(() => null);
      const clean = title?.trim().replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60);
      if (clean) await db.conversations.update(conversationId, { title: clean });
    },
    [configured],
  );

  /**
   * A built thing runs, rather than sitting in the transcript as markup.
   *
   * Asked for a timer, the model replies with one complete HTML document
   * because it was told this app can run one. Until now it arrived as a
   * nine-hundred-line code block with a button on it, and `toCanvas` — written
   * for exactly this — was never called by anything. So the answer that is a
   * document opens where documents run, and the conversation keeps its shape.
   *
   * Only a whole document, never a fragment: an explanation with an html
   * example in it is something to read in place, and lifting that out would be
   * the app deciding it knows better than the person who asked.
   */
  /**
   * An answer that is a page lands as a thing that runs.
   *
   * Beside the conversation, not in another room: the person who asked for
   * flashcards wants them on screen while they say "make the back bigger".
   * The first page in a conversation makes a canvas; a later page with the
   * same name replaces what is running, as a new version of the same
   * canvas, so an iteration is an iteration and not a second deck. A page
   * with a different name is a different thing and gets its own.
   */
  const landBuild = React.useCallback(async (m: Message): Promise<string | null> => {
    const doc = builtDocument(blockText(m.content));
    if (!doc) return null;
    if (m.canvasId && (await db.canvases.get(m.canvasId))) return m.canvasId;
    const title = titleOf(doc);
    const conv = await db.conversations.get(m.conversationId);
    const existing = conv?.madeId ? await db.canvases.get(conv.madeId) : undefined;
    const alike = (a: string, b: string) => {
      const x = a.toLowerCase(), y = b.toLowerCase();
      return x === y || x.includes(y) || y.includes(x);
    };
    let id: string;
    if (existing && existing.kind === "code" && alike(title, existing.title)) {
      await db.canvases.update(existing.id, { content: doc, title: title.slice(0, 80), updatedAt: Date.now() });
      await pushVersion(existing.id, doc, "model", "from the conversation");
      id = existing.id;
    } else {
      const canvas = await toCanvas(doc, {
        title,
        /* "code" with lang html, not "web": a web canvas is a folder whose text
           lives in `canvasFiles` and whose `content` stays empty, and this is one
           self-contained document. CanvasView counts both as runnable. */
        kind: "code",
        lang: "html",
        conversationId: m.conversationId,
      });
      id = canvas.id;
      await db.conversations.update(m.conversationId, { madeId: id });
    }
    await db.messages.update(m.id, { canvasId: id });
    return id;
  }, []);

  const stream = useStream(async (m) => {
    if (m.role !== "assistant") return;
    const id = await landBuild(m);
    if (id && m.conversationId === activeId) setMadeId(id);

    /* The decision, with its consequence attached. Written here rather than
       at send time because half of what is worth knowing — how long it took,
       what it cost, whether it stopped early, what the app's own reader made
       of it — does not exist until the answer does. */
    const sent = planRef.current;
    planRef.current = null;
    if (!sent || !worthRecording(sent.plan)) return;
    const text = blockText(m.content);
    await recordTurn({
      conversationId: m.conversationId,
      messageId: m.id,
      at: Date.now(),
      kind: sent.plan.kind,
      strategy: sent.plan.strategy,
      styleId: sent.plan.register?.id,
      mode: sent.plan.mode,
      modelId: m.modelId ?? sent.modelId,
      presetId: m.presetId,
      effort: sent.plan.effort,
      check: sent.plan.check,
      why: sent.plan.why,
      ms: m.latencyMs,
      tokens: (m.usage?.inputTokens ?? 0) + (m.usage?.outputTokens ?? 0),
      stopReason: m.stopReason,
      error: m.error,
      findings: text ? lintAnswer(text).length : undefined,
    });

    /* And the check the plan earned. Not every answer — one that this app
       has watched go wrong for this person, in this kind of work, often
       enough to expect the next one to. It runs on its own rather than
       waiting to be pressed, because an answer you have to remember to
       doubt is one you will trust by accident. */
    if (sent.plan.check === "second" && !m.error && text) verifyRef.current?.(m, sent.checkWith ?? undefined);
  });

  /* The column follows the conversation: open on one that built something,
     closed on one that did not, and a new build opens it again. */
  React.useEffect(() => {
    setMadeId(conversation?.madeId ?? null);
  }, [activeId, conversation?.madeId]);

  /**
   * A making conversation, started from the Creative room.
   *
   * Stamped creative at birth, which the ordinary path deliberately does
   * not do: there every turn is read on its own, here the person has walked
   * into the room named after making and said what they want, and every
   * answer in this thread should be a page. The message is sent once the
   * thread is on screen, by the effect below, so it goes through the same
   * `send` as anything typed — routing, title, memory and all.
   */
  const queued = React.useRef<{ id: string; text: string } | null>(null);
  const startBuild = React.useCallback(
    async (text: string) => {
      const c = await createConversation({ modelId: settings.modelId, styleId: settings.styleId, mode: "creative" });
      queued.current = { id: c.id, text };
      withTransition(() => {
        setActiveId(c.id);
        settings.setSection("chat");
      }, "forward");
    },
    [settings],
  );

  /**
   * A question from somewhere else in the app, asked in a new chat.
   *
   * The same machinery as the Creative room's builds, without the mode:
   * somebody who got a card wrong wants it explained, not built. The
   * message is sent once the thread is on screen, through the same `send`
   * as anything typed, so routing, memory and the register all apply.
   */
  const askInChat = React.useCallback(
    async (text: string) => {
      const c = await createConversation({ modelId: settings.modelId, styleId: settings.styleId });
      queued.current = { id: c.id, text };
      withTransition(() => {
        setActiveId(c.id);
        settings.setSection("chat");
      }, "forward");
    },
    [settings],
  );

  /** The card in the transcript, pressed. */
  const showMade = React.useCallback(
    async (m: Message) => {
      const id = await landBuild(m);
      if (id) setMadeId(id);
    },
    [landBuild],
  );

  /* --- Sending ---------------------------------------------------------- */

  /** The model and instructions belong to the thread, not to the app. */
  const threadModelId = conversation?.modelId ?? settings.modelId;
  const threadPrompt = conversation?.systemPrompt ?? settings.systemPrompt;
  const threadStyleId = conversation?.styleId ?? settings.styleId;
  const threadMode = conversation?.mode ?? settings.mode;

  const runTurn = React.useCallback(
    async (
      conversationId: string,
      parentId: string | null,
      history: Message[],
      /** What was picked: an engine, or one of Armi's own models. */
      picked: string,
      /** Set only when the app chose the model rather than the person. */
      routedWhy?: string,
      /** Something about this one reply — see `composeTurnPrompt`. */
      note?: string,
      /**
       * A second pass at a question already answered.
       *
       * The brief and the council are readings of the *question*, and this
       * turn already has one — plus an objection, which is better material
       * than either. Buying them again is paying twice for the same reading
       * and adding a round trip to a turn the person is already waiting on.
       */
      opts?: {
        revised?: boolean;
        /** Think harder on this one turn, whatever the tactic would have chosen. */
        effort?: "high";
        /** Have a second model read this answer back, whatever the tactic would have done. */
        check?: boolean;
      },
    ) => {
      /* An Armi model is a tactic, and this is where it becomes a request:
         which engine it runs on given the keys that are here, how hard it
         thinks, how it writes, and whether a second company checks it.
         Resolved here rather than at the call sites because there are eight
         of them — regenerate, retry, tighten, edit — and one that forgot
         would send "nova" to a provider as a model name. */
      const preset = getPreset(picked);
      const cast = preset
        ? resolveCast(picked, {
            configured,
            keys: settings.keys,
            hasImage: history.some((m) => m.content.some((b) => b.type === "image")),
            size: history.reduce((n, m) => n + costOf(m), 0),
          })
        : null;
      const modelId = cast?.answer.modelId ?? picked;

      const conv = await db.conversations.get(conversationId);
      /* Read the layers at send time rather than holding them in state. A
         project's instructions can be edited in another tab, and a turn should
         go out with what the project says now, not what it said when this
         screen mounted. */
      const project = conv?.projectId ? await db.projects.get(conv.projectId) : undefined;
      const files = project ? await filesOf(project.id) : [];
      /* What the person asked to be remembered — unless they turned it off,
         or this is a temporary chat, which knows nothing and keeps nothing. */
      const memories = settings.memoryOn && !conv?.temporary ? await allMemories() : [];
      /* The rooms, as tools, where the person allows it. Decided per turn
         from the conversation it is in: no memory in a temporary chat, no
         project file outside a project. */
      const room: ActionContext = {
        conversationId,
        projectId: conv?.projectId,
        temporary: Boolean(conv?.temporary),
        memoryOn: settings.memoryOn,
      };
      const offered = settings.actionsOn ? actionSpecs(room) : [];
      /* The mode is read off the request rather than set on a switch.
         Choosing between Chat and Creative was a question about the machine,
         asked before the person had said what they wanted and answerable only
         by someone who already knew what the two settings did — so the ones
         who most needed the built thing were the least likely to have found
         the toggle. A thread that has been given a mode explicitly (the canvas
         sets one) keeps it; everything else is decided from the sentence, the
         same way the router already decides the model. */
      const wants = [...history].reverse().find((m) => m.role === "user");
      const asked = wants ? blockText(wants.content) : "";
      /* One decision, made once and written down.
         What kind of job this is, whether it wants words or a working thing,
         how hard to think, and whether the answer has earned a second pair of
         eyes — four readings that used to happen at four call sites and were
         thrown away immediately. `pastFor` is what closes the loop: it asks
         how answers of this shape from this model have actually been going
         for this person, and the plan changes when the answer is "badly". */
      /* Whether the app is choosing the register at all. A style the
         person picked is an answer they already gave, and this does not
         overrule it. */
      const chosenStyle = conv?.styleId ?? settings.styleId;
      const autoStyle = !chosenStyle || chosenStyle === AUTO_STYLE;
      const first = planTurn(asked, {
        mode: conv?.mode,
        history: history.map((m) => blockText(m.content)).join("\n").slice(-4_000),
        autoStyle,
        theirs: history.filter((m) => m.role === "user").map((m) => blockText(m.content)),
        tooLong: autoStyle ? await complaints("long") : 0,
      });
      /* The request decides most of it; the tactic decides the rest. What the
         person typed about *this* turn always wins — somebody on Sage who
         asks for it short gets it short. */
      const shaped = shapePlan(withPast(first, await pastFor(first.kind, modelId)), preset, {
        autoStyle,
        cast,
        /* So it can tell whether the rest of the cast is going to run: the
           promise is two models, and the check is what keeps that promise on
           a turn nothing else would have joined. */
        ask: asked,
        size: history.reduce((n, m) => n + costOf(m), 0),
      });
      /* And an effort they set on the tactic itself, from the picker, which is
         the one part of an Armi model they can overrule without leaving it.
         Only where they actually set one: `paramsFor` answers with the
         defaults for a tactic nobody has touched, so reading it directly
         overruled every preset's own effort with `medium` on every turn. */
      const own = preset && paramsSet(picked) ? paramsFor(picked).reasoningEffort : undefined;
      /* An effort asked for on this turn beats one set on the tactic, which
         beats the reading of the request: the person pressing "more effort"
         has already seen the answer the other two produced. */
      const planned = opts?.effort ? { ...shaped, effort: opts.effort } : own ? { ...shaped, effort: own } : shaped;
      /* "/check" is the person asking for the second reading outright, on a
         turn whose tactic may not have earned one — so it is set here, after
         the tactic has had its say, and never taken away by it. */
      const plan = opts?.check ? { ...planned, check: "second" as const } : planned;
      /* Who checks it, decided here rather than when the answer lands: the
         cast is a property of the turn that went out, and a check chosen
         afterwards from whatever keys exist at that moment is a different
         promise from the one the row made. */
      planRef.current = { plan, modelId, at: Date.now(), checkWith: playerFor(cast, "check")?.modelId ?? null };
      const mode = findMode(plan.mode);
      /* The register the plan chose, or the one the person chose. */
      const style = findStyle(plan.register ? plan.register.id : chosenStyle, customStyles);
      const composed = composeSystemPrompt({
        base: [rulesText(settings.rules ?? [], settings.systemPrompt), conv?.systemPrompt ?? ""].filter(Boolean).join("\n\n"),
        project,
        files,
        /* What was asked, so a project holding more than fits sends the
           paragraphs about the question rather than the first file, cut.
           The last few turns rather than the last line: "tell me more about
           that" names nothing, and the thing it means is in the turn before. */
        query: [
          ...history.filter((m) => m.role === "user").slice(-3).map((m) => blockText(m.content)),
          ...history.filter((m) => m.role === "assistant").slice(-1).map((m) => blockText(m.content).slice(0, 1_500)),
        ].join("\n"),
        style,
        mode,
        memories,
        actions: offered,
      });
      /* What kind of job this is, and therefore what a good answer to it looks
         like. The app has classified requests since `task.ts` was written and
         spent the answer on one thing: telling a second model what to look for
         when checking the first. The classification was going into the audit
         and never into the work. */
      /* The other model, before this one starts.
         A second company reads the question and writes down what a good
         answer has to get right; the writer sees that list and nothing else
         about it. It is the cheap half of a second opinion bought at the one
         moment it can still change the answer rather than grade it. Skipped
         for one-liners, where it would be a second bill and a second second
         of waiting for nothing, and never fatal: a brief that fails leaves an
         ordinary answer rather than no answer. */
      const briefWith = playerFor(cast, "brief");
      let brief = "";
      if (briefWith && !opts?.revised && worthBriefing(asked, plan, history.reduce((n, m) => n + costOf(m), 0))) {
        brief = (await complete(briefPrompt(asked, briefWith.as), {
          modelId: briefWith.modelId,
          maxTokens: 300,
          temperature: 0.2,
        }).catch(() => null)) ?? "";
      }

      /* The council: three companies, three halves of the question, at once.
         Four models answering the same thing produce four drafts and make a
         reader into an editor; four models given four jobs produce something
         none of them would have written alone, which is the only reason to
         pay for four. Run in parallel — they do not see each other's work,
         which is the point — and never fatal: a seat that fails leaves the
         council smaller rather than leaving the person with nothing. */
      const seats = playersFor(cast, "council");
      let council = "";
      if (seats.length && !opts?.revised && worthConvening(asked, plan)) {
        const notes = await Promise.all(
          seats.map(async (seat) => ({
            angle: seat.angle!,
            text:
              (await complete(councilPrompt(asked, seat.angle!), {
                modelId: seat.modelId,
                maxTokens: 700,
                temperature: 0.3,
              }).catch(() => null)) ?? "",
          })),
        );
        const heard = notes.filter((n) => n.text.trim());
        if (heard.length) council = councilNote(heard);
      }

      const task = plan.task;
      const turn = composeTurnPrompt({
        shape: task ? shapeFor(task.kind) : "",
        /* And when a picture would beat a paragraph. The house rules say prose
           by default, which is right about bullets and wrong about diagrams —
           a bulleted explanation has had its connective tissue deleted and a
           flowchart is nothing but connective tissue. Left unqualified, "write
           in prose" reads as "never draw anything". */
        visual: task ? visualFor(task.kind) : "",
        /* And where a stance withholds something on purpose, the thing it
           withholds must not exist in the model's context: a hint written by
           someone who already has the answer points straight at it, whatever
           the instruction said. */
        teaching: isTeaching(style?.id),
        /* What this tactic is for, said to the model rather than only to the
           person who picked it. Nova builds because it is told to build. */
        /* And, when the question is an exam question, how it will be marked:
           the command word's meaning and the marks to account for. Every
           question is one in the Exam stance; elsewhere only one that
           carries marks. */
        note: [note, preset?.stance, examNote(asked, style?.id === "exam"), brief ? briefNote(brief) : "", council].filter(Boolean).join("\n\n") || undefined,
      });
      /* Said on the answer, like the model's reason: an app that quietly
         changes how it writes to you is an app whose answers you cannot
         account for. Built without an em dash, because the line strips
         everything before the first one — that belongs to the model. */
      const registerWhy =
        plan.register && plan.register.why && style
          ? `${style.name}, because ${plan.register.why}`
          : "";
      /* The header already carries the name — this line is for what happened
         *besides* being answered: whether a second model read the question
         first, how many were consulted, and whether the tactic could not have
         the engine it wanted. Counted rather than named, because which
         company was rented is a fact about this browser's keys and is spelled
         out in Settings; the reader's question here is "what did it do", not
         "who did you buy it from".

         Only what actually happened: a cast that could not be arranged must
         not be described as though it had, and a brief skipped for a
         three-word question did not happen either. */
      const extras = [
        cast?.answer.why,
        brief ? "briefed first by another model" : "",
        council ? `${seats.length} models consulted` : "",
      ].filter(Boolean);
      /* The clause before the first dash is stripped where this is drawn —
         the header already says the name — so it carries the name for the
         places that read the whole string, and nothing shows at all when
         there is nothing to add beyond having been answered. */
      const presetWhy = preset && extras.length ? `${preset.name} — ${extras.join(", ")}` : "";
      /* And where this is a second pass, the line says so without losing who
         answered: "ARMI Constellation, 3 models consulted · answered again after an
         objection" is the whole account of how the words on screen came to be
         there, and the first half of it is not less true for the second. */
      const why = [
        routedWhy || presetWhy,
        registerWhy,
        opts?.revised ? "answered again after a second model objected" : "",
        opts?.effort ? "asked to think harder" : "",
        /* Asked for, not done: with one company's key there is nobody to
           read it back, and the notice says so — the row must not claim
           what the notice denies. */
        opts?.check ? "second reading asked for" : "",
      ]
        .filter(Boolean)
        .join(" · ");

      /* Research is a thing only one company here does. When it is on and
         the writer the cast chose is from another, the turn moves to the
         strongest keyed model that can search, and the row says so — the
         same rule as a company that will not answer at all, applied before
         the send rather than after a failure. */
      const research = conversation?.research ?? pendingResearch;
      let writer = modelId;
      let searchWhy = "";
      if (research) {
        const able = searcher({ configured, keys: settings.keys });
        if (able && getModel(modelId).provider !== able.provider) {
          writer = able.id;
          searchWhy = "moved to a model that can search the web";
        } else if (!able) {
          searchWhy = "could not search: no key for a company that searches";
        }
      }

      /* And what the window will not hold.
         ---------------------------------------------------------------
         The fitter drops the oldest turns and the transcript says so. That
         is honest and it is still a conversation that has forgotten its
         own beginning, so before the turn goes out the dropped half is read
         once by a cheap model and carried as a record. Made only when the
         boundary moves past what the last record covered — otherwise this
         would be a second model call on every question — and never fatal:
         a record that cannot be written leaves the turn exactly as it was.
         Computed with the same inputs the stream will fit with, so the two
         agree about what is being left out. */
      let recapNote = "";
      try {
        /* Fitted against what the request will actually carry, plus room for
           the record itself — which is circular otherwise: the record is
           written because turns were dropped, and adding it to the prompt
           drops one more. Reserving its ceiling makes this fit the
           conservative one, so the record always reaches at least as far as
           the turns that end up left out. Covering one turn twice is a
           repetition; covering one turn short is a hole. */
        const RECAP_ROOM = " ".repeat(5_000);
        const fit = fitToContext(
          history,
          getModel(writer),
          paramsFor(writer),
          [composed.text, composed.volatile, turn, RECAP_ROOM].filter(Boolean).join("\n\n"),
        );
        if (fit.dropped > 0) {
          let recap = (await db.conversations.get(conversationId))?.recap;
          if (!covers(history, recap, fit.dropped)) {
            const scribe = cheapestAvailable(configured);
            const text = scribe
              ? cleanRecap(
                  await complete(recapPrompt(history.slice(0, fit.dropped), recap?.text), {
                    modelId: scribe,
                    maxTokens: RECAP_TOKENS,
                    temperature: 0.2,
                  }).catch(() => null),
                )
              : "";
            if (text) {
              recap = { text, throughId: history[fit.dropped - 1].id, at: Date.now() };
              await db.conversations.update(conversationId, { recap });
            }
          }
          if (recap?.text) recapNote = recapSection(recap.text, fit.dropped);
        }
      } catch {
        /* A thread that cannot be summarised is sent trimmed, as before. */
      }

      await stream.send({
        conversationId,
        parentId,
        modelId: writer,
        tools: research && !searchWhy.startsWith("could not") ? ["web_search", "web_fetch"] : undefined,
        actions: offered.length
          ? { specs: offered, run: (call) => runAction(call, room), doing: doingOf, keep: (id, done) => keepUndo(id, done.undo) }
          : undefined,
        /* Which Armi model this is, kept with the answer. The engine stays in
           `modelId` because a retry, a second opinion and the token meter all
           need it; what a reader is shown is the name they picked. */
        presetId: preset?.id ?? (picked === AUTO ? AUTO : undefined),
        routedWhy: [why, searchWhy].filter(Boolean).join(" · ") || undefined,
        history,
        systemPrompt: composed.text || undefined,
        /* Excerpts chosen for this question go with the turn, outside the
           cached half; see `ComposedPrompt.volatile`. */
        turnPrompt: [recapNote, composed.volatile, turn].filter(Boolean).join("\n\n") || undefined,
        /* And where to go when a company will not answer at all. Holding
           four keys is only worth anything if the others are tried, so the
           turn walks down the bench — each company once, whoever has already
           refused travelling with the ask — and the row says so rather than
           leaving a coloured bar and a Switch model button. */
        elsewhere: (tried, kind) => {
          const other = elsewhere(tried, { configured, keys: settings.keys }, {
            vision: history.some((m) => m.content.some((c) => c.type === "image")),
            size: history.reduce((n, m) => n + costOf(m), 0),
          });
          if (!other) return null;
          return {
            modelId: other.id,
            why: whyAvoided(kind, PROVIDERS[tried[tried.length - 1]].name),
          };
        },
        /* And how hard to think, from the same reading. `effortFor` returns
           nothing for the kinds that do not benefit, and nothing means the
           model keeps whatever it was already set to. */
        params: { ...mode.params, ...(plan.effort ? { reasoningEffort: plan.effort } : {}) },
      });
    },
    [stream, settings.systemPrompt, settings.styleId, settings.mode, settings.memoryOn, settings.actionsOn, settings.keys, configured, customStyles],
  );

  /** Same rule as the model: the open thread owns it, the app holds the default. */
  const setStyle = React.useCallback(
    (id: string) => {
      settings.setStyle(id);
      if (activeId) void db.conversations.update(activeId, { styleId: id });
    },
    [settings, activeId],
  );

  /** Switching model writes to the open thread; with none open, to the default. */
  const setModel = React.useCallback(
    (id: string) => {
      settings.setModel(id);
      if (activeId) void db.conversations.update(activeId, { modelId: id });
    },
    [settings, activeId],
  );

  const send = React.useCallback(
    async (content: ContentBlock[]) => {
      let convId = activeId;
      let leaf: string | null = conversation?.leafId ?? null;

      /* A slash at the front sets the room before the question. Read before
         the conversation exists, because two of the commands — temporary and
         research — are properties of the conversation it is about to make.
         The command itself is never stored: the message that goes out and
         the message kept in the thread is what came after it. */
      const slash = parseSlash(blockText(content));
      let slashPick: string | undefined;
      if (slash) {
        content = content.map((c) => (c.type === "text" ? { ...c, text: slash.text } : c));
        if (slash.presetId) slashPick = slash.presetId;
        /* "/compare" is Binary's whole tactic — two companies, side by side —
           so it is that Armi model for this turn rather than a second way of
           asking for the same thing. */
        if (slash.compare) slashPick = "duet";
        if (slash.research) {
          if (convId) void db.conversations.update(convId, { research: true });
          else setPendingResearch(true);
        }
        if (slash.temporary && !convId) setPendingTemporary(true);
        /* A bare command is a setting, not a question: "/research" alone turns
           research on and stops there, with nothing sent and the box cleared
           by the composer as for any send. */
        if (!slash.text.trim() && !content.some((c) => c.type !== "text")) return;
      }
      const wantsTemporary = pendingTemporary || Boolean(slash?.temporary);
      const wantsResearch = pendingResearch || Boolean(slash?.research);
      const wantsLearn = pendingLearn || slash?.presetId === "tutor";

      // Conversations are created on first send, not on "New chat", so the
      // sidebar never fills with empty rows the user did not mean to make.
      if (!convId) {
        // The style comes along, so the first answer is already in the style
        // the picker is showing rather than one turn behind it.
        const created = await createConversation({
          modelId: settings.modelId,
          styleId: settings.styleId,
          /* Learn is the one mode stamped at creation: it was asked for by
             a press, and a thread in it stays in it until the press again. */
          ...(wantsLearn ? { mode: "learn" as const } : {}),
          /* No mode. It used to be stamped on the row at creation, which meant
             `conv.mode` was always set and the per-turn reading of the request
             never ran at all — every thread was permanently whatever the switch
             had been. Left unset, each turn is read on its own, which is what
             lets one thread answer a question and then build the thing you ask
             for next. */
          // Set by "New chat here", which names a project before there is a
          // conversation for it to be a property of.
          projectId: pendingProject ?? undefined,
          /* Set by the toggle in the header before there is a conversation
             for it to be a property of, like the project above. */
          temporary: wantsTemporary, research: wantsResearch || undefined,
        });
        setPendingProject(null);
        setPendingTemporary(false);
        setPendingLearn(false);
        convId = created.id;
        leaf = null;
        setActiveId(created.id);
      }

      const userMessage = await addMessage({
        conversationId: convId,
        parentId: leaf,
        role: "user",
        content,
      });

      const history = [...path, userMessage];
      const isFirst = path.length === 0;

      /* Auto: read the ask, then decide. The whole point is that the person
         asking is the one least equipped to know whether this particular
         request wants the long-context model or the fast one — working that
         out is the app's job, not theirs. Off Auto, nothing here happens and
         the model you picked is the model that answers. */
      const asked = blockText(content);
      /* Loaded when it is used. The router and its calculator are a few
         kilobytes that nobody on the way to their first message needs, and the
         first load had drifted two kilobytes past its own budget carrying
         them. It is awaited inside a send that is already awaiting a network
         round trip, so the deferral costs nothing anybody can perceive. */
      /* A chunk that will not load — offline, or a deploy that rotated the
         file out from under an open tab — must not take the message with it.
         Auto is an improvement on picking a model by hand; falling back to the
         model already selected costs a slightly worse choice, and throwing here
         costs the message. */
      const { route } = threadModelId === AUTO
        ? await import("@/lib/route").catch(() => ({ route: null }))
        : { route: null };
      const decision =
        threadModelId === AUTO && route
          ? route(asked, {
              configured,
              keys: settings.keys,
              effort: "auto",
              hasImage: content.some((b) => b.type === "image"),
              /* A sample of the conversation, for reading what kind of thing
                 this is, and the real total separately. The sample is a tail
                 because the whole of a long thread is megabytes and none of it
                 changes the answer; the total is not, because it is the number
                 the decision turns on. */
              extra: path.map((m) => blockText(m.content)).join("\n").slice(-40_000),
              /* Attachments are part of the request, and `blockText` does not
                 return them: a two-hundred-page PDF used to reach the router as
                 the empty string, so it read as a short question and went to a
                 short-context model. Counted with `costOf`, which is what the
                 fitter uses, so both agree about how big this is. */
              attached: content.map((b) => (b.type === "file" ? b.text : "")).join("\n"),
              size: history.reduce((n, m) => n + costOf(m), 0),
              current: settings.modelId === AUTO ? DEFAULT_MODEL_ID : settings.modelId,
            })
          : null;

      /* A sum is answered here, exactly, for nothing. A model would predict
         what the answer looks like, which is usually the answer and is not the
         same thing — and you cannot tell the two apart by looking.

         Unless something came with it. Attaching a spreadsheet and typing
         "what is 948392 × 73" is not a request for long multiplication, it is
         a request about the spreadsheet — and the calculator used to answer the
         sum and drop the file on the floor, which looks from the outside like
         an attachment that silently failed to upload. */
      if (decision?.sum && !content.some((b) => b.type !== "text")) {
        await addMessage({
          conversationId: convId,
          parentId: userMessage.id,
          role: "assistant",
          content: [{ type: "text", text: `**${decision.sum.text}**\n\n*${decision.why}*` }],
          modelId: CALCULATOR,
          createdAt: Date.now(),
        } as never);
        if (isFirst) void generateTitle(convId, asked);
        return;
      }

      /* A tactic named by a slash beats the router's reading: the person
         said which room this belongs in, and Auto's whole premise is that
         they usually have not. */
      const answering = slashPick ?? decision?.modelId ?? threadModelId;

      /* "Remember that I'm vegetarian" is two things: a message, sent as
         written, and a memory, saved before the answer comes back so the
         reply can say so truthfully. Never in a temporary chat, and never
         with memory off — then it is only a message, and the model, which
         has been told it cannot remember, says so. */
      let note: string | undefined;
      const fact = rememberRequest(asked);
      if (fact && settings.memoryOn && !(conversation?.temporary ?? pendingTemporary)) {
        const kept = await addMemory(fact, convId);
        offerUndo(fact, async () => { await db.memories.delete(kept.id); }, "Remembered");
        note =
          `The person just asked you to remember something, and the app has saved it to their memory ` +
          `on this device: "${fact}". Confirm that in one short line, then answer the rest of what they said, if anything.`;
      }

      /* An Armi model whose tactic is two answers rather than one. Mizar puts
         two companies on the same question and lets the person keep the one
         they prefer — which is the honest arrangement wherever judgement
         decides and a verdict from a third model would only be a third
         opinion. It runs through the same columns the Compare button uses,
         and a comparison the person set up themselves wins over it. */
      const where = {
        configured,
        keys: settings.keys,
        hasImage: content.some((b) => b.type === "image"),
        size: history.reduce((n, m) => n + costOf(m), 0),
      };
      const duelCast = compareWith.length ? null : resolveCast(slashPick ?? threadModelId, where);
      const duellists = playersFor(duelCast, "duel").map((p) => p.modelId);
      if (compareWith.length || duellists.length) {
        /* A duel is briefed like any other turn, and every column gets the
           same brief: a comparison where one model was told what the answer
           has to cover and the other was not is not a comparison. */
        const briefer = playerFor(duelCast, "brief");
        let shared = "";
        if (briefer && worthBriefing(asked)) {
          shared = (await complete(briefPrompt(asked, briefer.as), {
            modelId: briefer.modelId,
            maxTokens: 300,
            temperature: 0.2,
          }).catch(() => null)) ?? "";
        }
        setComparing({
          conversationId: convId,
          parentId: userMessage.id,
          history,
          /* Side by side, every column has to be an engine: what runs is a
             model id, and a column handed an Armi model's id used to fall
             through `getModel` to the app default — so "also ask ARMI Parallax"
             quietly asked the same engine as the column beside it, twice, and
             headed the column with a name neither of them had. Each column
             resolves its own cast's writer. */
          modelIds: [
            engineOf(answering, where),
            ...(duellists.length ? duellists : compareWith.map((id) => engineOf(id, where))),
          ],
          /* A duel is one Armi model answering twice: the columns are the
             first answer and the second. A comparison somebody set up
             themselves is between Armi models, and is headed by the names
             they chose from — never by whichever engine those resolved to
             in this browser. */
          labels: duellists.length
            ? ["The first answer", "The second answer", "The third answer"].slice(0, duellists.length + 1)
            : [shortName(answering), ...compareWith.map((id) => shortName(id))],
          turnPrompt: shared ? briefNote(shared) : undefined,
        });
      } else {
        void runTurn(convId, userMessage.id, history, answering, decision?.why, note, slash?.check ? { check: true } : undefined);
      }

      if (isFirst) void generateTitle(convId, blockText(content));
    },
    [activeId, conversation?.leafId, conversation?.temporary, pendingTemporary, path, threadModelId, runTurn, generateTitle, compareWith, configured, settings.keys, settings.modelId, settings.memoryOn],
  );

  /* Anything that lands on a conversation that already exists settles the
     question of which project this is, so the pending one goes. */
  React.useEffect(() => {
    if (activeId) setPendingProject(null);
  }, [activeId]);

  /**
   * The project the next conversation will belong to, before there is one.
   *
   * Cleared by anything that lands somewhere else, so a project named and then
   * abandoned does not attach itself to an unrelated chat half an hour later.
   */
  const [pendingProject, setPendingProject] = React.useState<string | null>(null);

  /* What ⌘K is looking at, and what saying something would do to it. */
  /**
   * An instruction ⌘K handed to whatever was on screen.
   *
   * Stamped with the section it was meant for. It used to be section-less and
   * never cleared, and the two views take it on the nonce — so an instruction
   * given to a file and then a walk over to the notebook delivered the same
   * sentence a second time, to a page that had nothing to do with it, and
   * rewrote it.
   */
  const [handed, setHanded] = React.useState<{ text: string; nonce: number; to: string } | undefined>();

  /* Named by kind rather than by title. Two live queries in the shell to put a
     filename in a hint would put them on every render of the whole app, for a
     word the room you are standing in has already told you. */
  const focus = React.useMemo(() => {
    if (settings.section === "code" && canvasId) {
      return { what: "this file", where: "Ask for this change to the open file" };
    }
    if (settings.section === "notebook" && noteId) {
      return { what: "this page", where: "Ask for this change to the open page" };
    }
    if (settings.section === "chat") {
      return activeId
        ? { what: "this conversation", where: "Send it in this conversation" }
        : { what: "a new chat", where: "Start a new chat with it" };
    }
    return null;
  }, [settings.section, canvasId, noteId, activeId]);

  /**
   * One command, wherever you are.
   *
   * ⌘K could find things and could not do anything to them, so a sentence
   * typed into it was a search that failed. Given what is on screen, the same
   * box takes the sentence to the thing it is about: a file gets revised, a
   * page gets rewritten, a conversation gets it as the next message, and an
   * empty chat becomes one.
   */
  const askFocused = React.useCallback(
    (text: string) => {
      if (settings.section === "chat" || !focus) {
        void send([{ type: "text", text }]);
        settings.setSection("chat");
        return;
      }
      // The nonce, not the text: asking the same thing twice is two requests.
      setHanded({ text, nonce: Date.now(), to: settings.section });
    },
    [settings, focus, send],
  );

  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);

  /**
   * A second opinion, from somewhere else.
   *
   * The one thing an app holding four providers' keys can do that a
   * single-provider app cannot do honestly. A model asked to check its own
   * answer reproduces the same reasoning from the same weights and reports
   * that it holds up, which is an echo rather than a check — so this always
   * goes to a different provider, and where there is not one it says so
   * instead of quietly asking a sibling model and calling it independent.
   */
  const verify = React.useCallback(
    async (message: Message, pinned?: string) => {
      if (verifyingId) {
        // Silently doing nothing reads as a broken button.
        if (verifyingId !== message.id) setNotice("One check at a time — the last one is still running.");
        return;
      }
      const asked = pathTo(allMessages ?? [], message.parentId)
        .filter((m) => m.role === "user")
        .slice(-1)[0];
      if (!asked) return;

      const { checker } = await import("@/lib/route");
      /* An Armi model names its own checker when the turn goes out, and that
         one is used: the row promised a particular second company, and
         choosing again now could quietly substitute another. Everything else
         — the button on an ordinary answer — asks for the strongest model
         somewhere other than where the answer came from. */
      const who =
        pinned ??
        checker(engineOf(message.modelId ?? settings.modelId, { configured, keys: settings.keys }), {
          configured,
          keys: settings.keys,
        });
      if (!who) {
        /* Two ways there is nobody to ask, and they need different sentences.
           One provider configured is something you can fix in Settings; an
           answer from a model this app no longer recognises is not, and
           telling somebody to add a key would send them somewhere that does
           not help. */
        /* Distinct providers. A provider can be both configured on the server
           and keyed in this browser, and counting the two lists separately made
           one provider look like two — which picked the sentence about an
           unrecognised model for somebody whose actual problem was having only
           one key. */
        const providers = new Set([
          ...Object.entries(configured).filter(([, on]) => on).map(([p]) => p),
          ...Object.entries(settings.keys).filter(([, v]) => v).map(([p]) => p),
        ]).size;
        setNotice(
          providers > 1
            ? "That answer came from a model this app no longer recognises, so it cannot promise the check would come from somewhere else."
            : "A second opinion has to come from a different provider, and only one is configured. Add another key in Settings.",
        );
        return;
      }

      setVerifyingId(message.id);
      try {
        const { verifyAnswer } = await import("@/lib/verify");
        const verdict = await verifyAnswer(blockText(asked.content), blockText(message.content), who);
        if (verdict) await db.messages.update(message.id, { verdict });
        else setNotice("The check didn't come back. Try again.");

        /* And the part that makes a check worth buying. A verdict on its own
           is a report — "the second paragraph is wrong", printed under an
           answer that is still wrong, leaving the reader to do the work. On
           the tactics where being wrong costs something, the model that wrote
           it is handed the objection and answers again: a correction rather
           than a critique, which is what two models are for.

           Once per question, and never told to agree — where the objection
           is wrong the writer keeps its ground and says why, and where
           neither can settle it the reader is told that instead. */
        const preset = getPreset(threadModelId);
        const parent = message.parentId ?? "";
        if (
          verdict &&
          verdict.agrees !== "agrees" &&
          preset?.revise &&
          message.conversationId === activeId &&
          !arguedRef.current.has(parent)
        ) {
          arguedRef.current.add(parent);
          const history = pathTo(allMessages ?? [], message.parentId);
          void runTurn(
            message.conversationId,
            message.parentId,
            history,
            threadModelId,
            /* No routed reason: this turn builds its own, and it is the same
               tactic that answered the first time. */
            undefined,
            objectionNote(verdict),
            { revised: true },
          );
        }
      } catch {
        setNotice("That check failed. Check the key and the connection.");
      } finally {
        setVerifyingId(null);
      }
    },
    [verifyingId, allMessages, configured, settings.keys, settings.modelId, threadModelId, activeId, runTurn],
  );
  /* Handed to the finish callback, which is declared above this and has to
     be able to ask for a check without being rebuilt every time `verify`
     changes identity. */
  verifyRef.current = verify as (m: Message, pinned?: string) => void;

  /** Regenerating reuses the parent, so the new answer is a sibling of the old. */
  /* Taking back what an answer did. The closure that knows how lives with
     the registry for this session; here the record on the message is
     marked, so the chip says "undone" and a later turn is not told the
     cards are there. */
  const undoDone = React.useCallback(async (message: Message, action: Action) => {
    const ok = await undoAction(action.id);
    if (!ok) return;
    const actions = (message.actions ?? []).map((a) => (a.id === action.id ? { ...a, undone: true } : a));
    await db.messages.update(message.id, { actions });
    setNotice(`Undone: ${action.summary}`);
  }, []);

  const regenerate = React.useCallback(
    async (message: Message, modelId?: string, opts?: { effort?: "high" }) => {
      if (!activeId) return;
      void markOutcome(message.id, "retried");
      const parentId = message.parentId;
      const history = pathTo(allMessages ?? [], parentId);
      /* A calculator answer has no model behind it, and `calculator` is not an
         id anything can be asked with — `getModel` would quietly return the app
         default, so pressing Regenerate on a sum sent it to whichever model
         happens to be default rather than to the one this thread is on. Asking
         a model is the useful thing to do here, since running the same sum
         through the same calculator returns the same digits; it just has to be
         the model the thread would have used. */
      if (!modelId && message.modelId === CALCULATOR) {
        void runTurn(activeId, parentId, history, threadModelId);
        return;
      }
      // The leaf stays where it is: the old answer remains on screen and the
      // new one streams beneath it, so a worse regeneration costs nothing and
      // an aborted one costs nothing at all.
      void runTurn(activeId, parentId, history, modelId ?? message.modelId ?? threadModelId, undefined, undefined, opts?.effort ? { effort: opts.effort } : undefined);
    },
    [activeId, allMessages, runTurn, threadModelId],
  );

  /**
   * Regenerate without the packaging.
   *
   * `lib/lint.ts` reads a finished answer back against the house rules —
   * the header it opened with, the "let me explain", the "hope this helps",
   * the "probably" with no odds — and until now nothing did anything with
   * what it found. This is the loop closed: the findings go back to the
   * model as a note for one reply, quoted, so the next answer is the same
   * answer without the parts the rules are about. The old one stays on
   * screen as a branch, the way every regeneration does.
   */
  const tighten = React.useCallback(
    async (message: Message) => {
      if (!activeId) return;
      const history = pathTo(allMessages ?? [], message.parentId);
      const asked = [...history].reverse().find((m) => m.role === "user");
      const findings = lintAnswer(blockText(message.content), asked ? blockText(asked.content) : undefined);
      if (!findings.length) return;
      void markOutcome(message.id, "tightened");
      const note = [
        "Your previous reply to this broke these rules. Give the same answer without them:",
        ...findings.map((f) => `- ${f.rule} — it had "${f.found}". ${f.why}.`),
      ].join("\n");
      const modelId = message.modelId && message.modelId !== CALCULATOR ? message.modelId : threadModelId;
      void runTurn(activeId, message.parentId, history, modelId, undefined, note);
    },
    [activeId, allMessages, runTurn, threadModelId],
  );

  /**
   * A thumbs up is stored and that is all. A thumbs down with a reason is
   * stored and then acted on: the reason becomes the note for one more
   * attempt at the same question, so "too long" gets a shorter answer rather
   * than a tally mark. The old answer stays as a branch, like any regenerate.
   */
  const rate = React.useCallback(
    async (message: Message, rating: Rating) => {
      await db.messages.update(message.id, { rating });
      /* The one honest measure of an answer is what the person did about it,
         and this is the clearest signal there is. It goes to the record that
         decides whether answers of this shape earn a second opinion. */
      void markOutcome(message.id, rating.up ? "good" : "bad", rating.reason);
      if (rating.up || !rating.reason || !activeId) return;
      const history = pathTo(allMessages ?? [], message.parentId);
      const modelId = message.modelId && message.modelId !== CALCULATOR ? message.modelId : threadModelId;
      void runTurn(activeId, message.parentId, history, modelId, undefined, REASON_NOTE[rating.reason]);
    },
    [activeId, allMessages, runTurn, threadModelId],
  );

  React.useEffect(() => {
    const q = queued.current;
    if (!q || q.id !== activeId) return;
    queued.current = null;
    void send([{ type: "text", text: q.text }]);
  }, [activeId, send]);

  /**
   * A calculation in an answer finished. Answer again, with what it printed.
   *
   * This is the half that makes running code worth doing. The first reply
   * says what it is working out and carries the computation; the app runs
   * it; and this hands the real output back, so the reply that follows is
   * written from the numbers rather than from a memory of them. It is the
   * loop ChatGPT, Claude and Gemini all close, and until now this app had
   * the first half of it only.
   */
  const computed = React.useCallback(
    async (message: Message, out: Outcome) => {
      if (!activeId || message.computedAt) return;
      await db.messages.update(message.id, { computedAt: Date.now() });
      const history = [...pathTo(allMessages ?? [], message.parentId), message];
      const modelId = message.modelId && message.modelId !== CALCULATOR ? message.modelId : threadModelId;
      void runTurn(activeId, message.id, history, modelId, undefined, asNote(out));
    },
    [activeId, allMessages, runTurn, threadModelId],
  );

  /**
   * An answer, turned into cards that come back.
   *
   * The one move this app has that a conversation does not: the answer you
   * just read scrolls away, and the cards made from it do not. Named after
   * the conversation, so a week later the deck says where it came from.
   */
  const makeCards = React.useCallback(
    async (text: string) => {
      const modelId = cheapestAvailable(configured);
      if (!modelId) {
        setNotice("No key configured yet — add one in Settings.");
        return;
      }
      setNotice("Writing cards…");
      const { draftCards } = await import("@/lib/generate");
      const drafts = await draftCards(text, { modelId }).catch(() => null);
      if (!drafts) {
        setNotice("Nothing usable came back — the answer may be too short to make cards from.");
        return;
      }
      const name = (conversation?.title || text.split("\n")[0] || "From a chat").slice(0, 60);
      const deck = await createDeck(name, activeId ?? undefined);
      const n = await addCards(deck.id, drafts, activeId ?? undefined);
      setNotice(null);
      withTransition(() => settings.setSection("study"), "forward");
      /* The undo *is* the delete, not the result of one. `deleteDeck`
         performs the deletion and hands back the way back, which is right
         for a row somebody removed and exactly wrong here: calling it to
         get an undo handle deleted the deck the moment it was made. */
      offerUndo(`${n} card${n === 1 ? "" : "s"} from “${name}”`, async () => { await deleteDeck(deck.id); }, "Made");
    },
    [configured, conversation?.title, activeId, settings],
  );

  /** Remember something the person said, from the message itself. */
  const remember = React.useCallback(
    async (text: string) => {
      const kept = await addMemory(text, activeId ?? undefined);
      offerUndo(kept.text, async () => { await db.memories.delete(kept.id); }, "Remembered");
    },
    [activeId],
  );

  /** Editing forks: the original message and its whole subtree stay reachable. */
  const editMessage = React.useCallback(
    async (message: Message, text: string) => {
      if (!activeId) return;
      const kept = message.content.filter((b) => b.type !== "text");
      const edited = await addMessage({
        conversationId: activeId,
        parentId: message.parentId,
        role: "user",
        content: [...kept, { type: "text", text }],
      });
      const history = [...pathTo(allMessages ?? [], message.parentId), edited];
      /* Rewriting the question is the person saying the answer to the last
         one was not worth having. */
      const answered = (allMessages ?? []).find((m) => m.parentId === message.id && m.role === "assistant");
      if (answered) void markOutcome(answered.id, "edited");
      void runTurn(activeId, edited.id, history, threadModelId);
    },
    [activeId, allMessages, runTurn, threadModelId],
  );

  const keepCompared = React.useCallback(
    async (messageId: string, modelId: string) => {
      if (!activeId) return;
      // Keeping a compared answer points the thread at it and adopts its
      // model for this thread — it must not rewrite the global default.
      await db.conversations.update(activeId, { leafId: messageId, modelId });
      setComparing(null);
      setCompareWith([]);
    },
    [activeId],
  );

  const navigate = React.useCallback(
    async (id: string) => {
      if (!activeId) return;
      await db.conversations.update(activeId, { leafId: deepestLeaf(allMessages ?? [], id) });
    },
    [activeId, allMessages],
  );

  const closeDrawerOnMobile = React.useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) settings.setSidebar(false);
  }, [settings]);

  const newChat = React.useCallback(() => {
    // Deliberately does not stop the stream: an answer belongs to the thread it
    // was asked in, not to whatever is on screen.
    setActiveId(null);
    // And it has to bring you back to the chat. "New chat" pressed from Notes
    // or a canvas used to clear the thread behind a screen you were still
    // looking at — a button that reports doing nothing while quietly doing
    // something is worse than one that is disabled.
    settings.setSection("chat");
    closeDrawerOnMobile();
  }, [closeDrawerOnMobile, settings]);

  /**
   * A chat that belongs to a project from its first word.
   *
   * The project is stamped at creation rather than inferred later, because the
   * first turn is the one that most needs the instructions and the knowledge —
   * and a chat that picks up its project on the second message answers the
   * first one as a stranger.
   */
  /**
   * A chat in this project, starting when you say something.
   *
   * Not when you press the button. Everywhere else in the app a conversation
   * is created on first send — the comment in `send` says why: the sidebar
   * should not fill with empty rows nobody meant to make — and this one
   * created a row immediately, so pressing it and changing your mind left
   * "Untitled" behind every time. The project is remembered instead and
   * applied to whatever conversation the next message creates.
   */
  const newChatInProject = React.useCallback(
    (pid: string) => {
      setActiveId(null);
      setPendingProject(pid);
      settings.setSection("chat");
      closeDrawerOnMobile();
    },
    [settings, closeDrawerOnMobile],
  );

  /* Sections are laid out left to right the way the nav lists them, so moving
     down the list travels forward and moving up it travels back. The direction
     is not decoration: it is the only thing that distinguishes "I went
     somewhere" from "the screen changed". */
  const ORDER: Section[] = ["chat", "code", "projects", "notebook"];

  const goToSection = React.useCallback(
    (target: Section) => {
      const forward = ORDER.indexOf(target) >= ORDER.indexOf(settings.section as Section);
      withTransition(() => {
        settings.setSection(target);
        // On a phone the nav lives in a drawer over the content, so navigating
        // without closing it lands you on the screen you asked for with the
        // menu still on top of it.
        closeDrawerOnMobile();
        if (target === "projects") setProjectId(null);
        if (target === "code") setCanvasId(null);
        if (target === "notebook") setNoteId(null);
      }, forward ? "forward" : "back");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, closeDrawerOnMobile],
  );

  const createInSection = React.useCallback(
    async (section: Section) => {
      closeDrawerOnMobile();
      if (section === "chat") return newChat();
      if (section === "projects") return setProjectId((await createProject()).id);
      if (section === "code") return setCanvasId((await createCanvas()).id);
      setNoteId((await createNote()).id);
    },
    [closeDrawerOnMobile, newChat],
  );

  /* Code made inside a project belongs to it from the first keystroke.
     Making it somewhere else and moving it later is the version of this that
     nobody does, so the project's own rules never reach the file they were
     written for. */
  const newCanvasInProject = React.useCallback(
    async (pid: string) => {
      const canvas = await createCanvas({ projectId: pid });
      setCanvasSeed(undefined);
      setCanvasId(canvas.id);
      settings.setSection("code");
      closeDrawerOnMobile();
    },
    [settings, closeDrawerOnMobile],
  );

  const selectInSection = React.useCallback(
    (section: Section, id: string) => {
      withTransition(() => {
        closeDrawerOnMobile();
        if (section === "chat") {
          setActiveId(id);
          settings.setSection("chat");
        } else if (section === "projects") setProjectId(id);
        else if (section === "code") setCanvasId(id);
        else if (section === "study") {
          settings.setSection("study");
          setDeckId(id);
        } else setNoteId(id);
      }, "forward");
    },
    [closeDrawerOnMobile, settings],
  );

  /* From the Library, which lists things from three rooms: open in the one
     that edits it. `selectInSection` assumes you are already in the room;
     this is the version for when you are not. */
  const openFromLibrary = React.useCallback(
    (kind: "page" | "deck" | "canvas", id: string) => {
      withTransition(() => {
        closeDrawerOnMobile();
        if (kind === "page") {
          setNoteId(id);
          settings.setSection("notebook");
        } else if (kind === "deck") {
          setDeckId(id);
          settings.setSection("study");
        } else {
          setCanvasSeed(undefined);
          setCanvasId(id);
        }
      }, "forward");
    },
    [closeDrawerOnMobile, settings],
  );

  /** Lift an answer into a canvas and go there. */
  const keepAsCanvas = React.useCallback(
    async (text: string) => {
      /* A fenced block becomes a code canvas in its own language; anything
         else is prose. Guessing wrong here is cheap to fix, and guessing at all
         beats making someone pick a type before they can start.

         The info string is everything after the backticks — `ts` but also
         `ts title="debounce.ts"`, which this app writes and renders. Matching
         only a bare language would miss exactly the blocks that were labelled
         carefully enough to be worth keeping. */
      const fence = text.match(/```([\w.-]*)([^\n]*)\n([\s\S]*?)```/);
      const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1];
      // A code block's own filename names the canvas better than a heading
      // somewhere else in the answer does.
      const filename = fence?.[2].match(/title="([^"]+)"/)?.[1];

      /* A whole page is not a snippet. Asked to make a timer, Creative replies
         with a complete HTML document, and keeping that as a *code* canvas
         gave you the source of a working thing and made you press Run to find
         out. It lands as a web app instead: it opens running, it has a
         console, and "Use it" hands it the window. This is the difference
         between "Creative can build you anything" being a claim and being
         true. */
      const body = fence?.[3].replace(/\s+$/, "") ?? "";
      const wholePage = fence && /^\s*(<!doctype html|<html[\s>])/i.test(body);
      if (wholePage) {
        const title =
          body.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || heading || "Untitled";
        const made = await createWebCanvas([{ name: ENTRY, lang: "html", content: body + "\n" }], {
          title: title.slice(0, 80),
          sourceConversationId: activeId ?? undefined,
        });
        withTransition(() => {
          setCanvasId(made.id);
          settings.setSection("code");
          closeDrawerOnMobile();
        }, "forward");
        return;
      }

      const canvas = fence
        ? await createCanvas({
            title: filename ?? heading ?? "Untitled",
            kind: "code",
            lang: fence[1] || "ts",
            content: fence[3].replace(/\s+$/, "") + "\n",
            sourceConversationId: activeId ?? undefined,
          })
        : await createCanvas({
            title: heading ?? "Untitled",
            kind: "doc",
            content: text,
            sourceConversationId: activeId ?? undefined,
          });
      setCanvasId(canvas.id);
      settings.setSection("code");
      closeDrawerOnMobile();
    },
    [activeId, settings, closeDrawerOnMobile],
  );

  /**
   * A starter was pressed on a blank Creative page.
   *
   * The canvas already exists by the time this runs — the row makes it — so
   * this is only the move: go to Code, open it, and leave the starter's
   * half-sentence in the box. A web canvas opens running, so what lands on
   * screen is the working thing rather than its source.
   */
  const openMade = React.useCallback(
    (id: string, seed: string) => {
      setCanvasSeed(seed);
      setCanvasId(id);
      settings.setSection("code");
      closeDrawerOnMobile();
    },
    [settings, closeDrawerOnMobile],
  );

  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const conversationToNote = React.useCallback(async () => {
    if (!path.length) return;
    const md = path
      .map((m) => `${m.role === "user" ? "**You**" : `**${m.modelId ?? "Assistant"}**`}\n\n${blockText(m.content)}`)
      .join("\n\n---\n\n");
    const note = await saveToNote(
      `# ${conversation?.title || "Saved conversation"}\n\n${md}`,
      activeId ?? undefined,
    );
    setNoteId(note.id);
    settings.setSection("notebook");
  }, [path, conversation?.title, activeId, settings]);

  /** Lift an answer out of the conversation and into something you keep. */
  const keepAsNote = React.useCallback(
    async (text: string) => {
      const note = await saveToNote(text, activeId ?? undefined);
      // Deliberately does not navigate: you were reading something.
      setNoteId(note.id);
    },
    [activeId],
  );

  const exportConversation = React.useCallback(() => {
    if (!conversation) return;
    const md = exportMarkdown(conversation, path);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conversation.title || "conversation").replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversation, path]);

  const removeConversation = React.useCallback(async () => {
    if (!activeId) return;
    const title = conversation?.title || "this conversation";
    const restore = await deleteConversation(activeId);
    setActiveId(null);
    offerUndo(title, async () => {
      await restore();
      setActiveId(activeId);
    });
  }, [activeId, conversation]);

  const editLast = React.useCallback(() => {
    const lastUser = [...path].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const el = document.getElementById(`m-${lastUser.id}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Its own edit control does the work, so editing stays one flow whether you
    // reached it with the keyboard or the mouse.
    el?.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')?.click();
  }, [path]);

  /* --- Shortcuts. Everything here is also in the palette. ---------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inOverlay(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        const tagNow = (e.target as HTMLElement)?.tagName;
        const typing = tagNow === "INPUT" || tagNow === "TEXTAREA";

        if (e.key === "?" && !typing) {
          e.preventDefault();
          setShortcutsOpen(true);
          return;
        }

        // j and k step through the transcript, vi-style, once the composer is
        // out of the way.
        if ((e.key === "j" || e.key === "k") && !typing && settings.section === "chat" && path.length) {
          e.preventDefault();
          const ids = path.map((m) => m.id);
          const next =
            e.key === "j"
              ? Math.min(cursorRef.current + 1, ids.length - 1)
              : Math.max(cursorRef.current - 1, 0);
          cursorRef.current = next;
          document
            .getElementById(`m-${ids[next]}`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }

        if (e.key !== "Escape") return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        // Not while something made here has the window: there, Escape hands it
        // back, and this handler would carry you out of the canvas as well.
        if (inUse) return;
        // Escape backs out of an item, and backing out travels the other way.
        if (settings.section === "projects" && projectId)
          withTransition(() => setProjectId(null), "back");
        else if (settings.section === "code" && canvasId)
          withTransition(() => setCanvasId(null), "back");
        else if (settings.section === "notebook" && noteId)
          withTransition(() => setNoteId(null), "back");
        else if (stream.phase !== "idle") stream.stop();
        return;
      }
      switch (e.key.toLowerCase()) {
        case "k":
          e.preventDefault();
          setPaletteOpen((o) => !o);
          break;
        case "n":
          e.preventDefault();
          void createInSection(settings.section);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "4": {
          e.preventDefault();
          // The order the sidebar shows them in, so the number you press is
          // the position you can see rather than one you have to remember.
          const sections = ["chat", "code", "projects", "notebook"] as const;
          goToSection(sections[Number(e.key) - 1]);
          break;
        }
        case "\\":
          e.preventDefault();
          settings.toggleSidebar();
          break;
        case "/":
          e.preventDefault();
          setModelPickerOpen(true);
          break;
        case ",":
          e.preventDefault();
          setSettingsTab("keys");
          setSettingsOpen(true);
          break;
        case "d":
          if (e.shiftKey) {
            e.preventDefault();
            settings.setTheme(settings.theme === "dark" ? "light" : "dark");
          }
          break;
        case "c":
          if (e.shiftKey) {
            e.preventDefault();
            const last = [...path].reverse().find((m) => m.role === "assistant");
            if (last) navigator.clipboard.writeText(blockText(last.content));
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createInSection, goToSection, path, settings, stream, canvasId, noteId, projectId, inUse]);

  const openKeys = React.useCallback(() => {
    setSettingsTab("keys");
    setSettingsOpen(true);
  }, []);
  const openRules = React.useCallback(() => {
    setSettingsTab("rules");
    setSettingsOpen(true);
  }, []);

  /* The neutrals' undertone, on the root so every token reads it. The
     pre-paint script in the layout sets it for the first frame; this keeps
     it in step with the switch afterwards. */
  React.useEffect(() => {
    if (settings.tone === "warm") document.documentElement.dataset.tone = "warm";
    else delete document.documentElement.dataset.tone;
  }, [settings.tone]);

  /* The software keyboard, as a number the layout can use.
     ---------------------------------------------------------------
     On iPad and iPhone Safari the layout viewport does not shrink when the
     keyboard comes up — `100dvh` stays the height of the screen — so a box
     docked to the bottom of the frame is docked under the keyboard, and
     what you see while you type is the transcript's tail sliding about as
     Safari scrolls the caret into view. The visual viewport knows the
     truth; its height is written to `--kb` and the frame is that much
     shorter, so the composer stands on the keyboard rather than beneath
     it. Under a hundred pixels is a toolbar showing or hiding, not a
     keyboard, and is ignored so the frame does not twitch on every scroll. */
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const gap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb", `${gap > 100 ? gap : 0}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--kb");
    };
  }, []);

  /** Is the one live stream the one this screen is showing? */
  const live = stream.conversationId !== null && stream.conversationId === activeId;
  React.useEffect(() => {
    stopRef.current = stream.stop;
  }, [stream.stop]);

  /* Voice mode: the loop is in lib/voice.ts; this hands it the thread's
     facts. The answer it reads is the last finished one on the path. */
  const lastAnswer = React.useMemo(() => {
    const m = [...path].reverse().find((x) => x.role === "assistant");
    return m ? { id: m.id, text: blockText(m.content) } : null;
  }, [path]);
  const voice = useVoiceMode({
    onSend: (text) => void send([{ type: "text", text }]),
    busy: live && stream.phase !== "idle",
    answer: lastAnswer,
  });
  /* How much of this thread will not fit the window it is going into.
     Derived from the thread rather than remembered from the last request: it
     is a fact about the conversation as it now stands, so it stays true after
     the answer lands, and it updates the moment you switch to a model with a
     different window. */
  const droppedFromContext = React.useMemo(
    () => {
      /* On Auto there is no model yet — the model is chosen when you send —
         and `getModel("auto")` returns the app default, so the warning was
         counting against a window that had nothing to do with the model that
         would answer. The default is at least a model that exists and is a
         plausible stand-in; asking it about "auto" was not a question with an
         answer. */
      const base = threadModelId === AUTO ? (settings.modelId === AUTO ? DEFAULT_MODEL_ID : settings.modelId) : threadModelId;
      /* And the window belongs to the engine: an Armi model is a tactic, and
         "nearly full" measured against the app default while Atlas is holding
         a million tokens is a warning about a model nobody is talking to. */
      const id = engineOf(base, { configured, keys: settings.keys });
      return fitToContext(path, getModel(id), paramsFor(id), threadPrompt).dropped;
    },
    [path, threadModelId, threadPrompt, settings.modelId, settings.keys, configured],
  );

  const showEmpty = path.length === 0 && !live && !comparing;

  /* Built once and placed in one of two homes: centred inside the empty state,
     or docked under the transcript. Same element either way, so the draft and
     everything else in it survives the move. */
  const composer = mounted ? (
    <Composer
      conversationId={activeId ?? "new"}
      streaming={live && stream.phase !== "idle"}
      contextTokens={contextTokens}
      modelId={threadModelId}
      onSend={send}
      onStop={stream.stop}
      onEditLast={editLast}
      configured={configured}
      onOpenModels={() => setModelPickerOpen(true)}
      rulesCount={rulesCount(settings.rules ?? [], settings.systemPrompt)}
      onOpenRules={openRules}
      /* The web, switched on beside the box rather than in the bar: it is a
         decision about the question being typed. Same state either way —
         a thread that has one keeps it, and a blank page holds it until
         there is a thread to keep it on. */
      research={conversation ? !!conversation.research : pendingResearch}
      onToggleResearch={() => {
        if (activeId && conversation) void db.conversations.update(activeId, { research: !conversation.research });
        else setPendingResearch((v) => !v);
      }}
      placeholder={findMode((conversation ? conversation.mode : pendingLearn ? "learn" : undefined) ?? "chat").placeholder}
      learn={conversation ? conversation.mode === "learn" : pendingLearn}
      onToggleLearn={() => {
        if (activeId && conversation) void db.conversations.update(activeId, { mode: conversation.mode === "learn" ? undefined : "learn" });
        else setPendingLearn((v) => !v);
      }}
      voice={voice}
    />
  ) : null;

  const artifactValue = React.useMemo(
    () => ({ open: setArtifact, current: artifact }),
    [artifact],
  );

  return (
    <TooltipProvider>
      <ArtifactProvider value={artifactValue}>
      {/* The banner sits above the shell rather than inside it, because the
          shell is a row of scrollers that fills the screen and this is a fact
          about the whole app — true in the notebook and in Code as much as in
          a conversation. */}
      <div className="app-frame flex h-dvh flex-col">
      <StorageNotice />
      <div className="app-shell flex min-h-0 flex-1 overflow-hidden">
        {!inUse && (
        <Sidebar
          activeChatId={activeId}
          onSelectChat={(id) => selectInSection("chat", id)}
          onNewChat={() => void createInSection("chat")}
          onGoToSection={goToSection}
          onOpenSettings={openKeys}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
        )}

        {/* The room. Named for the view transition, so a section change slides
            in the direction you travelled instead of cutting. */}
        <main className="vt-room relative flex min-w-0 flex-1 flex-col">
          {settings.section !== "chat" ? (
            <>
              {/* A bar only when there is something to put in it. This was a
                  topbar-height strip in every room whose one occupant — the
                  sidebar toggle — appears below `md` with the sidebar closed,
                  so on a tablet with the sidebar open it was fifty-six pixels
                  of nothing above every room's own header: two headers, one
                  of them blank. Below `md` the toggle still needs somewhere to
                  be; everywhere else the room starts at the top. */}
              {!settings.sidebarOpen && !inUse && (
                <header className="no-print flex h-[var(--topbar-h)] shrink-0 items-center gap-1 border-b border-transparent px-2 md:hidden">
                  <IconButton label="Show sidebar" keys={["mod", "\\"]} onClick={settings.toggleSidebar}>
                    <PanelLeft size={16} />
                  </IconButton>
                </header>
              )}
              {settings.section === "projects" && (
                <ProjectsView
                  projectId={projectId}
                  onSelect={(id) => withTransition(() => setProjectId(id), "forward")}
                  onNew={() => void createInSection("projects")}
                  onBack={() => withTransition(() => setProjectId(null), "back")}
                  onOpenChat={(id) => selectInSection("chat", id)}
                  onNewChatHere={newChatInProject}
                  onOpenCanvas={(id) => selectInSection("code", id)}
                  onNewCanvasHere={(pid) => void newCanvasInProject(pid)}
                  configured={configured}
                />
              )}
              {settings.section === "code" && !canvasId && (
                <LibraryView
                  onOpen={openFromLibrary}
                  onNewCanvas={(id, seed) =>
                    withTransition(() => {
                      setCanvasSeed(seed);
                      setCanvasId(id);
                    }, "forward")
                  }
                  onNew={() => void createInSection("code")}
                />
              )}
              {settings.section === "code" && canvasId && (
                <CanvasView
                  canvasId={canvasId}
                  configured={configured}
                  seed={canvasSeed}
                  ask={settings.section === "code" && handed?.to === "code" ? handed : undefined}
                  onAsked={() => setHanded(undefined)}
                  onSelect={(id, seed) =>
                    withTransition(() => {
                      setCanvasSeed(seed);
                      setCanvasId(id);
                    }, "forward")
                  }
                  onNew={() => void createInSection("code")}
                  onFocus={setInUse}
                  onBack={() =>
                    withTransition(() => {
                      setCanvasSeed(undefined);
                      setCanvasId(null);
                    }, "back")
                  }
                />
              )}
              {settings.section === "creative" && (
                <CreativeView
                  /* Built, then handed to the room that runs canvases. This
                     room chooses; Code is where a canvas lives. */
                  onMade={(id, seed) =>
                    withTransition(() => {
                      setCanvasSeed(seed);
                      setCanvasId(id);
                      settings.setSection("code");
                    }, "forward")
                  }
                  /* `handed` is for the canvas and the notebook, which take an
                     instruction as a prop. The chat composer reads its draft
                     from the store, which is also what the empty page's
                     examples write to — so this writes the same half-sentence
                     to the same place. */
                  onBuild={(text) => void startBuild(text)}
                />
              )}
              {settings.section === "notebook" && (
                <NotebookView
                  noteId={noteId}
                  configured={configured}
                  ask={settings.section === "notebook" && handed?.to === "notebook" ? handed : undefined}
                  onAsked={() => setHanded(undefined)}
                  onSelect={(id) => withTransition(() => setNoteId(id), "forward")}
                  onNew={() => void createInSection("notebook")}
                  onBack={() => withTransition(() => setNoteId(null), "back")}
                  /* A passage from a page, taken to the chat — the same door
                     a card you got wrong goes through. */
                  onAsk={(question) => void askInChat(question)}
                  onToChat={() => withTransition(() => settings.setSection("chat"), "back")}
                />
              )}
              {settings.section === "study" && (
                <StudyView
                  configured={configured}
                  openId={deckId}
                  onFocus={setInUse}
                  /* A card you got wrong, taken to the chat. The deck is
                     inside an assistant rather than beside one, and this
                     is the whole of what that is worth. */
                  onAsk={(question) => void askInChat(question)}
                  /* A new page in the Notebook, opened with the file picker
                     up and the pack queued for whatever lands in it. */
                  onPack={() => {
                    void (async () => {
                      const page = await createNote();
                      setHanded({ text: "/pack", nonce: Date.now(), to: "notebook" });
                      withTransition(() => {
                        setNoteId(page.id);
                        settings.setSection("notebook");
                      }, "forward");
                    })();
                  }}
                />
              )}
            </>
          ) : (
          <>
          <TopBar
            conversation={conversation ?? null}
            scrolled={scrolled}
            onRename={(title) => activeId && db.conversations.update(activeId, { title })}
            onExport={exportConversation}
            onDelete={removeConversation}
            onTogglePin={() =>
              activeId && conversation && db.conversations.update(activeId, { pinned: !conversation.pinned })
            }
            onToggleArchive={async () => {
              if (!activeId || !conversation) return;
              const archived = !conversation.archived;
              // Archiving also unpins: a conversation cannot be both filed
              // away and held at the top of the list you filed it out of.
              await db.conversations.update(activeId, { archived, pinned: archived ? false : conversation.pinned });
              if (archived) setActiveId(null);
            }}
            projects={projects}
            pendingProject={pendingProject}
            temporary={conversation ? !!conversation.temporary : pendingTemporary}
            onToggleTemporary={() => setPendingTemporary((v) => !v)}
            modelId={threadModelId}
            configured={configured}
            modelPickerOpen={modelPickerOpen}
            onModelPickerOpenChange={setModelPickerOpen}
            onModelChange={setModel}
            onMoveToProject={(pid) => {
              if (activeId) void db.conversations.update(activeId, { projectId: pid ?? undefined });
            }}
            onOpenProject={(pid) => selectInSection("projects", pid)}
            onSaveAsNote={conversationToNote}
          />

          {showEmpty ? (
            <EmptyState
              hasAnyKey={hasAnyKey}
              onAddKey={openKeys}
              onGo={(section) => withTransition(() => settings.setSection(section), "forward")}
            >
              {composer}
            </EmptyState>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {notice && (
                <div className="mx-auto w-full max-w-[var(--measure)] px-4 pt-2">
                  <InlineError message={notice} onDismiss={() => setNotice(null)} />
                </div>
              )}
              <MessageList
                onScrolledChange={setScrolled}
                messages={path}
                allMessages={allMessages ?? []}
                streaming={live ? stream.phase : "idle"}
                streamText={live ? stream.text : ""}
                streamReasoning={live ? stream.reasoning : ""}
                streamSearching={live ? stream.searching : null}
                streamActing={live ? stream.acting : null}
                streamActions={live ? stream.actions : undefined}
                onOpenAction={(open) => selectInSection(open.section as Section, open.id ?? "")}
                onUndoAction={undoDone}
                dropped={droppedFromContext}
                recapped={Boolean(conversation?.recap)}
                /* The model actually receiving this turn, not the one the
                   picker is holding. An Armi model is a tactic — "one" is not
                   a model id — and Auto has not chosen yet when the picker is
                   read, so both used to draw the app default's name over an
                   answer somebody else was writing. */
                streamModelId={stream.modelId ?? engineOf(threadModelId, { configured, keys: settings.keys })}
                streamPresetId={stream.presetId ?? getPreset(threadModelId)?.id ?? (threadModelId === AUTO ? AUTO : undefined)}
                elapsed={live ? stream.elapsed : 0}
                retryingInMs={live ? stream.retryingInMs : 0}
                error={live ? stream.error : null}
                onNavigate={navigate}
                onEdit={editMessage}
                onRemember={remember}
                onRegenerate={regenerate}
                onSaveToNote={keepAsNote}
                onContinue={() => void send([{ type: "text", text: CONTINUE_PROMPT }])}
                onTighten={tighten}
                onFollowUp={(text) => void send([{ type: "text", text }])}
                teaching={isTeaching(conversation?.styleId) || getPreset(threadModelId)?.id === "tutor"}
                onRate={rate}
                onVerify={verify}
                verifyingId={verifyingId}
                onOpenMade={showMade}
                onComputed={computed}
                onMakeCards={makeCards}
                onOpenInCanvas={keepAsCanvas}
                onRetry={() => {
                  /* The turn that just failed, which is decided by the end of
                     the thread. Looking backwards for the last assistant
                     message anywhere in it found the answer to the question
                     *before* the one that failed — a failed turn leaves your
                     question as the leaf with nothing under it — so Retry
                     silently re-answered something already answered and
                     dropped what you had actually asked. */
                  const last = path[path.length - 1];
                  if (!last || !activeId) return;
                  if (last.role === "assistant") regenerate(last);
                  else runTurn(activeId, last.id, path, threadModelId);
                }}
                onAddKey={openKeys}
                onSwitchModel={() => setModelPickerOpen(true)}
                onDismissError={stream.clearError}
                /* Pointing at a sentence and asking about it. The quote goes
                   into the message rather than a description of the quote:
                   what a reader is worst at is saying which part they did not
                   follow, and a selection says it exactly. "Ask" leaves the
                   question to them and only carries the quote across. */
                onPoint={(action, quote) => {
                  const text = promptFor(action, quote);
                  if (action === "ask") {
                    useDrafts.getState().setDraft(activeId ?? "new", text);
                    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')?.focus();
                    return;
                  }
                  void send([{ type: "text", text }]);
                }}
                compare={
                  comparing && activeId && comparing.conversationId === activeId
                    ? {
                        conversationId: activeId,
                        parentId: comparing.parentId,
                        history: comparing.history,
                        modelIds: comparing.modelIds,
                        labels: comparing.labels,
                        turnPrompt: comparing.turnPrompt,
                        onKeep: keepCompared,
                        onCancel: () => setComparing(null),
                      }
                    : null
                }
              />
            </div>
          )}

          {/* Only once there is a transcript for it to sit under. On an empty
              thread the composer lives inside the centred block above. */}
          {!showEmpty && (
            <div className="composer-dock no-print relative shrink-0 px-4 pt-2">
              <div className="mx-auto w-full max-w-[var(--measure)]">{composer}</div>
            </div>
          )}
          </>
          )}
        </main>

        {artifact && <ArtifactPanel artifact={artifact} onClose={() => setArtifact(null)} />}
        {settings.section === "chat" && madeId && !artifact && (
          <MadePanel
            canvasId={madeId}
            onClose={() => setMadeId(null)}
            onEdit={() =>
              withTransition(() => {
                setCanvasId(madeId);
                settings.setSection("code");
              }, "forward")
            }
          />
        )}

        {(paletteOpen || everOpened.current.palette) && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          actions={{
            newChat,
            openSettings: openKeys,
            open: selectInSection,
            goToSection,
            setModel: settings.setModel,
            exportMarkdown: exportConversation,
            deleteConversation: removeConversation,
            hasConversation: Boolean(activeId),
            focus,
            ask: askFocused,
            compareWith,
            setCompareWith,
            canUseModel: modelUsable,
            styleId: threadStyleId,
            styles: [
              /* First, and not one of them: it is the choice not to choose,
                 the same shape as Auto on the model. */
              { id: AUTO_STYLE, name: "Auto" },
              ...allStyles(customStyles).map((st) => ({ id: st.id, name: st.name })),
            ],
            setStyle,
          }}
        />
        )}

        <UndoBar />

        <ShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

        {(settingsOpen || everOpened.current.settings) && (
          <Settings
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            configured={configured}
            initialTab={settingsTab}
          />
        )}
      </div>
      </div>
      </ArtifactProvider>
    </TooltipProvider>
  );
}

