"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, ChevronRight, FolderOpen, MessagesSquare, MoreHorizontal, NotebookPen,
  PanelLeft, Pin, PinOff, Plus, Search, Settings, Sparkles, SquarePen, Trash2, X,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { createNote, db, deleteConversation, groupConversations } from "@/lib/db";
import { dueNow } from "@/lib/study";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { Lockup, Mark } from "@/components/brand/Logo";
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
   which is what the middle is for. Studio last, because "where is the
   thing I made" is the other question people arrive with, and recency is
   the seat for the destination you go looking for rather than the one you
   land on. */
const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  /* Conversations is in the list too, and has to be: with the header switch
     gone there was no way back to the thread you were reading except opening
     one, and "New chat" is not that — it is a different conversation. */
  { id: "chat", label: "Conversations", icon: <MessagesSquare size={20} /> },
  /* Study is not listed here: it is opened from the command palette (⌘K),
     ⌘5, a deck or a due-cards line, and never from the list of rooms. */
  { id: "notebook", label: "Notebook", icon: <NotebookPen size={20} /> },
  { id: "projects", label: "Projects", icon: <FolderOpen size={20} /> },
  /* Studio is the one making room: what you ask for, what is ready this
     second, and everything made, whichever room made it. It was two rooms —
     Studio to ask and Creations to keep — and the seam between them was
     the one thing people had to learn. */
  { id: "creative", label: "Studio", icon: <Sparkles size={20} /> },
];

/* What the search box finds, in the room you are in: the list under the
   rooms is that room's, so the box searches that. */
const FIND: Record<Section, { one: string; many: string }> = {
  chat: { one: "a conversation", many: "conversations" },
  creative: { one: "a creation", many: "creations" },
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
  onOpenNotebook,
  onAllNotebooks,
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
  /** Open a notebook from wherever you are. */
  onOpenNotebook?: (id: string) => void;
  /** The Notebook room, showing only the notebooks. */
  onAllNotebooks?: () => void;
}) {
  const { sidebarOpen, toggleSidebar, section, name } = useSettings();
  const [query, setQuery] = React.useState("");
  /* Closed to begin with, and closing it clears what was typed: a filter
     left running behind a shut box is a list that is missing rows for a
     reason nobody can see. */
  const [searching, setSearching] = React.useState(false);
  /* Closed on a desk is a rail, as the reference has it: the panel's own
     controls at icon size, the page beside them. It was once a 72px rail,
     then nothing at all ("closed is closed"), and the reference settled
     the argument — a rail is what people expect, and a rail of 56px is
     not a thinner panel, it is the panel's index. On a phone the drawer
     leaves nothing behind, as before. */
  return (
    <>
      {sidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="no-print fixed inset-0 z-30 bg-[var(--bg-overlay)] anim-fade lg:hidden"
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "glass safe-y no-print z-40 flex shrink-0 flex-col overflow-hidden border-r border-line",
          "fixed inset-y-0 left-0 w-[var(--sidebar-w)] transition-transform duration-[var(--dur-layout)] ease-[var(--ease-out)]",
          /* Below 1024 — a phone, an iPad upright — the panel is a drawer
             over the page, as the reference's iPad app has it upright: the
             page keeps its whole width and the list slides over it. */
          "lg:relative lg:z-auto lg:transition-[width]",
          /* On a desk and a tablet the column stops being a wall and
             becomes a panel: inset from three edges, cornered, lifted,
             with the page visible around it. A border welded to the
             viewport edge says "this is the frame of the application";
             a panel says "this is one surface among others", which is
             the truer description of a list of rooms. Flush on a phone,
             where the drawer covers the screen and a margin around it
             would be a gap to nowhere. */
          "lg:my-2 lg:ml-2 lg:rounded-xl lg:border-r-0 lg:shadow-md",
          /* On a desk it is the desktop apps' column: flush to the edge,
             one hairline, no float — and closed it is a rail of icons,
             not nothing, so every room is still one click away. */
          "desk:m-0 desk:rounded-none desk:border-r desk:shadow-none",
          sidebarOpen
            ? "translate-x-0 lg:w-[var(--sidebar-w)]"
            : "-translate-x-full lg:hidden desk:flex! desk:w-[var(--rail-w)] desk:translate-x-0",
        )}
        /* The full panel, below, is `inert` as well as `aria-hidden` when
           closed, and the pair is the point: clipped to nothing on a desk
           behind the rail and translated off-screen on a phone, its
           controls would otherwise keep their place in the tab order —
           focusable inside aria-hidden is the one combination the spec
           calls out, and the browser makes it worse by scrolling a focused
           child of an overflow:hidden box into view. `inert` removes both
           at once, and the rail, which is not inert, is what takes the
           keyboard instead. */
      >
        {/* Closed on a desk or a tablet, the panel becomes a rail — the
            reference's collapsed sidebar: the mark at the top, which turns
            into the open-sidebar icon under the pointer; New chat; Search;
            the rooms as icons; the account at the bottom. Everything a
            press away, no label in the way of the page. */}
        {/* Closed is closed: no rail. The sidebar's switch stays at the top
            left of the page, a round button over the content, as ChatGPT's
            iPad app has it. */}
        {!sidebarOpen && (
          <Rail
            section={section}
            name={name}
            onOpen={toggleSidebar}
            onNewChat={onNewChat}
            onSearch={() => { toggleSidebar(); setSearching(true); }}
            onGoToSection={onGoToSection}
            onOpenSettings={onOpenSettings}
          />
        )}
        <div
          className={cn("relative flex min-h-0 w-[var(--sidebar-w)] flex-1 flex-col", !sidebarOpen && "lg:hidden")}
          inert={!sidebarOpen}
          aria-hidden={!sidebarOpen}
        >
          {/* The name, the close control and the round search control, as
              the reference's header has them: the panel carries its own
              switch, and the same square at the top of the rail carries
              the other half of it when the panel is closed. */}
          <div className="flex h-16 items-center gap-2 pl-4 pr-3 pt-1 desk:h-[3.25rem] desk:pl-3 desk:pr-1.5 desk:pt-0">
            {/* The drawn word, not the name set in the interface font. A
                product's own name is the one string it should never render in
                whatever the operating system happened to load. */}
            <span className="min-w-0 flex-1">
              <Lockup className="desk:origin-left desk:scale-[0.74]" />
            </span>
            {/* On a desk the panel carries its own switch, top right, as the
                desktop apps have it; the page's round one is for touch. */}
            <SidebarToggle open onClick={toggleSidebar} className="hidden desk:flex" />
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
                "tap flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)] desk:hidden",
                searching ? "bg-accent-subtle text-accent" : "bg-subtle text-primary hover:brightness-110",
              )}
            >
              <Search size={20} />
            </button>
          </div>

          {/* New chat and Search as the first two rows, on a desk: the
              desktop apps put both at the top of the list, where the pointer
              already is, rather than in a pill at the foot. */}
          <div className="hidden flex-col gap-px px-2 pb-1 desk:flex">
            <button
              onClick={onNewChat}
              aria-label="New chat"
              className="tap focus-inset group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle/70"
            >
              <SquarePen size={18} className="shrink-0" aria-hidden />
              <span className="flex-1">New chat</span>
              <span className="opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100"><Kbd keys={["mod", "N"]} /></span>
            </button>
            {/* Named by its visible words, so "click Search chats" said to
                voice control finds it (the round control on a tablet has no
                words, and keeps its label). */}
            <button
              onClick={() => { if (searching) setQuery(""); setSearching((v) => !v); }}
              aria-expanded={searching}
              className={cn(
                "tap focus-inset flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-primary transition-colors duration-[var(--dur-fast)]",
                searching ? "bg-subtle" : "hover:bg-subtle/70",
              )}
            >
              <Search size={18} className="shrink-0" aria-hidden />
              {section === "chat" ? "Search chats" : `Search ${FIND[section].many}`}
            </button>
          </div>

          <div className="space-y-1 px-2 pb-2 desk:pb-1">
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
              indicatorClassName="rounded-md bg-subtle desk:rounded-lg"
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
                      "tap flex h-12 w-full items-center gap-3.5 rounded-xl px-3 text-[1.0625rem] text-primary transition-colors duration-[var(--dur-fast)]",
                      "desk:h-9 desk:gap-2.5 desk:rounded-lg desk:px-2.5 desk:text-sm desk:[&_svg]:size-[18px]",
                      // The row only changes the colour of its ink; the fill
                      // underneath it is the one element that moves.
                      on ? "font-medium" : "hover:bg-subtle/60",
                    )}
                  >
                    <span className={cn("shrink-0", on ? "text-accent" : "text-primary")}>
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

          <div className="flex-1 overflow-y-auto px-2 pb-24 desk:pb-3">
            {/* The list under the rooms is the room's own. Conversations in
                Conversations; decks in Study, pages in the Notebook, projects
                in Projects, what you made in Studio — each a tap away
                from any of them, the way the reference keeps a room's things
                in its sidebar rather than only in the room. */}
            {/* Notebooks, as Gemini keeps them: a way to start one, the
                latest few, and the rest one press away — above the
                conversations and above the pages. */}
            {onOpenNotebook && (section === "chat" || section === "notebook") && !query.trim() && (
              <Notebooks
                activeId={section === "notebook" ? openItems?.notebook ?? null : null}
                onOpen={onOpenNotebook}
                onAll={onAllNotebooks}
              />
            )}
            {section === "chat" || !onOpenItem ? (
              <ChatList
                query={query}
                activeId={section === "chat" ? activeChatId : null}
                onSelect={(id) => onSelectChat(id)}
                onNew={onNewChat}
              />
            ) : (
              <RoomList
                quietWhenEmpty={section === "notebook" && Boolean(onOpenNotebook)}
                section={section}
                query={query}
                activeId={openItems?.[section] ?? null}
                onOpen={(id) => onOpenItem(section, id)}
              />
            )}
          </div>

          {/* The foot, as ChatGPT's iPad app has it — last in the page's order
              as it is last on the screen, so Tab walks down the panel: a blue "Chat" pill to
              start a new conversation and a round gear for settings, floating
              over the end of the list rather than a row of their own. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between desk:hidden bg-gradient-to-t from-[var(--bg-canvas)] via-[color-mix(in_oklab,var(--bg-canvas)_70%,transparent)] to-transparent px-4 pb-4 pt-10">
            <button
              onClick={onNewChat}
              aria-label="New chat"
              className="tap pointer-events-auto flex h-12 items-center gap-2.5 rounded-full bg-[var(--blue)] pl-4 pr-5 text-[1.0625rem] font-medium text-white shadow-lg transition-[filter] duration-[var(--dur-fast)] hover:brightness-110"
            >
              <SquarePen size={20} /> Chat
            </button>
            <button
              onClick={onOpenSettings}
              aria-label="Settings"
              className="tap pointer-events-auto flex size-12 items-center justify-center rounded-full border border-line bg-subtle text-primary shadow-lg transition-[filter] duration-[var(--dur-fast)] hover:brightness-110"
            >
              <Settings size={21} />
            </button>
          </div>
          {/* On a desk, the account at the foot as one row — your initial,
              your name, and the settings behind them — the way the desktop
              apps end their sidebar. */}
          <div className="hidden border-t border-line p-2 desk:block">
            <button
              onClick={onOpenSettings}
              className="tap focus-inset flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle/70"
            >
              <Avatar name={name} />
              <span className="min-w-0 flex-1 truncate">{name.trim() || "You"}<span className="sr-only"> Settings</span></span>
              <Settings size={16} className="shrink-0 text-tertiary" aria-hidden />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * The control that opens and closes the panel, as the reference draws it:
 * on the closed rail it is the mark, and under the pointer it becomes the
 * open-sidebar icon; on the open panel it is the icon, in the header's
 * corner. Same square, same shortcut, either way.
 */
function SidebarToggle({ open, onClick, className }: { open: boolean; onClick: () => void; className?: string }) {
  return (
    <Tooltip label={open ? "Hide sidebar" : "Show sidebar"} keys={["mod", "\\"]} side={open ? "bottom" : "right"}>
      <button
        onClick={onClick}
        aria-label={open ? "Hide sidebar" : "Show sidebar"}
        aria-expanded={open}
        className={cn(
          "group tap relative flex size-9 shrink-0 items-center justify-center rounded-lg text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary",
          className,
        )}
      >
        {open ? (
          <PanelLeft size={18} />
        ) : (
          <>
            <span className="transition-opacity duration-[var(--dur-fast)] group-hover:opacity-0 group-focus-visible:opacity-0">
              <Mark size={22} className="text-primary" />
            </span>
            <PanelLeft size={18} className="absolute opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100 group-focus-visible:opacity-100" />
          </>
        )}
      </button>
    </Tooltip>
  );
}

/** Your initial in a round, for the account row and the rail. */
function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "").toUpperCase();
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-semibold text-white">
      {initial || <Settings size={14} />}
    </span>
  );
}

/**
 * The closed sidebar on a desk: the desktop apps' rail. The mark (which
 * turns into the open icon under the pointer), New chat, Search, the rooms
 * as icons, and you at the foot — every room still one click away while
 * the page has the width.
 */
function Rail({
  section,
  name,
  onOpen,
  onNewChat,
  onSearch,
  onGoToSection,
  onOpenSettings,
}: {
  section: Section;
  name: string;
  onOpen: () => void;
  onNewChat: () => void;
  onSearch: () => void;
  onGoToSection: (s: Section) => void;
  onOpenSettings: () => void;
}) {
  const cell = "tap focus-inset flex size-9 items-center justify-center rounded-lg text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle [&_svg]:size-[18px]";
  return (
    <nav aria-label="Sidebar, closed" className="hidden h-full w-full flex-col items-center gap-1 py-2 desk:flex">
      <SidebarToggle open={false} onClick={onOpen} />
      <Tooltip label="New chat" keys={["mod", "N"]} side="right">
        <button onClick={onNewChat} aria-label="New chat" className={cell}><SquarePen /></button>
      </Tooltip>
      <Tooltip label={`Search ${FIND[section].many}`} side="right">
        <button onClick={onSearch} aria-label={`Find ${FIND[section].one}`} className={cell}><Search /></button>
      </Tooltip>
      <span className="my-1 h-px w-6 bg-[var(--border-subtle)]" aria-hidden />
      {SECTIONS.map((s) => (
        <Tooltip key={s.id} label={s.label} side="right">
          <button
            onClick={() => onGoToSection(s.id)}
            aria-label={s.label}
            aria-current={section === s.id || undefined}
            className={cn(cell, section === s.id && "bg-subtle text-accent")}
          >
            {s.icon}
          </button>
        </Tooltip>
      ))}
      <button onClick={onOpenSettings} aria-label="Settings" className={cn(cell, "mt-auto rounded-full")}>
        <Avatar name={name} />
      </button>
    </nav>
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
    /* A heading you can read, as ChatGPT sets "Recent": the list's own
       size, in weight, not a faint label. */
    <h2 className="px-3 pb-1.5 pt-5 text-[1.0625rem] font-semibold text-primary desk:px-2.5 desk:pb-1 desk:pt-4 desk:text-sm desk:font-medium desk:text-tertiary">
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

/* ---------------------------------------------------------- notebooks -- */

function Notebooks({ activeId, onOpen, onAll }: { activeId: string | null; onOpen: (id: string) => void; onAll?: () => void }) {
  const books = useLiveQuery(() => db.notes.filter((n) => n.view === "notebook").toArray(), [], []);
  const recent = [...(books ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const row = "tap focus-inset flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[1.0625rem] transition-colors duration-[var(--dur-fast)] desk:h-9 desk:gap-2.5 desk:rounded-lg desk:px-2.5 desk:text-sm";
  return (
    <section aria-label="Notebooks" className="mb-3">
      <GroupLabel>Notebooks</GroupLabel>
      <ul className="flex flex-col gap-px">
        <li>
          <button
            onClick={async () => { const made = await createNote({ title: "Untitled notebook", view: "notebook" }); onOpen(made.id); }}
            className={cn(row, "text-primary hover:bg-subtle/60")}
          >
            <Plus size={16} className="shrink-0 text-tertiary" aria-hidden /> New notebook
          </button>
        </li>
        {recent.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onOpen(n.id)}
              aria-current={n.id === activeId || undefined}
              title={n.title || "Untitled notebook"}
              className={cn(row, n.id === activeId ? "bg-subtle text-primary" : "text-primary hover:bg-subtle/60")}
            >
              {n.nb?.icon ? <span aria-hidden className="w-4 shrink-0 text-center text-[0.9rem] leading-none">{n.nb.icon}</span> : <BookOpen size={16} className="shrink-0 text-tertiary" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{n.title?.trim() || "Untitled notebook"}</span>
            </button>
          </li>
        ))}
        {onAll && (books?.length ?? 0) > 0 && (
          <li>
            <button onClick={onAll} className={cn(row, "text-primary hover:bg-subtle/60")}>
              <MoreHorizontal size={16} className="shrink-0 text-tertiary" aria-hidden /> All notebooks
            </button>
          </li>
        )}
      </ul>
    </section>
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
  quietWhenEmpty,
  section,
  query,
  activeId,
  onOpen,
}: {
  /* Under the notebooks, an empty list of pages says nothing: the notebooks above are not nothing. */
  quietWhenEmpty?: boolean;
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
      const notes = (await db.notes.orderBy("updatedAt").reverse().toArray()).filter((n) => n.view !== "notebook");
      return notes.map((n) => ({ id: n.id, title: n.title?.trim() || "Untitled", pinned: Boolean(n.pinned) }));
    }
    if (section === "projects") {
      const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
      return projects.map((p) => ({ id: p.id, title: p.name || "Untitled project" }));
    }
    if (section === "code" || section === "creative") {
      const canvases = await db.canvases.orderBy("updatedAt").reverse().toArray();
      return canvases.map((c) => ({ id: c.id, title: c.title || "Untitled", meta: c.kind === "web" ? "app" : c.kind === "doc" ? "doc" : c.lang || "code" }));
    }
    return [];
  }, [section]);

  const q = query.trim().toLowerCase();
  const list = (rows ?? []).filter((r) => !q || r.title.toLowerCase().includes(q));
  const ordered = [...list.filter((r) => r.pinned), ...list.filter((r) => !r.pinned)];
  const heading = { study: "Decks", notebook: "Pages", projects: "Projects", code: "Made here", creative: "Made here" }[section as "study"] ?? "";
  const noun = { study: "decks", notebook: "pages", projects: "projects", code: "creations", creative: "creations" }[section as "study"] ?? "things";

  if (rows === undefined) return null;
  if (!ordered.length) return quietWhenEmpty && !query.trim() ? null : <Empty query={query} noun={noun} />;
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
                  "tap focus-inset flex h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-[1.0625rem] transition-colors duration-[var(--dur-fast)] desk:h-9 desk:rounded-lg desk:px-2.5 desk:text-sm",
                  on ? "bg-subtle text-primary" : "text-primary hover:bg-subtle/60",
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
      {/* One list, newest first, under "Recent" — as ChatGPT has it — rather
          than a heading for every day. */}
      {groups.length > 0 && (
        <section className="mb-2" aria-label="Recent">
          <GroupLabel>Recent</GroupLabel>
          {groups.flatMap(([, items]) => items).map(row)}
        </section>
      )}

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
        "tap group relative flex h-12 items-center rounded-xl pl-3 pr-1.5 transition-colors duration-[var(--dur-fast)] desk:h-9 desk:rounded-lg desk:pl-2.5 desk:pr-1",
        active ? "bg-subtle" : "hover:bg-subtle/60",
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
          "flex h-full min-w-0 flex-1 items-center text-left text-[1.0625rem] text-primary desk:text-sm",
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
