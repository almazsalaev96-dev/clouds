"use client";

import * as React from "react";
import { ChevronLeft, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton, Tooltip } from "@/components/ui/primitives";

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
}) {
  const [query, setQuery] = React.useState("");

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Sticky, because a title that scrolls away takes the primary action
          with it, and on a long list that means scrolling back to the top to
          make the next one. */}
      <header className="glass safe-top sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-3 px-4 py-3">
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
          <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center anim-fade">
            <p className="text-base text-primary">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-secondary">{emptyHint}</p>
            <Button size="sm" variant="primary" className="mt-4" onClick={onNew}>
              <Plus size={14} />
              {newLabel}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-tertiary">
            Nothing matches <span className="text-secondary">{query}</span>.
          </p>
        ) : (
          <ul className="space-y-1">
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
                      className="focus-inset flex min-w-0 flex-1 flex-col justify-center self-stretch rounded-md text-left"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-primary">{item.title}</span>
                        {item.meta && <span className="shrink-0 text-xs text-tertiary">{item.meta}</span>}
                      </span>
                      {item.preview && (
                        <span className="mt-0.5 block truncate text-xs text-secondary">{item.preview}</span>
                      )}
                    </button>

                    {item.pinned && !onTogglePin && (
                      <Pin size={12} className="shrink-0 text-tertiary" aria-label="Pinned" />
                    )}

                    {item.badge && (
                      <span className="shrink-0 rounded-full border border-[var(--highlight-edge)] bg-[var(--highlight)] px-1.5 text-xs font-semibold text-[var(--highlight-fg)] tnum">
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
  children,
}: {
  onBack: () => void;
  backLabel: string;
  /** For screens whose content is wider than a reading measure — code. */
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "no-print mx-auto flex w-full items-center gap-1 px-4 pt-3",
        wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
      )}
    >
      <IconButton label={backLabel} keys={["Esc"]} onClick={onBack}>
        <ChevronLeft size={16} />
      </IconButton>
      {children}
    </div>
  );
}
