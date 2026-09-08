"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PanelLeft } from "lucide-react";
import type { ContentBlock, Message } from "@/lib/types";
import {
  createConversation, createDeck, createNote, createPaper, db, deepestLeaf,
  deleteConversation, exportMarkdown, pathTo, addMessage, blockText,
} from "@/lib/db";
import { estimateTokens, getModel } from "@/lib/models";
import { cheapestAvailable, complete, generateCards } from "@/lib/generate";
import { newCard } from "@/lib/study";
import { useSettings, useDrafts, type Section } from "@/lib/store";
import { useStream } from "@/lib/hooks/useStream";
import { Sidebar } from "@/components/Sidebar";
import { NotesView, saveToNote } from "@/components/NotesView";
import { CardsView } from "@/components/CardsView";
import { PapersView } from "@/components/PapersView";
import { PracticeView } from "@/components/PracticeView";
import { ShortcutsOverlay } from "@/components/ShortcutsOverlay";
import { InlineError } from "@/components/chat/Message";
import { TopBar } from "@/components/chat/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import dynamic from "next/dynamic";
import { IconButton, TooltipProvider } from "@/components/ui/primitives";
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

export default function Page() {
  const settings = useSettings();
  const drafts = useDrafts();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [configured, setConfigured] = React.useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<"keys" | "appearance" | "model" | "data" | "shortcuts">("keys");
  const [scrolled, setScrolled] = React.useState(false);
  const [artifact, setArtifact] = React.useState<Artifact | null>(null);
  /** Where j/k currently sit in the transcript. */
  const cursorRef = React.useRef(0);
  const [compareWith, setCompareWith] = React.useState<string[]>([]);
  const [noteId, setNoteId] = React.useState<string | null>(null);
  const [deckId, setDeckId] = React.useState<string | null>(null);
  const [paperId, setPaperId] = React.useState<string | null>(null);
  const [skillId, setSkillId] = React.useState<string | null>(null);
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

  React.useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    if (settings.density === "comfortable") delete root.dataset.density;
    else root.dataset.density = settings.density;
  }, [settings.theme, settings.density]);

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

  /* --- Titles are generated quietly, on the cheapest model with a key, and
         never block anything the user is doing. -------------------------- */
  const generateTitle = React.useCallback(
    async (conversationId: string, firstUserText: string) => {
      const title = await complete(
        `Give this conversation a title of at most six words. Reply with the title alone — no quotes, no punctuation at the end.\n\n${firstUserText.slice(0, 800)}`,
        { modelId: cheapestAvailable(configured), maxTokens: 64, temperature: 0.3 },
      );
      // A missing title is a cosmetic loss and must never surface as an error.
      const clean = title?.trim().replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60);
      if (clean) await db.conversations.update(conversationId, { title: clean });
    },
    [configured],
  );

  const stream = useStream();

  /* --- Sending ---------------------------------------------------------- */

  const runTurn = React.useCallback(
    async (conversationId: string, parentId: string | null, history: Message[], modelId: string) => {
      await stream.send({
        conversationId,
        parentId,
        modelId,
        history,
        systemPrompt: settings.systemPrompt || undefined,
      });
    },
    [stream, settings.systemPrompt],
  );

  const send = React.useCallback(
    async (content: ContentBlock[]) => {
      let convId = activeId;
      let leaf: string | null = conversation?.leafId ?? null;

      // Conversations are created on first send, not on "New chat", so the
      // sidebar never fills with empty rows the user did not mean to make.
      if (!convId) {
        const created = await createConversation(settings.modelId);
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

      if (compareWith.length) {
        setComparing({
          parentId: userMessage.id,
          history,
          modelIds: [settings.modelId, ...compareWith],
        });
      } else {
        void runTurn(convId, userMessage.id, history, settings.modelId);
      }

      if (isFirst) void generateTitle(convId, blockText(content));
    },
    [activeId, conversation?.leafId, path, settings.modelId, runTurn, generateTitle, compareWith],
  );

  /** Regenerating reuses the parent, so the new answer is a sibling of the old. */
  const regenerate = React.useCallback(
    async (message: Message, modelId?: string) => {
      if (!activeId) return;
      const parentId = message.parentId;
      const history = pathTo(allMessages ?? [], parentId);
      await db.conversations.update(activeId, { leafId: parentId });
      void runTurn(activeId, parentId, history, modelId ?? settings.modelId);
    },
    [activeId, allMessages, runTurn, settings.modelId],
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
      void runTurn(activeId, edited.id, history, settings.modelId);
    },
    [activeId, allMessages, runTurn, settings.modelId],
  );

  const keepCompared = React.useCallback(
    async (messageId: string, modelId: string) => {
      if (!activeId) return;
      await db.conversations.update(activeId, { leafId: messageId });
      settings.setModel(modelId);
      setComparing(null);
      setCompareWith([]);
    },
    [activeId, settings],
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
    stream.stop();
    setActiveId(null);
    closeDrawerOnMobile();
  }, [stream, closeDrawerOnMobile]);

  const goToSection = React.useCallback(
    (target: Section) => {
      settings.setSection(target);
      if (target === "notes") setNoteId(null);
      if (target === "cards") setDeckId(null);
      if (target === "papers") setPaperId(null);
      if (target === "practice") setSkillId(null);
    },
    [settings],
  );

  const createInSection = React.useCallback(
    async (section: Section) => {
      closeDrawerOnMobile();
      if (section === "chat") return newChat();
      if (section === "notes") return setNoteId((await createNote()).id);
      if (section === "cards") return setDeckId((await createDeck("New deck")).id);
      // Practice has no blank state worth creating: a skill without traps
      // cannot be practised, so New goes through the seed sheet instead.
      if (section === "practice") return setSkillId(null);
      setPaperId((await createPaper()).id);
    },
    [closeDrawerOnMobile, newChat],
  );

  const selectInSection = React.useCallback(
    (section: Section, id: string) => {
      closeDrawerOnMobile();
      if (section === "chat") {
        stream.stop();
        setActiveId(id);
        settings.setSection("chat");
      } else if (section === "notes") setNoteId(id);
      else if (section === "cards") setDeckId(id);
      else if (section === "practice") setSkillId(id);
      else setPaperId(id);
    },
    [closeDrawerOnMobile, stream, settings],
  );

  const [studyBusy, setStudyBusy] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  /** A whole conversation is often the study material, not one answer in it. */
  const conversationToCards = React.useCallback(async () => {
    if (!path.length) return;
    setStudyBusy(true);
    setNotice(null);
    const source = path
      .map((m) => `${m.role === "user" ? "Q" : "A"}: ${blockText(m.content)}`)
      .join("\n\n");
    const drafts = await generateCards(source, { modelId: cheapestAvailable(configured), count: 12 });
    setStudyBusy(false);
    if (!drafts?.length) {
      setNotice(
        "Couldn't turn this conversation into cards. Check the API key for the model, or try again once there's more in the thread.",
      );
      return;
    }
    const deck = await createDeck(conversation?.title || "From a conversation", {
      sourceConversationId: activeId ?? undefined,
    });
    await db.cards.bulkAdd(drafts.map((c) => newCard(deck.id, c.front, c.back)));
    setDeckId(deck.id);
    settings.setSection("cards");
  }, [path, configured, conversation?.title, activeId, settings]);

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
    settings.setSection("notes");
  }, [path, conversation?.title, activeId, settings]);

  /** Lift an answer out of the conversation and into something you keep. */
  const keepAsNote = React.useCallback(
    async (text: string) => {
      const note = await saveToNote(text, activeId ?? undefined);
      setNoteId(note.id);
      settings.setSection("notes");
    },
    [activeId, settings],
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
    await deleteConversation(activeId);
    setActiveId(null);
  }, [activeId]);

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
        if (settings.section === "notes" && noteId) setNoteId(null);
        else if (settings.section === "cards" && deckId) setDeckId(null);
        else if (settings.section === "papers" && paperId) setPaperId(null);
        else if (settings.section === "practice" && skillId) setSkillId(null);
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
        case "5": {
          e.preventDefault();
          const sections = ["chat", "notes", "cards", "papers", "practice"] as const;
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
  }, [createInSection, goToSection, path, settings, stream, noteId, deckId, paperId, skillId]);

  const openKeys = React.useCallback(() => {
    setSettingsTab("keys");
    setSettingsOpen(true);
  }, []);

  const showEmpty = path.length === 0 && stream.phase === "idle" && !comparing;

  const artifactValue = React.useMemo(
    () => ({ open: setArtifact, current: artifact }),
    [artifact],
  );

  return (
    <TooltipProvider>
      <ArtifactProvider value={artifactValue}>
      <div className="app-shell flex h-dvh overflow-hidden bg-canvas">
        <Sidebar
          activeChatId={activeId}
          onSelectChat={(id) => selectInSection("chat", id)}
          onNewChat={() => void createInSection("chat")}
          onGoToSection={goToSection}
          onOpenSettings={openKeys}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {settings.section !== "chat" ? (
            <>
              <header className="no-print flex h-[var(--topbar-h)] shrink-0 items-center gap-1 border-b border-transparent px-2">
                {!settings.sidebarOpen && (
                  <IconButton label="Show sidebar" keys={["mod", "\\"]} onClick={settings.toggleSidebar}>
                    <PanelLeft size={16} />
                  </IconButton>
                )}

              </header>
              {settings.section === "notes" && (
                <NotesView
                  noteId={noteId}
                  configured={configured}
                  onSelect={setNoteId}
                  onNew={() => void createInSection("notes")}
                  onBack={() => setNoteId(null)}
                  onOpenDeck={(id) => {
                    setDeckId(id);
                    settings.setSection("cards");
                  }}
                  onOpenPaper={(id) => {
                    setPaperId(id);
                    settings.setSection("papers");
                  }}
                />
              )}
              {settings.section === "cards" && (
                <CardsView
                  deckId={deckId}
                  onSelect={setDeckId}
                  onNew={() => void createInSection("cards")}
                  onBack={() => setDeckId(null)}
                />
              )}
              {settings.section === "practice" && (
                <PracticeView
                  skillId={skillId}
                  configured={configured}
                  onSelect={setSkillId}
                  onBack={() => setSkillId(null)}
                />
              )}
              {settings.section === "papers" && (
                <PapersView
                  paperId={paperId}
                  configured={configured}
                  onSelect={setPaperId}
                  onNew={() => void createInSection("papers")}
                  onBack={() => setPaperId(null)}
                />
              )}
            </>
          ) : (
          <>
          <TopBar
            conversation={conversation ?? null}
            scrolled={scrolled}
            configured={configured}
            modelPickerOpen={modelPickerOpen}
            onModelPickerOpenChange={setModelPickerOpen}
            onRename={(title) => activeId && db.conversations.update(activeId, { title })}
            onExport={exportConversation}
            onDelete={removeConversation}
            onTogglePin={() =>
              activeId && conversation && db.conversations.update(activeId, { pinned: !conversation.pinned })
            }
            onSaveAsNote={conversationToNote}
            onMakeCards={conversationToCards}
            busy={studyBusy}
          />

          {showEmpty ? (
            <EmptyState
              hasAnyKey={hasAnyKey}
              isFirstEver={(conversationCount ?? 0) === 0}
              onExample={(text) => drafts.setDraft(activeId ?? "new", text)}
              onAddKey={openKeys}
            />
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
                streaming={stream.phase}
                streamText={stream.text}
                streamReasoning={stream.reasoning}
                streamModelId={settings.modelId}
                elapsed={stream.elapsed}
                error={stream.error}
                onNavigate={navigate}
                onEdit={editMessage}
                onRegenerate={(m, modelId) => regenerate(m, modelId)}
                onSaveToNote={keepAsNote}
                onRetry={() => {
                  const last = [...path].reverse().find((m) => m.role === "assistant");
                  if (last) regenerate(last);
                  else if (path.length) runTurn(activeId!, path[path.length - 1].id, path, settings.modelId);
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

          <div className="no-print relative shrink-0 bg-canvas px-4 pb-3">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-[var(--bg-canvas)]"
            />
            <div className="mx-auto w-full max-w-[var(--measure)]">
              {mounted && (
                <Composer
                  conversationId={activeId ?? "new"}
                  streaming={stream.phase !== "idle"}
                  contextTokens={contextTokens}
                  onSend={send}
                  onStop={stream.stop}
                  onEditLast={editLast}
                  onOpenModels={() => setModelPickerOpen(true)}
                  compareWith={compareWith}
                  onCompareChange={setCompareWith}
                  availableModels={modelUsable}
                />
              )}
            </div>
          </div>
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
            selectConversation: setActiveId,
            setModel: settings.setModel,
            exportMarkdown: exportConversation,
            deleteConversation: removeConversation,
          }}
        />
        )}

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

