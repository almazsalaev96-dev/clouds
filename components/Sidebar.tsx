"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronRight, FolderOpen, GraduationCap, Keyboard, Library, MessagesSquare, NotebookPen,
  Pin, PinOff, Plus, Search, Settings2, Sparkles, Trash2, X,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { db, deleteConversation, groupConversations } from "@/lib/db";
import { dueNow } from "@/lib/study";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { Lockup } from "@/components/brand/Logo";
import { offerUndo } from "@/lib/undo";
import { useSettings, type Section } from "@/lib/store";
import { cn } from "@/lib/utils";
import { IconButton, Kbd, Tooltip } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";

/* All of them, in one list.
   Code used to sit in the header as half of a switch, on the argument that
   chat and code are not two destinations among several — they are the two
   things the app is. That stopped being true when Creative became a room:
   three icons in a segmented control is a menu pretending to be a switch, and
   it put the rooms in two places at once, one of them a strip of unlabelled
   marks above a list of labelled rows.

   So: one list, one row each, every destination named. Chat is the exception
   and stays out of it — the conversations are the list underneath, and you get
   back to them by opening one or by starting a new one, which is what the two
   controls above this already do. */
/* The order is the design, and it is not alphabetical or historical.
   ---------------------------------------------------------------------
   The serial-position effect is one of the oldest results in cognitive
   psychology and it is about lists exactly like this one: the first and the
   last item are found and remembered far more reliably than anything in the
   middle. A six-room list therefore has two good seats and four ordinary
   ones, and which rooms get them is a decision rather than an accident.

   It was an accident. Study — the one room in this app that a chat window
   structurally cannot be, and the reason somebody chooses this over the
   thing they already have — sat fourth of six, which is the worst position
   in the list. Creative sat last, holding the strongest seat in the column
   for the room that is opened least.

   So: Conversations first, because it is where nearly every session starts
   and primacy is wasted on anything else. Study second, where it is still
   above the fold of attention. The three supporting rooms in the middle,
   which is what the middle is for. Creations last, because "where is the
   thing I made" is the other question people arrive with, and recency is
   the seat for the destination you go looking for rather than the one you
   land on. */
const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  /* Conversations is in the list too, and has to be: with the header switch
     gone there was no way back to the thread you were reading except opening
     one, and "New chat" is not that — it is a different conversation. */
  { id: "chat", label: "Conversations", icon: <MessagesSquare size={20} /> },
  { id: "study", label: "Study", icon: <GraduationCap size={20} /> },
  { id: "notebook", label: "Notebook", icon: <NotebookPen size={20} /> },
  { id: "projects", label: "Projects", icon: <FolderOpen size={20} /> },
  { id: "creative", label: "Studio", icon: <Sparkles size={20} /> },
  /* "Creations", after "Library", after "Artifacts", after "Code". The room holds web
     apps, documents and code files, and since a request in the chat lands
     here as a running thing it mostly holds things that are not code at all
     — a deck of cards, a timetable, a tracker. "Code" sent everyone who was
     not a programmer straight past it; "Artifacts" is a word this industry
     uses and nobody else does. "Library" is what a person calls the place
     their own things are kept — and then, read against "Studio" one row
     up, it said a place things are borrowed from rather than the place your
     own things go. "Creations" says whose they are. And "Studio" for the
     room above it, because five rooms had nouns for names and one had an
     adjective: a studio is where you make things, which is what it is. */
  { id: "code", label: "Creations", icon: <Library size={20} /> },
];

/* What the search box finds, in the room you are in: the list under the
   rooms is that room's, so the box searches that. */
const FIND: Record<Section, { one: string; many: string }> = {
  chat: { one: "a conversation", many: "conversations" },
  creative: { one: "a conversation", many: "conversations" },
  study: { one: "a deck", many: "decks" },
  notebook: { one: "a page", many: "pages" },
  projects: { one: "a project", many: "projects" },
  code: { one: "a creation", many: "creations" },
};

export function Sidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  onGoToSection,
  onOpenSettings,
  onOpenShortcuts,
  onOpenItem,
  openItems,
}: {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onGoToSection: (section: Section) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  /** Open one thing in the room you are in: a deck, a page, a project, a creation. */
  onOpenItem?: (section: Section, id: string) => void;
  /** What is open in each room, so its row can say so. */
  openItems?: Partial<Record<Section, string | null>>;
}) {
  const { sidebarOpen, toggleSidebar, section, name } = useSettings();
  const [query, setQuery] = React.useState("");
  /* Closed to begin with, and closing it clears what was typed: a filter
     left running behind a shut box is a list that is missing rows for a
     reason nobody can see. */
  const [searching, setSearching] = React.useState(false);
  /* Closed is closed. It used to leave a 72px rail of icons on a desk,
     on the theory that "collapse" is not "hide" — and the person hiding
     the panel on a tablet did not want a thinner panel, they wanted the
     page. The rooms are one press away through the switch in the bar,
     which never moves, and through the palette. */
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
          "glass safe-y no-print z-40 flex shrink-0 flex-col overflow-hidden border-r border-line",
          "fixed inset-y-0 left-0 w-[var(--sidebar-w)] transition-transform duration-[var(--dur-layout)] ease-[var(--ease-out)]",
          "md:relative md:z-auto md:transition-[width]",
          /* On a desk and a tablet the column stops being a wall and
             becomes a panel: inset from three edges, cornered, lifted,
             with the page visible around it. A border welded to the
             viewport edge says "this is the frame of the application";
             a panel says "this is one surface among others", which is
             the truer description of a list of rooms. Flush on a phone,
             where the drawer covers the screen and a margin around it
             would be a gap to nowhere. */
          "md:my-2 md:ml-2 md:rounded-xl md:border-r-0 md:shadow-md",
          sidebarOpen
            ? "translate-x-0 md:w-[var(--sidebar-w)]"
            : "-translate-x-full md:w-0 md:translate-x-0 md:my-0 md:ml-0 md:shadow-none",
        )}
        /* `inert` as well as `aria-hidden`, and the pair is the point.
           Collapsed, this becomes `w-0` with `overflow-hidden` — clipped to
           nothing on the screen, while everything inside keeps its place in
           the document and its place in the tab order. So four controls
           (this toggle, the two room switches and New chat) could be tabbed
           to while invisible, and `aria-hidden` meant a screen reader said
           nothing when they were. That pairing — focusable inside
           aria-hidden — is the one combination the spec calls out, and the
           browser makes it worse by scrolling a focused child of an
           `overflow:hidden` box into view, which drags the clipped column
           back over the page. `inert` removes both at once. */
        inert={!sidebarOpen}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex w-[var(--sidebar-w)] flex-1 flex-col">
          {/* The name, and one round control. The switch that hides this
              panel is not here any more — it was a button drawn on the thing
              it hides, which had to be duplicated elsewhere the moment it
              worked; it lives in the bar beside the model now, where it is
              one control that never moves. What is left is what the header
              is for: whose app this is, and the way into finding things. */}
          <div className="flex h-[var(--topbar-h)] items-center gap-2 px-3">
            {/* The drawn word, not the name set in the interface font. A
                product's own name is the one string it should never render in
                whatever the operating system happened to load. */}
            <span className="min-w-0 flex-1">
              <Lockup />
            </span>
            <button
              onClick={() => setSearching((v) => !v)}
              /* Not the same name as the field it opens: two controls with
                 one accessible name is a screen reader saying the same
                 words for a button and a box, and a test that cannot tell
                 them apart either. */
              aria-label={`Find ${FIND[section].one}`}
              aria-expanded={searching}
              className={cn(
                /* 44, not the 36 it was drawn at. The round control in the
                   reference measures smaller and it does not matter: the
                   floor argued for in the rows two inches below this one
                   is the floor here too, and a rule that bends for the
                   thing its author happens to be drawing is not a rule. */
                "tap flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)]",
                searching ? "bg-accent-subtle text-accent" : "bg-surface text-secondary hover:text-primary",
              )}
            >
              <Search size={17} />
            </button>
          </div>

          <div className="space-y-1 px-2 pb-2">
            <button
              onClick={onNewChat}
              className="tap group flex h-11 w-full items-center gap-3 rounded-md border border-line bg-surface px-3 text-[0.9375rem] font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
            >
              <Plus size={17} className="text-tertiary transition-colors duration-[var(--dur-fast)] group-hover:text-accent" />
              New chat
              <span className="ml-auto reveal">
                <Kbd keys={["mod", "N"]} />
              </span>
            </button>

            {/* Shown when it is asked for, which is the same rule the tools
                in the composer follow. A search box that sits there on every
                screen of every session is a row of furniture for the one
                visit in ten that needs it — and the panel has six rooms and
                a history under it, all of which are further down for its
                sake. */}
            {searching && (
            <div className="tap flex h-10 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 transition-colors duration-[var(--dur-fast)]">
              <Search size={13} className="shrink-0 text-tertiary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setSearching(false); } }}
                /* "Conversations", to match the section this box sits in and
                   the two beside it — Search projects, Search notebook. The
                   list above it is headed Conversations for a reason the
                   comment up there gives: the composer has a mode called Chat
                   and two controls a syllable apart is a screen reader saying
                   the same word for different things. This box was still
                   saying the other one. */
                placeholder={`Search ${FIND[section].many}`}
                aria-label={`Search ${FIND[section].many}`}
                className="tap h-full min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
              />
              <button
                onClick={() => { setQuery(""); setSearching(false); }}
                aria-label="Close search"
                className="text-tertiary hover:text-primary"
              >
                <X size={13} />
              </button>
            </div>
            )}
          </div>

          {/* Destinations, above the history that fills the rest of the panel.

              The fill travels between rows rather than blinking from one to
              the next. When the rooms were a segmented switch in the header
              they had this already, and moving them into the list dropped it
              — the mark for "you are here" vanished from one row and appeared
              on another, and the eye had to go and find it. The same control
              that slides the switch in the canvas tabs slides it here, which
              is also why it does not animate on the first paint: where you are
              should be settled before the question is asked. */}
          <nav aria-label="Sections" className="px-2 pb-1">
            <Segmented
              value={section}
              /* A fill, not a floating object: it sits behind the row it
                 marks, so it takes no shadow at all rather than one turned
                 off. */
              indicatorClassName="rounded-sm bg-accent-subtle"
              /* `gap`, not `space-y`. The indicator is the first child of this
                 box, so `space-y-*` — which margins every sibling after the
                 first — would push the whole list down by one step the moment
                 the indicator appeared, and it appears one frame late because
                 it is positioned from a measurement. Absolutely positioned
                 children are not flex items, so `gap` skips it. */
              className="flex flex-col gap-0.5"
            >
              {SECTIONS.map((s) => {
                const on = section === s.id;
                return (
                  <button
                    key={s.id}
                    data-on={on}
                    onClick={() => onGoToSection(s.id)}
                    aria-current={on}
                    /* 44 tall, 12 of side padding, a 20px mark, and the label
                       at 15 rather than 14.

                       It went 32 → 36 → 44 and each step was the same
                       argument won more completely: a row built to the size
                       of its text is a row you read, and this is a row you
                       put a finger on. 36 was the floor for a pointer; 44 is
                       the floor Apple sets for a touch target and the size
                       every tablet-first tool in this class has settled on,
                       measured off the reference at ~42. On a desk the extra
                       height costs nothing but air, which a list of six
                       rooms has to spare. */
                    className={cn(
                      "tap flex h-11 w-full items-center gap-3 rounded-md px-3 text-[0.9375rem] transition-colors duration-[var(--dur-fast)]",
                      // The row only changes the colour of its ink; the fill
                      // underneath it is the one element that moves.
                      on ? "font-medium text-primary" : "text-secondary hover:bg-subtle/60 hover:text-primary",
                    )}
                  >
                    <span className={cn("shrink-0", on ? "text-accent" : "text-tertiary")}>
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </Segmented>
          </nav>

          {/* A hairline and a label, so the destinations above and the history
              below read as two different kinds of thing. */}
          <div className="mx-2 mb-1 mt-1 border-t border-line" aria-hidden />

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {/* The list under the rooms is the room's own. Conversations in
                Conversations and in Studio, where making happens in a
                conversation; decks in Study, pages in the Notebook, projects
                in Projects, what you made in Creations — each a tap away
                from any of them, the way the reference keeps a room's things
                in its sidebar rather than only in the room. */}
            {section === "chat" || section === "creative" || !onOpenItem ? (
              <ChatList
                query={query}
                activeId={section === "chat" ? activeChatId : null}
                onSelect={(id) => onSelectChat(id)}
                onNew={onNewChat}
              />
            ) : (
              <RoomList
                section={section}
                query={query}
                activeId={openItems?.[section] ?? null}
                onOpen={(id) => onOpenItem(section, id)}
              />
            )}
          </div>

          {/* The account row. An app that has asked your name and then signs
              its own footer "Settings" has forgotten it again; this is the one
              place the answer is worth showing back. It is still the settings
              button — the name is the label, not a second control. */}
          <div className="flex items-center gap-1 border-t border-line p-2">
            <button
              onClick={onOpenSettings}
              aria-label="Settings"
              className="tap group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle/60"
            >
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-tiny font-semibold uppercase text-accent"
              >
                {(name.trim()[0] ?? "").toUpperCase() || <Settings2 size={13} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-secondary group-hover:text-primary">
                {name.trim() || "Settings"}
              </span>
              {/* `reveal`, not a bare hover: on a touch screen there is no
                  hover, and a row that reads "Almaz" with nothing beside it
                  gives no sign it is the way to Settings. */}
              <Settings2 size={14} className="reveal shrink-0 text-tertiary" />
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
    // Sticky, but with no fill of its own: the sidebar is glass now, and an
    // opaque strip inside it reads as a row rather than a label for the rows
    // under it. Blur alone keeps the text legible over whatever scrolls past.
    /* Sentence case, not micro-caps. "TODAY" set in 11px capitals with
       letterspacing is a label shouting its own name; "Today" is a word you
       read past on the way to the thing under it, which is what a group
       heading is for. */
    <h2 className="glass sticky top-0 z-10 px-2 pb-1 pt-3 text-meta font-medium text-faint">
      {children}
    </h2>
  );
}

/* An empty list says what would fill it. "No conversations yet." was true
   and told you nothing; the second line is why, and the button is what to do
   about it — the three parts every empty state owes the person looking at
   it. The search case keeps its one line, because there the next action is
   obvious: change the query. */
function Empty({ query, noun, onNew }: { query: string; noun: string; onNew?: () => void }) {
  if (query) {
    return (
      <p className="px-2 py-6 text-center text-xs text-tertiary">
        Nothing matches <span className="text-secondary">{query}</span>.
      </p>
    );
  }
  return (
    <div className="px-2 py-6 text-center">
      <p className="text-sm text-secondary">No {noun} yet.</p>
      <p className="mt-1 text-xs text-tertiary">Ask anything and it will be kept here.</p>
      {onNew && (
        <button
          onClick={onNew}
          /* Primary ink, not the accent. The accent on the sidebar's glass is
             6.4:1 in light and 9.3:1 in dark, a wider gap than the two themes
             allow between them; primary ink is what the rows above already
             use and has the parity to show for it. It is still plainly a
             button — the fill on hover says so. */
          className="tap mt-3 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
        >
          Start a conversation
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ room lists -- */

type RoomRow = { id: string; title: string; meta?: string; badge?: string; pinned?: boolean };

/**
 * One room's things, as sidebar rows: newest first, pinned above, filtered
 * by the same search box as the conversations. Read live from the same
 * tables the rooms read, so a deck studied or a page written moves up
 * without anything telling it to.
 */
function RoomList({
  section,
  query,
  activeId,
  onOpen,
}: {
  section: Section;
  query: string;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const rows = useLiveQuery(async (): Promise<RoomRow[]> => {
    if (section === "study") {
      const [decks, cards] = await Promise.all([db.decks.orderBy("updatedAt").reverse().toArray(), db.cards.toArray()]);
      const now = Date.now();
      return decks.map((d) => {
        const mine = cards.filter((c) => c.deckId === d.id);
        const due = dueNow(mine, now).length;
        /* Due, when anything is: that is the number that asks for something.
           The size only when nothing is due — two bare numbers side by side
           ("8 8") read as one number printed twice. */
        return { id: d.id, title: d.name || "Untitled deck", meta: due ? undefined : `${mine.length} cards`, badge: due ? `${due}` : undefined };
      });
    }
    if (section === "notebook") {
      const notes = await db.notes.orderBy("updatedAt").reverse().toArray();
      return notes.map((n) => ({ id: n.id, title: n.title?.trim() || "Untitled", pinned: Boolean(n.pinned) }));
    }
    if (section === "projects") {
      const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
      return projects.map((p) => ({ id: p.id, title: p.name || "Untitled project" }));
    }
    if (section === "code") {
      const canvases = await db.canvases.orderBy("updatedAt").reverse().toArray();
      return canvases.map((c) => ({ id: c.id, title: c.title || "Untitled", meta: c.kind === "web" ? "app" : c.kind === "doc" ? "doc" : c.lang || "code" }));
    }
    return [];
  }, [section]);

  const q = query.trim().toLowerCase();
  const list = (rows ?? []).filter((r) => !q || r.title.toLowerCase().includes(q));
  const ordered = [...list.filter((r) => r.pinned), ...list.filter((r) => !r.pinned)];
  const heading = { study: "Decks", notebook: "Pages", projects: "Projects", code: "Made here" }[section as "study"] ?? "";
  const noun = { study: "decks", notebook: "pages", projects: "projects", code: "creations" }[section as "study"] ?? "things";

  if (rows === undefined) return null;
  if (!ordered.length) return <Empty query={query} noun={noun} />;
  return (
    <section aria-label={heading}>
      <GroupLabel>{heading}</GroupLabel>
      <ul className="flex flex-col gap-px">
        {ordered.map((r) => {
          const on = r.id === activeId;
          return (
            <li key={r.id}>
              <button
                onClick={() => onOpen(r.id)}
                aria-current={on || undefined}
                className={cn(
                  "tap focus-inset flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-[var(--dur-fast)]",
                  on ? "bg-accent-subtle text-primary" : "text-secondary hover:bg-subtle/60 hover:text-primary",
                )}
                title={r.title}
              >
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {/* At the end, so every title starts on the same line. */}
                {r.pinned && <Pin size={11} className="shrink-0 text-tertiary" aria-label="Pinned" />}
                {r.meta && <span className="shrink-0 text-xs text-tertiary tnum">{r.meta}</span>}
                {r.badge && <span className="badge-count shrink-0" aria-label={`${r.badge} due`}>{r.badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
  const [showArchived, setShowArchived] = React.useState(false);
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as Conversation[],
  );

  /* Titles alone miss most of what people remember, so bodies are searched
     too — but that is a full scan of every message in the database, and run on
     the raw query it happens once per keystroke. Titles stay instant off the
     live value; the scan follows the settled one. */
  const settled = useDebounced(query, 220);

  const matchedIds = useLiveQuery(async () => {
    const q = settled.trim().toLowerCase();
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
  }, [settled]);

  const filtered = React.useMemo(() => {
    // Temporary chats are not listed anywhere: that is the whole of the promise.
    const list = (conversations ?? []).filter((c) => !c.archived && !c.temporary);
    const q = query.trim().toLowerCase();
    // While the scan is catching up, title matches carry the list rather than
    // the previous query's body hits leaking into this one.
    if (!q) return list;
    const bodies = settled.trim().toLowerCase() === q ? matchedIds : null;
    return list.filter((c) => c.title.toLowerCase().includes(q) || bodies?.has(c.id));
  }, [conversations, query, settled, matchedIds]);

  const archived = (conversations ?? []).filter((c) => c.archived && !c.temporary);

  if (!filtered.length && !archived.length) return <Empty query={query} noun="conversations" onNew={onNew} />;

  const pinned = filtered.filter((c) => c.pinned);
  const groups = groupConversations(filtered.filter((c) => !c.pinned));

  const row = (c: Conversation) => (
    <Row
      key={c.id}
      title={c.title || "New chat"}
      active={c.id === activeId}
      pinned={c.pinned}
      onSelect={() => onSelect(c.id)}
      onTogglePin={() => db.conversations.update(c.id, { pinned: !c.pinned })}
      onDelete={async () => {
        // No confirmation step: it interrupts every delete to catch the rare
        // one, and the undo bar catches that one without interrupting any.
        const wasActive = c.id === activeId;
        const restore = await deleteConversation(c.id);
        if (wasActive) onNew();
        offerUndo(c.title || "New chat", async () => {
          await restore();
          if (wasActive) onSelect(c.id);
        });
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

      {/* Archived conversations, out of the way but not out of reach. Closed
          by default and silent when there are none, so it costs nothing to
          anyone who never archives anything. */}
      {archived.length > 0 && !query && (
        <section className="mt-1 border-t border-line pt-1">
          <button
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="focus-inset tap flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-meta font-medium text-faint transition-colors duration-[var(--dur-fast)] hover:text-secondary"
          >
            <ChevronRight
              size={12}
              className={cn("transition-transform duration-[var(--dur-fast)]", showArchived && "rotate-90")}
            />
            Archived
            <span className="tnum ml-auto pr-1">{archived.length}</span>
          </button>
          {showArchived && archived.map(row)}
        </section>
      )}
</>
  );
}

/* ------------------------------------------------------------------- row -- */

function Row({
  title,
  meta,
  badge,
  active,
  pinned,
  onSelect,
  onTogglePin,
  onDelete,
}: {
  title: string;
  meta?: string;
  badge?: string;
  active: boolean;
  pinned?: boolean;
  onSelect: () => void;
  onTogglePin?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "tap group relative flex h-8 items-center rounded-md pl-2 pr-1 transition-colors duration-[var(--dur-fast)]",
        active ? "bg-accent-subtle" : "hover:bg-subtle/60",
      )}
    >
      {/* `h-full`, because a row is a target and a line of text is not. The
          button used to be as tall as its own text — 21px inside a 32px row —
          so the eleven pixels of air that make the row comfortable to read
          were eleven pixels that did nothing when you pressed them. The
          baseline alignment the title and its date share moved inside. */}
      <button
        onClick={onSelect}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center text-left text-sm",
          active ? "text-primary" : "text-secondary group-hover:text-primary",
        )}
        title={title}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          {/* No mark down the left edge any more. There was a hollow bullet,
              then a filled one on the active row, and the fill was already
              saying which row was open; the reference says it with the fill
              alone and its list is the calmer for it. */}
          <span className="truncate">{title}</span>
          {meta && <span className="shrink-0 text-xs text-tertiary">{meta}</span>}
        </span>
      </button>

      {badge && (
        <span className="badge-count mr-1 shrink-0 group-hover:hidden">
          {badge}
        </span>
      )}

      <span className="flex shrink-0 items-center reveal">
        {onTogglePin && (
          <Tooltip label={pinned ? "Unpin" : "Pin"}>
            <button
              onClick={onTogglePin}
              aria-label={pinned ? "Unpin" : "Pin"}
              className="ctl focus-inset flex [--ctl:1.5rem] items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-primary"
            >
              {pinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
          </Tooltip>
        )}
        <Tooltip label="Delete">
          <button
            onClick={onDelete}
            aria-label={`Delete ${title}`}
            className="ctl focus-inset flex [--ctl:1.5rem] items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </Tooltip>
      </span>
    </div>
  );
}
