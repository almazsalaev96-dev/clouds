"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { getModel } from "@/lib/models";
import { useSettings } from "@/lib/store";
import { ProviderMark } from "@/components/ui/ProviderMark";

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
  const { modelId } = useSettings();
  const model = getModel(modelId);

  // Chosen once per mount: examples that reshuffle while you read them are a
  // distraction, not a feature.
  const examples = React.useMemo(
    () => [...EXAMPLES].sort(() => Math.random() - 0.5).slice(0, 4),
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-[var(--measure)] pb-[6vh]">
        <div className="mb-6 text-center">
          {/* The placeholder already says "Ask anything". Saying it twice on
              one screen makes the heading noise, so it says the other useful
              thing: this is a blank page and you get to pick what goes on it. */}
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.025em] text-primary anim-rise">
            Where should we start?
          </h1>
          <p
            className="mt-2 flex items-center justify-center gap-1.5 text-sm text-tertiary anim-rise"
            style={{ animationDelay: "40ms" }}
          >
            {hasAnyKey ? (
              <>
                <ProviderMark provider={model.provider} size={13} />
                {model.name}
                <span className="hidden md:inline">— ⌘/ to switch</span>
              </>
            ) : (
              "Bring your own API key. Nothing is stored anywhere but your browser."
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
                className="focus-inset lift anim-rise rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-secondary hover:border-line-strong hover:text-primary"
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex justify-center">
            <button
              onClick={onAddKey}
              className="bloom focus-inset anim-rise flex items-center gap-2 rounded-full bg-[var(--accent-fill)] px-4 py-2 text-sm font-medium text-accent-fg"
              style={{ animationDelay: "120ms" }}
            >
              <KeyRound size={14} />
              Add your API keys
            </button>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-faint">
          Models make mistakes. Check anything that matters.
        </p>
      </div>
    </div>
  );
}
