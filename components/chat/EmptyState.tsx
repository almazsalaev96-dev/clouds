"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, GraduationCap, KeyRound, LayoutTemplate, X } from "lucide-react";
import { db } from "@/lib/db";
import { dueNow, type Card } from "@/lib/study";
import { useSettings, type Section } from "@/lib/store";
import { Mark } from "@/components/brand/Logo";

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
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(1).toArray(), [], []);
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().limit(1).toArray(), [], []);
  return React.useMemo(() => {
    const now = Date.now();
    const out: { section: Section; text: string; icon: React.ReactNode }[] = [];
    const due = dueNow(cards, now).length;
    if (due > 0) out.push({ section: "study", text: `${due} card${due === 1 ? "" : "s"} due`, icon: <GraduationCap size={12} /> });
    const note = notes[0];
    if (note && now - note.updatedAt < 2 * 86_400_000) {
      out.push({ section: "notebook", text: `“${(note.title || "Untitled note").slice(0, 32)}” in the notebook`, icon: <BookOpen size={12} /> });
    }
    const made = canvases[0];
    if (made && now - made.updatedAt < 2 * 86_400_000) {
      out.push({ section: "code", text: `“${(made.title || "Untitled").slice(0, 32)}” is running`, icon: <LayoutTemplate size={12} /> });
    }
    return out;
  }, [cards, notes, canvases]);
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
 * The composer is rendered *inside* this block rather than docked at the
 * bottom of the window, because an empty thread has no transcript to sit under
 * — leaving the box at the bottom puts half a screen of nothing between the
 * greeting and the only thing you can do, and asks you to travel that distance
 * to start. Centred, the greeting and the box are one object, and the first
 * thing you read is directly above the first thing you type.
 *
 * On the first send the composer moves to the dock. That transition is the
 * app telling you the room changed: there is a conversation now, and the
 * conversation is the thing on screen.
 */

export function EmptyState({
  hasAnyKey,
  onAddKey,
  onGo,
  children,
}: {
  hasAnyKey: boolean;
  /** No key yet: the one button that fixes that. */
  onAddKey: () => void;
  /** Into another room, from the line that says what is waiting there. */
  onGo?: (section: Section) => void;
  /** The composer. */
  children: React.ReactNode;
}) {
  const settings = useSettings();
  const { name, nameAsked } = settings;
  const greeting = useGreeting();
  const [draftName, setDraftName] = React.useState("");
  const waiting = useWaiting();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-[var(--measure)] pb-[6vh]">
        {/* The signature, then a greeting that knows what time it is and — once
            you have said so — what you are called. The two are the whole of
            the "brand moment" on a blank page: a name in a hand, and a page
            that is addressed to you. Nothing else on this screen is allowed
            to be decorative. */}
        <div className="mb-7 text-center">
          {/* The mark sits *in* the line rather than above it. Stacked, the
              name and the greeting are two announcements; on one line they are
              a signature at the head of a letter, which is the whole idea. */}
          <h1
            className="display flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[1.75rem] text-primary anim-rise sm:text-3xl"
            suppressHydrationWarning
          >
            <Mark size={42} className="text-primary" />
            <span>
              {greeting}
              {name ? `, ${name.trim()}` : ""}
            </span>
          </h1>
          <p
            className="display-italic mt-1.5 text-[1.25rem] text-secondary anim-rise"
            style={{ animationDelay: "40ms" }}
          >
            Where should we start?
          </p>
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

        <div className="anim-rise" style={{ animationDelay: "70ms" }}>
          {children}
        </div>

        {/* With nothing waiting elsewhere, the space under the box says the
            one thing a blank page can usefully teach: that the box does more
            than take a sentence. A line of text rather than a row of chips —
            the four chips this replaced were the reason the page looked like
            a form. Never shown alongside the waiting line: two quiet rows
            under the box are one row too many, and what is actually due
            beats what is merely possible. */}
        {waiting.length === 0 && hasAnyKey && (
          <p
            className="anim-rise mt-4 text-center text-xs text-tertiary"
            style={{ animationDelay: "100ms" }}
          >
            Type <span className="font-medium text-secondary">/</span> to see what it can be asked to do
          </p>
        )}

        {/* What the other rooms are holding, on the one screen everybody
            starts on. The front door used to know nothing about the house:
            you could have forty cards due and a page you were writing last
            night and open to a greeting and a box, every time. One line,
            only the rooms with something in them, each a press away. */}
        {onGo && waiting.length > 0 && (
          <p
            className="anim-rise mt-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-xs text-tertiary"
            style={{ animationDelay: "100ms" }}
            aria-label="Waiting in the other rooms"
          >
            {waiting.map((w, i) => (
              <React.Fragment key={w.section}>
                {i > 0 && <span className="text-faint" aria-hidden>·</span>}
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
              settings.set({ name: draftName.trim(), nameAsked: true });
            }}
            className="mx-auto mt-5 flex w-full max-w-xs items-center gap-1.5 anim-rise"
            style={{ animationDelay: "280ms" }}
          >
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="What should I call you?"
              aria-label="Your name"
              className="tap focus-inset h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-primary outline-none placeholder:text-tertiary"
            />
            <button
              type="submit"
              disabled={!draftName.trim()}
              className="tap focus-inset h-10 rounded-full px-3.5 text-sm font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              aria-label="Not now"
              onClick={() => settings.set({ nameAsked: true })}
              className="ctl focus-inset flex [--ctl:2.5rem] items-center justify-center rounded-full text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              <X size={15} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
