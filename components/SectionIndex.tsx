"use client";

import * as React from "react";
import { ChevronLeft, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton, Tooltip } from "@/components/ui/primitives";
import { RoomToggle } from "@/components/ui/RoomToggle";

export interface IndexItem {
  id: string;
  title: string;
  /** One line of the thing itself, so the list is scannable without opening. */
  preview?: string;
  meta?: string;
  badge?: string;
  pinned?: boolean;
  /** The full body, searched but never drawn. */
  searchText?: string;
  /**
   * What kind of thing this is, at a glance. A room that holds one kind of
   * thing needs none; a room that holds five needs the reader to tell a
   * deck from a page before reading the title, which is what a mark before
   * the title is for.
   */
  icon?: React.ReactNode;
}

/**
 * The index for a section, in the main column rather than the sidebar.
 *
 * The sidebar belongs to conversations — that is what people navigate most, and
 * taking it away to show notes would cost more than it buys. So a section is a
 * place you go to, with its own list, the way a library is a room rather than a
 * tab.
 */
export function SectionIndex({
  title,
  items,
  newLabel,
  loading,
  emptyTitle,
  emptyHint,
  onOpen,
  onNew,
  onDelete,
  onTogglePin,
  lead,
  waysIn,
}: {
  title: string;
  items: IndexItem[];
  newLabel: string;
  /**
   * True until the query has come back. Dexie hands back `undefined` before it
   * resolves, and treating that as "none" flashes "No notes yet" at someone
   * who has fifty. An empty state is a claim about their work; it should not be
   * made until it is known to be true.
   */
  loading?: boolean;
  emptyTitle: string;
  emptyHint: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  /** Rendered above the list, for anything more urgent than browsing it. */
  lead?: React.ReactNode;
  /**
   * What an empty room offers, as a line of quiet presses rather than a
   * paragraph explaining the room. Each is a concrete first move — "Keep an
   * answer from a chat", "Attach a PDF" — not a description of one.
   */
  waysIn?: { label: string; icon?: React.ReactNode; onPick: () => void }[];
}) {
  const [query, setQuery] = React.useState("");
  const toggle = React.useContext(RoomToggle);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.preview?.toLowerCase().includes(q) ||
        i.searchText?.toLowerCase().includes(q),
    );
  }, [items, query]);

  // A search box over three rows is furniture. It appears when the list is long
  // enough that scanning it stops being the faster way to find something.
  const searchable = !loading && items.length >= 5;

  /* The same rule as the chat's bar: not a band until something scrolls
     under it. At rest the title sits on the page; a solid strip across the
     top of every room was the one frame that changed as you moved between
     the conversation and the rest. */
  const [scrolled, setScrolled] = React.useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
      {/* Sticky, because a title that scrolls away takes the primary action
          with it, and on a long list that means scrolling back to the top to
          make the next one. */}
      <header
        className={cn(
          "safe-top sticky top-0 z-10 border-b transition-[border-color,background-color] duration-[var(--dur-fast)]",
          scrolled ? "glass border-line" : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-3 px-4 py-3">
          {toggle && <div className="has-room-toggle -ml-2 -mr-1 md:hidden">{toggle}</div>}
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-primary">{title}</h1>
          {!loading && items.length > 0 && (
            <span className="tnum text-sm text-faint">{items.length}</span>
          )}
          <Button size="sm" variant="primary" className="bloom ml-auto" onClick={onNew}>
            <Plus size={14} />
            {newLabel}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        {lead}

        {searchable && (
          <div className="mb-3 flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 transition-colors duration-[var(--dur-fast)] focus-within:border-accent">
            <Search size={14} className="shrink-0 text-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder={`Search ${title.toLowerCase()}`}
              aria-label={`Search ${title.toLowerCase()}`}
              className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-tertiary hover:text-primary">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <ul className="space-y-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="skeleton h-[3.25rem] rounded-lg border border-line"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </ul>
        ) : items.length === 0 ? (
          /* An empty room is a room, not a placeholder for one. This was a
             dashed box holding a paragraph and a second copy of the button
             the header already has — three things saying "nothing here"
             where one would do, inside a border that made the nothing look
             like a form to fill in. Now: the title, the one sentence, and
             the same ways in the chat's blank page offers — as a quiet line,
             not as chips. The button stays in the header, where it will
             still be when the room is full. */
          <div className="px-4 pb-6 pt-12 text-center anim-fade">
            <p className="display-italic text-[1.25rem] text-secondary">{emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-[28rem] text-sm text-tertiary">{emptyHint}</p>
            {waysIn && waysIn.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-xs text-tertiary" aria-label="Ways to start">
                {waysIn.map((w, i) => (
                  <React.Fragment key={w.label}>
                    {i > 0 && <span className="text-faint" aria-hidden>·</span>}
                    <button
                      onClick={w.onPick}
                      className="btn-touch focus-inset flex items-center gap-1.5 rounded-full px-2 py-0.5 text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                    >
                      {w.icon}
                      {w.label}
                    </button>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-tertiary">
            Nothing matches <span className="text-secondary">{query}</span>.
          </p>
        ) : (
          <ul
            /* Named, like every other list in the app: four rooms draw their
               index through this component and not one of their lists had a
               name a screen reader could announce. */
            className="space-y-1"
            aria-label={title}
          >
            {filtered.map((item) => (
              <li
                key={item.id}
                /* `tap` is the app's 44pt floor on a touch device, and this
                   row never had it: at the two densities nobody had measured
                   it came out at 39 and 40 pixels, and a one-line item at 21.
                   Density multiplies every padding in the app at once, so a
                   row whose height is only its padding plus its text is a row
                   whose target size is a coincidence. */
                className="tap lift group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 hover:border-line-strong"
              >
                    {/* Stretched, for the same reason the conversation rows in
                        the sidebar are: the air that makes a list comfortable
                        to read should do something when you press it. */}
                    <button
                      onClick={() => onOpen(item.id)}
                      /* Its own name, rather than whatever its three lines of
                         text concatenate to: "Kanji N512 cards · 4 known" is
                         what a screen reader read out before this. */
                      aria-label={`Open ${item.title}`}
                      className="focus-inset flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-md text-left"
                    >
                      {item.icon && <span className="shrink-0 text-tertiary" aria-hidden>{item.icon}</span>}
                      <span className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-primary">{item.title}</span>
                        {item.meta && <span className="shrink-0 text-xs text-tertiary">{item.meta}</span>}
                      </span>
                      {item.preview && (
                        <span className="mt-0.5 block truncate text-xs text-secondary">{item.preview}</span>
                      )}
                      </span>
                    </button>

                    {item.pinned && !onTogglePin && (
                      <Pin size={12} className="shrink-0 text-tertiary" aria-label="Pinned" />
                    )}

                    {item.badge && (
                      <span className="badge-count shrink-0">
                        {item.badge}
                      </span>
                    )}

                    {onTogglePin && (
                      <Tooltip label={item.pinned ? "Unpin" : "Pin to top"}>
                        <button
                          onClick={() => onTogglePin(item.id)}
                          aria-label={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                          aria-pressed={item.pinned}
                          data-visible={item.pinned || undefined}
                          className={cn(
                            "ctl reveal flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-md hover:bg-subtle",
                            item.pinned ? "text-accent" : "text-tertiary hover:text-primary",
                          )}
                        >
                          {/* A pin, whether or not it is pinned. At rest this
                              icon reports state, and the accent is the report;
                              swapping in a crossed-out pin would show the
                              action instead, which reads as "this is unpinned"
                              at exactly the moment it is not. The action lives
                              in the tooltip and the accessible name. */}
                          <Pin size={14} className={cn(item.pinned && "fill-current")} />
                        </button>
                      </Tooltip>
                    )}

                    {/* Straight to it. The undo bar is the way back, and it is
                        the same way back everywhere else in the app. */}
                    <Tooltip label="Delete">
                      <button
                        onClick={() => onDelete(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="ctl focus-inset flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-md text-tertiary reveal hover:bg-subtle hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The way back out of a detail view, in the place every app puts it. */
export function DetailBar({
  onBack,
  backLabel,
  wide,
  wraps,
  children,
}: {
  onBack: () => void;
  backLabel: string;
  /** For screens whose content is wider than a reading measure — code. */
  wide?: boolean;
  /** The children wrap to two rows on a phone, so the back button sits on
      the first rather than floating between them. */
  wraps?: boolean;
  children?: React.ReactNode;
}) {
  const toggle = React.useContext(RoomToggle);
  return (
    <div
      className={cn(
        "no-print mx-auto flex w-full items-center gap-1 px-4 pt-3",
        wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
      )}
    >
      {toggle && <div className={cn("has-room-toggle -ml-2 md:hidden", wraps && "max-sm:self-start")}>{toggle}</div>}
      <IconButton label={backLabel} keys={["Esc"]} onClick={onBack} className={wraps ? "max-sm:self-start" : undefined}>
        <ChevronLeft size={16} />
      </IconButton>
      {children}
    </div>
  );
}
