"use client";

import * as React from "react";
import { getModel } from "@/lib/models";
import { cheapestAvailable } from "@/lib/generate";
import { useSettings } from "@/lib/store";
import { ModelPicker } from "./ModelPicker";
import { ProviderMark } from "@/components/ui/ProviderMark";

/**
 * Which model is about to rewrite your file, on the bar, changeable there.
 *
 * The canvas and the notebook both used to call `cheapestAvailable` and say
 * nothing about it. Cheapest is a good default — a revision is usually a
 * mechanical edit and paying Opus prices for "fix the spelling" is a waste —
 * but it is a bad secret, because the thing being picked for you is the thing
 * that edits your work, and "why did it rewrite my whole file" has a different
 * answer depending on which model did it.
 *
 * So it sits where chat puts the same control, looks the same, and is one
 * press to change. The choice is remembered; clearing it goes back to
 * cheapest-with-a-key, which is what the label says when nothing is chosen.
 */
export function useReviseModel(configured: Record<string, boolean>): string | null {
  const chosen = useSettings((s) => s.reviseModelId);
  const cheapest = cheapestAvailable(configured);
  // A model whose key has since been removed must not silently keep being
  // used — fall back rather than fail at the request.
  if (chosen && configured[getModel(chosen).provider]) return chosen;
  return cheapest;
}

export function RevisePicker({ configured }: { configured: Record<string, boolean> }) {
  const settings = useSettings();
  const [open, setOpen] = React.useState(false);
  const id = useReviseModel(configured);
  const model = id ? getModel(id) : null;

  return (
    <ModelPicker
      open={open}
      onOpenChange={setOpen}
      value={id ?? ""}
      onChange={(next) => settings.setReviseModel(next)}
      configured={configured}
      align="end"
    >
      <button
        aria-label={model ? `Model: ${model.name}` : "Choose a model"}
        className="btn-touch ctl-h focus-inset flex min-w-0 shrink items-center gap-1.5 rounded-full px-2 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
      >
        {model ? (
          <>
            <ProviderMark provider={model.provider} size={13} />
            <span className="truncate">{model.short}</span>
          </>
        ) : (
          <span className="truncate text-tertiary">No key</span>
        )}
      </button>
    </ModelPicker>
  );
}
