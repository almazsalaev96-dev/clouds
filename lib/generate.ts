"use client";

import { getModel } from "./models";
import { useSettings } from "./store";
import type { ProviderId } from "./types";

/**
 * One-shot generation for the things the app asks for on the user's behalf —
 * a conversation title, a set of flashcards, a first draft of a paper.
 *
 * Deliberately not the streaming path: none of these are read as they arrive,
 * so the extra machinery would buy nothing. Failure is a returned null, never
 * a thrown error, because every caller here is doing something optional.
 */
export async function complete(
  prompt: string,
  opts: { modelId?: string; maxTokens?: number; temperature?: number; system?: string } = {},
): Promise<string | null> {
  const settings = useSettings.getState();
  const modelId = opts.modelId ?? settings.modelId;
  const provider = getModel(modelId).provider;

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
    });
    if (!res.body) return null;

    let out = "";
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
          if (ev.type === "text") out += ev.text;
          if (ev.type === "error") return null;
        } catch {
          /* partial frame */
        }
      }
    }
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** The cheapest model the user actually has a key for. */
export function cheapestAvailable(configured: Record<string, boolean>): string {
  const settings = useSettings.getState();
  const preference = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"];
  const usable = (id: string) => {
    const p = getModel(id).provider as ProviderId;
    return Boolean(configured[p] || settings.keys[p]);
  };
  return preference.find(usable) ?? settings.modelId;
}

/** Models like to wrap JSON in prose or a fence. Both are stripped here. */
function extractJson(raw: string): unknown | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  if (end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface DraftCard {
  front: string;
  back: string;
}

/**
 * The prompt does most of the work here. Asking for "flashcards" gets you
 * definitions; asking for one idea per card, in the source's own terms, with
 * answers short enough to grade honestly, gets you something worth reviewing.
 */
export async function generateCards(
  source: string,
  opts: { count?: number; modelId?: string },
): Promise<DraftCard[] | null> {
  const count = opts.count ?? 12;
  const prompt = `Turn the material below into ${count} flashcards for spaced repetition.

Rules:
- One idea per card. Never two questions in one.
- Write the question so it can only be answered by understanding, not by recognising the wording.
- Answers must be short — a phrase or a sentence, never a paragraph. If an answer needs three sentences, it is really three cards.
- Prefer "why" and "when" over "what" wherever the material supports it.
- Use only what the material actually says. Invent nothing.
- Keep the source's own vocabulary and notation.

Reply with a JSON array and nothing else, each item {"front": "...", "back": "..."}.

MATERIAL
${source.slice(0, 24_000)}`;

  const raw = await complete(prompt, { modelId: opts.modelId, maxTokens: 8192, temperature: 0.3 });
  if (!raw) return null;

  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter(
      (c): c is DraftCard =>
        Boolean(c) &&
        typeof (c as DraftCard).front === "string" &&
        typeof (c as DraftCard).back === "string" &&
        (c as DraftCard).front.trim().length > 0 &&
        (c as DraftCard).back.trim().length > 0,
    )
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .slice(0, count * 2);
}

const PAPER_SHAPES = {
  report: `a structured report: a one-paragraph summary, then sections with headings, then a short conclusion`,
  essay: `a continuous essay: an argument stated early, developed in paragraphs with no headings, and closed`,
  notes: `structured notes: short headed sections and tight bullet points, built for revision rather than reading aloud`,
} as const;

export async function generatePaper(
  source: string,
  format: keyof typeof PAPER_SHAPES,
  title: string,
  modelId?: string,
): Promise<string | null> {
  const prompt = `Write ${PAPER_SHAPES[format]} from the material below.

Rules:
- Markdown only. Start at "## " for sections — the title is set separately, so do not repeat it.
- Use only what the material contains. Do not introduce facts, figures or citations that are not there.
- Where the material is thin on something, say so plainly in one clause rather than padding.
- No filler openings ("In today's world..."), no restating the brief back.
- Keep tables and code from the material intact if they carry meaning.

TITLE: ${title || "Untitled"}

MATERIAL
${source.slice(0, 40_000)}`;

  return complete(prompt, { modelId, maxTokens: 16_000, temperature: 0.4 });
}
