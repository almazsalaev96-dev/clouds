/**
 * Pictures, asked for in words.
 *
 * "Draw me the water cycle", "/image a poster for the exam", "make a picture
 * of a mitochondrion labelled" — the request is read the way a request to
 * build a thing is read (`lib/decide.ts`), and answered with a picture in
 * the thread rather than a paragraph describing one. It runs on the OpenAI
 * key, through `/api/image`; with no such key the thread says so and says
 * where to add one, which is the whole of what a missing key should do.
 */
import type { ChatError } from "./types";

/** The verbs and nouns that mean "I want a picture", not words about one. */
const VERB = /\b(draw|paint|sketch|illustrate|generate|make|create|render|design|produce|give)\b/i;
const NOUN = /\b(image|picture|photo|photograph|illustration|drawing|painting|sketch|logo|poster|icon|diagram|infographic|wallpaper|artwork|portrait|cartoon|comic)s?\b/i;
/** Asking *about* a picture that is already here is not asking for one. */
const ABOUT = /\b(this|the attached|that|above|my|these|uploaded)\s+(image|picture|photo|drawing|diagram)s?\b/i;

export function wantsPicture(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 1200) return false;
  if (ABOUT.test(t)) return false;
  if (/^(what|why|how|is|are|does|do|can|could|which|where|when|who)\b/i.test(t) && !/^(can|could) you (draw|paint|make|generate|create)/i.test(t)) return false;
  return VERB.test(t) && NOUN.test(t) && /\b(of|for|showing|that|with|a|an|the)\b/i.test(t);
}

/** The description alone, with the asking taken off the front. */
export function pictureSubject(text: string): string {
  return text
    .trim()
    .replace(/^(please\s+)?(can|could|would)\s+you\s+/i, "")
    .replace(/^(please\s+)?(draw|paint|sketch|illustrate|generate|make|create|render|design|produce|give)\s+(me\s+)?((a|an|the)\s+)?/i, "")
    .replace(/^(image|picture|photo|photograph|illustration|drawing|painting|sketch|poster|icon|diagram|infographic|artwork|portrait|cartoon)s?\s+(of|for|showing)\s+/i, "")
    .trim() || text.trim();
}

export interface Picture {
  mime: string;
  data: string;
}

export async function makePicture(
  prompt: string,
  opts: { clientKey?: string; signal?: AbortSignal; size?: "1024x1024" | "1536x1024" | "1024x1536"; image?: Picture } = {},
): Promise<{ picture: Picture } | { error: ChatError }> {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, clientKey: opts.clientKey, size: opts.size, image: opts.image }),
      signal: opts.signal,
    });
    const out = (await res.json()) as { b64?: string; mime?: string; error?: ChatError };
    if (out.error) return { error: out.error };
    if (!out.b64) return { error: { kind: "unknown", message: "No picture came back.", action: "retry" } };
    return { picture: { mime: out.mime ?? "image/png", data: out.b64 } };
  } catch (err) {
    return { error: { kind: "network", message: "Couldn't reach the server.", action: "retry", detail: err instanceof Error ? err.message : String(err) } };
  }
}
