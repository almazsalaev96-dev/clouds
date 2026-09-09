"use client";

import * as React from "react";
import { KeyRound, X } from "lucide-react";
import { getModel } from "@/lib/models";
import { useSettings } from "@/lib/store";
import { ProviderMark } from "@/components/ui/ProviderMark";
import { Wordmark } from "@/components/brand/Logo";

/**
 * The time of day, as a greeting.
 *
 * Read on the client, because the server has no idea what time it is where
 * you are. The first render carries a neutral word and the real one lands
 * before paint; the hydration warning that would otherwise fire on the
 * mismatch is suppressed on that one element and nowhere else.
 */
function useGreeting(): string {
  // Starts as the server's word on the client too — deliberately. With
  // `suppressHydrationWarning` React keeps the server's text and does not
  // re-render unless state actually changes, so an initial state that already
  // held the right answer would leave "Hello" on screen forever. The layout
  // effect changes it before paint.
  const [g, setG] = React.useState("Hello");
  useIsoLayoutEffect(() => {
    const h = new Date().getHours();
    setG(h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
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
const EXAMPLES = [
  "Explain this error and how to fix it",
  "What's wrong with my SQL query?",
  "Rewrite this so a beginner understands it",
  "Compare two approaches and pick one",
  "Turn these notes into a short summary",
  "Write a regex for this, and explain each part",
  "Find the bug in this function",
  "Draft a reply to this message",
];

export function EmptyState({
  hasAnyKey,
  onExample,
  onAddKey,
  children,
}: {
  hasAnyKey: boolean;
  onExample: (text: string) => void;
  onAddKey: () => void;
  /** The composer. */
  children: React.ReactNode;
}) {
  const settings = useSettings();
  const { modelId, name, nameAsked } = settings;
  const model = getModel(modelId);
  const greeting = useGreeting();
  const [draftName, setDraftName] = React.useState("");

  // Chosen once per mount: examples that reshuffle while you read them are a
  // distraction, not a feature.
  const examples = React.useMemo(
    () => [...EXAMPLES].sort(() => Math.random() - 0.5).slice(0, 4),
    [],
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
          <div className="flex justify-center anim-rise" style={{ animationDelay: "20ms" }}>
            <Wordmark height={46} className="text-primary" />
          </div>

          <h1
            className="display mt-4 text-[2.125rem] text-primary anim-rise sm:text-[2.5rem]"
            suppressHydrationWarning
          >
            {greeting}
            {name ? `, ${name.trim()}` : ""}.
          </h1>
          <p
            className="display-italic mt-1 text-[1.3rem] text-secondary anim-rise"
            style={{ animationDelay: "40ms" }}
          >
            Where should we start?
          </p>
          <p
            className="mt-2.5 flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.1em] text-faint anim-rise"
            style={{ animationDelay: "60ms" }}
          >
            {hasAnyKey ? (
              <>
                <ProviderMark provider={model.provider} size={12} />
                {model.name}
              </>
            ) : (
              "Bring your own key — nothing leaves this browser"
            )}
          </p>
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
          Models make mistakes. Check anything that matters.
        </p>
      </div>
    </div>
  );
}
