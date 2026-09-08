"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, List, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { Card, Grade } from "@/lib/types";
import { db } from "@/lib/db";
import { GRADES, dueCount, formatDue, newCard, orderForReview, schedule } from "@/lib/study";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton } from "@/components/ui/primitives";

export function CardsView({ deckId }: { deckId: string | null }) {
  const deck = useLiveQuery(() => (deckId ? db.decks.get(deckId) : undefined), [deckId]);
  const cards = useLiveQuery(
    () => (deckId ? db.cards.where("deckId").equals(deckId).toArray() : []),
    [deckId],
    [] as Card[],
  );
  const [mode, setMode] = React.useState<"review" | "list">("review");

  React.useEffect(() => setMode("review"), [deckId]);

  if (!deck) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-tertiary">
          Pick a deck, or make one from a note or a conversation.
        </p>
      </div>
    );
  }

  const due = dueCount(cards ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-2 px-4 pt-3">
        <h1 className="mr-auto truncate text-sm font-medium text-primary">{deck.title}</h1>
        <span className="text-xs text-tertiary tnum">
          {(cards ?? []).length} card{(cards ?? []).length === 1 ? "" : "s"}
          {due > 0 && <span className="ml-2 text-accent">{due} due</span>}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setMode(mode === "review" ? "list" : "review")}>
          {mode === "review" ? <List size={13} /> : <RotateCcw size={13} />}
          {mode === "review" ? "All cards" : "Review"}
        </Button>
      </div>

      {mode === "review" ? (
        <Review cards={cards ?? []} />
      ) : (
        <CardList cards={cards ?? []} deckId={deck.id} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- review -- */

function Review({ cards }: { cards: Card[] }) {
  const [revealed, setRevealed] = React.useState(false);
  const [aheadOf, setAheadOf] = React.useState(false);
  const [done, setDone] = React.useState(0);

  // The queue is recomputed from the database rather than held in state, so
  // grading a card removes it the moment it is no longer due — no stale copy,
  // no double-counting a card you already answered.
  const queue = React.useMemo(() => {
    const list = orderForReview(cards);
    if (list.length || !aheadOf) return list;
    return [...cards].sort((a, b) => a.due - b.due).slice(0, 20);
  }, [cards, aheadOf]);

  const card = queue[0];

  const grade = React.useCallback(
    async (g: Grade) => {
      if (!card) return;
      await db.cards.put(schedule(card, g));
      setRevealed(false);
      setDone((d) => d + 1);
    },
    [card],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const hit = GRADES.find((g) => g.keys === e.key);
        if (hit) {
          e.preventDefault();
          void grade(hit.grade);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, grade]);

  if (!cards.length) {
    return (
      <Centred>
        <p className="text-sm text-tertiary">This deck is empty. Add a card, or make one from a note.</p>
      </Centred>
    );
  }

  if (!card) {
    const next = Math.min(...cards.map((c) => c.due));
    return (
      <Centred>
        <p className="text-base text-primary">Nothing due.</p>
        <p className="mt-1 text-sm text-secondary">
          {done > 0 && `${done} reviewed. `}
          Next card {formatDue(next)}.
        </p>
        <Button size="sm" className="mt-4" onClick={() => setAheadOf(true)}>
          Review ahead anyway
        </Button>
      </Centred>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Progress is the count remaining, not a percentage: what matters is how
          many more, and a bar that barely moves is discouraging. */}
      <div className="mx-auto mt-2 w-full max-w-[var(--measure)] px-4">
        <div className="flex items-center gap-2 text-xs text-tertiary tnum">
          <span>{queue.length} left</span>
          {done > 0 && <span>{done} done</span>}
          {card.reps === 0 && <span className="text-accent">new</span>}
          {card.lapses > 2 && <span className="text-warning">leech</span>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 py-6">
          <button
            onClick={() => !revealed && setRevealed(true)}
            disabled={revealed}
            className={cn(
              "w-full rounded-xl border border-line bg-surface p-6 text-left transition-colors duration-[var(--dur-fast)]",
              !revealed && "cursor-pointer hover:border-line-strong",
            )}
          >
            <div className="text-lg text-primary">
              <Markdown content={card.front} />
            </div>

            {revealed ? (
              <div className="mt-5 border-t border-line pt-5 anim-rise">
                <Markdown content={card.back} />
              </div>
            ) : (
              <p className="mt-5 text-xs text-tertiary">Space to reveal</p>
            )}
          </button>

          {revealed && (
            <div className="mt-4 grid grid-cols-4 gap-1.5 anim-rise">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  onClick={() => grade(g.grade)}
                  className={cn(
                    "flex flex-col items-center rounded-md border border-line bg-surface py-2 transition-colors duration-[var(--dur-fast)] hover:border-line-strong",
                    g.grade === "again" && "hover:border-[var(--danger)]",
                    g.grade === "easy" && "hover:border-[var(--success)]",
                  )}
                >
                  <span className="text-sm font-medium text-primary">{g.label}</span>
                  <span className="text-xs text-tertiary">{g.hint}</span>
                  <span className="mt-1 text-xs text-tertiary tnum">
                    {formatDue(schedule(card, g.grade).due)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center anim-fade">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ list -- */

function CardList({ cards, deckId }: { cards: Card[]; deckId: string }) {
  const [editing, setEditing] = React.useState<string | null>(null);

  const add = async () => {
    const card = newCard(deckId, "", "");
    await db.cards.add(card);
    setEditing(card.id);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        <div className="space-y-1.5">
          {cards.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              editing={editing === c.id}
              onEdit={() => setEditing(c.id)}
              onDone={() => setEditing(null)}
            />
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-3" onClick={add}>
          <Plus size={13} />
          Add a card
        </Button>
      </div>
    </div>
  );
}

function CardRow({
  card,
  editing,
  onEdit,
  onDone,
}: {
  card: Card;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [front, setFront] = React.useState(card.front);
  const [back, setBack] = React.useState(card.back);

  React.useEffect(() => {
    if (editing) {
      setFront(card.front);
      setBack(card.back);
    }
  }, [editing, card.front, card.back]);

  if (editing) {
    return (
      <div className="rounded-lg border border-accent bg-surface p-3">
        <textarea
          autoFocus
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Question"
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
        />
        <div className="my-2 h-px bg-[var(--border-subtle)]" />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Answer"
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-secondary outline-none placeholder:text-tertiary"
        />
        <div className="mt-2 flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={onDone}>
            <X size={13} />
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              await db.cards.update(card.id, { front: front.trim(), back: back.trim() });
              onDone();
            }}
          >
            <Check size={13} />
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 rounded-lg border border-line bg-surface p-3">
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm text-primary">{card.front || "Empty question"}</p>
        <p className="truncate text-sm text-secondary">{card.back || "Empty answer"}</p>
      </button>
      <span className="shrink-0 text-xs text-tertiary tnum">{formatDue(card.due)}</span>
      <IconButton
        label="Delete card"
        size={26}
        className="opacity-0 transition-opacity duration-[var(--dur-fast)] focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => db.cards.delete(card.id)}
      >
        <Trash2 size={13} />
      </IconButton>
    </div>
  );
}
