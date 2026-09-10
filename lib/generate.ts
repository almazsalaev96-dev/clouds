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
export function extractJson(raw: string): unknown | null {
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

export async function reviseCanvas(
  current: string,
  instruction: string,
  kind: "code" | "doc" | "web",
  lang: string | undefined,
  modelId?: string,
  /**
   * The rest of the folder, on a web canvas. Without it a model asked to wire
   * up a button in app.js cannot see that the button has no id in index.html,
   * and confidently writes a selector for something that does not exist.
   */
  siblings?: { name: string; content: string }[],
): Promise<string | null> {
  const what = kind === "doc" ? "document" : `${lang ?? "code"} file`;
  const context = siblings?.length
    ? `\n\nThe other files in this folder, for reference only. Do NOT return them.\n\n` +
      siblings
        .map((f) => `--- ${f.name} ---\n${f.content.slice(0, 12_000)}`)
        .join("\n\n")
    : "";
  const prompt = `Revise the ${what} below according to the instruction.

Rules:
- Return the COMPLETE revised ${what} and nothing else. No preamble, no explanation, no "here is".
- Change only what the instruction asks for. Leave everything else byte for byte as it is — formatting, comments, blank lines, ordering.
- If the instruction cannot be carried out, return the ${what} unchanged rather than guessing at what was meant.
${kind === "code" ? "- Do not wrap the answer in a markdown fence unless the file itself is markdown." : ""}

INSTRUCTION
${instruction}${context}

CURRENT
${current.slice(0, 60_000)}`;

  const out = await complete(prompt, { modelId, maxTokens: 16_000, temperature: 0.15 });
  if (!out) return null;

  /* Models fence code even when told not to. Strip one wrapping fence — but
     only if it wraps the *whole* answer, because a markdown document that
     happens to open and close with a code block is not a fenced answer. */
  const fenced = out.match(/^\s*```[\w.-]*\n([\s\S]*?)\n?```\s*$/);

  /* Match the file's own trailing-newline convention rather than imposing one.
     A revision that silently adds a final newline shows up in the diff as a
     change nobody asked for, on every single revision, and a diff with a line
     of noise in it is a diff people stop reading. */
  const trailing = /\n$/.test(current) ? "\n" : "";
  return (fenced ? fenced[1] : out).replace(/\s+$/, "") + trailing;
}

/**
 * What this code does, in prose.
 *
 * Deliberately not a revision: "explain" is the one shortcut of the five that
 * must not touch the file, and a feature that sometimes edits and sometimes
 * does not is one people stop trusting with either.
 */
export async function explainCode(
  current: string,
  lang: string | undefined,
  modelId?: string,
  siblings?: { name: string; content: string }[],
): Promise<string | null> {
  const context = siblings?.length
    ? `\n\nThe other files in the same folder:\n\n` +
      siblings.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8_000)}`).join("\n\n")
    : "";
  return complete(
    `Explain the ${lang ?? "code"} below to the person who wrote it.

Rules:
- Start with one sentence saying what it does overall. No preamble before that.
- Then walk the parts that carry the logic, in the order they run, not top to bottom.
- Name anything that looks wrong, fragile, or surprising, and say why. If nothing does, say so in one line rather than inventing something.
- Markdown. Short paragraphs. Do not paste the code back.

CODE
${current.slice(0, 40_000)}${context}`,
    { modelId, maxTokens: 2_000, temperature: 0.3 },
  );
}
