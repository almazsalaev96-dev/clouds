"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Flame, Keyboard, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { mark, type Mark } from "@/lib/grade";
import { weakestDeck } from "@/lib/plan";
import type { Deck } from "@/lib/types";
import { addCards, createDeck, db, deleteCard, deleteDeck, answerCard, importCards, noteStudied, updateCard } from "@/lib/db";
import { draftCards } from "@/lib/generate";
import { cheapestAvailable } from "@/lib/complete";
import {
  answeredToday, clozeAnswer, clozeHidden, clozeQuestion, cramOrder, dueNow, isCloze, progressOf, previewGaps, streakOf, whenDue,
  type Card, type Rating, type StudyDay,
} from "@/lib/study";
import { offerUndo } from "@/lib/undo";
import { Button } from "@/components/ui/primitives";
import { MessageBar } from "@/components/chat/MessageBar";
import { DeckPanel } from "@/components/study/DeckPanel";
import { SectionIndex } from "@/components/SectionIndex";
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
  const days = useLiveQuery(() => db.studyDays.toArray(), [], [] as StudyDay[]);
  /**
   * What is being asked, and on what terms.
   *
   * `due` is the schedule doing its job. `cram` is the night before: every
   * card in the deck, the ones you have forgotten most first, and nothing
   * you answer moves anything — the schedule made a promise about when each
   * card comes back, and a run-through does not get to break it.
   */
  const [session, setSession] = React.useState<{ deckId: string | null; mode: "due" | "cram" } | null>(null);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState("");
  const [openDeck, setOpenDeck] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  /* "New deck" puts the caret in the line that makes one. Bumping this is
     how the shared index asks for that, since there is no such thing as an
     empty deck worth creating. */
  const [focusKey, setFocusKey] = React.useState("");
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

  /* The other way in, and the one that asks nothing of a model: a list
     from a glossary, an export from the tool somebody used before this one,
     cloze sentences typed by hand. Named after the first line unless the
     subject line has something in it. */
  const paste = async () => {
    const text = pasted.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const name = subject.trim() || text.split("\n")[0].split(/::|\t|,/)[0].trim().slice(0, 60) || "Pasted cards";
      const deck = await createDeck(name, "pasted");
      const { added, skipped } = await importCards(deck.id, text);
      if (!added) {
        await deleteDeck(deck.id);
        setNotice("Nothing on those lines could be read as a card. One card a line: “question :: answer”, or a sentence with the answer in {{braces}}.");
        return;
      }
      setNotice(skipped ? `${added} card${added === 1 ? "" : "s"} made · ${skipped} line${skipped === 1 ? "" : "s"} skipped` : null);
      setPasted("");
      setSubject("");
      setPasting(false);
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    const pool = session.deckId ? cards.filter((c) => c.deckId === session.deckId) : cards;
    return (
      <Session
        cards={pool}
        mode={session.mode}
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
        onStudy={() => { setOpenDeck(null); setSession({ deckId: deck.id, mode: "due" }); }}
        onCram={() => { setOpenDeck(null); setSession({ deckId: deck.id, mode: "cram" }); }}
      />
    );
  }

  const due = dueNow(cards, now).length;
  const today = answeredToday(cards, now);
  const streak = streakOf(days, now);
  /* Where the trouble is, from the cards' own memory model: the deck most
     likely to be forgotten right now, offered as a practice run. Not a
     hook: this line sits below the early returns for a session and an open
     deck, and a hook here changes the hook count the moment one starts. */
  const weakest = weakestDeck(cards, now);
  const weakDeck = weakest ? decks.find((d) => d.id === weakest.deckId) : undefined;

  /* The same chrome as the Notebook, the Artifacts and the Projects.
     This room was written last and grew its own header — a different title
     size, a different empty state, its own row shape, no search — so the one
     section a student lives in was the one that looked like it came from
     another app. Everything specific to studying is in the lead: the line
     that makes a deck, and what is waiting today. */
  return (
    <SectionIndex
      title="Study"
      newLabel="New deck"
      loading={decks === undefined}
      emptyTitle="Nothing to study yet."
      emptyHint="Name a subject above, or press “Make cards from this” under any answer. Cards come back on a schedule: a minute later, ten minutes later, then days apart, and sooner again whenever you get one wrong."
      items={(decks ?? []).map((d) => {
        const mine = cards.filter((c) => c.deckId === d.id);
        const p = progressOf(mine, now);
        return {
          id: d.id,
          title: d.name,
          preview:
            `${p.total} card${p.total === 1 ? "" : "s"} · ${p.known} known` +
            (p.due > 0 ? "" : p.nextDue ? ` · next ${whenDue(p.nextDue, now)}` : " · nothing waiting"),
          /* The number that decides whether you open it, in the one place
             this list puts a number that decides anything. */
          badge: p.due > 0 ? `${p.due} due` : undefined,
          searchText: mine.map((c) => `${c.front} ${c.back}`).join(" "),
        };
      })}
      onOpen={(id: string) => setOpenDeck(id)}
      /* There is no such thing as an empty deck worth having, so "New deck"
         puts the cursor where a deck is actually made rather than creating a
         row somebody then has to fill or delete. */
      onNew={() => setFocusKey(String(Date.now()))}
      onDelete={(id: string) => {
        const d = (decks ?? []).find((x) => x.id === id);
        if (d) void (async () => offerUndo(d.name, await deleteDeck(d.id)))();
      }}
      lead={
        <div className="mb-4">
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
            focusKey={focusKey}
          />
          {/* Or hand it a list. Hidden until asked for: the line above is the
              way in for most people most of the time, and a second box under
              it every time would make the room a form. */}
          {pasting ? (
            <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
              <textarea
                autoFocus
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
                aria-label="Cards to paste"
                placeholder={"One card a line:\nWhat is a debounce :: Waiting for silence\nThe {{mitochondria}} is the powerhouse of the cell\nquestion<tab>answer, or question,answer"}
                className="focus-inset w-full resize-y rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs text-primary outline-none"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setPasting(false); setPasted(""); }}>Cancel</Button>
                <Button size="sm" variant="primary" disabled={!pasted.trim() || busy} onClick={() => void paste()}>
                  Make the deck
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPasting(true)}
              className="focus-inset mt-1.5 rounded-sm text-xs text-tertiary hover:text-primary hover:underline"
            >
              …or paste a list of cards
            </button>
          )}
          {busy && !pasting && <p className="sheen mt-2 text-sm font-medium">Writing the cards</p>}
          {notice && <p className="mt-2 text-sm text-warning">{notice}</p>}

          {/* What is waiting, and the one press that clears it. Everything
              due across every deck, because "study for ten minutes" is the
              thing somebody actually sits down to do. */}
          {due > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm text-primary">
                <span className="tnum font-medium text-accent">{due}</span> waiting now
                {today > 0 && (
                  <span className="text-tertiary"> · {today} answered today</span>
                )}
              </span>
              <Button size="sm" variant="primary" className="bloom" onClick={() => setSession({ deckId: null, mode: "due" })}>
                Start
              </Button>
            </div>
          )}
          {due === 0 && today > 0 && (
            <p className="mt-3 text-sm text-tertiary tnum">
              {today} answered today · nothing else waiting.
            </p>
          )}
          {/* Days in a row. The one number that is about the person rather
              than the cards, and the reason somebody opens this room on a
              day nothing is due. Counted from the log, not from the cards:
              a card keeps only its last answer and forgets the day before. */}
          {weakest && weakDeck && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary tnum" aria-label={`Shakiest deck: ${weakDeck.name}`}>
              <span>
                Shakiest: <span className="text-secondary">{weakDeck.name}</span> — {weakest.shaky} of {weakest.reviewed} likely forgotten
              </span>
              <button
                onClick={() => setSession({ deckId: weakDeck.id, mode: "cram" })}
                className="btn-touch press rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                Practise it
              </button>
            </p>
          )}
          {streak > 1 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-tertiary tnum" aria-label={`${streak} days in a row`}>
              <Flame size={12} className="text-[var(--accent-2)]" />
              {streak} days in a row
            </p>
          )}
        </div>
      }
    />
  );
}

/**
 * Being asked.
 *
 * One card at a time, the answer hidden until you have tried to remember
 * it — which is the whole mechanism. A card you read the answer to is a
 * card you have not been tested on, so the reveal is a deliberate act and
 * the keyboard does it: space to show, then one to four.
 *
 * Two kinds of card, drawn differently. A question-and-answer card shows the
 * question and then the answer. A cloze card shows its sentence with a hole
 * in it, and then the same sentence whole with the missing word marked —
 * the answer *in its place*, which is what makes a cloze worth having.
 */
function Session({
  cards,
  mode,
  title,
  onLeave,
  onAsk,
}: {
  cards: Card[];
  /** The schedule's queue, or every card regardless of it. */
  mode: "due" | "cram";
  title: string;
  onLeave: () => void;
  onAsk?: (question: string) => void;
}) {
  const [shown, setShown] = React.useState(false);
  const [done, setDone] = React.useState(0);
  /* How it went, by answer, for the line at the end. A session that ends
     with "nothing left" and no account of itself is one that leaves
     nobody knowing whether it went well. */
  const [tally, setTally] = React.useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [editing, setEditing] = React.useState(false);
  /**
   * Write mode: type what you remember, then see.
   *
   * Recalling a word is a different act from recognising it, and the
   * difference is most of what an exam tests. The marker is forgiving where
   * it should be — case, articles, a slipped letter — and never has the last
   * word: it suggests a button, and the person presses whichever is true.
   */
  const [typing, setTyping] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [verdict, setVerdict] = React.useState<{ mark: Mark; why: string } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const now = useNow(1_000);
  /* In practice the order is fixed at the start and walked once, since
     nothing answered changes when anything comes back. The schedule's queue
     re-reads the clock every second, because a card answered "again" is
     due again in a minute and should turn up at the end of the same sitting. */
  const [walk, setWalk] = React.useState<string[]>(() => (mode === "cram" ? cramOrder(cards).map((c) => c.id) : []));
  const queue = React.useMemo(() => {
    if (mode === "cram") return walk.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => Boolean(c));
    return dueNow(cards, now);
  }, [cards, now, mode, walk]);
  const card = queue[0];

  const answer = React.useCallback(
    async (rating: Rating) => {
      if (!card) return;
      setShown(false);
      setEditing(false);
      setTyped("");
      setVerdict(null);
      setDone((n) => n + 1);
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      if (mode === "cram") {
        /* Counted as studying — it is — and nothing else. The card's own
           schedule is left exactly where it was. */
        setWalk((w) => w.slice(1));
        await noteStudied(rating);
      } else {
        await answerCard(card, rating);
      }
    },
    [card, mode],
  );

  /* Checked, then shown. The typed answer is marked against the back — or,
     for a cloze, against what was hidden — and the verdict picks a button
     without pressing it. */
  const submitTyped = () => {
    if (!card) return;
    /* A cloze is marked against what was hidden — any one hole, where the
       sentence has several, since the question showed them all as blanks. */
    const expected = isCloze(card.front) ? clozeHidden(card.front).split(" · ").join(" / ") : card.back;
    setVerdict(mark(typed, expected));
    setShown(true);
  };
  const suggested: Rating | null = verdict ? (verdict.mark === "right" ? "good" : verdict.mark === "close" ? "hard" : "again") : null;

  React.useEffect(() => {
    if (typing && !shown) inputRef.current?.focus();
  }, [typing, shown, card]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || editing) return;
      if (e.key === "Escape") return onLeave();
      if (!card) return;
      /* While typing, the box has the keys: Enter checks, and the digits are
         digits. Once the answer is shown the buttons take over again. */
      if (typing && !shown) return;
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
  }, [shown, card, answer, onLeave, editing, typing]);

  const gaps = card ? previewGaps(card, now) : null;
  const cloze = card ? isCloze(card.front) : false;

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
        <span className="min-w-0 flex-1 truncate text-sm text-secondary">
          {title}
          {mode === "cram" && <span className="text-tertiary"> · practice</span>}
        </span>
        <span className="tnum shrink-0 text-xs text-tertiary">
          {queue.length} left{done > 0 ? ` · ${done} done` : ""}
        </span>
        <button
          onClick={() => { setTyping((v) => !v); setTyped(""); setVerdict(null); }}
          aria-pressed={typing}
          aria-label="Type the answer"
          title="Type the answer before seeing it"
          className={cn(
            "ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)]",
            typing ? "bg-accent-subtle text-accent" : "text-tertiary hover:bg-subtle hover:text-primary",
          )}
        >
          <Keyboard size={15} />
        </button>
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
                ? mode === "cram"
                  ? `${done} card${done === 1 ? "" : "s"} practised. Nothing about when they come back has changed.`
                  : `${done} card${done === 1 ? "" : "s"} answered. The ones you found hard come back within the hour; the rest in a day or more.`
                : "Everything here is scheduled for later."}
            </p>
            {done > 0 && (
              /* The account of itself. Right first time is the number that
                 tells somebody whether the deck is learned or being learned. */
              <p className="mt-3 text-sm text-tertiary tnum" aria-label="How the session went">
                <span className="text-primary">{tally.good + tally.easy}</span> of {done} right first time
                {tally.again > 0 && <> · <span className="text-warning">{tally.again}</span> to see again</>}
              </p>
            )}
            <Button size="sm" variant="secondary" className="mt-4" onClick={onLeave}>
              Back to Study
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-[var(--measure)]">
            {editing ? (
              <EditCard card={card} onDone={() => setEditing(false)} />
            ) : (
              <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
                <p className="text-center text-xl leading-snug text-primary sm:text-2xl">
                  {cloze ? clozeQuestion(card.front) : card.front}
                </p>
                {shown && (
                  <>
                    <hr className="my-5 border-0 border-t border-line" />
                    {verdict && (
                      <p
                        role="status"
                        className={cn(
                          "mb-2 text-center text-xs font-medium",
                          verdict.mark === "right" ? "text-[var(--ok,var(--success))]" : verdict.mark === "close" ? "text-warning" : "text-[var(--danger)]",
                        )}
                      >
                        {verdict.mark === "right" ? "Right" : verdict.mark === "close" ? `Close — ${verdict.why}` : "Not quite"}
                        {typed.trim() && verdict.mark !== "right" && (
                          <span className="font-normal text-tertiary"> · you wrote “{typed.trim()}”</span>
                        )}
                      </p>
                    )}
                    <p className="anim-fade whitespace-pre-wrap text-center text-lg leading-relaxed text-secondary">
                      {cloze ? <Marked text={clozeAnswer(card.front)} /> : card.back}
                    </p>
                  </>
                )}
              </div>
            )}

            {!shown ? (
              typing ? (
                <form
                  className="mt-5 flex justify-center gap-2"
                  onSubmit={(e) => { e.preventDefault(); submitTyped(); }}
                >
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    aria-label="Your answer"
                    placeholder="Type the answer…"
                    autoComplete="off"
                    className="focus-inset h-10 w-full max-w-md rounded-full border border-line bg-surface px-4 text-sm text-primary outline-none placeholder:text-tertiary"
                  />
                  <Button type="submit" variant="primary" className="bloom">Check</Button>
                </form>
              ) : (
                <div className="mt-5 flex justify-center">
                  <Button variant="primary" className="bloom" onClick={() => setShown(true)}>
                    Show answer
                  </Button>
                </div>
              )
            ) : (
              /* Four buttons and what each one costs, said before it is
                 pressed. A scheduler nobody can see the consequences of is
                 one people fight rather than use. In practice the cost is
                 nothing, and the buttons say that instead. */
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
                    aria-describedby={suggested === r ? "suggested" : undefined}
                    className={cn(
                      "tap focus-inset flex flex-col items-center gap-0.5 rounded-lg border bg-surface px-3 py-2.5 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:bg-subtle",
                      suggested === r ? "border-accent ring-1 ring-accent" : "border-line",
                    )}
                  >
                    <span className="text-sm font-medium text-primary">
                      {label} <span className="text-tertiary">{i + 1}</span>
                    </span>
                    <span className="text-xs text-tertiary tnum">{mode === "cram" ? "—" : gaps?.[r]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* The two moves a deck of cards has never had. You got it
                wrong, and the explanation is one press away rather than a
                search somewhere else. Or the card itself is wrong — the
                answer given away in the question, a fact off by one — and
                the moment you notice is now, mid-session, not later in a
                list you have to find it in. */}
            {shown && !editing && (
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {onAsk && (
                  <button
                    onClick={() =>
                      onAsk(
                        `I am studying ${title}. I was asked: “${cloze ? clozeQuestion(card.front) : card.front}”\n\nThe answer given was: “${card.back}”\n\nExplain it so it sticks — why that is the answer, and the thing people get wrong about it.`,
                      )
                    }
                    className="focus-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                  >
                    <MessageSquare size={12} />
                    Explain this
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="focus-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <Pencil size={12} />
                  Fix this card
                </button>
                <button
                  onClick={async () => {
                    setShown(false);
                    setWalk((w) => w.filter((id) => id !== card.id));
                    offerUndo("that card", await deleteCard(card.id));
                  }}
                  className="focus-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-[var(--danger)]"
                >
                  <Trash2 size={12} />
                  Drop it
                </button>
              </div>
            )}

            <p id="suggested" className={cn("mt-3 text-center text-xs text-faint", shown ? "" : "opacity-70")}>
              {shown
                ? suggested ? "The marker suggests one — press whichever is true · 1 – 4" : "1 – 4 to answer · Esc to leave"
                : typing ? "Enter to check" : "Space to show the answer"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A card, corrected where it was being asked.
 *
 * The same two boxes the deck panel offers, brought to the place the fault
 * was noticed. Saving keeps the card's schedule — a corrected answer is not
 * a new card, and somebody who knew it under the wrong wording still knows
 * it under the right one.
 */
function EditCard({ card, onDone }: { card: Card; onDone: () => void }) {
  const [front, setFront] = React.useState(card.front);
  const [back, setBack] = React.useState(card.back);
  const save = async () => {
    const f = front.trim();
    const b = back.trim();
    if (f && b && (f !== card.front || b !== card.back)) await updateCard(card.id, { front: f, back: b });
    onDone();
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label="Fix this card">
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
        className="focus-inset mt-2 w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-secondary outline-none"
      />
      <p className="mt-1.5 text-xs text-faint">A sentence with the answer in {"{{braces}}"} is asked with a hole in it.</p>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => void save()}>Save</Button>
      </div>
    </div>
  );
}

/** `**bold**` and nothing else, for the answer to a cloze. */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-primary">{p.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
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
