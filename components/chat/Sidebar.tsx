"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  MessageSquarePlus, PanelLeft, Pin, PinOff, Search, Settings2, Trash2, X,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { db, deleteConversation, groupConversations } from "@/lib/db";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ConfirmInline, IconButton, Kbd, Tooltip } from "@/components/ui/primitives";

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  onOpenSettings,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
}) {
  const { sidebarOpen, toggleSidebar } = useSettings();
  const [query, setQuery] = React.useState("");
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Conversation[],
  );

  /** Search reads message bodies too — titles alone miss most of what you remember. */
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
    return list.filter(
      (c) => c.title.toLowerCase().includes(q) || matchedIds?.has(c.id),
    );
  }, [conversations, query, matchedIds]);

  const pinned = filtered.filter((c) => c.pinned);
  const groups = groupConversations(filtered.filter((c) => !c.pinned));

  const row = (c: Conversation) => (
    <ConversationRow
      key={c.id}
      conversation={c}
      active={c.id === activeId}
      confirming={confirming === c.id}
      onSelect={() => onSelect(c.id)}
      onConfirmDelete={() => setConfirming(c.id)}
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
      {/* Below md the sidebar is a drawer over the conversation, because a
          260px column on a 390px screen leaves nothing to read. */}
      {sidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 z-30 bg-[var(--bg-overlay)] anim-fade md:hidden"
          aria-hidden
        />
      )}
      <aside
      className={cn(
        "z-40 flex shrink-0 flex-col overflow-hidden border-r border-line bg-subtle",
        "fixed inset-y-0 left-0 w-[var(--sidebar-w)] transition-transform duration-[var(--dur-layout)] ease-[var(--ease-out)]",
        "md:relative md:z-auto md:transition-[width]",
        sidebarOpen ? "translate-x-0 md:w-[var(--sidebar-w)]" : "-translate-x-full md:w-0 md:translate-x-0 md:border-r-0",
      )}
      aria-hidden={!sidebarOpen}
    >
      <div className="flex w-[var(--sidebar-w)] flex-1 flex-col">
        <div className="flex h-[var(--topbar-h)] items-center gap-1 px-2">
          <IconButton label="Hide sidebar" keys={["mod", "\\"]} onClick={toggleSidebar}>
            <PanelLeft size={16} />
          </IconButton>
          <span className="ml-1 text-sm font-medium tracking-[-0.01em] text-primary">Clouds</span>
        </div>

        <div className="space-y-1 px-2 pb-2">
          <button
            onClick={onNew}
            className="group flex h-9 w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
          >
            <MessageSquarePlus size={15} className="text-tertiary transition-colors duration-[var(--dur-fast)] group-hover:text-accent" />
            New chat
            <span className="ml-auto opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100">
              <Kbd keys={["mod", "N"]} />
            </span>
          </button>

          <div className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 transition-colors duration-[var(--dur-fast)] focus-within:border-line-strong focus-within:bg-canvas">
            <Search size={13} className="shrink-0 text-tertiary" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search"
              aria-label="Search conversations"
              className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-tertiary hover:text-primary">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-tertiary">
              {query ? (
                <>
                  Nothing matches <span className="text-secondary">{query}</span>.
                </>
              ) : (
                "No conversations yet."
              )}
            </p>
          )}

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
        </nav>

        <div className="border-t border-line p-2">
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-canvas hover:text-primary"
          >
            <Settings2 size={15} />
            Settings
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 bg-subtle px-2 pb-1 pt-2 text-xs font-medium text-tertiary">
      {children}
    </h2>
  );
}

function ConversationRow({
  conversation: c,
  active,
  confirming,
  onSelect,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  confirming: boolean;
  onSelect: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const title = c.title || "New chat";

  return (
    <div
      className={cn(
        "group relative flex h-8 items-center rounded-md pl-2 pr-1 transition-colors duration-[var(--dur-fast)]",
        active ? "bg-accent-subtle" : "hover:bg-canvas",
      )}
    >
      {/* A 2px bar, not a heavy fill: the active row should be findable at a
          glance without dominating the list. */}
      {active && <span aria-hidden className="absolute left-0 top-1.5 h-5 w-0.5 rounded-full bg-accent" />}

      {confirming ? (
        <ConfirmInline question="Delete?" onConfirm={onDelete} onCancel={onCancelDelete} />
      ) : (
        <>
          <button
            onClick={onSelect}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-sm",
              active ? "text-primary" : "text-secondary group-hover:text-primary",
            )}
            title={title}
          >
            {title}
          </button>
          {/* Row actions appear on hover only. A delete icon on every row at
              rest is noise and an accident waiting to happen. */}
          <span className="flex shrink-0 items-center opacity-0 transition-opacity duration-[var(--dur-fast)] focus-within:opacity-100 group-hover:opacity-100">
            <Tooltip label={c.pinned ? "Unpin" : "Pin"}>
              <button
                onClick={() => db.conversations.update(c.id, { pinned: !c.pinned })}
                aria-label={c.pinned ? "Unpin conversation" : "Pin conversation"}
                className="flex size-6 items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-primary"
              >
                {c.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                onClick={onConfirmDelete}
                aria-label="Delete conversation"
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
