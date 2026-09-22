"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Code2, FileText, GraduationCap, LayoutTemplate, NotebookPen } from "lucide-react";
import { db, deleteCanvas, deleteDeck, deleteNote } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { plainLine } from "@/lib/plain";
import { cn } from "@/lib/utils";
import { SectionIndex, type IndexItem } from "@/components/SectionIndex";
import { Starters } from "@/components/CanvasView";

/**
 * Everything you made, in one room.
 *
 * It was the canvases and only the canvases, under a name that promised more.
 * A page written in the Notebook, a deck built in Study and a document made
 * here were three lists in three rooms, and "where is the thing I made last
 * Tuesday" meant remembering which room it had been made in — which is the
 * one fact about a thing nobody keeps.
 *
 * The shape is the one every tool this is compared against has settled on:
 * a single list across kinds, newest first, narrowed by a row of kind chips
 * rather than split into tabs. A split view asks the question the reader
 * came here to avoid answering. Each row says what it is before it says what
 * it is called, and opens into the room that knows how to edit it.
 *
 * Making things stays where it was. The starters here make canvases; a page
 * is written in the Notebook and a deck in Study, because a room that can
 * make everything is a room that explains itself for a paragraph before it
 * lets you do anything.
 */

type Kind = "page" | "deck" | "doc" | "code" | "app";

const KINDS: { id: Kind; label: string; plural: string; icon: React.ReactNode }[] = [
  { id: "page", label: "page", plural: "Pages", icon: <NotebookPen size={16} /> },
  { id: "deck", label: "deck", plural: "Decks", icon: <GraduationCap size={16} /> },
  { id: "doc", label: "document", plural: "Documents", icon: <FileText size={16} /> },
  { id: "code", label: "code", plural: "Code", icon: <Code2 size={16} /> },
  { id: "app", label: "web app", plural: "Apps", icon: <LayoutTemplate size={16} /> },
];
const kindOf = (id: Kind) => KINDS.find((k) => k.id === id)!;

/** "today", "yesterday", "5 days ago" — the resolution a list is read at. */
function when(t: number, now = Date.now()): string {
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function LibraryView({
  onOpen,
  onNewCanvas,
  onNew,
}: {
  /** Open a thing in the room that edits it. */
  onOpen: (kind: "page" | "deck" | "canvas", id: string) => void;
  /** A starter made a canvas; go there, with a first sentence to finish. */
  onNewCanvas: (id: string, seed?: string) => void;
  onNew: () => void;
}) {
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray(), []);
  const decks = useLiveQuery(() => db.decks.orderBy("updatedAt").reverse().toArray(), []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().toArray(), []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const [kind, setKind] = React.useState<Kind | "all">("all");

  const loading = notes === undefined || decks === undefined || canvases === undefined;

  const items = React.useMemo<(IndexItem & { kind: Kind; at: number })[]>(() => {
    if (loading) return [];
    const projectName = new Map(projects.map((p) => [p.id, p.name || "Untitled project"]));
    const now = Date.now();
    const perDeck = new Map<string, { n: number; due: number }>();
    for (const c of cards) {
      const row = perDeck.get(c.deckId) ?? { n: 0, due: 0 };
      row.n += 1;
      if (c.due <= now) row.due += 1;
      perDeck.set(c.deckId, row);
    }
    const out: (IndexItem & { kind: Kind; at: number })[] = [];
    for (const n of notes!) {
      out.push({
        id: `page:${n.id}`,
        kind: "page",
        at: n.updatedAt,
        icon: kindOf("page").icon,
        title: n.title || "Untitled page",
        preview: plainLine(n.content.replace(/^\s*#[^\n]*\n?/, "")) || plainLine(n.content) || "Empty",
        meta: `page · ${when(n.updatedAt, now)}`,
        pinned: n.pinned,
        searchText: n.content,
      });
    }
    for (const d of decks!) {
      const c = perDeck.get(d.id) ?? { n: 0, due: 0 };
      out.push({
        id: `deck:${d.id}`,
        kind: "deck",
        at: d.updatedAt,
        icon: kindOf("deck").icon,
        title: d.name || "Untitled deck",
        preview: `${c.n} card${c.n === 1 ? "" : "s"}${c.due ? ` · ${c.due} due` : ""}`,
        meta: `deck · ${when(d.updatedAt, now)}`,
      });
    }
    for (const c of canvases!) {
      const k: Kind = c.kind === "web" || (c.kind === "code" && c.lang === "html") ? "app" : c.kind === "doc" ? "doc" : "code";
      out.push({
        id: `canvas:${c.id}`,
        kind: k,
        at: c.updatedAt,
        icon: kindOf(k).icon,
        title: c.title || "Untitled",
        preview:
          k === "app"
            ? "A web app — markup, styling and behaviour"
            : k === "doc"
              ? plainLine(c.content.replace(/^\s*#[^\n]*\n?/, "")) || plainLine(c.content) || "Empty"
              : (c.content.split("\n").find((l) => l.trim()) ?? "Empty"),
        meta: [
          k === "code" ? (c.lang ?? "code") : kindOf(k).label,
          c.projectId ? projectName.get(c.projectId) : undefined,
          when(c.updatedAt, now),
        ]
          .filter(Boolean)
          .join(" · "),
        searchText: c.content,
      });
    }
    /* Newest first, whatever kind. The date is the one thing a person
       reliably remembers about something they made. */
    return out.sort((a, b) => b.at - a.at);
  }, [loading, notes, decks, cards, canvases, projects]);

  /* Only the kinds that exist get a chip: a chip for a kind with nothing in
     it is a control that does nothing when pressed. */
  const present = React.useMemo(() => KINDS.filter((k) => items.some((i) => i.kind === k.id)), [items]);
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);

  const open = (id: string) => {
    const [k, raw] = id.split(/:(.*)/s) as [string, string];
    onOpen(k === "page" ? "page" : k === "deck" ? "deck" : "canvas", raw);
  };

  const remove = async (id: string) => {
    const [k, raw] = id.split(/:(.*)/s) as [string, string];
    const item = items.find((i) => i.id === id);
    const title = item?.title ?? "it";
    if (k === "page") offerUndo(title, await deleteNote(raw));
    else if (k === "deck") offerUndo(title, await deleteDeck(raw));
    else offerUndo(title, await deleteCanvas(raw));
  };

  return (
    <SectionIndex
      title="Creations"
      newLabel="New document"
      emptyTitle="Nothing made yet."
      emptyHint="Every page, deck, document and app you make lands here, whichever room you made it in."
      loading={loading}
      lead={
        <>
          <Starters onSelect={onNewCanvas} />
          {present.length > 1 && (
            <div role="group" aria-label="Kinds" className="mb-3 flex flex-wrap gap-1.5">
              {[{ id: "all" as const, plural: "All" }, ...present].map((k) => {
                const on = kind === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    aria-pressed={on}
                    className={cn(
                      "tap rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-[var(--dur-fast)]",
                      on
                        ? "border-transparent bg-accent-subtle text-accent"
                        : "border-line bg-surface text-secondary hover:border-line-strong hover:text-primary",
                    )}
                  >
                    {k.plural}
                  </button>
                );
              })}
            </div>
          )}
        </>
      }
      items={shown}
      onOpen={open}
      onNew={onNew}
      onDelete={remove}
    />
  );
}
