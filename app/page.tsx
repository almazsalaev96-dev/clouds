"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ContentBlock, Message } from "@/lib/types";
import {
  createConversation, db, deepestLeaf, deleteConversation, exportMarkdown,
  pathTo, addMessage, blockText,
} from "@/lib/db";
import { estimateTokens, getModel } from "@/lib/models";
import { useSettings, useDrafts, paramsFor } from "@/lib/store";
import { useStream } from "@/lib/hooks/useStream";
import { Sidebar } from "@/components/chat/Sidebar";
import { TopBar } from "@/components/chat/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/primitives";

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

  const contextTokens = React.useMemo(
    () => path.reduce((n, m) => n + estimateTokens(blockText(m.content)), 0),
    [path],
  );

  const hasAnyKey =
    Object.values(configured).some(Boolean) || Object.values(settings.keys).some(Boolean);

  const conversationCount = useLiveQuery(() => db.conversations.count(), [], 0);

  /* --- Titles are generated quietly, on the cheapest model with a key, and
         never block anything the user is doing. -------------------------- */
  const generateTitle = React.useCallback(
    async (conversationId: string, firstUserText: string) => {
      const candidates = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"];
      const pick =
        candidates.find((id) => {
          const p = getModel(id).provider;
          return configured[p] || settings.keys[p];
        }) ?? settings.modelId;

      const provider = getModel(pick).provider;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            modelId: pick,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Give this conversation a title of at most six words. Reply with the title alone — no quotes, no punctuation at the end.\n\n${firstUserText.slice(0, 800)}`,
                  },
                ],
              },
            ],
            params: { ...paramsFor(pick), maxTokens: 1024, temperature: 0.3 },
            clientKey: settings.keys[provider] || undefined,
          }),
        });
        if (!res.body) return;

        let title = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            if (!chunk.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(chunk.slice(6));
              if (ev.type === "text") title += ev.text;
            } catch { /* partial frame */ }
          }
        }

        const clean = title.trim().replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60);
        if (clean) await db.conversations.update(conversationId, { title: clean });
      } catch {
        /* A missing title is a cosmetic loss; it must never surface as an error. */
      }
    },
    [configured, settings.keys, settings.modelId],
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
      void runTurn(convId, userMessage.id, history, settings.modelId);

      if (isFirst) void generateTitle(convId, blockText(content));
    },
    [activeId, conversation?.leafId, path, settings.modelId, runTurn, generateTitle],
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
    // Scroll the message into view and let its own edit affordance take over.
    document.getElementById(`m-${lastUser.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    drafts.setDraft(activeId ?? "new", blockText(lastUser.content));
  }, [path, drafts, activeId]);

  /* --- Shortcuts. Everything here is also in the palette. ---------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        if (e.key === "Escape" && stream.phase !== "idle") {
          stream.stop();
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "k":
          e.preventDefault();
          setPaletteOpen((o) => !o);
          break;
        case "n":
          e.preventDefault();
          newChat();
          break;
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
  }, [newChat, path, settings, stream]);

  const openKeys = React.useCallback(() => {
    setSettingsTab("keys");
    setSettingsOpen(true);
  }, []);

  const showEmpty = path.length === 0 && stream.phase === "idle";

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <Sidebar
          activeId={activeId}
          onSelect={(id) => {
            stream.stop();
            setActiveId(id);
            closeDrawerOnMobile();
          }}
          onNew={newChat}
          onOpenSettings={openKeys}
        />

        <main className="flex min-w-0 flex-1 flex-col">
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
                onRegenerate={(m) => regenerate(m)}
                onRetry={() => {
                  const last = [...path].reverse().find((m) => m.role === "assistant");
                  if (last) regenerate(last);
                  else if (path.length) runTurn(activeId!, path[path.length - 1].id, path, settings.modelId);
                }}
                onAddKey={openKeys}
                onSwitchModel={() => setModelPickerOpen(true)}
                onDismissError={stream.clearError}
              />
            </div>
          )}

          <div className="relative shrink-0 bg-canvas px-4 pb-3">
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
                />
              )}
            </div>
          </div>
        </main>

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

        {settingsOpen && (
          <Settings
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            configured={configured}
            initialTab={settingsTab}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

