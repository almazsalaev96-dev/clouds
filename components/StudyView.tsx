"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, GraduationCap, MessageSquare, Trash2 } from "lucide-react";
import type { Deck } from "@/lib/types";
import { addCards, cardsOf, createDeck, db, deleteDeck, answerCard } from "@/lib/db";
import { draftCards } from "@/lib/generate";
import { cheapestAvailable } from "@/lib/complete";
import { answeredToday, dueNow, progressOf, previewGaps, whenDue, type Card, type Rating } from "@/lib/study";
import { offerUndo } from "@/lib/undo";
import { Button } from "@/components/ui/primitives";
import { MessageBar } from "@/components/chat/MessageBar";
import { DeckPanel } from "@/components/study/DeckPanel";
import { cn } from "@/lib/utils";

/**
 * The room where you are asked again.
 *
 * Every assistant will write you flashcards. None of them will ask you for
 * them next Tuesday, because a conversation has nowhere to keep the answer
 * you got wrong. This app does, so this room is the one thing here that a
 * chat window structurally cannot be.
 *
 * It is deliberately one room. An earlier version of this app had three —
 * decks, cards and practice — and they were dropped for being more sidebar
 * than the activity was getting used. The lesson was about the number of
 * doors, not the idea. So: a list of what you are learning, a number of
 * cards waiting, and a button that starts asking. Nothing else.
 */
export function StudyView({
  configured,
  onFocus,
  onAsk,
}: {
  configured: Record<string, boolean>;
  /** Raised while a session has the window: the app gets out of the way. */
  onFocus?: (on: boolean) => void;
  /**
   * Take a card to the chat and ask about it.
   *
   * The thing a deck of cards has never been able to do and this app can:
   * when you get one wrong, the explanation is one press away instead of a
   * separate search in a separate place.
   */
  onAsk?: (question: string) => void;
}) {
  const decks = useLiveQuery(() => db.decks.orderBy("updatedAt").reverse().toArray(), [], [] as Deck[]);
  const cards = useLiveQuery(() => db.cards.toArray(), [], [] as Card[]);
  const [session, setSession] = React.useState<{ deckId: string | null } | null>(null);
  const [openDeck, setOpenDeck] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  /* A clock that ticks, so "3 due" becomes "4 due" while the page is open
     rather than the next time somebody navigates — and that is also read
     again the moment the cards change. Without that second half, a deck
     made ten seconds after the page opened was counted against the time
     the page opened, and every card in it read as not yet due: the room
     said "Done" about a deck nobody had touched. */
  const tick = useNow(session ? 1_000 : 20_000);
  const now = React.useMemo(() => Date.now(), [tick, cards]);

  React.useEffect(() => {
    onFocus?.(Boolean(session));
    return () => onFocus?.(false);
  }, [session, onFocus]);

  const make = async () => {
    const about = subject.trim();
    if (!about || busy) return;
    const modelId = cheapestAvailable(configured);
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const drafts = await draftCards(about, { about, modelId });
      if (!drafts) {
        setNotice("Nothing usable came back. Try naming the subject more narrowly.");
        return;
      }
      const deck = await createDeck(about, "typed");
      await addCards(deck.id, drafts, "typed");
      setSubject("");
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    const pool = session.deckId ? cards.filter((c) => c.deckId === session.deckId) : cards;
    return (
      <Session
        cards={pool}
        title={session.deckId ? decks.find((d) => d.id === session.deckId)?.name ?? "Studying" : "Everything due"}
        onLeave={() => setSession(null)}
        onAsk={onAsk}
      />
    );
  }

  const deck = openDeck ? decks.find((d) => d.id === openDeck) : undefined;
  if (deck) {
    return (
      <DeckPanel
        deck={deck}
        configured={configured}
        onBack={() => setOpenDeck(null)}
        onStudy={() => { setOpenDeck(null); setSession({ deckId: deck.id }); }}
      />
    );
  }

  const due = dueNow(cards, now).length;
  const today = answeredToday(cards, now);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="glass safe-top sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-primary">Study</h1>
          {due > 0 && <span className="tnum text-sm text-accent">{due} due</span>}
          {/* What you have already done, which is the half that keeps
              anybody coming back. Only once there is something to say. */}
          {today > 0 && (
            <span className="tnum text-sm text-tertiary">{today} answered today</span>
          )}
          {due > 0 && (
            <Button size="sm" variant="primary" className="bloom ml-auto" onClick={() => setSession({ deckId: null })}>
              Start
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        {/* The way in. A subject, and a deck a few seconds later — this is
            the part every assistant is already good at, so it is one line
            rather than a form. */}
        <MessageBar
          value={subject}
          onChange={setSubject}
          onSubmit={make}
          placeholder="What are you learning? — “the French Revolution”, “React hooks”, “kanji N5”"
          ariaLabel="What to study"
          canSend={Boolean(subject.trim()) && !busy}
          busy={busy}
          className="glass"
        />
        {busy && <p className="sheen mt-2 text-sm font-medium">Writing the cards</p>}
        {notice && <p className="mt-2 text-sm text-warning">{notice}</p>}

        {decks.length === 0 && !busy ? (
          <div className="mt-10 text-center">
            <GraduationCap size={22} className="mx-auto text-tertiary" />
            <p className="mt-2 text-base text-primary">Nothing to study yet.</p>
            <p className="mx-auto mt-1 max-w-prose text-sm text-secondary">
              Name a subject above, or press “Make cards from this” under any answer. Cards come
              back on a schedule: a minute later, ten minutes later, then days apart, and sooner
              again whenever you get one wrong.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-1.5" aria-label="Decks">
            {decks.map((d) => {
              const mine = cards.filter((c) => c.deckId === d.id);
              const p = progressOf(mine, now);
              return (
                <li
                  key={d.id}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
                >
                  <button
                    onClick={() => setOpenDeck(d.id)}
                    className="focus-inset min-w-0 flex-1 rounded-md text-left"
                    aria-label={`Open ${d.name}`}
                  >
                    <span className="block truncate text-sm font-medium text-primary">{d.name}</span>
                    <span className="block text-xs text-tertiary tnum">
                      {p.total} card{p.total === 1 ? "" : "s"} · {p.known} known
                      {p.due > 0
                        ? ` · ${p.due} due now`
                        : p.nextDue
                          ? ` · next ${whenDue(p.nextDue, now)}`
                          : ""}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant={p.due > 0 ? "primary" : "ghost"}
                    disabled={p.due === 0}
                    onClick={() => setSession({ deckId: d.id })}
                  >
                    {p.due > 0 ? `Study ${p.due}` : "Done"}
                  </Button>
                  <button
                    onClick={async () => offerUndo(d.name, await deleteDeck(d.id))}
                    aria-label={`Delete ${d.name}`}
                    className="ctl reveal flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-[var(--danger)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Being asked.
 *
 * One card at a time, the answer hidden until you have tried to remember
 * it — which is the whole mechanism. A card you read the answer to is a
 * card you have not been tested on, so the reveal is a deliberate act and
 * the keyboard does it: space to show, then one to four.
 */
function Session({
  cards,
  title,
  onLeave,
  onAsk,
}: {
  cards: Card[];
  title: string;
  onLeave: () => void;
  onAsk?: (question: string) => void;
}) {
  const [shown, setShown] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const now = useNow(1_000);
  const queue = React.useMemo(() => dueNow(cards, now), [cards, now]);
  const card = queue[0];

  const answer = React.useCallback(
    async (rating: Rating) => {
      if (!card) return;
      setShown(false);
      setDone((n) => n + 1);
      await answerCard(card, rating);
    },
    [card],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return onLeave();
      if (!card) return;
      if (!shown && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setShown(true);
        return;
      }
      if (shown) {
        const r = { "1": "again", "2": "hard", "3": "good", "4": "easy" }[e.key] as Rating | undefined;
        if (r) {
          e.preventDefault();
          void answer(r);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, card, answer, onLeave]);

  const gaps = card ? previewGaps(card, now) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="glass safe-top sticky top-0 z-10 flex h-[var(--topbar-h)] shrink-0 items-center gap-2 border-b border-line px-3 relative">
        <button
          onClick={onLeave}
          aria-label="Leave the session"
          className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-secondary">{title}</span>
        <span className="tnum shrink-0 text-xs text-tertiary">
          {queue.length} left{done > 0 ? ` · ${done} done` : ""}
        </span>
        {/* How far through, as a line rather than a fraction. A session
            with no visible end is one people leave in the middle. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--border-subtle)]"
        >
          <span
            className="block h-full bg-accent transition-[width] duration-[var(--dur-layout)] ease-[var(--ease-out)]"
            style={{ width: `${Math.round((done / Math.max(1, done + queue.length)) * 100)}%` }}
          />
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        {!card ? (
          <div className="text-center" role="status">
            <p className="text-xl text-primary">Nothing left for now.</p>
            <p className="mx-auto mt-1.5 max-w-prose text-sm text-secondary">
              {done > 0
                ? `${done} card${done === 1 ? "" : "s"} answered. The ones you found hard come back within the hour; the rest in a day or more.`
                : "Everything here is scheduled for later."}
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={onLeave}>
              Back to Study
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-[var(--measure)]">
            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <p className="text-center text-xl leading-snug text-primary sm:text-2xl">{card.front}</p>
              {shown && (
                <>
                  <hr className="my-5 border-0 border-t border-line" />
                  <p className="anim-fade whitespace-pre-wrap text-center text-lg leading-relaxed text-secondary">
                    {card.back}
                  </p>
                </>
              )}
            </div>

            {!shown ? (
              <div className="mt-5 flex justify-center">
                <Button variant="primary" className="bloom" onClick={() => setShown(true)}>
                  Show answer
                </Button>
              </div>
            ) : (
              /* Four buttons and what each one costs, said before it is
                 pressed. A scheduler nobody can see the consequences of is
                 one people fight rather than use. */
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How did it go">
                {([
                  ["again", "Again", "var(--danger)"],
                  ["hard", "Hard", "var(--warning)"],
                  ["good", "Good", "var(--accent-fill)"],
                  ["easy", "Easy", "var(--ok, var(--success))"],
                ] as [Rating, string, string][]).map(([r, label], i) => (
                  <button
                    key={r}
                    onClick={() => void answer(r)}
                    className="tap focus-inset flex flex-col items-center gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:bg-subtle"
                  >
                    <span className="text-sm font-medium text-primary">
                      {label} <span className="text-tertiary">{i + 1}</span>
                    </span>
                    <span className="text-xs text-tertiary tnum">{gaps?.[r]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* The move a deck of cards has never had. You got it wrong,
                and the explanation is one press away rather than a search
                somewhere else — which is the whole reason for a deck that
                lives inside an assistant rather than beside one. */}
            {shown && onAsk && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() =>
                    onAsk(
                      `I am studying ${title}. I was asked: “${card.front}”\n\nThe answer given was: “${card.back}”\n\nExplain it so it sticks — why that is the answer, and the thing people get wrong about it.`,
                    )
                  }
                  className="focus-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <MessageSquare size={12} />
                  Explain this
                </button>
              </div>
            )}

            <p className={cn("mt-3 text-center text-xs text-faint", shown ? "" : "opacity-70")}>
              {shown ? "1 – 4 to answer · Esc to leave" : "Space to show the answer"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** A clock that ticks, so "due in a minute" becomes "due" without a reload. */
function useNow(everyMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
