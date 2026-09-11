"use client";

import * as React from "react";
import { CalendarRange, CheckCheck, ListChecks, Sparkles, Timer, Wand2 } from "lucide-react";
import { MAKES } from "@/lib/makes";
import { createWebCanvas } from "@/lib/db";

/**
 * The starter row, on its own.
 *
 * It lived in the canvas, which is where it is used — and it is also used by
 * the blank chat page, which meant every first paint in the app pulled in the
 * code editor, the diff, the sandboxed preview and the console to draw five
 * buttons. Nobody's first act here is to open the Code section; nobody should
 * pay for it on the way to a first message. Its own module, so the canvas can
 * be loaded when somebody actually goes there.
 */

/** A lucide mark per make, resolved here so the catalogue stays a plain module. */
export function MakeMark({ icon, size = 15 }: { icon: string; size?: number }) {
  if (icon === "CalendarRange") return <CalendarRange size={size} />;
  if (icon === "ListChecks") return <ListChecks size={size} />;
  if (icon === "CheckCheck") return <CheckCheck size={size} />;
  if (icon === "Timer") return <Timer size={size} />;
  return <Sparkles size={size} />;
}

/**
 * The things you can make, as one row of buttons.
 *
 * Shared between the Code index and a blank Creative page, because it is the
 * same offer in both places: press one and there is a working thing on screen
 * a second later, already running, with your half-written instruction waiting
 * in the box under it.
 */
export function MakeRow({
  onSelect,
  onAnything,
}: {
  onSelect: (id: string, seed: string) => void;
  /** Anything not on the list — which is most things. */
  onAnything?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MAKES.map((m) => (
        <button
          key={m.id}
          title={m.blurb}
          onClick={async () => {
            // The folder arrives now rather than at load; see lib/makes.ts.
            const canvas = await createWebCanvas(await m.files(), { title: m.title });
            onSelect(canvas.id, m.ask);
          }}
          className="lift focus-inset tap inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-meta text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
        >
          <span className="text-[var(--accent-2)]">
            <MakeMark icon={m.icon} size={14} />
          </span>
          {m.name}
        </button>
      ))}
      {/* Five starters is five answers to a question with no end of them. This
          is the honest sixth: say what you want and it gets built, because
          that is what Creative does with anything you ask it to make. */}
      {onAnything && (
        <button
          onClick={onAnything}
          title="Describe anything and it gets built"
          className="lift focus-inset tap inline-flex items-center gap-2 rounded-full border border-dashed border-line bg-transparent px-3.5 py-1.5 text-meta text-tertiary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
        >
          <Wand2 size={14} />
          Anything else…
        </button>
      )}
    </div>
  );
}
