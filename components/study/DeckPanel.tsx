"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import type { Deck } from "@/lib/types";
import { addCards, cardsOf, db, deleteCard, updateCard } from "@/lib/db";
import { draftCards } from "@/lib/generate";
import { cheapestAvailable } from "@/lib/complete";
import { progressOf, whenDue, type Card } from "@/lib/study";
import { offerUndo } from "@/lib/undo";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * What is actually in a deck, and the chance to fix it.
 *
 * A model wrote these cards and some of them are wrong: an answer given
 * away inside its own question, two cards asking the same thing, a fact
 * that is not quite right. Without somewhere to look, the only remedy is
 * to throw the deck away and make another — and a deck you cannot correct
 * is one you stop trusting after the third bad card.
 *
 * So: every card, editable in place, deletable one at a time, and a way to
 * ask for more without starting again. The scheduling state is shown as
 * plain words rather than numbers, because "in 4 days" is the fact and
 * "interval 4, ease 2.5" is the implementation.
 */
export function DeckPanel({
  deck,
  configured,
  onBack,
  onStudy,
}: {
  deck: Deck;
  configured: Record<string, boolean>;
  onBack: () => void;
  onStudy: () => void;
}) {
  const cards = useLiveQuery(() => cardsOf(deck.id), [deck.id], [] as Card[]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const now = Date.now();
  const p = progressOf(cards, now);

  const more = async () => {
    const modelId = cheapestAvailable(configured);
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      /* The cards it already has go in, so the next twelve are twelve more
         rather than the same easy half again in different words. */
      const had = cards.map((c) => `- ${c.front}`).join("\n");
      const drafts = await draftCards(
        `${deck.name}\n\nCards this deck already has, which must not be repeated or reworded:\n${had}`,
        { about: deck.name, modelId },
      );
      if (!drafts) {
        setNotice("Nothing usable came back.");
        return;
      }
      const n = await addCards(deck.id, drafts, deck.source);
      setNotice(n === 0 ? "Everything it wrote was already here." : null);
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="glass safe-top sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-2 px-3 py-3">
          <button
            onClick={onBack}
            aria-label="Back to Study"
            className="ctl focus-inset flex [--ctl:2rem] shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-primary">{deck.name}</span>
            <span className="block text-xs text-tertiary tnum">
              {p.total} card{p.total === 1 ? "" : "s"} · {p.known} known
              {p.due > 0 ? ` · ${p.due} due now` : p.nextDue ? ` · next ${whenDue(p.nextDue, now)}` : ""}
            </span>
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void more()}>
            <Plus size={13} />
            {busy ? "Writing…" : "More cards"}
          </Button>
          {p.due > 0 && (
            <Button size="sm" variant="primary" onClick={onStudy}>
              Study {p.due}
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        {notice && <p className="mb-3 text-sm text-warning">{notice}</p>}
        <ul className="space-y-1.5" aria-label="Cards">
          {cards.map((c) => (
            <CardRow key={c.id} card={c} now={now} />
          ))}
        </ul>
        {cards.length === 0 && (
          <p className="mt-8 text-center text-sm text-tertiary">
            This deck is empty. Press “More cards” to write some.
          </p>
        )}
      </div>
    </div>
  );
}

/** One card: what it asks, what it answers, and when it is next due. */
function CardRow({ card, now }: { card: Card; now: number }) {
  const [editing, setEditing] = React.useState(false);
  const [front, setFront] = React.useState(card.front);
  const [back, setBack] = React.useState(card.back);

  const save = async () => {
    const f = front.trim();
    const b = back.trim();
    setEditing(false);
    if (!f || !b || (f === card.front && b === card.back)) {
      setFront(card.front);
      setBack(card.back);
      return;
    }
    await updateCard(card.id, { front: f, back: b });
  };

  return (
    <li className="group rounded-lg border border-line bg-surface px-3 py-2.5">
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={front}
            onChange={(e) => setFront(e.target.value)}
            aria-label="Question"
            rows={2}
            className="focus-inset w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-primary outline-none"
          />
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            aria-label="Answer"
            rows={2}
            className="focus-inset w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-secondary outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setFront(card.front); setBack(card.back); setEditing(false); }}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            onClick={() => setEditing(true)}
            className="focus-inset min-w-0 flex-1 rounded-md text-left"
            aria-label={`Edit “${card.front.slice(0, 40)}”`}
          >
            <span className="block text-sm text-primary">{card.front}</span>
            <span className="mt-0.5 block text-sm text-tertiary">{card.back}</span>
          </button>
          <span className="shrink-0 text-xs text-faint tnum">
            {card.state === "new" ? "new" : whenDue(card.due, now)}
          </span>
          <button
            onClick={async () => offerUndo("that card", await deleteCard(card.id))}
            aria-label={`Delete “${card.front.slice(0, 40)}”`}
            className={cn(
              "ctl reveal flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-sm text-tertiary",
              "hover:bg-subtle hover:text-[var(--danger)]",
            )}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
}
