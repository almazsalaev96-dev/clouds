"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FileText, Keyboard, Layers, PanelLeft, Pin, PinOff, Plus, Printer, Search,
  Settings2, Trash2, X,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { db, deleteConversation, groupConversations } from "@/lib/db";
import { dueCount } from "@/lib/study";
import { useSettings, type Section } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ConfirmInline, IconButton, Kbd, Tooltip } from "@/components/ui/primitives";

const SECTIONS: { id: Exclude<Section, "chat">; label: string; icon: React.ReactNode }[] = [
  { id: "notes", label: "Notes", icon: <FileText size={15} /> },
  { id: "cards", label: "Cards", icon: <Layers size={15} /> },
  { id: "papers", label: "Papers", icon: <Printer size={15} /> },
];

export function Sidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  onGoToSection,
  onOpenSettings,
  onOpenShortcuts,
}: {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onGoToSection: (section: Section) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}) {
  const { sidebarOpen, toggleSidebar, section } = useSettings();
  const [query, setQuery] = React.useState("");
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const due = dueCount(cards ?? []);

  return (
    <>
      {sidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="no-print fixed inset-0 z-30 bg-[var(--bg-overlay)] anim-fade md:hidden"
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "no-print z-40 flex shrink-0 flex-col overflow-hidden border-r border-line bg-subtle",
          "fixed inset-y-0 left-0 w-[var(--sidebar-w)] transition-transform duration-[var(--dur-layout)] ease-[var(--ease-out)]",
          "md:relative md:z-auto md:transition-[width]",
          sidebarOpen
            ? "translate-x-0 md:w-[var(--sidebar-w)]"
            : "-translate-x-full md:w-0 md:translate-x-0 md:border-r-0",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex w-[var(--sidebar-w)] flex-1 flex-col">
          <div className="flex h-[var(--topbar-h)] items-center gap-1 px-2">
            <IconButton label="Hide sidebar" keys={["mod", "\\"]} onClick={toggleSidebar}>
              <PanelLeft size={16} />
            </IconButton>
            <span className="ml-1 flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-[13px] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent))",
                  WebkitMask: "radial-gradient(closest-side, transparent 52%, #000 54%)",
                  mask: "radial-gradient(closest-side, transparent 52%, #000 54%)",
                }}
              />
              <span className="text-sm font-semibold tracking-[-0.01em] text-primary">Astra</span>
            </span>
          </div>

          <div className="space-y-1 px-2 pb-2">
            <button
              onClick={onNewChat}
              className="group flex h-9 w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
            >
              <Plus size={15} className="text-tertiary transition-colors duration-[var(--dur-fast)] group-hover:text-accent" />
              New chat
              <span className="ml-auto opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100">
                <Kbd keys={["mod", "N"]} />
              </span>
            </button>

            <div className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 transition-colors duration-[var(--dur-fast)] focus-within:border-line-strong focus-within:bg-canvas">
              <Search size={13} className="shrink-0 text-tertiary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder="Search chats"
                aria-label="Search chats"
                className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-tertiary hover:text-primary">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Destinations, above the history that fills the rest of the panel. */}
          <nav aria-label="Sections" className="space-y-0.5 px-2 pb-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onGoToSection(s.id)}
                aria-current={section === s.id}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors duration-[var(--dur-fast)]",
                  section === s.id
                    ? "bg-accent-subtle font-medium text-primary"
                    : "text-secondary hover:bg-canvas hover:text-primary",
                )}
              >
                <span className={cn("shrink-0", section === s.id ? "text-accent" : "text-tertiary")}>
                  {s.icon}
                </span>
                {s.label}
                {s.id === "cards" && due > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-medium text-accent-fg tnum">
                    {due}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* A hairline and a label, so the destinations above and the history
              below read as two different kinds of thing. */}
          <div className="mx-2 mb-1 mt-1 border-t border-line" aria-hidden />

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <ChatList
              query={query}
              activeId={section === "chat" ? activeChatId : null}
              onSelect={(id) => onSelectChat(id)}
              onNew={onNewChat}
            />
          </div>

          <div className="flex items-center gap-1 border-t border-line p-2">
            <button
              onClick={onOpenSettings}
              className="flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-canvas hover:text-primary"
            >
              <Settings2 size={15} />
              Settings
            </button>
            <IconButton label="Keyboard shortcuts" keys={["?"]} onClick={onOpenShortcuts}>
              <Keyboard size={15} />
            </IconButton>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------- lists -- */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 bg-subtle px-2 pb-1 pt-2 text-xs font-medium text-tertiary">
      {children}
    </h2>
  );
}

function Empty({ query, noun }: { query: string; noun: string }) {
  return (
    <p className="px-2 py-6 text-center text-xs text-tertiary">
      {query ? (
        <>
          Nothing matches <span className="text-secondary">{query}</span>.
        </>
      ) : (
        `No ${noun} yet.`
      )}
    </p>
  );
}

function ChatList({
  query,
  activeId,
  onSelect,
  onNew,
}: {
  query: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Conversation[],
  );

  // Titles alone miss most of what people remember, so bodies are searched too.
  const matchedIds = useLiveQuery(async () => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const hits = new Set<string>();
    await db.messages.each((m) => {
      for (const block of m.content) {
        if (block.type === "text" && block.text.toLowerCase().includes(q)) {
          hits.add(m.conversationId);
          return;
        }
      }
    });
    return hits;
  }, [query]);

  const filtered = React.useMemo(() => {
    const list = (conversations ?? []).filter((c) => !c.archived);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q) || matchedIds?.has(c.id));
  }, [conversations, query, matchedIds]);

  if (!filtered.length) return <Empty query={query} noun="conversations" />;

  const pinned = filtered.filter((c) => c.pinned);
  const groups = groupConversations(filtered.filter((c) => !c.pinned));

  const row = (c: Conversation) => (
    <Row
      key={c.id}
      title={c.title || "New chat"}
      active={c.id === activeId}
      confirming={confirming === c.id}
      pinned={c.pinned}
      onSelect={() => onSelect(c.id)}
      onTogglePin={() => db.conversations.update(c.id, { pinned: !c.pinned })}
      onAskDelete={() => setConfirming(c.id)}
      onCancelDelete={() => setConfirming(null)}
      onDelete={async () => {
        setConfirming(null);
        await deleteConversation(c.id);
        if (c.id === activeId) onNew();
      }}
    />
  );

  return (
    <>
      {pinned.length > 0 && (
        <section className="mb-2">
          <GroupLabel>Pinned</GroupLabel>
          {pinned.map(row)}
        </section>
      )}
      {groups.map(([label, items]) => (
        <section key={label} className="mb-2">
          <GroupLabel>{label}</GroupLabel>
          {items.map(row)}
        </section>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------- row -- */

function Row({
  title,
  meta,
  badge,
  active,
  confirming,
  pinned,
  onSelect,
  onTogglePin,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  title: string;
  meta?: string;
  badge?: string;
  active: boolean;
  confirming: boolean;
  pinned?: boolean;
  onSelect: () => void;
  onTogglePin?: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-8 items-center rounded-md pl-2 pr-1 transition-colors duration-[var(--dur-fast)]",
        active ? "bg-accent-subtle" : "hover:bg-canvas",
      )}
    >
      {active && <span aria-hidden className="absolute left-0 top-1.5 h-5 w-0.5 rounded-full bg-accent" />}

      {confirming ? (
        <ConfirmInline question="Delete?" onConfirm={onDelete} onCancel={onCancelDelete} />
      ) : (
        <>
          <button
            onClick={onSelect}
            className={cn(
              "flex min-w-0 flex-1 items-baseline gap-1.5 text-left text-sm",
              active ? "text-primary" : "text-secondary group-hover:text-primary",
            )}
            title={title}
          >
            <span className="truncate">{title}</span>
            {meta && <span className="shrink-0 text-xs text-tertiary">{meta}</span>}
          </button>

          {badge && (
            <span className="mr-1 shrink-0 rounded-full bg-accent px-1.5 text-xs font-medium text-accent-fg tnum group-hover:hidden">
              {badge}
            </span>
          )}

          <span className="flex shrink-0 items-center opacity-0 transition-opacity duration-[var(--dur-fast)] focus-within:opacity-100 group-hover:opacity-100">
            {onTogglePin && (
              <Tooltip label={pinned ? "Unpin" : "Pin"}>
                <button
                  onClick={onTogglePin}
                  aria-label={pinned ? "Unpin" : "Pin"}
                  className="flex size-6 items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-primary"
                >
                  {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                </button>
              </Tooltip>
            )}
            <Tooltip label="Delete">
              <button
                onClick={onAskDelete}
                aria-label="Delete"
                className="flex size-6 items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-danger"
              >
                <Trash2 size={12} />
              </button>
            </Tooltip>
          </span>
        </>
      )}
    </div>
  );
}
