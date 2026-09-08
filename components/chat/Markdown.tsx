"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/**
 * The markdown pipeline — micromark, GFM, KaTeX — is the heaviest thing in the
 * client bundle and none of it is needed to paint the shell or the composer.
 * It loads in its own chunk, with the raw text shown meanwhile, so the first
 * message is never a blank space.
 */
const Renderer = dynamic(() => import("./MarkdownRenderer"), {
  ssr: false,
  loading: () => null,
});

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

  if (!ready) {
    return (
      <div className="prose">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    );
  }
  return <Renderer content={content} streaming={streaming} />;
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
