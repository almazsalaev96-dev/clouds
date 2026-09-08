"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FileText, Layers, MessageSquare, PanelLeft, Pin, PinOff, Plus, Printer,
  Search, Settings2, Trash2, X,
} from "lucide-react";
import type { Conversation, Deck, Note, Paper } from "@/lib/types";
import {
  db, deleteConversation, deleteDeck, deleteNote, deletePaper, groupConversations,
} from "@/lib/db";
import { dueCount } from "@/lib/study";
import { useSettings, type Section } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ConfirmInline, IconButton, Kbd, Tooltip } from "@/components/ui/primitives";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; keys: string[] }[] = [
  { id: "chat", label: "Chats", icon: <MessageSquare size={13} />, keys: ["mod", "1"] },
  { id: "notes", label: "Notes", icon: <FileText size={13} />, keys: ["mod", "2"] },
  { id: "cards", label: "Cards", icon: <Layers size={13} />, keys: ["mod", "3"] },
  { id: "papers", label: "Papers", icon: <Printer size={13} />, keys: ["mod", "4"] },
];

const NEW_LABEL: Record<Section, string> = {
  chat: "New chat",
  notes: "New note",
  cards: "New deck",
  papers: "New paper",
};

export function Sidebar({
  activeIds,
  onSelect,
  onNew,
  onOpenSettings,
}: {
  activeIds: Record<Section, string | null>;
  onSelect: (section: Section, id: string) => void;
  onNew: (section: Section) => void;
  onOpenSettings: () => void;
}) {
  const { sidebarOpen, toggleSidebar, section, setSection } = useSettings();
  const [query, setQuery] = React.useState("");

  // Search is per-section: carrying a chat query into the notes list would
  // silently hide everything and look like data loss.
  React.useEffect(() => setQuery(""), [section]);

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
            <span className="ml-1 text-sm font-medium tracking-[-0.01em] text-primary">Clouds</span>
          </div>

          {/* Four rooms, one rail. Icons alone would make this a memory test, so
              the labels stay. */}
          <nav aria-label="Sections" className="flex gap-0.5 px-2 pb-2">
            {SECTIONS.map((s) => (
              <Tooltip key={s.id} label={s.label} keys={s.keys}>
                <button
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id}
                  className={cn(
                    "flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-xs transition-colors duration-[var(--dur-fast)]",
                    section === s.id
                      ? "bg-canvas font-medium text-primary shadow-sm"
                      : "text-tertiary hover:text-primary",
                  )}
                >
                  <span className="shrink-0">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              </Tooltip>
            ))}
          </nav>

          <div className="space-y-1 px-2 pb-2">
            <button
              onClick={() => onNew(section)}
              className="group flex h-9 w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
            >
              <Plus size={15} className="text-tertiary transition-colors duration-[var(--dur-fast)] group-hover:text-accent" />
              {NEW_LABEL[section]}
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
                placeholder="Search"
                aria-label={`Search ${SECTIONS.find((s) => s.id === section)?.label.toLowerCase()}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-tertiary hover:text-primary">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {section === "chat" && (
              <ChatList query={query} activeId={activeIds.chat} onSelect={(id) => onSelect("chat", id)} onNew={() => onNew("chat")} />
            )}
            {section === "notes" && (
              <NoteList query={query} activeId={activeIds.notes} onSelect={(id) => onSelect("notes", id)} />
            )}
            {section === "cards" && (
              <DeckList query={query} activeId={activeIds.cards} onSelect={(id) => onSelect("cards", id)} />
            )}
            {section === "papers" && (
              <PaperList query={query} activeId={activeIds.papers} onSelect={(id) => onSelect("papers", id)} />
            )}
          </div>

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

function NoteList({
  query,
  activeId,
  onSelect,
}: {
  query: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const notes = useLiveQuery(
    () => db.notes.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Note[],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes ?? [];
    return (notes ?? []).filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  if (!filtered.length) return <Empty query={query} noun="notes" />;

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  const row = (n: Note) => (
    <Row
      key={n.id}
      title={n.title || "Untitled note"}
      active={n.id === activeId}
      confirming={confirming === n.id}
      pinned={n.pinned}
      onSelect={() => onSelect(n.id)}
      onTogglePin={() => db.notes.update(n.id, { pinned: !n.pinned })}
      onAskDelete={() => setConfirming(n.id)}
      onCancelDelete={() => setConfirming(null)}
      onDelete={async () => {
        setConfirming(null);
        await deleteNote(n.id);
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
      <section className="mb-2">
        {pinned.length > 0 && <GroupLabel>Notes</GroupLabel>}
        {rest.map(row)}
      </section>
    </>
  );
}

function DeckList({
  query,
  activeId,
  onSelect,
}: {
  query: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const decks = useLiveQuery(() => db.decks.orderBy("createdAt").reverse().toArray(), [], [] as Deck[]);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);

  const filtered = (decks ?? []).filter((d) =>
    d.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!filtered.length) return <Empty query={query} noun="decks" />;

  return (
    <section className="mb-2">
      {filtered.map((d) => {
        const own = (cards ?? []).filter((c) => c.deckId === d.id);
        const due = dueCount(own);
        return (
          <Row
            key={d.id}
            title={d.title || "Untitled deck"}
            active={d.id === activeId}
            confirming={confirming === d.id}
            // The number that decides whether you open it at all.
            badge={due > 0 ? String(due) : undefined}
            meta={`${own.length} card${own.length === 1 ? "" : "s"}`}
            onSelect={() => onSelect(d.id)}
            onAskDelete={() => setConfirming(d.id)}
            onCancelDelete={() => setConfirming(null)}
            onDelete={async () => {
              setConfirming(null);
              await deleteDeck(d.id);
            }}
          />
        );
      })}
    </section>
  );
}

function PaperList({
  query,
  activeId,
  onSelect,
}: {
  query: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const papers = useLiveQuery(
    () => db.papers.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Paper[],
  );

  const filtered = (papers ?? []).filter(
    (p) =>
      p.title.toLowerCase().includes(query.trim().toLowerCase()) ||
      p.content.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!filtered.length) return <Empty query={query} noun="papers" />;

  return (
    <section className="mb-2">
      {filtered.map((p) => (
        <Row
          key={p.id}
          title={p.title || "Untitled paper"}
          active={p.id === activeId}
          confirming={confirming === p.id}
          meta={p.format}
          onSelect={() => onSelect(p.id)}
          onAskDelete={() => setConfirming(p.id)}
          onCancelDelete={() => setConfirming(null)}
          onDelete={async () => {
            setConfirming(null);
            await deletePaper(p.id);
          }}
        />
      ))}
    </section>
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
