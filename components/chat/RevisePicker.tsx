"use client";

import * as React from "react";
import { getModel } from "@/lib/models";
import { engineOf, getPreset } from "@/lib/presets";
import { cheapestAvailable } from "@/lib/complete";
import { useSettings } from "@/lib/store";
import { ModelPicker } from "./ModelPicker";
import { Wand2 } from "lucide-react";

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
 * So it sits where chat puts the same control and is one press to change.
 * The choice is remembered; clearing it goes back to cheapest-with-a-key.
 *
 * What it does *not* do is wear an engine's name on the bar. Everywhere else
 * in this app the thing on screen is an Armi model — a cast of two or three —
 * and a rewrite is one call with no cast behind it, so there is no Armi model
 * to name here and a vendor's name would be the only one of its kind left on
 * a toolbar. The button says what it does; the menu, the tooltip and Settings
 * say who is doing it.
 */
export function useReviseModel(configured: Record<string, boolean>): string | null {
  const chosen = useSettings((s) => s.reviseModelId);
  const keys = useSettings((s) => s.keys);
  const cheapest = cheapestAvailable(configured);
  /* What is stored is an Armi model; what a one-shot rewrite needs is an
     engine. Resolved here, against the keys that are actually present, so
     the caller gets something it can send and the person picked something
     they can recognise. */
  const engine = chosen ? engineOf(chosen, { configured, keys }) : null;
  // A model whose key has since been removed must not silently keep being
  // used — fall back rather than fail at the request.
  if (engine && (configured[getModel(engine).provider] || keys[getModel(engine).provider])) return engine;
  return cheapest;
}

export function RevisePicker({ configured }: { configured: Record<string, boolean> }) {
  const settings = useSettings();
  const [open, setOpen] = React.useState(false);
  const id = useReviseModel(configured);
  const model = id ? getModel(id) : null;
  /* What the person chose, which is an Armi model — not what it resolved to. */
  const chosen = getPreset(settings.reviseModelId ?? "");

  return (
    <ModelPicker
      open={open}
      onOpenChange={setOpen}
      value={settings.reviseModelId ?? ""}
      onChange={(next) => settings.setReviseModel(next)}
      configured={configured}
      align="end"
    >
      <button
        /* What it does, not who is rented to do it. Rewriting a file is one
           call with no tactic behind it, so there is no Armi model to name
           here — and an engine's name is the one thing this control does not
           need on screen, since choosing the engine is what opening it is
           for. The Armi model is in the menu and in this label. */
        aria-label={chosen ? `Model for this room: ${chosen.name}` : "Choose the model for this room"}
        className="btn-touch ctl-h focus-inset flex min-w-0 shrink items-center gap-1.5 rounded-full px-2 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
      >
        {model ? (
          <>
            <Wand2 size={13} className="shrink-0 text-[var(--accent-2)]" />
            <span className="truncate">{chosen?.short ?? "Auto"}</span>
          </>
        ) : (
          <span className="truncate text-tertiary">No key</span>
        )}
      </button>
    </ModelPicker>
  );
}
