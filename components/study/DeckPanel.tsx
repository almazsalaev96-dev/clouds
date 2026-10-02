"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ClipboardPaste, Download, Gamepad2, Plus, Repeat, Settings2, Trash2 } from "lucide-react";
import type { Deck } from "@/lib/types";
import { addCards, cardsOf, db, deleteCard, importCards, updateCard } from "@/lib/db";
import { draftCards } from "@/lib/generate";
import { cheapestAvailable, whyItFailed } from "@/lib/complete";
import { DESIRED_RETENTION, NEW_PER_DAY, readiness, clozeQuestion, exportCards, isCloze, progressOf, whenDue, type Card } from "@/lib/study";
import { offerUndo } from "@/lib/undo";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { RoomToggle } from "@/components/ui/RoomToggle";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { TestMode } from "@/components/study/TestMode";
import { Games } from "@/components/study/Games";

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
  onCram,
  onReview,
}: {
  deck: Deck;
  configured: Record<string, boolean>;
  onBack: () => void;
  onStudy: () => void;
  /** Every card, regardless of the schedule, and the schedule untouched. */
  onCram: () => void;
  /** Study exactly these, in this order — the ones a test got wrong. */
  onReview?: (cardIds: string[]) => void;
}) {
  const [testing, setTesting] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const stored = useLiveQuery(() => cardsOf(deck.id), [deck.id], [] as Card[]);
  /* In the order they matter, not the order the database keeps them. The
     index is by id, and ids sort as text — a deck of numbered cards came out
     q0, q1, q10, q11, q12 — which is no order at all to a person. Soonest
     due first, so what is waiting is at the top, and the ones never yet
     seen at the end. */
  const cards = React.useMemo(
    () => [...stored].sort((a, b) => (a.state === "new") === (b.state === "new") ? a.due - b.due : a.state === "new" ? 1 : -1),
    [stored],
  );
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState("");

  const paste = async () => {
    const text = pasted.trim();
    if (!text) return;
    const { added, skipped } = await importCards(deck.id, text);
    setNotice(
      added
        ? `${added} card${added === 1 ? "" : "s"} added${skipped ? ` · ${skipped} line${skipped === 1 ? "" : "s"} skipped` : ""}`
        : "Nothing on those lines could be read as a card.",
    );
    if (added) {
      setPasted("");
      setPasting(false);
    }
  };

  /* The deck as a file, in the form that reads back in here and into the
     tools people came from. A deck you cannot take with you is a deck that
     belongs to the app rather than to the person who made it. */
  const download = () => {
    const blob = new Blob([exportCards(cards)], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/[^\w-]+/g, "-").toLowerCase() || "deck"}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const now = Date.now();
  const p = progressOf(cards, now);
  const roomModel = useReviseModel(configured);

  const more = async () => {
    const modelId = roomModel ?? cheapestAvailable(configured);
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
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = React.useContext(RoomToggle);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="glass safe-top sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-2 px-3 py-3">
          {toggle && <div className="has-room-toggle -ml-1">{toggle}</div>}
          <button
            onClick={onBack}
            aria-label="Back to Study"
            className="ctl focus-inset flex [--ctl:2rem] shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-0 flex-1" />
          <RevisePicker configured={configured} />
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void more()}>
            <Plus size={13} />
            {busy ? "Writing…" : "More cards"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPasting((v) => !v)} aria-label="Paste cards in">
            <ClipboardPaste size={13} />
          </Button>
          {cards.length > 0 && (
            <Button size="sm" variant="ghost" onClick={download} aria-label="Download the deck">
              <Download size={13} />
            </Button>
          )}
          {/* The night before. Everything, the ones you have forgotten most
              first, and the schedule left exactly as it was. */}
          {cards.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onCram} aria-label="Practise every card">
              <Repeat size={13} />
              Practise
            </Button>
          )}
          {/* Recall, written down: ten questions answered in a box and
              marked, the exam's own shape rather than a card's. */}
          {/* Games from the same cards — Match, Quick-fire, Gravity — for
              the evening a review queue is empty and the deck still wants
              going over. */}
          {cards.length >= 2 && (
            <Button size="sm" variant="ghost" onClick={() => { setTesting(false); setPlaying(true); }} aria-label="Play a game">
              <Gamepad2 size={13} />
              Play
            </Button>
          )}
          {cards.length >= 3 && (
            <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); setTesting(true); }} aria-label="Test me on this deck">
              Test me
            </Button>
          )}
          {p.due > 0 && (
            <Button size="sm" variant="primary" onClick={onStudy}>
              Study {p.due}
            </Button>
          )}
        </div>
      </header>
      {/* The deck's name set large under the toolbar, the way every room's
          page opens now — a project, a notebook — with what it holds in one
          line under it. It sat in the toolbar at 14px between the back
          chevron and six buttons, which is where a label goes, not a name. */}
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-2 pt-5">
        <h1 className="title-field text-primary">{deck.name}</h1>
        <p className="mt-1 text-base text-tertiary tnum">
          {p.total} card{p.total === 1 ? "" : "s"} · {p.known} known
          {p.due > 0 ? ` · ${p.due} due now` : p.nextDue ? ` · next ${whenDue(p.nextDue, now)}` : ""}
          {(() => { const r = readiness(cards, now); return r.score === null ? null : <> · <span className="text-secondary">{Math.round(r.score * 100)}% ready</span></>; })()}
        </p>
      </div>

      {playing ? (
        <Games
          deck={deck}
          cards={cards}
          onDone={() => setPlaying(false)}
          onReview={(ids) => { setPlaying(false); onReview?.(ids); }}
        />
      ) : testing ? (
        <TestMode
          cards={cards}
          now={now}
          onDone={() => setTesting(false)}
          onReview={(ids) => { setTesting(false); onReview?.(ids); }}
        />
      ) : (
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        {pasting && (
          <div className="mb-3 rounded-lg border border-line bg-surface p-2.5">
            <textarea
              autoFocus
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              aria-label="Cards to paste"
              placeholder={"One card a line:\nWhat is a debounce :: Waiting for silence\nThe {{mitochondria}} is the powerhouse of the cell\nquestion<tab>answer, or question,answer"}
              className="focus-inset w-full resize-y rounded-md border border-line bg-field px-2.5 py-1.5 font-mono text-xs text-primary outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setPasting(false); setPasted(""); }}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={!pasted.trim()} onClick={() => void paste()}>Add them</Button>
            </div>
          </div>
        )}
        {notice && <p className="mb-3 text-sm text-warning">{notice}</p>}
        <DeckOptions deck={deck} />
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
      )}
    </div>
  );
}

/**
 * The two dials a deck has of its own, closed by default.
 *
 * How many new cards a day decides how fast the pile grows — twenty is
 * the app's number and right for a subject with months to go; a deck
 * for an exam next week wants more, a language deck kept for years
 * wants fewer. Retention is how sure the schedule is made to be that a
 * card comes back remembered: higher means more reviews, sooner. Both
 * are the deck's, because the right number is a fact about the deck
 * and not about the person.
 */
function DeckOptions({ deck }: { deck: Deck }) {
  const [open, setOpen] = React.useState(false);
  const newPerDay = deck.newPerDay ?? NEW_PER_DAY;
  const retention = Math.round((deck.retention ?? DESIRED_RETENTION) * 100);
  const set = (patch: Partial<Deck>) => void db.decks.update(deck.id, patch);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-inset flex items-center gap-1.5 rounded-md text-xs text-tertiary hover:text-primary"
      >
        <Settings2 size={13} />
        Deck options
        <span className="text-faint">· {newPerDay} new a day · {retention}% retention</span>
      </button>
      {open && (
        <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 anim-fade" role="group" aria-label="Deck options">
          <label className="block text-sm">
            <span className="text-secondary">New cards a day</span>
            <input
              type="number"
              min={0}
              max={200}
              value={newPerDay}
              onChange={(e) => { const n = Math.max(0, Math.min(200, Math.round(Number(e.target.value) || 0))); set({ newPerDay: n === NEW_PER_DAY ? undefined : n }); }}
              className="focus-inset rounded-md border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none mt-1 h-9 w-full"
              aria-label="New cards a day"
            />
            <span className="mt-1 block text-xs text-tertiary">Cards never seen that a day may start. Due ones are never capped.</span>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Retention</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={70}
                max={97}
                value={retention}
                onChange={(e) => { const r = Number(e.target.value) / 100; set({ retention: Math.abs(r - DESIRED_RETENTION) < 0.001 ? undefined : r }); }}
                className="w-full"
                aria-label="Retention"
              />
              <span className="tnum w-10 text-right text-sm text-primary">{retention}%</span>
            </span>
            <span className="mt-1 block text-xs text-tertiary">How sure to be a card comes back remembered. Higher means more reviews, sooner.</span>
          </label>
        </div>
      )}
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
            className="focus-inset w-full resize-none rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-primary outline-none"
          />
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            aria-label="Answer"
            rows={2}
            className="focus-inset w-full resize-none rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-secondary outline-none"
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
            <span className="block text-sm text-primary">{isCloze(card.front) ? clozeQuestion(card.front) : card.front}</span>
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
