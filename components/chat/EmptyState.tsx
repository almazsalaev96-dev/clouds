"use client";

import * as React from "react";
import { KeyRound, X } from "lucide-react";
import { useSettings } from "@/lib/store";
import { findMode } from "@/lib/modes";
import { Mark } from "@/components/brand/Logo";
import { MakeRow } from "@/components/CanvasView";

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
  onMake,
  onAddKey,
  children,
}: {
  hasAnyKey: boolean;
  onExample: (text: string) => void;
  /** A working thing was made; go and open it. */
  onMake: (canvasId: string, seed: string) => void;
  onAddKey: () => void;
  /** The composer. */
  children: React.ReactNode;
}) {
  const settings = useSettings();
  const { name, nameAsked } = settings;
  const greeting = useGreeting();
  const spec = findMode(settings.mode);
  const [draftName, setDraftName] = React.useState("");

  // Chosen once per mount: examples that reshuffle while you read them are a
  // distraction, not a feature.
  /* Reshuffled when the mode changes and at no other time: openers that
     rearrange themselves while you are reading them are a distraction, and
     openers that stay put when you switch modes are the app not noticing. */
  const examples = React.useMemo(
    () => [...spec.openers].sort(() => Math.random() - 0.5).slice(0, 4),
    [spec.id],
  );

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
              className="mt-2.5 text-xs uppercase tracking-[0.1em] text-faint anim-rise"
              style={{ animationDelay: "60ms" }}
            >
              Bring your own key — nothing leaves this browser
            </p>
          )}
        </div>

        <div className="anim-rise" style={{ animationDelay: "70ms" }}>
          {children}
        </div>

        {hasAnyKey ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {examples.map((e, i) => (
              <button
                key={e}
                onClick={() => onExample(e)}
                style={{ animationDelay: `${120 + i * 40}ms` }}
                className="tap focus-inset lift anim-rise inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-secondary hover:border-line-strong hover:text-primary"
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
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

        {/* And then, in Creative, the things you can have as a *thing* rather
            than as a paragraph. "Make me a timetable" answered with a
            description of a timetable is the app not understanding the
            request, so the five shapes it can actually build are offered as
            buttons: press one and a working, animated version is on screen a
            second later, with your half-written instruction under it.

            Below the sentences and not above them, because "or" has to come
            after the thing it is an alternative to. Chat does not get this
            row — it is a different question. */}
        {hasAnyKey && spec.id === "creative" && (
          <div className="mt-6 anim-rise" style={{ animationDelay: "300ms" }}>
            <p className="mb-2.5 text-center text-xs uppercase tracking-[0.08em] text-faint">
              Or make something you can use
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <MakeRow
                onSelect={(id, seed) => onMake(id, seed)}
                onAnything={() => onExample("Make me a ")}
              />
            </div>
          </div>
        )}

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
        <p className="mt-6 text-center text-xs text-faint">
          May make mistakes. Check anything that matters.
        </p>
      </div>
    </div>
  );
}
