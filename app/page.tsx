"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PanelLeft } from "lucide-react";
import type { ContentBlock, Message } from "@/lib/types";
import {
  createConversation, createNote, db, deepestLeaf, deleteConversation,
  exportMarkdown, pathTo, addMessage, blockText, createCanvas, createWebCanvas, createProject,
  filesOf,
} from "@/lib/db";
import { composeSystemPrompt } from "@/lib/prompt";
import { findStyle } from "@/lib/styles";
import { findMode } from "@/lib/modes";
import { AUTO, CALCULATOR, DEFAULT_MODEL_ID, estimateTokens, getModel } from "@/lib/models";
import { fitToContext } from "@/lib/context";
import { cheapestAvailable, complete } from "@/lib/complete";
import { useSettings, useDrafts, paramsFor, type Section } from "@/lib/store";
import { useStream } from "@/lib/hooks/useStream";
import { cn, inOverlay } from "@/lib/utils";
import { offerUndo } from "@/lib/undo";
import { Sidebar } from "@/components/Sidebar";
import { CanvasView } from "@/components/CanvasView";
import { saveToNote } from "@/lib/db";
import { InlineError } from "@/components/chat/Message";
import { TopBar } from "@/components/chat/TopBar";
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
  { ssr: false },
);
/* A list of keyboard shortcuts, shown when you press `?`. Nobody's first act
   is to read the manual, and it was in the bundle drawn before the first
   screen. */
const ShortcutsOverlay = dynamic(
  () => import("@/components/ShortcutsOverlay").then((m) => m.ShortcutsOverlay),
  { ssr: false },
);
const ProjectsView = dynamic(
  () => import("@/components/ProjectsView").then((m) => m.ProjectsView),
  { ssr: false },
);

/** What "Continue" sends. Phrased so the model picks up mid-sentence. */
const CONTINUE_PROMPT =
  "Continue exactly where you left off, from the last character you wrote. Do not repeat anything, and do not summarise what came before.";

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
    if (!id) {
      restored.current = true;
      return;
    }
    let cancelled = false;
    void db.conversations.get(id).then((c) => {
      if (cancelled) return;
      restored.current = true;
      if (c && !c.archived) setActiveId(id);
      else useSettings.getState().setLastConversation(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (restored.current) useSettings.getState().setLastConversation(activeId);
  }, [activeId]);
  const [configured, setConfigured] = React.useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<"keys" | "appearance" | "model" | "styles" | "data" | "shortcuts">("keys");
  const [scrolled, setScrolled] = React.useState(false);
  const [artifact, setArtifact] = React.useState<Artifact | null>(null);
  /** Where j/k currently sit in the transcript. */
  const cursorRef = React.useRef(0);
  const [compareWith, setCompareWith] = React.useState<string[]>([]);
  const [canvasId, setCanvasId] = React.useState<string | null>(null);
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
    parentId: string;
    history: Message[];
    modelIds: string[];
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
      .then((d) => setConfigured(d.configured ?? {}))
      .catch(() => setConfigured({}));
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
      const p = getModel(id).provider;
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
      const title = await complete(
        `Give this conversation a title of at most six words. Reply with the title alone — no quotes, no punctuation at the end.\n\n${firstUserText.slice(0, 800)}`,
        { modelId, maxTokens: 64, temperature: 0.3 },
      );
      // A missing title is a cosmetic loss and must never surface as an error.
      const clean = title?.trim().replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60);
      if (clean) await db.conversations.update(conversationId, { title: clean });
    },
    [configured],
  );

  const stream = useStream();

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
      modelId: string,
      /** Set only when the app chose the model rather than the person. */
      routedWhy?: string,
    ) => {
      const conv = await db.conversations.get(conversationId);
      /* Read the layers at send time rather than holding them in state. A
         project's instructions can be edited in another tab, and a turn should
         go out with what the project says now, not what it said when this
         screen mounted. */
      const project = conv?.projectId ? await db.projects.get(conv.projectId) : undefined;
      const files = project ? await filesOf(project.id) : [];
      const style = findStyle(conv?.styleId ?? settings.styleId, customStyles);
      const mode = findMode(conv?.mode ?? settings.mode);
      const composed = composeSystemPrompt({
        base: conv?.systemPrompt ?? settings.systemPrompt,
        project,
        files,
        style,
        mode,
      });
      await stream.send({
        conversationId,
        parentId,
        modelId,
        routedWhy,
        history,
        systemPrompt: composed.text || undefined,
        params: mode.params,
      });
    },
    [stream, settings.systemPrompt, settings.styleId, settings.mode, customStyles],
  );

  /** Same rule as the model: the open thread owns it, the app holds the default. */
  const setStyle = React.useCallback(
    (id: string) => {
      settings.setStyle(id);
      if (activeId) void db.conversations.update(activeId, { styleId: id });
    },
    [settings, activeId],
  );

  /** Same rule again: the open thread owns it, the app holds the default. */
  const setMode = React.useCallback(
    (id: string) => {
      settings.setMode(id);
      if (activeId) void db.conversations.update(activeId, { mode: id });
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

      // Conversations are created on first send, not on "New chat", so the
      // sidebar never fills with empty rows the user did not mean to make.
      if (!convId) {
        // The style comes along, so the first answer is already in the style
        // the picker is showing rather than one turn behind it.
        const created = await createConversation({
          modelId: settings.modelId,
          styleId: settings.styleId,
          mode: settings.mode,
        });
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
      const { route } = threadModelId === AUTO ? await import("@/lib/route") : { route: null };
      const decision =
        threadModelId === AUTO && route
          ? route(asked, {
              configured,
              keys: settings.keys,
              effort: "auto",
              hasImage: content.some((b) => b.type === "image"),
              extra: path.map((m) => blockText(m.content)).join("\n").slice(-40_000),
              current: settings.modelId === AUTO ? DEFAULT_MODEL_ID : settings.modelId,
            })
          : null;

      /* A sum is answered here, exactly, for nothing. A model would predict
         what the answer looks like, which is usually the answer and is not the
         same thing — and you cannot tell the two apart by looking. */
      if (decision?.sum) {
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

      const answering = decision?.modelId ?? threadModelId;

      if (compareWith.length) {
        setComparing({
          parentId: userMessage.id,
          history,
          modelIds: [answering, ...compareWith],
        });
      } else {
        void runTurn(convId, userMessage.id, history, answering, decision?.why);
      }

      if (isFirst) void generateTitle(convId, blockText(content));
    },
    [activeId, conversation?.leafId, path, threadModelId, runTurn, generateTitle, compareWith, configured, settings.keys, settings.modelId],
  );

  /* What ⌘K is looking at, and what saying something would do to it. */
  const [handed, setHanded] = React.useState<{ text: string; nonce: number } | undefined>();

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
      setHanded({ text, nonce: Date.now() });
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
    async (message: Message) => {
      if (verifyingId) return;
      const asked = pathTo(allMessages ?? [], message.parentId)
        .filter((m) => m.role === "user")
        .slice(-1)[0];
      if (!asked) return;

      const { checker } = await import("@/lib/route");
      const who = checker(message.modelId ?? settings.modelId, { configured, keys: settings.keys });
      if (!who) {
        setNotice(
          "A second opinion has to come from a different provider, and only one is configured. Add another key in Settings.",
        );
        return;
      }

      setVerifyingId(message.id);
      try {
        const { verifyAnswer } = await import("@/lib/verify");
        const verdict = await verifyAnswer(blockText(asked.content), blockText(message.content), who);
        if (verdict) await db.messages.update(message.id, { verdict });
        else setNotice("The check didn't come back. Try again.");
      } catch {
        setNotice("That check failed. Check the key and the connection.");
      } finally {
        setVerifyingId(null);
      }
    },
    [verifyingId, allMessages, configured, settings.keys, settings.modelId],
  );

  /** Regenerating reuses the parent, so the new answer is a sibling of the old. */
  const regenerate = React.useCallback(
    async (message: Message, modelId?: string) => {
      if (!activeId) return;
      const parentId = message.parentId;
      const history = pathTo(allMessages ?? [], parentId);
      // The leaf stays where it is: the old answer remains on screen and the
      // new one streams beneath it, so a worse regeneration costs nothing and
      // an aborted one costs nothing at all.
      void runTurn(activeId, parentId, history, modelId ?? message.modelId ?? threadModelId);
    },
    [activeId, allMessages, runTurn, threadModelId],
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
  const newChatInProject = React.useCallback(
    async (pid: string) => {
      const conv = await createConversation({
        modelId: settings.modelId,
        projectId: pid,
        styleId: settings.styleId,
        mode: settings.mode,
      });
      setActiveId(conv.id);
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
        else setNoteId(id);
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

  /** Is the one live stream the one this screen is showing? */
  const live = stream.conversationId !== null && stream.conversationId === activeId;
  /* How much of this thread will not fit the window it is going into.
     Derived from the thread rather than remembered from the last request: it
     is a fact about the conversation as it now stands, so it stays true after
     the answer lands, and it updates the moment you switch to a model with a
     different window. */
  const droppedFromContext = React.useMemo(
    () => fitToContext(path, getModel(threadModelId), paramsFor(threadModelId), threadPrompt).dropped,
    [path, threadModelId, threadPrompt],
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
      onOpenModels={() => setModelPickerOpen(true)}
      compareWith={compareWith}
      onCompareChange={setCompareWith}
      availableModels={modelUsable}
      configured={configured}
      modelPickerOpen={modelPickerOpen}
      onModelPickerOpenChange={setModelPickerOpen}
      onModelChange={setModel}
      mode={threadMode}
      onModeChange={setMode}
      styleId={threadStyleId}
      customStyles={customStyles}
      onStyleChange={setStyle}
      onEditStyles={() => {
        setSettingsTab("styles");
        setSettingsOpen(true);
      }}
    />
  ) : null;

  const artifactValue = React.useMemo(
    () => ({ open: setArtifact, current: artifact }),
    [artifact],
  );

  return (
    <TooltipProvider>
      <ArtifactProvider value={artifactValue}>
      <div className="app-shell flex h-dvh overflow-hidden">
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
              <header
                className={cn(
                  "no-print h-[var(--topbar-h)] shrink-0 items-center gap-1 border-b border-transparent px-2",
                  inUse ? "hidden" : "flex",
                )}
              >
                {!settings.sidebarOpen && (
                  <IconButton label="Show sidebar" keys={["mod", "\\"]} onClick={settings.toggleSidebar}>
                    <PanelLeft size={16} />
                  </IconButton>
                )}

              </header>
              {settings.section === "projects" && (
                <ProjectsView
                  projectId={projectId}
                  onSelect={(id) => withTransition(() => setProjectId(id), "forward")}
                  onNew={() => void createInSection("projects")}
                  onBack={() => withTransition(() => setProjectId(null), "back")}
                  onOpenChat={(id) => selectInSection("chat", id)}
                  onNewChatHere={(pid) => void newChatInProject(pid)}
                  onOpenCanvas={(id) => selectInSection("code", id)}
                  onNewCanvasHere={(pid) => void newCanvasInProject(pid)}
                  configured={configured}
                />
              )}
              {settings.section === "code" && (
                <CanvasView
                  canvasId={canvasId}
                  configured={configured}
                  seed={canvasSeed}
                  ask={settings.section === "code" ? handed : undefined}
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
              {settings.section === "notebook" && (
                <NotebookView
                  noteId={noteId}
                  configured={configured}
                  ask={settings.section === "notebook" ? handed : undefined}
                  onSelect={(id) => withTransition(() => setNoteId(id), "forward")}
                  onNew={() => void createInSection("notebook")}
                  onBack={() => withTransition(() => setNoteId(null), "back")}
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
            onMoveToProject={(pid) => {
              if (activeId) void db.conversations.update(activeId, { projectId: pid ?? undefined });
            }}
            onOpenProject={(pid) => selectInSection("projects", pid)}
            onSaveAsNote={conversationToNote}
          />

          {showEmpty ? (
            <EmptyState
              hasAnyKey={hasAnyKey}
              onExample={(text) => useDrafts.getState().setDraft(activeId ?? "new", text)}
              onMake={openMade}
              onAddKey={openKeys}
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
                dropped={droppedFromContext}
                streamModelId={threadModelId}
                elapsed={live ? stream.elapsed : 0}
                error={live ? stream.error : null}
                onNavigate={navigate}
                onEdit={editMessage}
                onRegenerate={regenerate}
                onSaveToNote={keepAsNote}
                onContinue={() => void send([{ type: "text", text: CONTINUE_PROMPT }])}
                onVerify={verify}
                verifyingId={verifyingId}
                onOpenInCanvas={keepAsCanvas}
                onRetry={() => {
                  const last = [...path].reverse().find((m) => m.role === "assistant");
                  if (last) regenerate(last);
                  else if (path.length) runTurn(activeId!, path[path.length - 1].id, path, threadModelId);
                }}
                onAddKey={openKeys}
                onSwitchModel={() => setModelPickerOpen(true)}
                onDismissError={stream.clearError}
                compare={
                  comparing && activeId
                    ? {
                        conversationId: activeId,
                        parentId: comparing.parentId,
                        history: comparing.history,
                        modelIds: comparing.modelIds,
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

        {paletteOpen && (
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
          }}
        />
        )}

        <UndoBar />

        <ShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

        {settingsOpen && (
          <Settings
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            configured={configured}
            initialTab={settingsTab}
          />
        )}
      </div>
      </ArtifactProvider>
    </TooltipProvider>
  );
}

