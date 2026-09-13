"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import { MAKES } from "@/lib/makes";
import { createWebCanvas } from "@/lib/db";
import { MakeMark } from "@/components/MakeRow";
import { MessageBar } from "@/components/chat/MessageBar";

/**
 * The room where things get made.
 *
 * Two ways in, and both end with the thing running rather than described.
 *
 * Say what you want. The box at the top is the composer, tuned for making:
 * whatever you type here starts a conversation in which every answer is a
 * page — the thing itself, running beside the thread, with the code behind
 * a press for whoever wants it. "A flashcard deck for Spanish verbs" is a
 * deck a few seconds later, and "make the back bigger" is the same deck,
 * bigger. That is what makes this room different from a chat: the chat
 * reads each request and decides; this room has already decided.
 *
 * Or press one. The five starters are already something — a deck that
 * flips, a week that knows what day it is — and they open in Code, running,
 * with a half-written instruction for filling in your own material. No
 * model is asked; they are instant.
 *
 * ## It has no viewer of its own
 *
 * What it makes is a canvas, and canvases live and run in Code, or beside
 * the conversation that asked for them. Two rooms rendering the same object
 * would be two places for one thing and two sets of bugs.
 */
const IDEAS = [
  "Make me a flashcard deck for Spanish verbs",
  "Make me a Pomodoro timer with a sweeping ring",
  "Make me a habit tracker for the week",
  "Make me a quiz on the solar system, scored",
  "Make me a budget calculator with a chart",
  "Make me a word game I can play on my phone",
];

export function CreativeView({
  onMade,
  onBuild,
}: {
  /** Built and ready: hand it to the room that runs canvases. */
  onMade: (canvasId: string, seed: string) => void;
  /** Start a making conversation with this request. */
  onBuild: (text: string) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    onBuild(t);
  };

  return (
    <div className="mx-auto w-full max-w-[var(--measure-wide)] px-4 py-8">
      <h1 className="text-[1.75rem] font-medium leading-tight text-primary sm:text-3xl">What should we make?</h1>
      <p className="mt-1 max-w-prose text-sm text-secondary">
        Describe it and it is built and running beside the conversation — a working thing, not a page of
        code. Ask for changes in the same breath and it changes in place.
      </p>

      <div className="mt-5">
        <MessageBar
          value={text}
          onChange={setText}
          onSubmit={submit}
          placeholder="A flashcard deck for… a timer that… a tracker for…"
          ariaLabel="What to make"
          canSend={Boolean(text.trim())}
          autoFocus
          className="glass"
        />
      </div>

      {/* Ideas, written as requests, sent as they are. A blank box in a room
          called Creative is the one place a blank box is unkind. */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Ideas">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            onClick={() => onBuild(idea)}
            className="focus-inset tap rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
          >
            {idea.replace(/^Make me a /, "A ")}
          </button>
        ))}
      </div>

      <h2 className="mt-10 text-base font-medium text-primary">Ready this second</h2>
      <p className="mt-0.5 text-sm text-tertiary">
        Already built. Press one and it opens running, with a half-written instruction for putting your
        own material in.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

        <button
          onClick={() => document.querySelector<HTMLTextAreaElement>(".composer-shell textarea")?.focus()}
          className="lift focus-inset tap flex flex-col items-start gap-0.5 rounded-xl border border-dashed border-line bg-transparent p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
        >
          <span className="text-tertiary">
            <Wand2 size={16} />
          </span>
          <span className="mt-1 text-sm font-medium text-primary">Anything else</span>
          <span className="text-xs text-tertiary">Describe it above and it gets built.</span>
        </button>
      </div>
    </div>
  );
}
