"use client";

import * as React from "react";
import { ArrowDown, Zap } from "lucide-react";
import type { ChatError, Message as Msg } from "@/lib/types";
import { getModel } from "@/lib/models";
import { siblingIndex, siblingsFrom } from "@/lib/db";
import { cn, formatElapsed } from "@/lib/utils";
import { AssistantMessage, InlineError, UserMessage } from "./Message";
import { Markdown, useThrottled } from "./Markdown";
import { CompareGrid } from "./Compare";

/** How far the user must scroll up before we stop following the stream. */
const RELEASE_PX = 40;
/** Past this, silence is worth explaining. */
const PATIENCE_MS = 5000;
/** Past this, offer a way out rather than asking for more patience. */
const IMPATIENCE_MS = 20_000;

export function MessageList({
  messages,
  allMessages,
  streaming,
  streamText,
  streamReasoning,
  streamModelId,
  elapsed,
  error,
  onNavigate,
  onEdit,
  onRegenerate,
  onSaveToNote,
  onRetry,
  onAddKey,
  onSwitchModel,
  onDismissError,
  onScrolledChange,
  compare,
}: {
  messages: Msg[];
  allMessages: Msg[];
  streaming: "idle" | "waiting" | "streaming";
  streamText: string;
  streamReasoning: string;
  streamModelId: string;
  elapsed: number;
  error: ChatError | null;
  onNavigate: (id: string) => void;
  onEdit: (message: Msg, text: string) => void;
  onRegenerate: (message: Msg, modelId?: string) => void;
  onSaveToNote: (text: string) => void;
  onRetry: () => void;
  onAddKey: () => void;
  onSwitchModel: () => void;
  onDismissError: () => void;
  onScrolledChange: (scrolled: boolean) => void;
  compare: React.ComponentProps<typeof CompareGrid> | null;
}) {
  /* Rebuilt only when the thread itself changes — not on every frame of a
     stream, which is when this component re-renders most. */
  const byParent = React.useMemo(() => siblingIndex(allMessages), [allMessages]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = React.useState(true);
  const [unread, setUnread] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const active = streaming !== "idle";

  /* Which message, if any, has just stopped generating. Set on the falling
     edge of `active` so the glow marks an arrival rather than firing on every
     mount — opening an old conversation must not make its last answer pretend
     to have just landed. */
  const [settledId, setSettledId] = React.useState<string | null>(null);
  const wasStreaming = React.useRef(false);
  React.useEffect(() => {
    if (active) {
      wasStreaming.current = true;
      return;
    }
    if (!wasStreaming.current) return;
    wasStreaming.current = false;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return;
    setSettledId(last.id);
    const t = setTimeout(() => setSettledId(null), 1300);
    return () => clearTimeout(t);
  }, [active, messages]);

  const wasActive = React.useRef(false);
  React.useEffect(() => {
    if (wasActive.current && !active) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        const text = last.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        setAnnouncement(text.slice(0, 600));
      }
    }
    wasActive.current = active;
  }, [active, messages]);

  /**
   * Follow the stream while the user is at the bottom, and let go the moment
   * they scroll up. Yanking a reading user back down is the fastest way to
   * make an app feel hostile.
   */
  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < RELEASE_PX;
    setPinned(atBottom);
    if (atBottom) setUnread(false);
    onScrolledChange(el.scrollTop > 8);
  }, [onScrolledChange]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinned) el.scrollTop = el.scrollHeight;
    else if (active) setUnread(true);
  }, [messages.length, streamText, streamReasoning, pinned, active, compare]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setPinned(true);
    setUnread(false);
  };

  const streamModel = getModel(streamModelId);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto"
        // Not a live region. This element's contents change on every animation
        // frame of a stream and again wholesale when you switch conversations —
        // announcing either would be unusable. The status node below announces
        // one finished answer instead.
        role="region"
        aria-label="Conversation"
        aria-busy={active}
      >
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
          {messages.map((m, i) => {
            const siblings = siblingsFrom(byParent, m);
            const index = siblings.findIndex((s) => s.id === m.id);
            // Only the newest turn rises in. Animating the whole transcript on
            // every conversation switch would be motion for its own sake.
            const entering = i === messages.length - 1;
            // Callbacks take the message rather than closing over it, so they
            // keep their identity between renders and React.memo can actually
            // hold: without this, every frame of a stream re-renders every
            // message in the transcript.
            return m.role === "user" ? (
              <UserMessage
                key={m.id}
                message={m}
                siblings={siblings}
                index={index}
                onNavigate={onNavigate}
                onEdit={onEdit}
                entering={entering}
              />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                siblings={siblings}
                index={index}
                onNavigate={onNavigate}
                onRegenerate={onRegenerate}
                onSaveToNote={onSaveToNote}
                entering={entering}
                settled={m.id === settledId}
                isLast={i === messages.length - 1}
              />
            );
          })}

          {compare && <CompareGrid {...compare} />}

          {/* Hidden from assistive tech while it churns; announced once, below,
              when it is finished and worth hearing. */}
          {active && (
            <StreamingMessage
              text={streamText}
              reasoning={streamReasoning}
              modelName={streamModel.name}
              elapsed={elapsed}
              onSwitchModel={onSwitchModel}
            />
          )}

          {error && (
            <InlineError
              error={error}
              onRetry={onRetry}
              onAddKey={onAddKey}
              onSwitchModel={onSwitchModel}
              onDismiss={onDismissError}
            />
          )}
        </div>
      </div>

      {/* One polite announcement per finished answer, and nothing while it
          arrives. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* The pill is the counterweight to releasing the scroll pin: the user is
          never stranded, and never dragged. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-[opacity,transform] duration-[var(--dur-enter)] ease-[var(--ease-out)]",
          pinned ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <button
          onClick={scrollToBottom}
          tabIndex={pinned ? -1 : 0}
          className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-secondary shadow-md transition-colors duration-[var(--dur-fast)] hover:text-primary"
        >
          <ArrowDown size={13} />
          {unread ? "New message" : "Jump to latest"}
        </button>
      </div>
    </div>
  );
}

function StreamingMessage({
  text,
  reasoning,
  modelName,
  elapsed,
  onSwitchModel,
}: {
  text: string;
  reasoning: string;
  modelName: string;
  elapsed: number;
  onSwitchModel: () => void;
}) {
  // Coarsen the markdown parse to ~30fps. The reveal cadence is unchanged;
  // this only stops us re-parsing the whole message on every frame.
  const throttled = useThrottled(text, 33);
  const waiting = !text && !reasoning;

  return (
    <div className="live-ring rounded-xl px-3 py-3 -mx-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-tertiary">
        <span className="think-orb" aria-hidden />
        <span className="font-medium text-secondary">{modelName}</span>
        {waiting && elapsed > PATIENCE_MS && (
          // The honest version of a spinner: what is happening, and for how long.
          <span className="tnum anim-fade">thinking · {formatElapsed(elapsed)}</span>
        )}
      </div>

      {/* The whole answer is live, so the line spans it rather than sitting on
          one word of it. */}
      <div className="mb-3 h-0.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <div className="field-line h-full w-full" />
      </div>

      {reasoning && !text && (
        <p className="mb-2 line-clamp-2 text-sm text-tertiary">{reasoning.slice(-240)}</p>
      )}

      {throttled ? (
        <div className="relative">
          <Markdown content={throttled} streaming />
          <span className="caret" aria-hidden />
        </div>
      ) : (
        // A container with real height from the first frame, so nothing below
        // it moves when the first token lands.
        <div className="flex h-6 items-center">
          <span className="caret" aria-hidden />
        </div>
      )}

      {waiting && elapsed > IMPATIENCE_MS && (
        <button
          onClick={onSwitchModel}
          className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:underline anim-fade"
        >
          <Zap size={12} />
          Taking a while — try a faster model
        </button>
      )}
    </div>
  );
}
