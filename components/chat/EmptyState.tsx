"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { getModel } from "@/lib/models";
import { useSettings } from "@/lib/store";

/**
 * The first thing a new user sees, so it is a page rather than a pitch: no
 * hero, no feature grid, no mascot. Examples exist to remove the blank-page
 * problem, and disappear once the user clearly knows what they are doing.
 */
const EXAMPLES = [
  "Explain this error and how to fix it",
  "Rewrite this so a beginner understands it",
  "What's wrong with my SQL query?",
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
  const examples = React.useMemo(
    () => [...EXAMPLES].sort(() => Math.random() - 0.5).slice(0, 4),
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-[var(--measure)] flex-1 flex-col justify-end px-4 pb-6 anim-fade">
      <h1 className="text-xl font-semibold tracking-tight text-primary">
        {isFirstEver ? "Ask anything." : "New chat"}
      </h1>
      <p className="mt-1 text-sm text-secondary">
        {hasAnyKey
          ? `Talking to ${model.name}.`
          : "Add an API key to get started — you bring your own."}
        {hasAnyKey && (
          <span className="hidden md:inline"> Press ⌘/ to switch.</span>
        )}
      </p>

      {!hasAnyKey && (
        <button
          onClick={onAddKey}
          className="mt-4 flex items-center gap-2 self-start rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
        >
          <KeyRound size={14} className="text-tertiary" />
          Add your API keys
        </button>
      )}

      {hasAnyKey && isFirstEver && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {examples.map((e) => (
            <button
              key={e}
              onClick={() => onExample(e)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
