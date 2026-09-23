"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeftRight, ChevronLeft, FileText, Flame, Gauge, Keyboard, MessageSquare, Pencil, Trash2, BookMarked } from "lucide-react";
import { mark, type Mark } from "@/lib/grade";
import { recallRate, weakestDeck, weeksOf } from "@/lib/plan";
import { Tutor } from "@/components/study/Tutor";
import { extractPdf, isPdf } from "@/lib/pdf";
import { createLesson, deleteLesson } from "@/lib/db";
import type { Deck, Lesson } from "@/lib/types";
import {
  addCards, addReverse, allCards, answerCard, attemptsSince, createDeck, db, deleteCard, deleteDeck,
  importCards, noteAttempt, noteStudied, parkCard, unanswerCard, updateCard,
} from "@/lib/db";
import { draftCards } from "@/lib/generate";
import { cheapestAvailable, whyItFailed } from "@/lib/complete";
import {
  answeredToday, calibration, calibrationLine, clozeAnswer, clozeHidden, clozeQuestion, cramOrder,
  clampRetention, dailyLoad, dueNow, isCloze, isLeech, RETENTION_CHOICES, topicKey, mistakeQueue, progressOf, previewGaps, streakOf, topicStats, weakestTopic, whenDue,
  type Attempt, type Calibration, type Card, type Rating, type StudyDay, type TopicStat,
} from "@/lib/study";
import { offerUndo } from "@/lib/undo";
import { Button } from "@/components/ui/primitives";
import { MessageBar } from "@/components/chat/MessageBar";
import { DeckPanel } from "@/components/study/DeckPanel";
import { SectionIndex } from "@/components/SectionIndex";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/store";

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
  openId,
  onFocus,
  onAsk,
  onPack,
}: {
  configured: Record<string, boolean>;
  /** A deck to open on arrival — from the palette or a link. */
  openId?: string | null;
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
  /**
   * A chapter in, a revision pack out: the organiser, the Cornell notes,
   * the exam questions, and the cards. Made in the Notebook, where pages
   * live; offered here, where the person with the exam is standing.
   */
  onPack?: () => void;
}) {
  const decks = useLiveQuery(() => db.decks.orderBy("updatedAt").reverse().toArray(), [], [] as Deck[]);
  const cards = useLiveQuery(() => db.cards.toArray(), [], [] as Card[]);
  const days = useLiveQuery(() => db.studyDays.toArray(), [], [] as StudyDay[]);
  /* Two months of answers. Bounded because nothing here reads further back
     than a month and an unbounded read of a year of studying is a stall on
     opening the room. */
  const attempts = useLiveQuery(() => attemptsSince(60), [], [] as Attempt[]);
  /**
   * What is being asked, and on what terms.
   *
   * `due` is the schedule doing its job. `cram` is the night before: every
   * card in the deck, the ones you have forgotten most first, and nothing
   * you answer moves anything — the schedule made a promise about when each
   * card comes back, and a run-through does not get to break it.
   */
  const [session, setSession] = React.useState<{
    deckId: string | null;
    mode: "due" | "cram";
    /**
     * An explicit queue, for a run that is not a deck.
     *
     * The mistake list crosses decks by construction — it is ordered by what
     * is not going in, and what is not going in does not respect the boxes
     * things were filed in.
     */
    only?: string[];
    title?: string;
  } | null>(null);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState("");
  const [openDeck, setOpenDeck] = React.useState<string | null>(null);
  const [openLesson, setOpenLesson] = React.useState<string | null>(null);
  const lessons = useLiveQuery(() => db.lessons.orderBy("updatedAt").reverse().toArray(), [], [] as Lesson[]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /* A document taken in to work through. The text is extracted once, here,
     and the bytes are kept so any page can be drawn again; a scan has no
     text and is kept anyway, because the whole point of pointing at a page
     is that it works when there is nothing to quote. */
  /* Dropping a file on the block that offers to open one is the gesture
     everybody makes; the composer has taken drops from the start and this did
     not, so a dragged PDF landed on a dead surface. Counted rather than
     boolean, because dragging over a child fires leave on the parent. */
  const [overDrop, setOverDrop] = React.useState(false);
  const dropDepth = React.useRef(0);

  const take = async (file: File) => {
    setBusy(true);
    setNotice(null);
    try {
      if (file.size > 40_000_000) {
        setNotice("That file is over 40MB — too big to keep in this browser.");
        return;
      }
      let text = "";
      let pages = 1;
      if (isPdf(file)) {
        const out = await extractPdf(file);
        text = out.text;
        pages = out.pages;
      } else if (!file.type.startsWith("image/")) {
        text = await file.text();
      }
      const lesson = await createLesson({ name: file.name, mimeType: file.type || "application/pdf", bytes: file, text, pages });
      setOpenLesson(lesson.id);
    } catch {
      setNotice("That file could not be opened. It may be encrypted or damaged.");
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    if (openId) setOpenDeck(openId);
  }, [openId]);
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
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
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
    const pool = session.only
      /* Kept in the order given: the list is already sorted by how badly
         each one is going, and re-sorting it by deck would throw that away. */
      ? session.only.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => Boolean(c))
      : session.deckId ? cards.filter((c) => c.deckId === session.deckId) : cards;
    return (
      <Session
        cards={pool}
        mode={session.mode}
        title={session.title ?? (session.deckId ? decks.find((d) => d.id === session.deckId)?.name ?? "Studying" : "Everything due")}
        onLeave={() => setSession(null)}
        onAsk={onAsk}
      />
    );
  }

  const lesson = openLesson ? (lessons ?? []).find((l) => l.id === openLesson) : undefined;
  if (lesson) {
    return <Tutor lesson={lesson} configured={configured} onLeave={() => setOpenLesson(null)} onAsk={onAsk} />;
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
  /* Same rule as above, and it matters more here: these four sit below the
     early returns for a session, a deck and a lesson, so each must be a
     plain call. A `useMemo` here changes the hook count the moment a
     session opens, which is React error #300 and a blank room. */
  const topics = topicStats(cards, attempts ?? [], now);
  const weakTopic = weakestTopic(cards, attempts ?? [], now);
  const missed = mistakeQueue(attempts ?? [], cards, now);
  const sureness = calibration(attempts ?? []);
  const surenessLine = calibrationLine(sureness);

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
      emptyHint="Name a subject above, or ask for cards in any chat. They come back on a schedule — sooner whenever you get one wrong."
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
          {/* First, when there is anything waiting: somebody who opens this
              room on a Tuesday evening has come to do what is due, and on a
              phone the line that does it sat below the fold, under a box for
              starting a new subject. */}
          {/* What is waiting, and the one press that clears it. Everything
              due across every deck, because "study for ten minutes" is the
              thing somebody actually sits down to do. */}
          {due > 0 && (
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
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
            <p className="mb-3 text-sm text-tertiary tnum">
              {today} answered today · nothing else waiting.
            </p>
          )}
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
            /* "New deck" is a press that means "I want to type": the
               keyboard is what was asked for, on a tablet as much as a desk. */
            focusOnTouch
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
                className="focus-inset w-full resize-y rounded-md border border-line bg-field px-2.5 py-1.5 font-mono text-xs text-primary outline-none"
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
          {/* The other way to study: not cards you have made, but the thing
              you are actually holding — a paper, a chapter, a worksheet, a
              photograph of your own working. It opens beside a conversation
              that can see the page. */}
          <div
            className={cn(
              "mt-2 flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-1.5 transition-colors duration-[var(--dur-fast)]",
              overDrop ? "border-accent bg-accent-subtle" : "border-transparent",
            )}
            onDragEnter={(e) => {
              if (![...e.dataTransfer.types].includes("Files")) return;
              e.preventDefault();
              dropDepth.current += 1;
              setOverDrop(true);
            }}
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
            }}
            onDragLeave={() => {
              dropDepth.current -= 1;
              if (dropDepth.current <= 0) setOverDrop(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              dropDepth.current = 0;
              setOverDrop(false);
              const f = e.dataTransfer.files?.[0];
              if (f) await take(f);
            }}
          >
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-touch press focus-inset flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-50"
            >
              <FileText size={13} />
              {overDrop ? "Drop it here" : "Work through a document"}
            </button>
            {onPack && (
              <button
                onClick={onPack}
                disabled={busy}
                className="btn-touch press focus-inset flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-50"
              >
                <BookMarked size={13} />
                Make a revision pack
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,text/*,.md"
              aria-label="A document to work through"
              tabIndex={-1}
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await take(f);
              }}
            />
          </div>

          {(lessons ?? []).length > 0 && (
            <ul className="mt-2 space-y-1" aria-label="Documents">
              {(lessons ?? []).slice(0, 4).map((l) => (
                <li key={l.id} className="tap lift flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <button
                    onClick={() => setOpenLesson(l.id)}
                    aria-label={`Open ${l.name}`}
                    className="focus-inset flex min-w-0 flex-1 flex-col self-stretch rounded-md text-left"
                  >
                    <span className="truncate text-sm text-primary">{l.name}</span>
                    <span className="text-xs text-tertiary tnum">
                      {l.pages > 1 ? `page ${l.atPage} of ${l.pages}` : "1 page"}
                      {l.text ? "" : " · pictures only"}
                    </span>
                  </button>
                  <button
                    onClick={async () => offerUndo(l.name, await deleteLesson(l.id))}
                    aria-label={`Remove ${l.name}`}
                    className="ctl focus-inset flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-md text-tertiary reveal hover:bg-subtle hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {busy && !pasting && <p className="sheen mt-2 text-sm font-medium">Reading it</p>}
          {notice && <p className="mt-2 text-sm text-warning">{notice}</p>}

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
          {/* The deck is the box somebody filed it in; the topic is the
              thing being learned, and the two come apart the moment a deck
              is made from a chapter. "Biology paper 2 is at 78%" does not
              say which of osmosis, respiration and the light reaction to
              spend the evening on. This does. */}
          {weakTopic && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary tnum" aria-label={`Weakest topic: ${weakTopic.topic}`}>
              <span>
                Weakest topic: <span className="text-secondary">{weakTopic.topic}</span>
                {weakTopic.shaky > 0 && <> — {weakTopic.shaky} of {weakTopic.reviewed} likely forgotten</>}
                {weakTopic.wrong > 0 && <> · got wrong {weakTopic.wrong} of {weakTopic.tried}</>}
              </span>
              <button
                onClick={() => {
                  const ids = cards.filter((c) => c.topic === weakTopic.topic).map((c) => c.id);
                  setSession({ deckId: null, mode: "cram", only: ids, title: weakTopic.topic });
                }}
                className="btn-touch press rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                Practise it
              </button>
            </p>
          )}

          {/* The wrong answers themselves, which the cards cannot remember.
              "You wrote meiosis" is a sentence somebody can act on; "lapses:
              2" is not. Worst first, and only what is still being missed —
              a mistake you have stopped making is not a mistake. */}
          {missed.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary tnum" aria-label="Mistakes">
              <span>
                <span className="text-secondary">{missed.length}</span> {missed.length === 1 ? "card you keep" : "cards you keep"} getting wrong
              </span>
              <button
                onClick={() => setSession({
                  deckId: null, mode: "cram", only: missed.map((c) => c.id), title: "Mistakes",
                })}
                className="btn-touch press rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                Practise these
              </button>
            </p>
          )}

          <Record days={days} now={now} cards={cards} />
          {surenessLine && <Sureness c={sureness} line={surenessLine} />}
          {topics.length > 1 && <Topics topics={topics} onPractise={(t) => {
            const ids = cards.filter((c) => c.topic === t).map((c) => c.id);
            setSession({ deckId: null, mode: "cram", only: ids, title: t });
          }} />}
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
  ordered,
  title,
  onLeave,
  onAsk,
}: {
  cards: Card[];
  /** The schedule's queue, or every card regardless of it. */
  mode: "due" | "cram";
  /** Take the cards in the order given rather than re-sorting them. */
  ordered?: boolean;
  title: string;
  onLeave: () => void;
  onAsk?: (question: string) => void;
}) {
  const [shown, setShown] = React.useState(false);
  /* On a phone there is no Space, no 1–4 and no Esc, and a hint that names
     them is a hint about somebody else's device. Server answers "fine",
     which is the desk, and the phone corrects itself on the first frame. */
  const fine = useMediaQuery("(pointer: fine)");
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
  /**
   * The card as it was before the last answer, kept so it can be put back.
   *
   * Pressing 2 when you meant 3 buys the card back in ten minutes instead of
   * four days, and the only way out without this is to wait for it and then
   * lie in the other direction — which corrupts the schedule properly rather
   * than just inconveniencing you. The scheduler is pure, so the way back is
   * the previous row, not a recomputation.
   */
  const [undoable, setUndoable] = React.useState<Card | null>(null);
  /**
   * How sure they said they were, asked before the answer is revealed.
   *
   * Optional, and off until turned on, because a question in front of every
   * card is a tax on every card. What it buys is the one reading a rate
   * cannot give you: sure-and-wrong, which is the answer you do not check
   * and the marks you lose without feeling it coming.
   */
  const [asking, setAsking] = React.useState(false);
  const [sure, setSure] = React.useState<boolean | null>(null);
  /** One line of feedback for a mid-session move, cleared by the next card. */
  const [note, setNote] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const now = useNow(1_000);
  /* The topic of the card just answered, which has left the queue by the
     time the next one is chosen — so the mix can still avoid it. */
  const [lastKey, setLastKey] = React.useState<string | undefined>();
  const retention = clampRetention(useSettings((st) => st.retention));
  /* In practice the order is fixed at the start and walked once, since
     nothing answered changes when anything comes back. The schedule's queue
     re-reads the clock every second, because a card answered "again" is
     due again in a minute and should turn up at the end of the same sitting. */
  const [walk, setWalk] = React.useState<string[]>(() =>
    mode === "cram" ? (ordered ? cards.map((c) => c.id) : cramOrder(cards).map((c) => c.id)) : [],
  );
  const queue = React.useMemo(() => {
    if (mode === "cram") return walk.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => Boolean(c));
    return dueNow(cards, now, { after: lastKey });
  }, [cards, now, mode, walk, lastKey]);
  const card = queue[0];

  const answer = React.useCallback(
    async (rating: Rating) => {
      if (!card) return;
      const wrote = typed.trim();
      const said = sure;
      setShown(false);
      setEditing(false);
      setTyped("");
      setVerdict(null);
      setSure(null);
      setNote(null);
      setDone((n) => n + 1);
      setLastKey(topicKey(card));
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      /* Written down before the schedule moves, and written for every
         answer rather than only the wrong ones: a log of failures alone
         cannot give a rate, and a rate is what makes "six of these eight"
         mean anything. */
      void noteAttempt({
        cardId: card.id,
        deckId: card.deckId,
        topic: card.topic,
        question: card.front,
        given: wrote,
        expected: card.back,
        right: rating === "good" || rating === "easy",
        sure: said ?? undefined,
      });
      if (mode === "cram") {
        /* Counted as studying — it is — and nothing else. The card's own
           schedule is left exactly where it was, so there is nothing to
           undo either. */
        setWalk((w) => w.slice(1));
        setUndoable(null);
        await noteStudied(rating);
      } else {
        setUndoable(card);
        await answerCard(card, rating, retention);
      }
    },
    [card, mode, typed, sure, retention],
  );

  /* The way back from the last press. Only the last: a stack of undos over a
     scheduler is a way to lose track of what the schedule now says, and one
     step covers the mistake people actually make. */
  const undo = React.useCallback(async () => {
    if (!undoable) return;
    const back = undoable;
    setUndoable(null);
    setDone((n) => Math.max(0, n - 1));
    setShown(false);
    setSure(null);
    await unanswerCard(back);
  }, [undoable]);

  /* Checked, then shown. The typed answer is marked against the back — or,
     for a cloze, against what was hidden — and the verdict picks a button
     without pressing it. */
  const submitTyped = () => {
    if (!card) return;
    if (asking && sure === null) return;
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
      /* Before the no-card guard on purpose. Answering the last card wrongly
         is the mis-press with the least slack in it — the queue empties, the
         card is gone from view, and the only way back would be to wait for
         it and lie in the other direction. */
      if (e.key.toLowerCase() === "u" && undoable && !shown) {
        e.preventDefault();
        void undo();
        return;
      }
      if (!card) return;
      /* While typing, the box has the keys: Enter checks, and the digits are
         digits. Once the answer is shown the buttons take over again. */
      if (typing && !shown) return;
      if (!shown && (e.key === " " || e.key === "Enter")) {
        /* Where confidence is being asked, it is asked before the answer is
           seen or it is not being asked at all — a guess recorded after the
           reveal is a memory of a guess. */
        if (asking && sure === null) return;
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
  }, [shown, card, answer, onLeave, editing, typing, undoable, undo, asking, sure]);

  const gaps = card ? previewGaps(card, now) : null;
  const cloze = card ? isCloze(card.front) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="safe-top sticky top-0 z-10 flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-3 relative">
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
        <button
          onClick={() => { setAsking((v) => !v); setSure(null); }}
          aria-pressed={asking}
          aria-label="Ask how sure I am"
          title="Ask how sure you are, before each answer"
          className={cn(
            "ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)]",
            asking ? "bg-accent-subtle text-accent" : "text-tertiary hover:bg-subtle hover:text-primary",
          )}
        >
          <Gauge size={15} />
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
            {undoable && (
              <p className="mt-3 text-xs text-faint">
                <button
                  onClick={() => void undo()}
                  className="focus-inset rounded-sm underline underline-offset-2 hover:text-primary"
                >
                  Undo that last answer
                </button>
                <span className="text-faint"> (U)</span>
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
                <div className="mt-5 flex flex-col items-center gap-3">
                  {/* Asked before the reveal or not asked at all: a guess
                      recorded after seeing the answer is a memory of a
                      guess, and the whole value of this is that it was
                      committed to while it could still be wrong. */}
                  {asking && (
                    <div className="flex items-center gap-2" role="group" aria-label="How sure are you">
                      <span className="text-xs text-tertiary">Sure?</span>
                      {([[true, "Sure"], [false, "Not sure"]] as [boolean, string][]).map(([v, label]) => (
                        <button
                          key={label}
                          onClick={() => setSure(v)}
                          aria-pressed={sure === v}
                          className={cn(
                            "btn-touch press focus-inset rounded-full border px-3 text-xs transition-colors duration-[var(--dur-fast)]",
                            sure === v ? "border-accent bg-accent-subtle text-primary" : "border-line bg-surface text-secondary hover:text-primary",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="primary"
                    className="bloom"
                    disabled={asking && sure === null}
                    onClick={() => setShown(true)}
                  >
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
                      {label} <span className="kbd-hint text-tertiary">{i + 1}</span>
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
                    const made = await addReverse(card);
                    setNote(made ? "Made the other direction of this card." : "This one has no other direction.");
                  }}
                  className="focus-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <ArrowLeftRight size={12} />
                  Ask it backwards
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

            {/* A card forgotten eight times is not going to be learned by a
                ninth showing: it is two facts pretending to be one, or the
                front does not ask for the back, or the thing underneath was
                never understood. All three are fixed by rewriting or
                explaining it. So it is said, once, where it can be acted on
                — not filed in a list nobody opens. */}
            {shown && !editing && isLeech(card) && (
              <div className="mt-3 rounded-lg border border-[var(--warning)] bg-surface px-3 py-2.5 text-center anim-fade">
                <p className="text-xs text-secondary">
                  You have forgotten this one {card.lapses} times. Showing it again is not going to be
                  what fixes it.
                </p>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {onAsk && (
                    <button
                      onClick={() => onAsk(
                        `This flashcard keeps defeating me — I have forgotten it ${card.lapses} times.\n\nFront: “${card.front}”\nBack: “${card.back}”\n\nTell me honestly whether this is a bad card (two facts in one, or a front that does not actually ask for the back) and rewrite it if so. If the card is fine, explain the thing underneath it differently from how it is written here.`,
                      )}
                      className="focus-inset rounded-full px-2.5 py-1 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Work out why with me
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      setShown(false);
                      setWalk((w) => w.filter((id) => id !== card.id));
                      offerUndo(`${card.front.slice(0, 32)}`, await parkCard(card));
                      setNote("Parked. It stays in the deck and stops costing a slot.");
                    }}
                    className="focus-inset rounded-full px-2.5 py-1 text-xs text-tertiary hover:text-primary"
                  >
                    Park it for now
                  </button>
                </div>
              </div>
            )}

            {note && (
              <p role="status" className="mt-3 text-center text-xs text-tertiary anim-fade">{note}</p>
            )}

            <p id="suggested" className={cn("mt-3 text-center text-xs text-faint", shown ? "" : "opacity-70")}>
              {shown
                ? suggested ? (fine ? "The marker suggests one — press whichever is true · 1 – 4" : "The marker suggests one — press whichever is true")
                  : fine ? "1 – 4 to answer · Esc to leave" : "Press how it went"
                : asking && sure === null ? "Say whether you are sure, then look"
                : typing ? (fine ? "Enter to check" : "Send to check") : fine ? "Space to show the answer" : "Tap to show the answer"}
              {!shown && undoable && (
                <>
                  {" · "}
                  <button
                    onClick={() => void undo()}
                    className="focus-inset rounded-sm underline underline-offset-2 hover:text-primary"
                  >
                    Undo that answer
                  </button>
                  <span className="text-faint"> (U)</span>
                </>
              )}
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
  const [topic, setTopic] = React.useState(card.topic ?? "");
  /* Every topic already in use, so the field completes rather than asking
     somebody to retype a string exactly. Two spellings of one topic are two
     topics, and a free-text box with no memory is how that happens. */
  const known = useLiveQuery(
    async () => [...new Set((await allCards()).map((c) => c.topic).filter((t): t is string => Boolean(t)))].sort(),
    [],
    [] as string[],
  );
  const save = async () => {
    const f = front.trim();
    const b = back.trim();
    const t = topic.trim().slice(0, 60);
    if (f && b && (f !== card.front || b !== card.back || t !== (card.topic ?? ""))) {
      await updateCard(card.id, { front: f, back: b, topic: t || undefined });
    }
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
        className="focus-inset w-full resize-none rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-primary outline-none"
      />
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        aria-label="Answer"
        rows={2}
        className="focus-inset mt-2 w-full resize-none rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-secondary outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor="card-topic" className="shrink-0 text-xs text-tertiary">About</label>
        <input
          id="card-topic"
          list="known-topics"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="the thing this is about"
          autoComplete="off"
          className="focus-inset h-8 min-w-0 flex-1 rounded-md border border-line bg-field px-2.5 text-xs text-secondary outline-none placeholder:text-faint"
        />
        <datalist id="known-topics">
          {(known ?? []).map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>
      <p className="mt-1.5 text-xs text-faint">
        A sentence with the answer in {"{{braces}}"} is asked with a hole in it. What it is
        <em> about</em> is how the room works out where the trouble is.
      </p>
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


/**
 * The last twelve weeks, and how the month went.
 *
 * A calendar of days with something answered, drawn from the log, and the
 * number the scheduler is aiming at held against the one that happened:
 * cards known when they came up, over the last thirty days, against the
 * ninety per cent it plans for. Numbers about the person, not the cards,
 * and only once there is a month to read.
 */
function Record({ days, now, cards }: { days: StudyDay[]; now: number; cards: Card[] }) {
  const aim = clampRetention(useSettings((st) => st.retention));
  const aimPct = Math.round(aim * 100);
  const cells = weeksOf(days, now);
  const active = cells.filter((c) => c.answered > 0).length;
  if (active === 0) return null;
  const most = Math.max(...cells.map((c) => c.answered), 1);
  const total = cells.reduce((n, c) => n + c.answered, 0);
  const month = recallRate(days, now);
  return (
    <div className="mt-3">
      {/* Said, not only announced. The grid carried its meaning in an
          aria-label and nothing else, so a sighted reader got twelve weeks of
          unlabelled squares directly above a line about the last thirty days
          — two different spans, one of them captioned, and the caption
          belonged to the other one. */}
      <p className="eyebrow mb-1.5 text-faint">Last 12 weeks</p>
      <div
        role="img"
        aria-label={`Last twelve weeks: ${total} cards answered on ${active} day${active === 1 ? "" : "s"}`}
        className="grid grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, 10px)", gridAutoColumns: "10px" }}
      >
        {cells.map((c) => (
          <span
            key={c.day}
            title={c.answered ? `${c.day}: ${c.answered}` : c.day}
            className="rounded-[2px]"
            style={{
              /* `--bg-subtle`, not `--subtle`. The latter is not a token this
                 app has ever defined, so every empty cell in the twelve-week
                 grid painted with nothing and the calendar was one square
                 floating in a void. `test-tokens` now fails on the whole
                 class rather than waiting for somebody to notice. */
              background: c.answered ? "var(--accent)" : "var(--bg-subtle)",
              opacity: c.answered ? 0.35 + 0.65 * (c.answered / most) : 1,
            }}
          />
        ))}
      </div>
      {month.answered >= 20 && month.rate !== null && (
        <p className="mt-1.5 text-xs text-tertiary tnum">
          Known when asked, last 30 days: <span className="text-secondary">{Math.round(month.rate * 100)}%</span> of {month.answered}
          {month.rate < aim - 0.05 ? ` — below the ${aimPct}% you are aiming for; shorter gaps would help, so would fewer new cards` : month.rate > aim + 0.06 ? ` — above the ${aimPct}% aimed for; the gaps could be longer` : ` — close to the ${aimPct}% you are aiming for`}
        </p>
      )}
      <Aim cards={cards} />
    </div>
  );
}

/**
 * How much to remember, chosen, with what it costs said beside it.
 *
 * The schedule asks again at the point a card is about to slip below this
 * chance of being known. Ninety is the default and the right one for most
 * people, but in a season of six subjects eighty-five can be the difference
 * between keeping up and abandoning the deck — and a student about to sit
 * the paper may want ninety-five for a week. The choice changes the gaps
 * from the next answer on; nothing already scheduled moves.
 */
function Aim({ cards }: { cards: Card[] }) {
  const aim = clampRetention(useSettings((st) => st.retention));
  const set = useSettings((st) => st.set);
  const known = cards.filter((c) => c.state === "review").length;
  if (known < 5) return null;
  const load = (r: number) => Math.max(1, Math.round(dailyLoad(cards, r)));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-tertiary" role="group" aria-label="How much to remember">
      <span>Aim to remember</span>
      <div className="flex gap-1">
        {RETENTION_CHOICES.map((r) => (
          <button
            key={r}
            onClick={() => set({ retention: r })}
            aria-pressed={Math.abs(aim - r) < 0.001}
            className={cn(
              "btn-touch press tnum rounded-full border px-2.5 text-xs transition-colors duration-[var(--dur-fast)]",
              Math.abs(aim - r) < 0.001
                ? "border-transparent bg-accent-subtle text-primary"
                : "border-line bg-surface text-secondary hover:bg-subtle hover:text-primary",
            )}
          >
            {Math.round(r * 100)}%
          </button>
        ))}
      </div>
      {/* Its own line on a phone rather than a clause that wraps there and
          starts the next line with a stray dot. */}
      <span className="tnum max-sm:basis-full">
        <span className="max-sm:hidden">· </span>about {load(aim)} review{load(aim) === 1 ? "" : "s"} a day for what you know now
      </span>
    </div>
  );
}

/**
 * The two-by-two, and the one cell that matters.
 *
 * Sure-and-wrong is the dangerous quadrant: it is the answer you do not
 * check, the working you do not redo, and the marks that go without ever
 * feeling like they were at risk. Drawn as a grid rather than a percentage
 * because the shape *is* the message — four cells, and your eye goes to the
 * one with a number in it that should not have one.
 *
 * Not-sure-and-right is the opposite problem and worth saying too: it means
 * you know more than you are giving yourself credit for, which changes how
 * somebody walks into an exam.
 */
function Sureness({ c, line }: { c: Calibration; line: string }) {
  const cells: { label: string; n: number; bad?: boolean; good?: boolean }[] = [
    { label: "Sure · right", n: c.sureRight, good: true },
    { label: "Sure · wrong", n: c.sureWrong, bad: true },
    { label: "Not sure · right", n: c.unsureRight },
    { label: "Not sure · wrong", n: c.unsureWrong },
  ];
  return (
    <section className="mt-3" aria-label="How well you know what you know">
      <div className="grid max-w-xs grid-cols-2 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cn(
              "rounded-md border px-2 py-1.5",
              cell.bad && cell.n > 0 ? "border-[var(--warning)] bg-surface" : "border-line bg-surface",
            )}
          >
            <p className={cn(
              "text-sm tnum",
              cell.bad && cell.n > 0 ? "text-warning" : cell.good ? "text-primary" : "text-secondary",
            )}>
              {cell.n}
            </p>
            <p className="text-tiny text-tertiary">{cell.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 max-w-prose text-xs text-tertiary">{line}</p>
    </section>
  );
}

/**
 * Every topic, weakest first.
 *
 * Two numbers per row because they answer different questions and neither
 * is enough alone: the bar is what the memory model expects you to still
 * know, and the count beside it is what you have actually got wrong. A
 * topic can be shaky on the model and never missed (you have not been asked
 * lately), or answered wrong repeatedly while the model is happy (you are
 * getting it back with effort each time). Both are worth an evening; they
 * are not the same evening.
 */
function Topics({ topics, onPractise }: { topics: TopicStat[]; onPractise: (topic: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const shown = open ? topics : topics.slice(0, 4);
  return (
    <section className="mt-3" aria-label="Topics">
      <h3 className="text-xs font-medium text-tertiary">By topic</h3>
      <ul className="mt-1.5 space-y-1">
        {shown.map((t) => (
          <li key={t.topic} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-secondary">{t.topic}</span>
            {/* The bar is the reading; the number beside it is there because
                a bar alone cannot be read off precisely and this one gets
                compared between rows.
                An empty track where nothing has graduated yet. The mean of no
                cards is 1 by construction — there is nothing known to be
                forgotten — and drawing that as a full bar says "you know all
                of this" about a topic nobody has been asked about once. An
                empty track says the true thing, which is that there is
                nothing to say yet. */}
            <span
              aria-hidden
              className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--border-subtle)]"
            >
              {t.reviewed > 0 && (
                <span
                  className={cn("block h-full rounded-full", t.mean < 0.8 ? "bg-[var(--warning)]" : "bg-accent")}
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, t.mean)) * 100)}%` }}
                />
              )}
            </span>
            <span className="w-11 shrink-0 text-right text-tiny text-tertiary tnum">
              {t.reviewed ? `${Math.round(t.mean * 100)}%` : "new"}
            </span>
            <span className="w-14 shrink-0 text-right text-tiny text-tertiary tnum">
              {t.tried ? `${t.wrong}/${t.tried} wrong` : ""}
            </span>
            <button
              onClick={() => onPractise(t.topic)}
              aria-label={`Practise ${t.topic}`}
              className="btn-touch press focus-inset shrink-0 rounded-full border border-line bg-surface px-2 text-tiny text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              Practise
            </button>
          </li>
        ))}
      </ul>
      {topics.length > 4 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="focus-inset mt-1.5 rounded-sm text-tiny text-tertiary hover:text-primary hover:underline"
        >
          {open ? "Fewer" : `All ${topics.length} topics`}
        </button>
      )}
    </section>
  );
}
