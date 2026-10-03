"use client";

import { getPlusOffer } from "@/lib/configured";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Cpu, Flame, GraduationCap, KeyRound, LayoutTemplate, PenLine, Sparkles, TrendingDown, X, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { dueNow, streakOf, weakestTopic, type Card } from "@/lib/study";
import { attemptsSince } from "@/lib/db";
import { useSettings, type Section } from "@/lib/store";
import { STAGES, type Stage } from "@/lib/persona";

/**
 * The time of day, as a greeting.
 *
 * Read on the client, because the server has no idea what time it is where
 * you are. The first render carries a neutral word and the real one lands
 * before paint; the hydration warning that would otherwise fire on the
 * mismatch is suppressed on that one element and nowhere else.
 */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Two greetings, alternating: the hour, and the day.
 *
 * "Good evening" every single evening becomes wallpaper by the third one, and
 * a page that greets you the same way forever has stopped saying anything. So
 * it alternates with "Happy Thursday" — picked from the date rather than at
 * random, so it is the same all day and changes when the day does. Randomness
 * that reshuffles under you while you read is not warmth, it is a glitch.
 *
 * Starts as the server's word on the client too — deliberately. With
 * `suppressHydrationWarning` React keeps the server's text and does not
 * re-render unless state actually changes, so an initial state that already
 * held the right answer would leave "Hello" on screen forever. The layout
 * effect changes it before paint.
 */
function useGreeting(): string {
  const [g, setG] = React.useState("Hello");
  useIsoLayoutEffect(() => {
    const now = new Date();
    const h = now.getHours();
    const hour =
      h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    // Odd days get the weekday, even days the hour. Late at night the hour is
    // the more useful of the two, and it always wins.
    setG(h < 5 || now.getDate() % 2 === 0 ? hour : `Happy ${DAYS[now.getDay()]}`);
  }, []);
  return g;
}

/**
 * What is waiting elsewhere, read off the same tables the rooms read.
 *
 * Cards due is the one that matters most — it is the number that decides
 * whether today is a day you kept up — and the other two are only said when
 * they are recent, because "3 pages" forever is furniture and "a page edited
 * today" is a thread to pick back up.
 */
function useWaiting(): { section: Section; text: string; icon: React.ReactNode }[] {
  const cards = useLiveQuery(() => db.cards.toArray(), [], [] as Card[]);
  const days = useLiveQuery(() => db.studyDays.toArray(), [], []);
  const attempts = useLiveQuery(() => attemptsSince(60), [], []);
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(1).toArray(), [], []);
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().limit(1).toArray(), [], []);
  return React.useMemo(() => {
    const now = Date.now();
    const out: { section: Section; text: string; icon: React.ReactNode }[] = [];
    const due = dueNow(cards, now).length;
    if (due > 0) out.push({ section: "study", text: `${due} card${due === 1 ? "" : "s"} due`, icon: <GraduationCap size={12} /> });
    /* A streak is the one number that makes today's cards matter: two
       days in a row is a habit starting, and the line says so before it
       is broken. One day is not a streak and is not said. */
    const streak = streakOf(days, now);
    if (streak >= 2) out.push({ section: "study", text: `${streak}-day streak`, icon: <Flame size={12} /> });
    /* The topic that is going worst, by name — the one line a student
       would not think to ask for and most needs: not "study", but what. */
    const weak = weakestTopic(cards, attempts, now);
    if (weak && (weak.shaky > 0 || weak.wrong > 0)) out.push({ section: "study", text: `“${weak.topic.slice(0, 32)}” is your weakest topic`, icon: <TrendingDown size={12} /> });
    const note = notes[0];
    if (note && now - note.updatedAt < 2 * 86_400_000) {
      out.push({ section: "notebook", text: `“${(note.title || "Untitled note").slice(0, 32)}” in the notebook`, icon: <BookOpen size={12} /> });
    }
    const made = canvases[0];
    if (made && now - made.updatedAt < 2 * 86_400_000) {
      out.push({ section: "creative", text: `“${(made.title || "Untitled").slice(0, 32)}” is running`, icon: <LayoutTemplate size={12} /> });
    }
    return out;
  }, [cards, days, attempts, notes, canvases]);
}

/* The four boxed openers that used to live here are gone.
   ---------------------------------------------------------------------------
   They were a good idea rendered as the wrong object. Half of them were
   sentences you were meant to finish — "Explain ", "Make me a working quiz
   on " — and a half-sentence inside a hard-edged chip does not read as an
   invitation to keep typing, it reads as a label that got cut off. Four of
   them under the box turned the blank page into a menu you had to get past
   before you were allowed to type, which is the opposite of what a blank
   page is for.

   What they were actually for survives in two better places: the line below
   says what is genuinely waiting in the other rooms, and a slash in the box
   lists what this app can be asked to do, in the box, while you are already
   typing. --- */

/** useLayoutEffect on the client, a no-op on the server, without the warning. */
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * A thread with nothing in it yet.
 *
 * The composer is not in here. It was — centred under the greeting, on the
 * argument that an empty thread has nothing for a box at the bottom to sit
 * under — and on the first send it moved to the dock, which was meant to
 * say "the room changed". Held against the reference on the same tablet,
 * the move read as the box jumping, and a box that lives in one place is a
 * box you never have to find. It is in the dock from the first frame now,
 * and the blank page has what the reference has above its bar: three plain
 * rows saying what to start with, no boxes, one press each.
 */

/** What to start with: the reference's three rows, in this app's words —
    and a fourth for the thing a student asks for most that the others do
    not offer on their blank page: something to print. It switches the
    Document mode on, so what is typed next comes back as a PDF. */
export type Start = "make" | "write" | "read" | "print";
const STARTS: { id: Start; label: string; icon: React.ReactNode }[] = [
  { id: "make", label: "Make something that runs", icon: <Sparkles size={18} /> },
  { id: "write", label: "Write or edit", icon: <PenLine size={18} /> },
  { id: "read", label: "Learn from a document", icon: <BookOpen size={18} /> },
  { id: "print", label: "Make a document to print", icon: <FileText size={18} /> },
];

export function EmptyState({
  hasAnyKey,
  onAddKey,
  onPlus,
  onLocal,
  onGo,
  onStart,
  assistants = [],
  onAssistant,
}: {
  hasAnyKey: boolean;
  /** The person's own assistants, each a press from here. */
  assistants?: { id: string; name: string; icon: string }[];
  onAssistant?: (id: string) => void;
  /** No key yet: the one button that fixes that. */
  onAddKey: () => void;
  /** Or the other door: Armi Plus, where the server offers it. */
  onPlus?: () => void;
  /** Or the third: a free model on this computer. */
  onLocal?: () => void;
  /** Into another room, from the line that says what is waiting there. */
  onGo?: (section: Section) => void;
  /** One of the three rows above the box was pressed. */
  onStart?: (what: Start) => void;
}) {
  const settings = useSettings();
  const { name, nameAsked } = settings;
  const greeting = useGreeting();
  const [draftName, setDraftName] = React.useState("");
  const [draftLevel, setDraftLevel] = React.useState<Stage>("default");
  const waiting = useWaiting();

  return (
    <div className="empty-state flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4">
      <div className="my-auto w-full max-w-[var(--measure)] py-8">
        {/* The signature, then a greeting that knows what time it is and — once
            you have said so — what you are called. The two are the whole of
            the "brand moment" on a blank page: a name in a hand, and a page
            that is addressed to you. Nothing else on this screen is allowed
            to be decorative. */}
        <div className="mb-7 text-center">
          {/* The mark sits *in* the line rather than above it. Stacked, the
              name and the greeting are two announcements; on one line they are
              a signature at the head of a letter, which is the whole idea. */}
          {/* One plain line in the interface's own type, as ChatGPT greets
              you — no mark, no second line under it. */}
          <h1
            className="text-[1.75rem] font-normal tracking-tight text-primary anim-rise"
            title={greeting}
            suppressHydrationWarning
          >
            {name.trim() ? `Where should we start, ${name.trim()}?` : "Where should we start?"}
          </h1>
          {/* Which model is answering is no longer announced here: it lives in
              the composer, next to the box you are about to type in, where it
              is both visible and changeable. Saying it twice on one screen
              made the second one furniture. */}
          {!hasAnyKey && (
            <p
              className="eyebrow mt-2.5 text-faint anim-rise"
              style={{ animationDelay: "60ms" }}
            >
              Bring your own key — nothing leaves this browser
            </p>
          )}
        </div>

        {/* Your assistants, where you start. Each is a press: the box opens
            with its opening line and the chat answers as it. */}
        {onAssistant && assistants.length > 0 && (
          <ul
            className="anim-rise mt-5 flex flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "80ms" }}
            aria-label="Your assistants"
          >
            {assistants.slice(0, 8).map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onAssistant(a.id)}
                  className="tap focus-inset flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
                >
                  <span aria-hidden>{a.icon}</span>
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* What the other rooms are holding, on the one screen everybody
            starts on. The front door used to know nothing about the house:
            you could have forty cards due and a page you were writing last
            night and open to a greeting and a box, every time. One line,
            only the rooms with something in them, each a press away. */}
        {onGo && waiting.length > 0 && (
          <p
            /* Gap, not dots, between the presses: a dot between items that
               wrap is a dot left dangling at the end of a line on a phone. */
            className="anim-rise mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-tertiary"
            style={{ animationDelay: "100ms" }}
            aria-label="Waiting in the other rooms"
          >
            {waiting.map((w) => (
              <React.Fragment key={w.section}>
                <button
                  onClick={() => onGo(w.section)}
                  /* Small on the page, full-sized under a finger: the row is
                     one line of quiet text, and the thing you press is still
                     forty-four points tall. */
                  className="btn-touch focus-inset flex items-center gap-1.5 rounded-full px-2 py-0.5 tnum transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  {w.icon}
                  {w.text}
                </button>
              </React.Fragment>
            ))}
          </p>
        )}

        {!hasAnyKey && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={onAddKey}
              className="tap bloom focus-inset anim-rise flex items-center gap-2 rounded-full bg-[var(--cta)] px-4 py-2 text-sm font-medium text-[var(--cta-fg)]"
              style={{ animationDelay: "120ms" }}
            >
              <KeyRound size={14} />
              Add your API keys
            </button>
          </div>
        )}
        {/* The other door, where this installation has one: a dollar a
            month and no keys at all. Said under the key button, quietly,
            because the key is still the arrangement most people here want. */}
        {!hasAnyKey && ((onPlus && getPlusOffer().on) || onLocal) && (
          <p className="anim-rise mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-tertiary" style={{ animationDelay: "200ms" }}>
            or
            {onPlus && getPlusOffer().on && (
              <button onClick={onPlus} className="focus-inset rounded underline decoration-[var(--border-strong)] underline-offset-2 hover:text-primary">
                Armi Plus, {getPlusOffer().price} — no keys needed
              </button>
            )}
            {onPlus && getPlusOffer().on && onLocal && <span aria-hidden>·</span>}
            {/* The third door, and the only free one with nobody to pay:
                an open model installed on this computer. */}
            {onLocal && (
              <button onClick={onLocal} className="focus-inset flex items-center gap-1 rounded underline decoration-[var(--border-strong)] underline-offset-2 hover:text-primary">
                <Cpu size={12} aria-hidden /> a free AI on this computer
              </button>
            )}
          </p>
        )}
        {/* For somebody deciding, not asking: what this is and why, on its own page. */}
        {!hasAnyKey && (
          <p className="anim-rise mt-6 text-center text-xs text-tertiary" style={{ animationDelay: "260ms" }}>
            <a href="/why" className="focus-inset rounded hover:text-primary hover:underline">Why Armi? What it does, how it compares, what it costs</a>
          </p>
        )}

        {/* The row of things you can make used to live here too, shown only
            in Creative. Creative is not a mode you switch into any more — the
            app reads it off the request — and the same row has always been in
            the Code room under "Or make one of these", which is where making
            things belongs. One copy, in the room named after it. */}

        {/* Asked once, on the blank page, after the keys are in — never as a
            modal and never again after an answer either way. A name is the
            cheapest thing an interface can know about you and the one that
            changes the most about how it reads back. */}
        {hasAnyKey && !name && !nameAsked && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              settings.set({
                name: draftName.trim(),
                nameAsked: true,
                ...(draftLevel !== "default" ? { persona: { ...(settings.persona ?? {}), level: draftLevel } } : {}),
              });
            }}
            aria-label="First things"
            className="mx-auto mt-5 w-full max-w-sm rounded-2xl border border-line bg-surface p-3 anim-rise"
            style={{ animationDelay: "280ms" }}
          >
            {/* Two things, once, and never a modal: a name, which changes
                how the page reads back, and a level, which changes what a
                right answer is. Both are optional and both stay here. */}
            <div className="flex items-center gap-1.5">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="What should I call you?"
                aria-label="Your name"
                className="tap focus-inset h-10 min-w-0 flex-1 rounded-full border border-line bg-field px-4 text-sm text-primary outline-none placeholder:text-tertiary"
              />
              <button
                type="button"
                aria-label="Not now"
                onClick={() => settings.set({ nameAsked: true })}
                className="ctl focus-inset flex [--ctl:2.5rem] items-center justify-center rounded-full text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <select
                value={draftLevel}
                onChange={(e) => setDraftLevel(e.target.value as Stage)}
                aria-label="Your level"
                className="tap focus-inset h-10 min-w-0 flex-1 rounded-full border border-line bg-field px-3 text-sm text-primary outline-none"
              >
                {STAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.id === "default" ? "Your level (optional)" : l.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!draftName.trim() && draftLevel === "default"}
                className="tap focus-inset h-10 rounded-full bg-[var(--cta)] px-4 text-sm font-medium text-[var(--cta-fg)] transition-opacity duration-[var(--dur-fast)] disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <p className="mt-2 px-1 text-xs text-tertiary">The name stays in this browser. The level is sent with each chat so answers fit you; change either in Settings.</p>
          </form>
        )}
      </div>

      {/* Three rows, directly above the box, the way the reference does it:
          an icon and a few words each, no borders, no boxes, left-aligned
          to the column the box sits in. They replace the line that said
          "type / to see what it can be asked to do" — a row you can press
          beats a sentence about a key. */}
      {hasAnyKey && onStart && (
        <nav
          aria-label="Ways to start"
          /* On a desk the three are a row of pills over the centred box,
             as the desktop apps set their suggestions; on a tablet, rows. */
          className="mx-auto w-full max-w-[var(--measure)] pb-1 anim-rise desk:flex desk:flex-wrap desk:justify-center desk:gap-2 desk:pb-3"
          style={{ animationDelay: "90ms" }}
        >
          {STARTS.map((st, i) => (
            <button
              key={st.id}
              onClick={() => onStart(st.id)}
              /* Each a beat after the last: a row of four that lands at
                 once is a block; four that arrive in turn read as a list. */
              style={{ animationDelay: `${120 + i * 45}ms` }}
              className="tap focus-inset anim-rise flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[0.9375rem] text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary desk:h-9 desk:w-auto desk:gap-2 desk:rounded-full desk:border desk:border-line desk:px-3.5 desk:text-sm desk:[&_svg]:size-4"
            >
              <span className="shrink-0 text-tertiary">{st.icon}</span>
              {st.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
