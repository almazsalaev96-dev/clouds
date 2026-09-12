"use client";

import { useSyncExternalStore } from "react";
import { storageTrouble, watchStorage } from "@/lib/db";

/**
 * The one thing this app cannot recover from, said out loud.
 *
 * Everything here lives in the browser: the conversations, the notes, the
 * canvases, the keys. When the browser will not let it save — a private
 * window, site data switched off, a second tab holding an older version of the
 * schema — every query fails the same quiet way, every list renders its empty
 * state, and the app looks brand new and perfectly well. Somebody works in it
 * for an hour and loses all of it on close.
 *
 * Neither case is fixable from in here, which is exactly why it has to be
 * said. A fault you can route around is a different thing from a bug.
 */
export function StorageNotice() {
  const trouble = useSyncExternalStore(watchStorage, storageTrouble, () => null);
  if (!trouble) return null;

  return (
    <div
      role="alert"
      className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[var(--stop)] bg-[color-mix(in_srgb,var(--stop)_10%,transparent)] px-4 py-2 text-center"
    >
      <span className="text-sm text-primary">
        {trouble === "blocked"
          ? "Another tab has Armi open and is holding up an update. Close the others, then reload."
          : "This browser will not let Armi save anything — a private window, or site data switched off. Nothing you write here will survive closing the tab."}
      </span>
      {trouble === "blocked" && (
        <button
          onClick={() => location.reload()}
          className="focus-inset rounded-md px-1.5 py-0.5 text-sm font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
        >
          Reload
        </button>
      )}
    </div>
  );
}
