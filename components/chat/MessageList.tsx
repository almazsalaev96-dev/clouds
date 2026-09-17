"use client";

import * as React from "react";
import { ArrowDown, Zap } from "lucide-react";
import { lintAnswer } from "@/lib/lint";
import { blockText } from "@/lib/db";
import type { Rating, ChatError, Message as Msg } from "@/lib/types";
import { PointAt, type PointAction } from "./PointAt";
import { authorName } from "@/lib/presets";
import { siblingIndex, siblingsFrom } from "@/lib/db";
import { cn, formatElapsed } from "@/lib/utils";
import { AssistantMessage, InlineError, UserMessage } from "./Message";
import { builtDocument, building, titleOf, withoutBuild } from "@/lib/built";
import { Markdown, useThrottled } from "./Markdown";
import { CompareGrid } from "./Compare";

/** How far the user must scroll up before we stop following the stream. */
const RELEASE_PX = 40;
/** Past this, silence is worth explaining. */
const PATIENCE_MS = 5000;
/** Past this, offer a way out rather than asking for more patience. */
const IMPATIENCE_MS = 20_000;

function MessageListImpl({
  messages,
  allMessages,
  streaming,
  streamText,
  streamReasoning,
  dropped,
  streamModelId,
  streamPresetId,
  elapsed,
  retryingInMs,
  error,
  onNavigate,
  onEdit,
  onRemember,
  onRegenerate,
  onSaveToNote,
  onOpenMade,
  onComputed,
  onMakeCards,
  onOpenInCanvas,
  onContinue,
  onTighten,
  onFollowUp,
  teaching,
  onRate,
  onVerify,
  verifyingId,
  onRetry,
  onAddKey,
  onSwitchModel,
  onDismissError,
  onPoint,
  onScrolledChange,
  compare,
}: {
  messages: Msg[];
  allMessages: Msg[];
  streaming: "idle" | "waiting" | "streaming";
  streamText: string;
  streamReasoning: string;
  /** Turns left out of the request to make it fit the window. */
  dropped: number;
  streamModelId: string;
  /** The Armi model this stream is answering as, where one was chosen. */
  streamPresetId?: string | null;
  elapsed: number;
  /** Milliseconds until the stream tries again after a rate limit; 0 otherwise. */
  retryingInMs: number;
  error: ChatError | null;
  onNavigate: (id: string) => void;
  onEdit: (message: Msg, text: string) => void;
  onRemember?: (text: string) => void;
  onRegenerate: (message: Msg, modelId?: string) => void;
  onSaveToNote: (text: string) => void;
  onOpenMade?: (message: Msg) => void;
  onComputed?: (message: Msg, out: import("@/lib/compute").Outcome) => void;
  onMakeCards?: (text: string) => void;
  onOpenInCanvas: (text: string) => void;
  onContinue: () => void;
  /** Regenerate the answer without the packaging the linter found in it. */
  onTighten: (message: Msg) => void;
  /** Send a canned follow-up as the next user turn. */
  onFollowUp: (text: string) => void;
  /** A teaching stance is on for this thread; the last row offers hints. */
  teaching?: boolean;
  /** Store a thumbs up or down; a down with a reason regenerates with it. */
  onRate: (message: Msg, rating: Rating) => void;
  /** Ask a model from another provider whether an answer is right. */
  onVerify: (message: Msg) => void;
  verifyingId?: string | null;
  onRetry: () => void;
  onAddKey: () => void;
  onSwitchModel: () => void;
  onDismissError: () => void;
  /** Ask about a span of an answer, with the span quoted rather than described. */
  onPoint: (action: PointAction, quote: string) => void;
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
        /* A built thing is announced as a thing, not read out as markup. */
        const doc = builtDocument(text);
        setAnnouncement(
          doc
            ? `${withoutBuild(text)} Built ${titleOf(doc)}. It is running beside the conversation.`.slice(0, 600)
            : text.slice(0, 600),
        );
      }
    }
    wasActive.current = active;
  }, [active, messages]);

  /* A failure has to be heard as well as seen. An errored turn is deliberately
     not saved as a message, so the announcement above has nothing to read and
     stays on the last thing that worked — somebody listening waits for an
     answer that is never coming. Cleared first so that the same failure twice
     running is announced twice: a live region says nothing when the text it
     already holds is written into it again. */
  React.useEffect(() => {
    if (!error) return;
    setAnnouncement("");
    const t = setTimeout(() => setAnnouncement(error.message), 60);
    return () => clearTimeout(t);
  }, [error]);

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

  /* The name over an answer being written is the same name it will carry
     once it is written. Watching one company's model think and then reading
     "ARMI Pulsar" over the result is two different authors for one answer. */
  const streamAuthor = authorName(streamPresetId, streamModelId);

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
        {/* Which reading mode the text inside is set in. A thread is read once,
            at speed, often while the next words are still arriving. */}
        <div data-read="chat" className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
          {/* Said once, at the top of what is left, in the place the missing
              turns used to be. A conversation that quietly forgets its own
              beginning and carries on is the most disorienting thing an
              assistant can do; the fix is not to hide it better. */}
          {dropped > 0 && (
            <div className="mb-4 flex items-center gap-3 anim-fade">
              <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
              <span className="eyebrow text-faint">
                {dropped} earlier {dropped === 1 ? "message" : "messages"} not sent — too long to fit
              </span>
              <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
            </div>
          )}

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
            /* The last answer is read back against the house rules, here
               rather than in the message, because the question it answered is
               one message up the path and only this component has the path.
               Only when nothing is streaming: a Tighten button beside an
               answer that is being replaced is a button for the wrong thing. */
            const last = i === messages.length - 1 && streaming === "idle";
            const asked = last ? [...messages.slice(0, i)].reverse().find((x) => x.role === "user") : undefined;
            const findings = last && m.role === "assistant"
              ? lintAnswer(blockText(m.content), asked ? blockText(asked.content) : undefined)
              : undefined;
            return m.role === "user" ? (
              <UserMessage
                key={m.id}
                message={m}
                siblings={siblings}
                index={index}
                onNavigate={onNavigate}
                onEdit={onEdit}
                onRemember={onRemember}
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
                onOpenMade={onOpenMade}
                onComputed={onComputed}
                onMakeCards={onMakeCards}
                onOpenInCanvas={onOpenInCanvas}
                onContinue={onContinue}
                onTighten={onTighten}
                onFollowUp={last ? onFollowUp : undefined}
                teaching={teaching}
                findings={findings}
                onRate={onRate}
                onSwitchModel={onSwitchModel}
                onVerify={onVerify}
                verifying={verifyingId === m.id}
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
              modelName={streamAuthor}
              elapsed={elapsed}
              retryingInMs={retryingInMs}
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

      <PointAt scope={scrollRef} onAct={onPoint} />

      {/* One polite announcement per finished answer, and nothing while it
          arrives. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* The pill is the counterweight to releasing the scroll pin: the user is
          never stranded, and never dragged. */}
      <div
        className={cn(
          "no-print pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-[opacity,transform] duration-[var(--dur-enter)] ease-[var(--ease-out)]",
          pinned ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <button
          onClick={scrollToBottom}
          tabIndex={pinned ? -1 : 0}
          className="ctl-h [--ctl:2rem] pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-secondary shadow-md transition-colors duration-[var(--dur-fast)] hover:text-primary"
        >
          <ArrowDown size={13} />
          {unread ? "New message" : "Jump to latest"}
        </button>
      </div>
    </div>
  );
}

/**
 * Memoised, because a transcript is the most expensive thing on the page and
 * the cheapest thing to rebuild by accident. Even with every message memoised,
 * mapping four hundred of them into four hundred elements and reconciling them
 * is real work, and it was happening on every keystroke in the composer — a
 * component two levels away that this one has nothing to do with.
 */
export const MessageList = React.memo(MessageListImpl);

function StreamingMessage({
  text,
  reasoning,
  modelName,
  elapsed,
  retryingInMs,
  onSwitchModel,
}: {
  text: string;
  reasoning: string;
  modelName: string;
  elapsed: number;
  retryingInMs: number;
  onSwitchModel: () => void;
}) {
  // Coarsen the markdown parse to ~30fps. The reveal cadence is unchanged;
  // this only stops us re-parsing the whole message on every frame.
  const throttled = useThrottled(text, 33);
  const waiting = !text && !reasoning;
  /* A page being written is not shown as it is written. The person asked
     for flashcards; watching four hundred lines of markup scroll past is
     not what they asked for, and the card that says "Building Flashcards ·
     212 lines" tells them everything the markup would have. */
  const build = building(throttled);

  return (
    <div className="live-ring rounded-xl px-3 py-3 -mx-3">
      {/* The word is the animation.
          There used to be three things moving here at once: a ring spinning in
          the corner, a bar sweeping the full width of the answer, and the
          elapsed seconds counting up — three separate claims that something
          was happening, none of which said anything the other two did not.
          ChatGPT makes the whole indicator one word with a light passing
          through it, and that is the right amount: a spinner is a machine
          noise, a word is a status. The seconds stay, because after a few of
          them the honest question is "how long" and only one of the three was
          ever answering it. */}
      <div className="mb-2 flex items-center gap-2 text-xs text-tertiary">
        <span className="font-medium text-secondary">{modelName}</span>
        {/* The retry, said. The stream has always known when it was waiting
            out a rate limit and for how long — `retryingInMs` was set on
            that path and read by nothing, so the indicator said "Thinking"
            while the app was in fact doing nothing for eight seconds. The
            honest word for that state is the one it uses now. */}
        {retryingInMs > 0 ? (
          <span className="sheen font-medium">
            Retrying<span className="tnum"> · {Math.ceil(retryingInMs / 1000)}s</span>
          </span>
        ) : waiting ? (
          <span className="sheen font-medium">
            Thinking{elapsed > PATIENCE_MS && <span className="tnum"> · {formatElapsed(elapsed)}</span>}
          </span>
        ) : (
          <span className="sheen font-medium">Writing</span>
        )}
      </div>

      {reasoning && !text && (
        <p className="mb-2 line-clamp-2 text-sm text-tertiary">{reasoning.slice(-240)}</p>
      )}

      {build ? (
        <div>
          {build.before.trim() && <Markdown content={build.before} streaming />}
          <div role="status" className="my-2 flex max-w-[28rem] items-center gap-3 rounded-lg border border-line bg-surface p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
              <span className="sheen text-sm font-medium">⋯</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="sheen block text-base font-medium">Building {build.title}</span>
              <span className="block text-xs text-tertiary">
                Web app · <span className="tnum">{build.lines}</span> lines so far
              </span>
            </span>
          </div>
        </div>
      ) : throttled ? (
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
