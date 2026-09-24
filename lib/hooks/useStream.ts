"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, ChatError, ContentBlock, Message, ProviderId, StreamEvent, ToolCall, ToolSpec, Usage, WebSource, WebTool } from "../types";
import type { ActionDone } from "../actions";
import { noteFailure, noteSuccess, worthMoving } from "../health";
import { getModel, estimateTokens } from "../models";
import { db, addMessage, uid } from "../db";
import { useSettings, paramsFor } from "../store";
import { fitToContext } from "../context";

export type Phase = "idle" | "waiting" | "streaming";

interface StreamState {
  /** The query being searched right now, or nothing. */
  searching: string | null;
  /** What this app is doing for the model right now: "Saving cards". */
  acting: string | null;
  /** What it has done so far this turn, as it happens. */
  actions: Action[];
  /** Pages met so far this turn, numbered. */
  sources: WebSource[];
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
  /**
   * Which model this stream is actually being written by.
   *
   * The header over a streaming answer used to be drawn from whatever the
   * picker was holding, and `getModel` answers the app default for an id it
   * does not recognise — so on Auto, and on every Armi model, it said "Claude
   * Sonnet 4.5" for the whole of an answer that Haiku or GPT-5.1 was writing,
   * and then the finished message replaced it with the truth. The model that
   * received the request is known here and nowhere else.
   */
  modelId: string | null;
  /** And which Armi model that engine is answering as, where one is chosen. */
  presetId: string | null;
  text: string;
  reasoning: string;
  /** Milliseconds since send. Drives the honest "thinking · 6s" counter. */
  elapsed: number;
  ttft: number | null;
  error: ChatError | null;
  messageId: string | null;
}


/* How many companies a single turn may be carried to before it gives up.
   There are four in the registry, so three is "everybody else, once each" —
   a bound rather than a budget, since `elsewhere` runs out of providers
   before this runs out of hops in every real arrangement of keys. */
const HOPS = 3;

/** How long to wait before the one retry of a failure that tends to pass. */
const BRIEF: Partial<Record<ChatError["kind"], number>> = { provider_down: 2_000, timeout: 2_000, network: 2_000 };

const EMPTY: StreamState = {
  searching: null,
  acting: null,
  actions: [],
  sources: [],
  phase: "idle",
  retryingInMs: 0,
  conversationId: null,
  modelId: null,
  presetId: null,
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
  /* Set when the app's own route refused the request outright — a bad body,
     a payload too large. Sending the same thing again two seconds later is
     not a retry, it is the same refusal with a wait in front. */
  const refusedRef = useRef(false);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  /** Pages the answer has drawn on so far, as the provider reports them. */
  const sourcesRef = useRef<WebSource[]>([]);
  /** Whether a search is in flight, so the first word can end it. */
  const searchingRef = useRef(false);
  /** Whether a tool is in flight, likewise. */
  const actingRef = useRef(false);
  /** What was done this turn, in order. Goes on the saved answer. */
  const actionsRef = useRef<Action[]>([]);
  /** Citation markers waiting for a word boundary to land on. */
  const pendingRef = useRef<number[]>([]);
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
      /** Which Armi model this turn belongs to. Travels to the saved answer. */
      presetId?: string;
      history: Message[];
      systemPrompt?: string;
      /** The half that changes with the question. Kept out of the cached half. */
      turnPrompt?: string;
      /** A mode's sampling overrides, layered over the model's own. */
      params?: Partial<import("../types").ModelParams>;
      /** False while comparing: the column writes, the user chooses. */
      advanceLeaf?: boolean;
      /**
       * Somewhere else to ask when this company will not answer.
       *
       * Given the provider that failed and why, the caller hands back
       * another company's model and one line saying why the answer came
       * from there. Returning nothing means there is nowhere else, and the
       * error stands.
       */
      /** Web tools to offer. Sent as given; the adapter shapes them per model. */
      tools?: WebTool[];
      /**
       * This app's own tools, and how to run one. The model asks; the
       * answer is run here, in the browser, and the turn goes on.
       */
      actions?: {
        specs: ToolSpec[];
        run: (call: ToolCall) => Promise<ActionDone>;
        /** The line for the wait: "Saving cards". */
        doing: (name: string) => string;
        /** Keep what a done action can take back, by the action's id. */
        keep?: (actionId: string, done: ActionDone) => void;
      };
      elsewhere?: (tried: ProviderId[], kind: ChatError["kind"], from: string) => { modelId: string; why: string } | null;
    }) => {
      const model = getModel(opts.modelId);
      const settings = useSettings.getState();
      const assistantId = uid();

      bufferRef.current = "";

      sourcesRef.current = [];
      searchingRef.current = false;
      actingRef.current = false;
      actionsRef.current = [];
      pendingRef.current = [];
      fedRef.current = Date.now();
      shownRef.current = "";
      reasoningRef.current = "";
      ttftRef.current = null;
      usageRef.current = null;
      startedRef.current = Date.now();
      refusedRef.current = false;

      setState({ ...EMPTY, phase: "waiting", messageId: assistantId, conversationId: opts.conversationId, modelId: opts.modelId, presetId: opts.presetId ?? null });

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

      /* The transcript for this turn. A tool round appends to it — the
         model's ask and this app's answer — and the request goes again,
         which is how one answer comes to have saved the cards it describes.
         Five rounds is the ceiling: an answer that has asked for tools five
         times and still has nothing to say is not going to. */
      let turns: Message[] = fitted.messages;
      const ROUNDS = 5;

      try {
        for (let round = 0; round < ROUNDS; round++) {
        let calls: ToolCall[] = [];
        let raw: { provider: ProviderId; content: unknown } | null = null;
        stopReason = "stop";
        const res = await fetch("/api/chat", {
          method: "POST",
          signal: ac.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            modelId: opts.modelId,
            tools: opts.tools,
            actions: opts.actions?.specs.length ? opts.actions.specs : undefined,
            messages: turns,
            systemPrompt: opts.systemPrompt || undefined,
            turnPrompt: opts.turnPrompt || undefined,
            params,
            clientKey: settings.keys[model.provider] || undefined,
            plusKey: settings.plus?.key || undefined,
            plusCustomer: settings.plus?.customerId || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          refusedRef.current = true;
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
                case "text": {
                  if (ttftRef.current === null) ttftRef.current = Date.now() - startedRef.current;
                  /* A marker held from a citation that landed mid-word goes in
                     at the first boundary this delta offers, so the reader
                     sees "silence [1]" and never "sil [1]ence". A provider's
                     chunks end wherever its tokens do. */
                  if (pendingRef.current.length) {
                    const at = ev.text.search(/[\s.,;:!?)\]]/);
                    if (at >= 0) {
                      const head = ev.text.slice(0, at);
                      const tail = ev.text.slice(at);
                      bufferRef.current += head + pendingRef.current.map((n) => ` [${n}]`).join("");
                      pendingRef.current = [];
                      bufferRef.current += tail;
                    } else {
                      bufferRef.current += ev.text;
                    }
                  } else {
                    bufferRef.current += ev.text;
                  }
                  fedRef.current = Date.now();
                  /* The search is over once the writing starts, not once the
                     results land: between the two the model is reading what
                     it found, and "Searching for …" is still the truer word
                     for that than "Writing". */
                  if (searchingRef.current) {
                    searchingRef.current = false;
                    setState((s) => ({ ...s, searching: null }));
                  }
                  if (actingRef.current) {
                    actingRef.current = false;
                    setState((s) => ({ ...s, acting: null }));
                  }
                  break;
                }
                case "acting":
                  /* The ask has gone out; the doing is a moment away. Named
                     now so the pause has a reason on it. */
                  actingRef.current = true;
                  setState((s) => ({ ...s, phase: "streaming", acting: opts.actions?.doing(ev.name) ?? "Working" }));
                  break;
                case "calls":
                  calls = ev.calls;
                  raw = ev.raw;
                  break;
                case "reasoning":
                  if (ttftRef.current === null) ttftRef.current = Date.now() - startedRef.current;
                  reasoningRef.current += ev.text;
                  setState((s) => ({ ...s, phase: "streaming", reasoning: reasoningRef.current }));
                  break;
                case "searching":
                  /* Said while it happens. A search is the longest silent
                     stretch a turn has, and a wait with a reason on it is a
                     different wait. */
                  searchingRef.current = true;
                  setState((s) => ({ ...s, phase: "streaming", searching: ev.query }));
                  break;
                case "source":
                  sourcesRef.current = [...sourcesRef.current, ev.source];
                  setState((s) => ({ ...s, sources: sourcesRef.current }));
                  break;
                case "cite": {
                  /* The marker goes into the text at the point the citation
                     attached, through the same buffer as the words, so it
                     appears in step with them rather than jumping in. The
                     passage, where one came, lands on the source it cites. */
                  /* At a boundary already: in it goes. Mid-word: held for the
                     next delta's first boundary. */
                  const sofar = shownRef.current + bufferRef.current;
                  if (!sofar || /[\s.,;:!?)\]]$/.test(sofar)) bufferRef.current += ` [${ev.n}]`;
                  else pendingRef.current.push(ev.n);
                  if (ev.quote) {
                    sourcesRef.current = sourcesRef.current.map((x) => (x.n === ev.n && !x.quote ? { ...x, quote: ev.quote } : x));
                    setState((s) => ({ ...s, sources: sourcesRef.current }));
                  }
                  break;
                }
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

        /* The model stopped to have something done. Do it, write down what
           was done, hand the result back, and go round again. Anything else
           — an answer, an error, a stop — ends the turn here. */
        if (stopReason !== "tool" || !calls.length || !raw || !opts.actions || error || ac.signal.aborted) break;
        const results: Extract<ContentBlock, { type: "tool_result" }>[] = [];
        for (const call of calls) {
          actingRef.current = true;
          setState((s) => ({ ...s, phase: "streaming", acting: opts.actions?.doing(call.name) ?? "Working" }));
          const done = await opts.actions.run(call);
          const id = uid();
          const action: Action = { id, name: call.name, summary: done.summary, ok: done.ok, at: Date.now(), open: done.open };
          opts.actions.keep?.(id, done);
          actionsRef.current = [...actionsRef.current, action];
          setState((s) => ({ ...s, actions: actionsRef.current }));
          results.push({ type: "tool_result", toolUseId: call.id, name: call.name, text: done.text, ok: done.ok });
        }
        /* Words said before the ask stay; the words after it follow on. */
        if (shownRef.current + bufferRef.current) bufferRef.current += "\n\n";
        turns = [
          ...turns,
          { id: uid(), conversationId: opts.conversationId, parentId: null, role: "assistant", content: [], raw, createdAt: Date.now() },
          { id: uid(), conversationId: opts.conversationId, parentId: null, role: "user", content: results, createdAt: Date.now() },
        ];
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

      // Flush whatever is still buffered so no token is dropped on the floor —
      // a marker still held for a boundary that never came goes on the end.
      if (pendingRef.current.length) {
        bufferRef.current += pendingRef.current.map((n) => ` [${n}]`).join("");
        pendingRef.current = [];
      }
      const finalText = shownRef.current + bufferRef.current;
      bufferRef.current = "";
      shownRef.current = finalText;
      stopLoops();

      /* A turn that ran out of rounds mid-ask ended; "tool" is not a way an
         answer stops, it is a way a round does. */
      if (stopReason === "tool") stopReason = "stop";
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
        presetId: opts.presetId,
        sources: sourcesRef.current.length ? sourcesRef.current : undefined,
        actions: actionsRef.current.length ? actionsRef.current : undefined,
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

      /* What just happened to this company, remembered for a couple of
         minutes so the next question is not sent into the same wall. An
         answer clears it; see lib/health.ts for what counts. */
      if (error) noteFailure(model.provider as ProviderId, error.kind);
      else noteSuccess(model.provider as ProviderId);

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
      if (!err) return first;
      /* The same one retry for the failures that are nobody's fault and
         usually over in a moment: a provider overloaded (their SDKs retry
         these themselves, twice), a request that timed out, a connection
         that never opened. Only when nothing arrived — an answer that broke
         off half-way is saved as it stands, and asking again would put a
         second one under it. */
      const blank = !first.reasoning && !first.content.some((c) => c.type === "text" && c.text);
      const wait =
        err.kind === "rate_limit"
          ? err.retryAfterMs && Math.min(err.retryAfterMs, 20_000)
          : blank && !refusedRef.current
            ? BRIEF[err.kind]
            : undefined;
      let result = first;
      if (wait) {
        setState({ ...EMPTY, phase: "waiting", error: err, retryingInMs: wait, conversationId: opts.conversationId, modelId: opts.modelId, presetId: opts.presetId ?? null });
        const cancelled = await new Promise<boolean>((resolve) => {
          retryTimerRef.current = setTimeout(() => resolve(false), wait);
          retryCancelRef.current = () => resolve(true);
        });
        if (cancelled) {
          /* Stopped during the wait: the run is over, and the screen has to
             know it. Left as it was, "Retrying · 2s" stayed up and the
             composer stayed locked until a reload. */
          setState({ ...EMPTY, error: err, conversationId: opts.conversationId });
          return first;
        }
        result = await runOnce(opts);
      } else if (!blank || refusedRef.current || !worthMoving(err.kind)) {
        /* Nothing to wait for and nowhere worth going: a refusal that would
           land the same way anywhere, or an answer that had already begun.
           The ones that are worth carrying — a spent key, a company down, a
           conversation this window cannot hold — go straight on below;
           waiting first would only have been a second refusal. */
        return first;
      }

      /* Still refused, and by the provider rather than by the request. The
         app holds several companies' keys precisely so that this is not the
         end of the turn: ask somewhere else and say on the row that it did.
         Only the kinds that are about the provider — a request this model
         cannot serve at all would fail the same way anywhere.

         Down the bench rather than one step off it. One hop was enough while
         this only fired for a provider having a bad minute; it is not enough
         for the failure that sends people here, which is an empty balance —
         those do not arrive one at a time, and stopping after the second
         company leaves two untried keys and a coloured bar. Each is asked at
         most once, the list of who has already refused travels with the ask,
         and the row ends up carrying the whole story. */
      const tried: ProviderId[] = [getModel(opts.modelId).provider as ProviderId];
      let why = opts.routedWhy;
      let from = opts.modelId;
      while (tried.length <= HOPS) {
        const after = errorRef.current;
        if (!after || !worthMoving(after.kind)) return result;
        const other = opts.elsewhere?.(tried, after.kind, from);
        if (!other || other.modelId === from) return result;
        why = [why, other.why].filter(Boolean).join(" · ");
        tried.push(getModel(other.modelId).provider as ProviderId);
        from = other.modelId;
        result = await runOnce({ ...opts, modelId: other.modelId, routedWhy: why });
      }
      return result;
    },
    [runOnce],
  );

  return { ...state, send, stop, clearError };
}
