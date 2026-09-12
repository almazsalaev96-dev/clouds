"use client";

import * as React from "react";
import { db } from "@/lib/db";

/**
 * What is left when the render throws.
 *
 * There was no error boundary anywhere in this app, which in a production
 * React build means a throw during render unmounts the whole tree and leaves
 * the browser's blank page. That is bad in any app and specific here, because
 * this one keeps everything the person has ever written in their own browser
 * and nowhere else.
 *
 * The path is not hypothetical. `restoreBackup` admitted any row with a string
 * id, so a message whose `content` came back as a string rather than an array
 * of blocks — a truncated download, a half-synced file, a backup somebody
 * opened in a text editor — went into the database and then reached
 * `blockText`, which does `content.map(...)`. And it does not fail once:
 * `lastConversationId` reopens that same thread on the next load, so the app
 * is permanently unopenable with every conversation inside it.
 *
 * So this is not an apology screen. The two buttons are the two things that
 * actually get somebody out: leave the thread that is throwing, and take a
 * copy of everything before touching anything. A crash net whose only offer is
 * "reload" returns you to the crash.
 *
 * ## Why a class
 *
 * `componentDidCatch` has no hook equivalent. This is the one place in the
 * codebase where a class is not a style choice.
 *
 * ## What it deliberately does not do
 *
 * It does not clear the database, and it does not offer to. The failure this
 * exists for is one bad row out of thousands of good ones, and an app that
 * responds to a render error by deleting the user's work has converted a
 * recoverable fault into the thing they were most afraid of. Leaving the
 * thread is reversible; export is additive; neither destroys anything.
 */
export class CrashNet extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The console is the only place a developer will look, and the component
    // stack is the half React does not put in the message.
    console.error("Armi crashed while rendering", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <Crashed error={this.state.error} />;
  }
}

function Crashed({ error }: { error: Error }) {
  const [leaving, setLeaving] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);

  /* Leaving is the fix nine times out of ten, because the row that throws is
     almost always in the thread that was open. Clearing the pointer and
     reloading is what a person cannot do for themselves from a blank page. */
  const leave = () => {
    setLeaving(true);
    try {
      const raw = localStorage.getItem("store.settings.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state) {
          delete parsed.state.lastConversationId;
          parsed.state.section = "chat";
          localStorage.setItem("store.settings.v1", JSON.stringify(parsed));
        }
      }
    } catch {
      // A storage that will not answer is the one case where there is nothing
      // to clear, and reloading is still worth a try.
    }
    location.reload();
  };

  /* Straight off the tables rather than through `exportBackup`, because
     whatever is wrong is upstream of the code that would normally do this and
     the point of a lifeboat is that it does not share a hull with the ship. */
  const rescue = async () => {
    try {
      const out: Record<string, unknown[]> = {};
      for (const t of db.tables) out[t.name] = await t.toArray();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify({ rescuedAt: new Date().toISOString(), data: out }, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `armi-rescue-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaved("Saved to your downloads.");
    } catch (e) {
      setSaved(`Could not read the database: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-10 text-primary"
    >
      <h1 className="text-xl font-medium">Something in this conversation stopped the app drawing.</h1>
      <p className="text-base text-secondary">
        Nothing has been deleted. Your work is still in this browser — the app just could not render
        what it found. Leaving the conversation it was showing gets you back in almost every case.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={leave}
          disabled={leaving}
          className="btn-touch ctl-h press focus-inset flex items-center rounded-lg bg-accent-fill px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          {leaving ? "Reloading…" : "Leave this conversation and reload"}
        </button>
        <button
          onClick={rescue}
          className="btn-touch ctl-h press focus-inset flex items-center rounded-lg border border-line-strong px-4 text-sm text-primary hover:bg-subtle"
        >
          Save a copy of everything first
        </button>
      </div>

      {saved && (
        <p role="status" className="text-sm text-secondary">
          {saved}
        </p>
      )}

      {/* The message, because somebody has to be able to report this, and a
          screenshot of a sentence about being sorry is not a bug report. */}
      <details className="mt-2 text-sm text-tertiary">
        <summary className="cursor-pointer focus-inset rounded-sm">What went wrong</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-inset p-3 text-xs">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      </details>
    </div>
  );
}
