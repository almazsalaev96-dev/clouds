"use client";

import * as React from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { getModel } from "@/lib/models";
import { useSettings } from "@/lib/store";
import { ProviderMark } from "@/components/ui/ProviderMark";

/**
 * The first thing anyone sees, so it is a page rather than a pitch: no hero, no
 * feature grid, no mascot, no tour. It sits at optical centre — slightly above
 * true centre, where the eye expects a title — and hands over to the composer.
 *
 * The example prompts exist only to solve the blank-page problem, so they
 * disappear the moment there is any history at all: a returning user knows what
 * they came to do, and suggesting otherwise is condescending.
 */
const EXAMPLES = [
  "Explain this error and how to fix it",
  "What's wrong with my SQL query?",
  "Rewrite this so a beginner understands it",
  "Compare two approaches and pick one",
  "Turn these notes into a short summary",
  "Write a regex for this, and explain each part",
];

export function EmptyState({
  hasAnyKey,
  isFirstEver,
  onExample,
  onAddKey,
}: {
  hasAnyKey: boolean;
  isFirstEver: boolean;
  onExample: (text: string) => void;
  onAddKey: () => void;
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
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4">
      <div className="w-full max-w-[var(--measure)] pb-[8vh]">
        {/* The placeholder already says "Ask anything". Saying it twice on one
            screen makes the heading noise, so it says the other useful thing:
            that this is a blank page and you get to pick what goes on it. */}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary anim-rise">
          {isFirstEver ? "Where should we start?" : "New chat"}
        </h1>

        <p
          className="mt-1.5 flex items-center gap-1.5 text-sm text-secondary anim-rise"
          style={{ animationDelay: "40ms" }}
        >
          {hasAnyKey ? (
            <>
              <span className="text-tertiary">
                <ProviderMark provider={model.provider} size={13} />
              </span>
              {model.name}
              <span className="hidden text-tertiary md:inline">— ⌘/ to switch</span>
            </>
          ) : (
            "Bring your own API key. Nothing is stored anywhere but your browser."
          )}
        </p>

        {!hasAnyKey && (
          <button
            onClick={onAddKey}
            className="mt-5 flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition-colors duration-[var(--dur-fast)] hover:bg-accent-hover anim-rise"
            style={{ animationDelay: "80ms" }}
          >
            <KeyRound size={14} />
            Add your API keys
          </button>
        )}

        {hasAnyKey && isFirstEver && (
          <div className="mt-6 flex flex-col gap-px">
            {examples.map((e, i) => (
              <button
                key={e}
                onClick={() => onExample(e)}
                style={{ animationDelay: `${80 + i * 35}ms` }}
                className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary anim-rise"
              >
                <span className="min-w-0 flex-1 truncate">{e}</span>
                <ArrowRight
                  size={13}
                  className="shrink-0 text-tertiary reveal"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
