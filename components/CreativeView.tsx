"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import { MAKES } from "@/lib/makes";
import { createWebCanvas } from "@/lib/db";
import { MakeMark } from "@/components/MakeRow";

/**
 * The room where things get made.
 *
 * Creative used to be a switch in the composer: a question about the machine,
 * asked before you had said anything, and answered by a toggle most people
 * never found. The app reads the request now, which covers the common case —
 * "build me a timer" gets a timer without anyone choosing a mode. This is the
 * other half, for when you do not yet know what you want to ask for: a place
 * you go, with the things it can build on the page.
 *
 * ## It has no viewer of its own
 *
 * What it makes is a canvas, and canvases live and run in Code. Two rooms
 * rendering the same object would be two places for one thing and two sets of
 * bugs. So this room's whole job is the choosing: press one and you land in
 * Code with it built, running, and a half-written instruction in the box.
 *
 * The row of the same starters used to sit at the bottom of the Code index.
 * It is here instead — one copy, in the room named after it.
 */
export function CreativeView({
  onMade,
  onAnything,
}: {
  /** Built and ready: hand it to the room that runs canvases. */
  onMade: (canvasId: string, seed: string) => void;
  /** Anything not on the list, which is most things. */
  onAnything: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[var(--measure-wide)] px-4 py-8">
      <h1 className="text-xl font-medium text-primary">Make something</h1>
      <p className="mt-1 text-sm text-secondary">
        Press one and it is built and running a second later, with a half-written
        instruction under it for filling in your own material.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MAKES.map((m) => (
          <button
            key={m.id}
            disabled={busy !== null}
            onClick={async () => {
              setBusy(m.id);
              try {
                // The folder arrives now rather than at load; see lib/makes.ts.
                const canvas = await createWebCanvas(await m.files(), { title: m.title });
                onMade(canvas.id, m.ask);
              } finally {
                setBusy(null);
              }
            }}
            className="lift focus-inset tap flex flex-col items-start gap-0.5 rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong disabled:opacity-60"
          >
            <span className="text-[var(--accent-2)]">
              <MakeMark icon={m.icon} size={16} />
            </span>
            <span className="mt-1 text-sm font-medium text-primary">{m.name}</span>
            <span className="text-xs text-tertiary">{busy === m.id ? "Building…" : m.blurb}</span>
          </button>
        ))}

        {/* Five starters is five answers to a question with no end of them.
            This is the honest sixth: say what you want and it gets built. */}
        <button
          onClick={onAnything}
          className="lift focus-inset tap flex flex-col items-start gap-0.5 rounded-xl border border-dashed border-line bg-transparent p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
        >
          <span className="text-tertiary">
            <Wand2 size={16} />
          </span>
          <span className="mt-1 text-sm font-medium text-primary">Anything else</span>
          <span className="text-xs text-tertiary">Describe it and it gets built.</span>
        </button>
      </div>
    </div>
  );
}
