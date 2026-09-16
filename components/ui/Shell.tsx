"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";

/**
 * The part of the app that keeps working without the internet.
 *
 * Registers the worker that holds a copy of the page and its scripts (see
 * `public/sw.js`), and says so, quietly, when the connection is gone: the
 * rooms that never needed it — cards, notes, the things you have made —
 * carry on, and a question to a model gets a plain reason instead of a
 * spinner that never ends.
 *
 * Not under automation. A worker answers fetches before the test driver's
 * own interception sees them, and the screenshots would be of a page the
 * probe never served.
 */
export function Shell() {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    if (typeof navigator === "undefined") return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    /* Built only. Under the dev server a chunk's name never changes while
       its contents do, and cache-first would serve the first edit forever. */
    if ("serviceWorker" in navigator && !navigator.webdriver && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /* The region is always there and only its words come and go: a live
     region that arrives with its text already in it is, in most screen
     readers, a region that said nothing. */
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] z-30 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {offline && (
        <div className="glass pointer-events-auto flex max-w-[min(25rem,100%)] items-center gap-3 rounded-md border border-line px-4 py-3 shadow-lg anim-toast">
          <WifiOff size={14} className="shrink-0 text-tertiary" aria-hidden />
          <span className="min-w-0 text-sm text-secondary">
            <span className="text-primary">Offline.</span> Cards, pages and canvases still work; asking a model needs the connection.
          </span>
        </div>
      )}
    </div>
  );
}
