"use client";

import * as React from "react";
import { KeyRound, X } from "lucide-react";
import { useSettings } from "@/lib/store";
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

/** useLayoutEffect on the client, a no-op on the server, without the warning. */
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * A thread with nothing in it yet.
 *
 * The composer is rendered *inside* this block rather than docked at the
 * bottom of the window, because an empty thread has no transcript to sit under
 * — leaving the box at the bottom puts half a screen of nothing between the
 * greeting and the only thing you can do, and asks you to travel that distance
 * to start. Centred, the greeting, the box and the suggestions are one object,
 * and the first thing you read is directly above the first thing you type.
 *
 * On the first send the composer moves to the dock. That transition is the
 * app telling you the room changed: there is a conversation now, and the
 * conversation is the thing on screen.
 */

export function EmptyState({
  hasAnyKey,
  onExample,
  onAddKey,
  children,
}: {
  hasAnyKey: boolean;
  onExample: (text: string) => void;
  /** A working thing was made; go and open it. */
  onAddKey: () => void;
  /** The composer. */
  children: React.ReactNode;
}) {
  const settings = useSettings();
  const { name, nameAsked } = settings;
  const greeting = useGreeting();
  const [draftName, setDraftName] = React.useState("");

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
            className="display flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[2rem] text-primary anim-rise sm:text-[2.5rem]"
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
