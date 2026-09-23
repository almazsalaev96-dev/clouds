"use client";

import * as React from "react";

/**
 * The markdown pipeline — micromark, GFM, KaTeX — is the heaviest thing in the
 * client bundle and none of it is needed to paint the shell or the composer.
 * It loads in its own chunk, with the raw text shown meanwhile, so the first
 * message is never a blank space.
 */
const Renderer = React.lazy(() => import("./MarkdownRenderer"));

/** The text for the moment before it is typeset: no `#`, `**` or `- ` on show. */
const bare = (s: string) =>
  s.replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^(\s*)[-*+]\s+/gm, "$1• ").replace(/(\*\*|__)(.+?)\1/g, "$2");

export const Markdown = React.memo(function Markdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Once the chunk has been fetched, every later message renders instantly;
    // this only covers the very first paint of the very first session.
    import("./MarkdownRenderer").then(() => setReady(true));
  }, []);

  /* The words as they are, while the renderer is not there yet. This used
     to be two waits with one fallback: `ready` covered the first, and the
     second — the lazy component resolving after `ready` flipped — rendered
     nothing. A Notebook page opened in that gap came up as its toolbar over
     an empty sheet, "18 words" and no words, and stayed that way on one run
     in five of the rooms probe. Both waits now show the text. */
  const plain = (
    <div className="prose" dir="auto">
      <p className="whitespace-pre-wrap">{bare(content)}</p>
    </div>
  );
  if (!ready) {
    /* `dir="auto"` and not an app-wide direction. Four providers, all fluent in
       Arabic, Hebrew, Persian and Urdu; without this an answer in any of them
       renders left-aligned with its terminal punctuation at the wrong end. Per
       block rather than per app because a thread is routinely mixed — an Arabic
       explanation with an English identifier in it — and the browser decides
       from the first strong character, which is the one heuristic that gets a
       mixed line right. */
    return (
      <div className="prose" dir="auto">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    );
  }
  return (
    <React.Suspense fallback={plain}>
      <Renderer content={content} streaming={streaming} />
    </React.Suspense>
  );
});

/**
 * Re-parsing markdown on every animation frame is wasteful, and no reader can
 * perceive the difference between 60 and 30 updates per second in prose. The
 * text still arrives evenly — this only coarsens the parse cadence.
 */
export function useThrottled<T>(value: T, ms = 33): T {
  const [throttled, setThrottled] = React.useState(value);
  const last = React.useRef(0);
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const now = Date.now();
    const since = now - last.current;
    if (since >= ms) {
      last.current = now;
      setThrottled(value);
    } else {
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        last.current = Date.now();
        setThrottled(value);
      }, ms - since);
    }
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [value, ms]);

  return throttled;
}
