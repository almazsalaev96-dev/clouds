"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatError, ContentBlock, Message, StreamEvent, Usage } from "../types";
import { getModel, estimateTokens } from "../models";
import { db, addMessage, uid } from "../db";
import { useSettings, paramsFor } from "../store";

export type Phase = "idle" | "waiting" | "streaming";

interface StreamState {
  phase: Phase;
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

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
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
      const take = Math.max(2, Math.ceil(pending.length / 6));
      shownRef.current += pending.slice(0, take);
      bufferRef.current = pending.slice(take);
      setState((s) => ({
        ...s,
        phase: "streaming",
        text: shownRef.current,
        reasoning: reasoningRef.current,
      }));
    }
    rafRef.current = requestAnimationFrame(drain);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const send = useCallback(
    async (opts: {
      conversationId: string;
      parentId: string | null;
      modelId: string;
      history: Message[];
      systemPrompt?: string;
      /** False while comparing: the column writes, the user chooses. */
      advanceLeaf?: boolean;
    }) => {
      const model = getModel(opts.modelId);
      const settings = useSettings.getState();
      const assistantId = uid();

      bufferRef.current = "";
      shownRef.current = "";
      reasoningRef.current = "";
      ttftRef.current = null;
      usageRef.current = null;
      startedRef.current = Date.now();

      setState({ ...EMPTY, phase: "waiting", messageId: assistantId });

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

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          signal: ac.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            modelId: opts.modelId,
            messages: opts.history,
            systemPrompt: opts.systemPrompt || undefined,
            params: paramsFor(opts.modelId),
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

      setState({ ...EMPTY, error });
      return saved;
    },
    [drain, stopLoops],
  );

  return { ...state, send, stop, clearError };
}
