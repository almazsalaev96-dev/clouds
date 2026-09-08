"use client";

import * as React from "react";
import { ChevronLeft, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ConfirmInline, IconButton, Tooltip } from "@/components/ui/primitives";

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
  const [confirming, setConfirming] = React.useState<string | null>(null);

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-6">
        <header className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary">{title}</h1>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={onNew}>
            <Plus size={14} />
            {newLabel}
          </Button>
        </header>

        {lead}

        {items.length > 0 && (
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

        {items.length === 0 ? (
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
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors duration-[var(--dur-fast)]",
                  confirming !== item.id && "hover:border-line-strong",
                )}
              >
                {confirming === item.id ? (
                  <ConfirmInline
                    question={`Delete "${item.title}"?`}
                    onConfirm={() => {
                      setConfirming(null);
                      onDelete(item.id);
                    }}
                    onCancel={() => setConfirming(null)}
                  />
                ) : (
                  <>
                    <button onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
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
                      <span className="shrink-0 rounded-full bg-[var(--go-fill)] px-1.5 text-xs font-semibold text-[var(--on-fill)] tnum">
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
                            "reveal flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-subtle hover:text-primary",
                            item.pinned ? "text-accent" : "text-tertiary",
                          )}
                        >
                          {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                      </Tooltip>
                    )}

                    <Tooltip label="Delete">
                      <button
                        onClick={() => setConfirming(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-tertiary reveal hover:bg-subtle hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </>
                )}
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
  children,
}: {
  onBack: () => void;
  backLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="no-print mx-auto flex w-full max-w-[var(--measure)] items-center gap-1 px-4 pt-3">
      <IconButton label={backLabel} keys={["Esc"]} onClick={onBack}>
        <ChevronLeft size={16} />
      </IconButton>
      {children}
    </div>
  );
}
