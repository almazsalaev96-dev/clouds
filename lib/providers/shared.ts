import type { ChatError, ErrorKind, Message } from "../types";
import { PROVIDERS } from "../models";
import type { ProviderId } from "../types";

/** Line-oriented SSE reader. Handles chunk boundaries splitting mid-event. */
export async function* sseLines(
  res: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line) yield line;
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}

/** `data: {...}` → the parsed payload, skipping comments and `[DONE]`. */
export function sseData(line: string): unknown | null {
  if (!line.startsWith("data:")) return null;
  const raw = line.slice(5).trim();
  if (!raw || raw === "[DONE]") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Every provider fails in its own dialect. This is the single place where that
 * is translated into something a person can act on, so no raw provider string
 * ever reaches the interface.
 */
export function classifyError(
  provider: ProviderId,
  status: number,
  body: string,
): ChatError {
  const name = PROVIDERS[provider].name;
  const lower = body.toLowerCase();
  let kind: ErrorKind = "unknown";

  // Google answers an invalid key with 400, not 401, so status alone is not
  // enough to tell "your key is wrong" from "your request is wrong".
  const looksLikeKeyProblem =
    /api[ _-]?key[ _-]?(not valid|invalid)|invalid[ _-]?api[ _-]?key|api_key_invalid|unauthenticated|permission[ _-]?denied/.test(
      lower,
    );
  if (status === 401 || status === 403 || looksLikeKeyProblem) kind = "bad_key";
  else if (status === 429) kind = lower.includes("quota") || lower.includes("billing") ? "quota" : "rate_limit";
  else if (status === 400 && (lower.includes("context") || lower.includes("too long") || lower.includes("max_tokens"))) kind = "context_length";
  else if (status === 400 && (lower.includes("safety") || lower.includes("blocked") || lower.includes("filter"))) kind = "content_filter";
  else if (status === 400 && (lower.includes("image") || lower.includes("modality") || lower.includes("multimodal"))) kind = "unsupported_content";
  else if (status === 408 || status === 504) kind = "timeout";
  else if (status >= 500) kind = "provider_down";

  const messages: Record<ErrorKind, string> = {
    no_key: `No ${name} key yet. Add one to use this model.`,
    bad_key: `${name} rejected your API key.`,
    rate_limit: `${name} is rate-limiting your key right now.`,
    quota: `Your ${name} account is out of credit.`,
    context_length: "This conversation is too long for the model's context window.",
    content_filter: `${name} declined to answer this one.`,
    unsupported_content: `This model can't read the attachments in this conversation.`,
    provider_down: `${name} is having trouble on their end.`,
    network: `Couldn't reach ${name}.`,
    timeout: `${name} took too long to respond.`,
    unknown: `Something went wrong talking to ${name}.`,
  };

  const actions: Record<ErrorKind, ChatError["action"]> = {
    no_key: "add_key",
    bad_key: "add_key",
    rate_limit: "retry",
    quota: "switch_model",
    context_length: "shorten",
    content_filter: "switch_model",
    unsupported_content: "switch_model",
    provider_down: "switch_model",
    network: "retry",
    timeout: "retry",
    unknown: "retry",
  };

  // Providers often tell us exactly how long to wait. Using it beats guessing.
  let retryAfterMs: number | undefined;
  const m = body.match(/retry[- ]?after[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)/i);
  if (m) retryAfterMs = Math.round(parseFloat(m[1]) * 1000);
  else if (kind === "rate_limit") retryAfterMs = 8000;

  return { kind, message: messages[kind], action: actions[kind], retryAfterMs, detail: body.slice(0, 600) };
}

export function textOf(m: Message): string {
  return m.content
    .map((b) => (b.type === "text" ? b.text : b.type === "file" ? `${b.name}\n${b.text}` : ""))
    .filter(Boolean)
    .join("\n\n");
}

export function imagesOf(m: Message) {
  return m.content.filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image");
}
