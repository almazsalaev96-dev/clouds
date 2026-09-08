"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight, List, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import type { Card, Deck, Grade } from "@/lib/types";
import { db, deleteDeck } from "@/lib/db";
import { GRADES, dueCount, formatDue, newCard, orderForReview, schedule } from "@/lib/study";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";

/** Each grade's colour, used only as a 2px rule above its label. */
const GRADE_SIGNAL: Record<Grade, string> = {
  again: "var(--stop)",
  hard: "var(--live)",
  good: "var(--accent)",
  easy: "var(--go)",
};

export function CardsView({
  deckId,
  onSelect,
  onNew,
  onBack,
}: {
  deckId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const decks = useLiveQuery(() => db.decks.orderBy("createdAt").reverse().toArray(), [], [] as Deck[]);
  const allCards = useLiveQuery(() => db.cards.toArray(), [], [] as Card[]);
  const deck = useLiveQuery(() => (deckId ? db.decks.get(deckId) : undefined), [deckId]);
  const cards = useLiveQuery(
    () => (deckId ? db.cards.where("deckId").equals(deckId).toArray() : []),
    [deckId],
    [] as Card[],
  );
  const [mode, setMode] = React.useState<"review" | "list">("review");
  const [reviewingAll, setReviewingAll] = React.useState(false);

  React.useEffect(() => setMode("review"), [deckId]);
  React.useEffect(() => {
    if (deckId) setReviewingAll(false);
  }, [deckId]);

  const dueEverywhere = orderForReview(allCards ?? []);

  // Reviewing is a daily habit, not a per-deck errand: what people want is one
  // queue of everything that is due, in the order they are closest to losing.
  if (!deck && reviewingAll) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DetailBar onBack={() => setReviewingAll(false)} backLabel="All decks">
          <h1 className="mr-auto truncate text-sm font-medium text-primary">Everything due</h1>
          <span className="text-xs text-tertiary tnum">
            across {new Set(dueEverywhere.map((c) => c.deckId)).size} deck
            {new Set(dueEverywhere.map((c) => c.deckId)).size === 1 ? "" : "s"}
          </span>
        </DetailBar>
        <Review cards={allCards ?? []} />
      </div>
    );
  }

  if (!deck) {
    return (
      <SectionIndex
        title="Cards"
        newLabel="New deck"
        emptyTitle="No decks yet."
        emptyHint="Turn a note or a conversation into a deck, then review it on a spaced schedule — the interval stretches every time you get one right."
        items={(decks ?? []).map((d) => {
          const own = (allCards ?? []).filter((c) => c.deckId === d.id);
          const due = dueCount(own);
          return {
            id: d.id,
            title: d.title || "Untitled deck",
            meta: `${own.length} card${own.length === 1 ? "" : "s"}`,
            preview: own[0]?.front,
            searchText: own.map((c) => `${c.front} ${c.back}`).join(" "),
            badge: due > 0 ? String(due) : undefined,
          };
        })}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={(id) => void deleteDeck(id)}
        lead={
          dueEverywhere.length > 0 ? (
            <button
              onClick={() => setReviewingAll(true)}
              className="group mb-3 flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-accent"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
                <Sparkles size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-primary">
                  {dueEverywhere.length} card{dueEverywhere.length === 1 ? "" : "s"} due today
                </span>
                <span className="block text-xs text-secondary">
                  Across {new Set(dueEverywhere.map((c) => c.deckId)).size} deck
                  {new Set(dueEverywhere.map((c) => c.deckId)).size === 1 ? "" : "s"} — review them in one pass.
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-tertiary transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
            </button>
          ) : null
        }
      />
    );
  }

  const due = dueCount(cards ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All decks">
        <h1 className="mr-auto truncate text-sm font-medium text-primary">{deck.title}</h1>
        <span className="text-xs text-tertiary tnum">
          {(cards ?? []).length} card{(cards ?? []).length === 1 ? "" : "s"}
          {due > 0 && <span className="ml-2 text-accent">{due} due</span>}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setMode(mode === "review" ? "list" : "review")}>
          {mode === "review" ? <List size={13} /> : <RotateCcw size={13} />}
          {mode === "review" ? "All cards" : "Review"}
        </Button>
      </DetailBar>

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
  /**
   * Cards failed in this session, and how far into it they may return.
   *
   * `again` writes a due date ten minutes out, which is right for tomorrow and
   * useless today: the queue is derived from the database, so the one card just
   * proved unknown vanished until the next session. Anki calls the fix learning
   * steps. Three cards is enough that the answer has left working memory and
   * short enough that the session can still close.
   */
  const relearning = React.useRef<{ id: string; readyAt: number }[]>([]);

  // The queue is recomputed from the database rather than held in state, so
  // grading a card removes it the moment it is no longer due — no stale copy,
  // no double-counting a card you already answered.
  const queue = React.useMemo(() => {
    const scheduled = orderForReview(cards);
    const seen = new Set(scheduled.map((c) => c.id));
    // Appended, not prepended: other cards should come between a lapse and its
    // second attempt, otherwise the retry only proves short-term memory.
    const returning = relearning.current
      .filter((r) => r.readyAt <= done && !seen.has(r.id))
      .map((r) => cards.find((c) => c.id === r.id))
      .filter((c): c is Card => Boolean(c));

    const list = [...scheduled, ...returning];
    if (list.length || !aheadOf) return list;
    return [...cards].sort((a, b) => a.due - b.due).slice(0, 20);
  }, [cards, aheadOf, done]);

  // Studying ahead is a decision about right now, not a mode you get stuck in:
  // once something is genuinely due again, the deck goes back to normal.
  React.useEffect(() => {
    if (aheadOf && orderForReview(cards).length > 0) setAheadOf(false);
  }, [cards, aheadOf]);

  const card = queue[0];

  const grade = React.useCallback(
    async (g: Grade) => {
      if (!card) return;
      await db.cards.put(schedule(card, g));

      relearning.current = relearning.current.filter((r) => r.id !== card.id);
      if (g === "again") {
        relearning.current.push({ id: card.id, readyAt: done + 3 });
      }

      setRevealed(false);
      setDone((d) => d + 1);
    },
    [card, done],
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
    relearning.current = [];
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
                  className="group/grade relative flex flex-col items-center overflow-hidden rounded-md border border-line bg-surface py-2 transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
                >
                  {/* A signal at hairline scale: enough to tell the four apart
                      before reading them, nowhere near enough to be a fill. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-0.5 opacity-70 transition-opacity duration-[var(--dur-fast)] group-hover/grade:opacity-100"
                    style={{ background: GRADE_SIGNAL[g.grade] }}
                  />
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
