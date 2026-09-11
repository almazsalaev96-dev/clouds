"use client";

import { getModel } from "./models";
import { useSettings } from "./store";
import type { ProviderId } from "./types";

/**
 * The call, and nothing about what is in it.
 *
 * Split from `generate.ts` because the two have completely different reach:
 * the prompts are used by three sections that are all loaded on demand, and
 * this is used by the shell that draws the first screen. Importing two small
 * functions from the same file as every prompt in the app put all of them in
 * the bundle a person waits for before they can type anything.
 *
 * One-shot generation for the things the app asks for on the user's behalf —
 * a conversation title, a set of flashcards, a first draft of a paper.
 *
 * Deliberately not the streaming path: none of these are read as they arrive,
 * so the extra machinery would buy nothing. Failure is a returned null, never
 * a thrown error, because every caller here is doing something optional.
 */
/**
 * Watching it work, and being able to stop it.
 *
 * The answer was already arriving a token at a time and being poured into a
 * buffer nobody could see — so every revision, plan, review and page in this
 * app was a spinner in front of a stream that had started. On a four-hundred
 * line file that is forty seconds of a screen that looks broken, with no way
 * to tell "thinking" from "hung" and nothing to do but wait for a result you
 * cannot judge until it is finished and has replaced your file.
 *
 * Chat had both of these from the beginning. Everything else in the app was
 * built on the one-shot path, which is the right shape for a title and the
 * wrong one for anything you are sitting and waiting for.
 */
export interface Progress {
  /** Called with everything received so far, each time more arrives. */
  onText?: (soFar: string) => void;
  /** Aborts the request. What had arrived is returned rather than discarded. */
  signal?: AbortSignal;
}

export async function complete(
  prompt: string,
  opts: {
    modelId?: string;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  } & Progress = {},
): Promise<string | null> {
  const settings = useSettings.getState();
  const modelId = opts.modelId ?? settings.modelId;
  const provider = getModel(modelId).provider;

  /* Outside the try, so an abort mid-stream can still hand back what arrived. */
  let out = "";
  /* Whether the stream said it was finished, rather than merely stopping.
     Every adapter ends with a `done` event, so a stream that runs out without
     one ended for a reason nobody reported — a dropped connection, a proxy
     timeout, a tab suspended mid-read. What arrived is then a file with its
     end missing, and the caller has no way to tell it from a complete one:
     the canvas was offering it as a finished replacement, captioned with the
     instruction, in exactly the case its own comment says it refuses. */
  let finished = false;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelId,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        systemPrompt: opts.system,
        // Explicit and self-contained. These calls want a complete, parseable
        // answer, not the sampling settings someone left on the chat surface.
        params: {
          maxTokens: opts.maxTokens ?? 8192,
          temperature: opts.temperature ?? 0.4,
          topP: 1,
          reasoningEffort: undefined,
        },
        clientKey: settings.keys[provider] || undefined,
      }),
      signal: opts.signal,
    });
    if (!res.body) return null;

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
        try {
          const ev = JSON.parse(chunk.slice(6));
          if (ev.type === "text") {
            out += ev.text;
            opts.onText?.(out);
          }
          if (ev.type === "done") finished = true;
          if (ev.type === "error") return null;
        } catch {
          /* partial frame */
        }
      }
    }
    if (!finished && !opts.signal?.aborted) {
      throw new Error("The connection ended before the answer did.");
    }
    return out.trim() || null;
  } catch (err) {
    /* An abort is not a failure, and what had already arrived is not rubbish.
       A stopped revision of a long file is usually most of a revision, and
       throwing it away because the reader pressed stop is throwing away the
       thing they were watching arrive. Callers decide what a partial answer is
       worth; this only decides not to lose it.

       Anything else is a failure and is raised as one. Returning the fragment
       for a connection that dropped made a truncated file indistinguishable
       from a finished one — same shape, same absent error — and every caller
       treated it as an answer. */
    if (opts.signal?.aborted) return out.trim() || null;
    throw err;
  }
}

/** The cheapest model the user actually has a key for. */
/**
 * The cheapest model that can actually answer, or nothing.
 *
 * It used to end `?? settings.modelId` — fall back to whatever chat is set to
 * — which reads as a sensible default and is a lie when no provider has a key
 * at all: it hands back a model that cannot be called, so every caller's
 * `if (!modelId) tell them` branch was unreachable and asking a canvas for a
 * change with no key configured did nothing at all. Silence is the worst
 * possible answer; the honest one is null.
 */
export function cheapestAvailable(configured: Record<string, boolean>): string | null {
  const settings = useSettings.getState();
  const preference = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"];
  const usable = (id: string) => {
    const p = getModel(id).provider as ProviderId;
    return Boolean(configured[p] || settings.keys[p]);
  };
  // The chosen chat model is the fallback only when it is one that can answer.
  return preference.find(usable) ?? (usable(settings.modelId) ? settings.modelId : null);
}

/**
 * Models like to wrap JSON in prose or a fence. Both are stripped here.
 *
 * The reply itself is tried first, which sounds obvious and was not what
 * happened. The old version reached for a fence before anything else, and
 * several of these prompts ask for markdown inside a field — a review, a plan,
 * "give the correct version" — so the reply is JSON whose *string value*
 * contains a fenced code block. The fence regex found that inner fence, threw
 * away the object around it, and handed back a snippet of TypeScript to be
 * parsed as JSON. Every one of those calls came back as nothing.
 *
 * Each reading is tried in turn and the first that parses wins, so prose
 * around an object, a ```json wrapper, and an object with fences inside it all
 * work, and none of them can spoil another.
 */
export function extractJson(raw: string): unknown | null {
  const text = raw.trim();
  const readings = [text];
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson) readings.push(fencedJson[1]);
  const fenced = text.match(/```[a-z]*\s*([\s\S]*?)```/i);
  if (fenced) readings.push(fenced[1]);

  for (const reading of readings) {
    const body = reading.trim();
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      /* The next reading, if there is one. */
    }
  }
  return null;
}
