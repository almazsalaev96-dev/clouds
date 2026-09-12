"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatError, ContentBlock, Message, StreamEvent, Usage } from "../types";
import { getModel, estimateTokens } from "../models";
import { db, addMessage, uid } from "../db";
import { useSettings, paramsFor } from "../store";
import { fitToContext } from "../context";

export type Phase = "idle" | "waiting" | "streaming";

interface StreamState {
  phase: Phase;
  /** Set while waiting out a rate limit before trying again. */
  retryingInMs: number;
  /**
   * Which conversation this stream belongs to.
   *
   * Without it the page can only ask "is something streaming", so it stopped
   * the stream whenever you navigated — the safe-looking choice that threw away
   * the answer you were waiting for. With it, the page asks "is this stream
   * mine", and an answer finishes wherever it was started.
   */
  conversationId: string | null;
  text: string;
  reasoning: string;
  /** Milliseconds since send. Drives the honest "thinking · 6s" counter. */
  elapsed: number;
  ttft: number | null;
  error: ChatError | null;
  messageId: string | null;
}

const EMPTY: StreamState = {
  phase: "idle",
  retryingInMs: 0,
  conversationId: null,
  text: "",
  reasoning: "",
  elapsed: 0,
  ttft: null,
  error: null,
  messageId: null,
};

/**
 * Streaming controller.
 *
 * The important part is not the fetch — it is the reveal. Providers emit tokens
 * in ragged bursts: forty characters, then nothing for 300ms, then a hundred.
 * Rendered raw, that reads as stuttering, and stuttering reads as slow. So
 * arriving text goes into a buffer and a rAF loop drains it at a rate
 * proportional to how far behind it is. The result finishes at exactly the same
 * moment and *feels* considerably faster, which is the only speed the user has.
 */
export function useStream(onFinish?: (m: Message) => void) {
  const [state, setState] = useState<StreamState>(EMPTY);
  // setState is async; the retry wrapper needs the error the moment the run
  // returns, not on the next render.
  const errorRef = useRef<ChatError | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCancelRef = useRef<(() => void) | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  /** When the buffer last grew. The drain holds a partial word only this long. */
  const fedRef = useRef(0);
  const shownRef = useRef("");
  const reasoningRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const ttftRef = useRef<number | null>(null);
  const usageRef = useRef<Usage | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const stopLoops = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => () => {
    stopLoops();
    abortRef.current?.abort();
  }, [stopLoops]);

  const drain = useCallback(() => {
    const pending = bufferRef.current;
    if (pending.length > 0) {
      // Release proportionally, with a floor, so a long backlog catches up fast
      // while a trickle still moves every frame instead of freezing.
      let take = Math.max(2, Math.ceil(pending.length / 6));

      /* Then round up to the end of the word.
         ---------------------------------------------------------------------
         Providers emit tokens, and a token is not a word: "unbelievable"
         arrives as "un", "believ", "able". Released by the character, the
         reader watches fragments assemble into words and the eye keeps
         stopping on strings that are not language yet — which is the whole of
         why some streaming text feels frantic and some feels like someone
         writing. Releasing on word boundaries costs nothing and removes it.

         A partial last word is held back rather than shown — but only for as
         long as the rest is plausibly in flight. Providers pause: hold it
         indefinitely and a stream that stalls mid-word shows the reader
         nothing at all, which is worse than the fragment. So the hold expires
         with the gap, and after that the word goes out however it looks. */
      const boundary = pending.slice(take).search(/[\s\p{P}]/u);
      if (boundary > 0) take += boundary;
      else if (boundary === -1 && pending.length - take < 24 && Date.now() - fedRef.current < 120) take = 0;

      if (take > 0) {
        shownRef.current += pending.slice(0, take);
        bufferRef.current = pending.slice(take);
        setState((s) => ({
          ...s,
          phase: "streaming",
          text: shownRef.current,
          reasoning: reasoningRef.current,
        }));
      }
    }
    rafRef.current = requestAnimationFrame(drain);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // Stop has to reach a request that has not been sent yet. During the wait
    // after a rate limit there is no socket to abort, and a Stop button that
    // does nothing — then watches the request fire anyway — is worse than no
    // button at all.
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = undefined;
    retryCancelRef.current?.();
    retryCancelRef.current = null;
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const runOnce = useCallback(
    async (opts: {
      conversationId: string;
      parentId: string | null;
      modelId: string;
      /** Why this model, when the app chose it. Travels to the saved answer. */
      routedWhy?: string;
      history: Message[];
      systemPrompt?: string;
      /** The half that changes with the question. Kept out of the cached half. */
      turnPrompt?: string;
      /** A mode's sampling overrides, layered over the model's own. */
      params?: Partial<import("../types").ModelParams>;
      /** False while comparing: the column writes, the user chooses. */
      advanceLeaf?: boolean;
    }) => {
      const model = getModel(opts.modelId);
      const settings = useSettings.getState();
      const assistantId = uid();

      bufferRef.current = "";
      fedRef.current = Date.now();
      shownRef.current = "";
      reasoningRef.current = "";
      ttftRef.current = null;
      usageRef.current = null;
      startedRef.current = Date.now();

      setState({ ...EMPTY, phase: "waiting", messageId: assistantId, conversationId: opts.conversationId });

      // A live elapsed counter, not a spinner: it is the difference between
      // "this is broken" and "this is working, and here is how hard".
      timerRef.current = setInterval(() => {
        setState((s) => (s.phase === "idle" ? s : { ...s, elapsed: Date.now() - startedRef.current }));
      }, 100);
      rafRef.current = requestAnimationFrame(drain);

      const ac = new AbortController();
      abortRef.current = ac;

      let error: ChatError | null = null;
      let stopReason: Message["stopReason"] = "stop";

      /* Trim to what the window can hold before asking. Sending a thread that
         cannot fit and letting the provider reject it wastes a round trip and
         hands back an error instead of an answer. */
      const params = { ...paramsFor(opts.modelId), ...(opts.params ?? {}) };
      const fitted = fitToContext(opts.history, model, params, (opts.systemPrompt ?? "") + (opts.turnPrompt ?? ""));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          signal: ac.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            modelId: opts.modelId,
            messages: fitted.messages,
            systemPrompt: opts.systemPrompt || undefined,
            turnPrompt: opts.turnPrompt || undefined,
            params,
            clientKey: settings.keys[model.provider] || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          error = { kind: "network", message: "The server couldn't start the request.", action: "retry" };
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buf.indexOf("\n\n")) !== -1) {
              const chunk = buf.slice(0, nl);
              buf = buf.slice(nl + 2);
              if (!chunk.startsWith("data: ")) continue;

              let ev: StreamEvent;
              try {
                ev = JSON.parse(chunk.slice(6)) as StreamEvent;
              } catch {
                continue;
              }

              switch (ev.type) {
                case "text":
                  if (ttftRef.current === null) ttftRef.current = Date.now() - startedRef.current;
                  bufferRef.current += ev.text;
                  fedRef.current = Date.now();
                  break;
                case "reasoning":
                  if (ttftRef.current === null) ttftRef.current = Date.now() - startedRef.current;
                  reasoningRef.current += ev.text;
                  setState((s) => ({ ...s, phase: "streaming", reasoning: reasoningRef.current }));
                  break;
                case "usage":
                  usageRef.current = ev.usage;
                  break;
                case "done":
                  stopReason = ev.stopReason;
                  break;
                case "error":
                  error = ev.error;
                  break;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Stopping is a legitimate outcome, not a failure. Everything already
          // streamed is kept — losing text the user was reading is the worst
          // thing a chat app can do.
          stopReason = "aborted";
        } else {
          error = { kind: "network", message: "Lost the connection mid-answer.", action: "retry" };
        }
      }

      // Flush whatever is still buffered so no token is dropped on the floor.
      const finalText = shownRef.current + bufferRef.current;
      bufferRef.current = "";
      shownRef.current = finalText;
      stopLoops();

      const latencyMs = Date.now() - startedRef.current;
      const usage =
        usageRef.current ??
        (() => {
          const inputTokens = opts.history.reduce(
            (n, m) => n + estimateTokens(m.content.map((c) => (c.type === "text" ? c.text : "")).join("")),
            0,
          );
          const outputTokens = estimateTokens(finalText);
          return {
            inputTokens,
            outputTokens,
            costUsd: (inputTokens * model.priceIn + outputTokens * model.priceOut) / 1_000_000,
          };
        })();

      const content: ContentBlock[] = [{ type: "text", text: finalText }];
      const saved: Message = {
        id: assistantId,
        conversationId: opts.conversationId,
        parentId: opts.parentId,
        role: "assistant",
        content,
        reasoning: reasoningRef.current || undefined,
        modelId: opts.modelId,
        routedWhy: opts.routedWhy,
        usage,
        latencyMs,
        ttftMs: ttftRef.current ?? undefined,
        createdAt: Date.now(),
        stopReason,
        error: error?.message,
      };

      // An errored turn with no text is not worth keeping as a message; the
      // error is surfaced inline instead, where retry lives.
      if (finalText || reasoningRef.current || !error) {
        await addMessage(saved, opts.advanceLeaf ?? true);
        // Read-modify-write loses two of three concurrent comparison columns,
        // and the number it loses them from is the one a user might act on.
        await db.conversations
          .where("id")
          .equals(opts.conversationId)
          .modify((conv) => {
            conv.inputTokens += usage.inputTokens;
            conv.outputTokens += usage.outputTokens;
            conv.costUsd += usage.costUsd;
          });
        finishRef.current?.(saved);
      }

      errorRef.current = error;
      /* An error belongs to the conversation it happened in, and the screen
         only shows what belongs to the one it is looking at. Clearing the id
         alongside the run left the error in state with nothing to attach it
         to — classified, carried across the wire, stored, and then dropped one
         line before it would have been rendered. Every provider failure was
         silent: your question on screen, no answer, no explanation, nothing to
         press. The run is over either way; what stays is which thread this
         belongs to. */
      setState({ ...EMPTY, error, conversationId: error ? opts.conversationId : null });
      return saved;
    },
    [drain, stopLoops],
  );

  /**
   * One automatic retry when the provider says to wait.
   *
   * A rate limit is the provider telling us, precisely, that the request would
   * have worked a few seconds later — and it usually says how many. Surfacing
   * that as an error the person has to notice and click through turns a
   * two-second wait into a manual step at exactly the moment they are already
   * annoyed. So the wait is taken once, visibly, and the request goes again.
   *
   * Once, not until it works. A second failure is a real one, and retrying a
   * hard limit in a loop is how an account gets throttled harder.
   */
  const send = useCallback(
    async (opts: Parameters<typeof runOnce>[0]) => {
      const first = await runOnce(opts);
      const err = errorRef.current;
      if (!err || err.kind !== "rate_limit" || !err.retryAfterMs) return first;

      const wait = Math.min(err.retryAfterMs, 20_000);
      setState({ ...EMPTY, phase: "waiting", error: err, retryingInMs: wait, conversationId: opts.conversationId });
      const cancelled = await new Promise<boolean>((resolve) => {
        retryTimerRef.current = setTimeout(() => resolve(false), wait);
        retryCancelRef.current = () => resolve(true);
      });
      if (cancelled) return first;

      return runOnce(opts);
    },
    [runOnce],
  );

  return { ...state, send, stop, clearError };
}
