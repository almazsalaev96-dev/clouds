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
  /* A 403 is ambiguous: providers use it for a rejected key, but so does every
     corporate proxy, VPN and egress allowlist standing between the server and
     the internet. Telling someone their key is wrong when the request never
     left the building sends them to re-issue a key that was always fine. If
     the body reads like a network refusal rather than an auth failure, say so
     — and point at retrying rather than at the key. */
  const looksLikeBlockedEgress =
    /not in allowlist|blocked by|proxy|firewall|egress|enotfound|econnrefused|etimedout|getaddrinfo|tunneling socket|certificate/.test(
      lower,
    ) && !looksLikeKeyProblem;

  if (looksLikeBlockedEgress) kind = "network";
  else if (status === 401 || (status === 403 && !looksLikeBlockedEgress) || looksLikeKeyProblem) kind = "bad_key";
  else if (status === 429) kind = lower.includes("quota") || lower.includes("billing") ? "quota" : "rate_limit";
  else if (status === 400 && (lower.includes("context") || lower.includes("too long") || lower.includes("max_tokens"))) kind = "context_length";
  else if (status === 400 && (lower.includes("safety") || lower.includes("blocked") || lower.includes("filter"))) kind = "content_filter";
  else if (status === 400 && (lower.includes("image") || lower.includes("modality") || lower.includes("multimodal"))) kind = "unsupported_content";
  else if (status === 408 || status === 504) kind = "timeout";
  else if (status >= 500) kind = "provider_down";

  /* The provider's own words, for the cases this cannot name.
     "Something went wrong talking to Anthropic" is true of every failure
     and useful for none of them: the one time it appeared in earnest it was
     hiding a one-line description of exactly what was wrong with the
     request. Quoted rather than paraphrased, trimmed to a sentence, and
     only where nothing more specific is known. */
  const detail = reasonFrom(body);

  const messages: Record<ErrorKind, string> = {
    no_key: `No ${name} key yet. Add one to use this model.`,
    bad_key: `${name} rejected your API key.`,
    rate_limit: `${name} is rate-limiting your key right now.`,
    quota: `Your ${name} account is out of credit.`,
    context_length: "This conversation is too long for the model's context window.",
    content_filter: `${name} declined to answer this one.`,
    unsupported_content: `This model can't read the attachments in this conversation.`,
    provider_down: `${name} is having trouble on their end.`,
    network: `Couldn't reach ${name}. Check the connection — this did not look like a key problem.`,
    timeout: `${name} took too long to respond.`,
    unknown: detail
      ? `${name} refused the request: ${detail}`
      : `Something went wrong talking to ${name}.`,
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

  /* Providers often tell us exactly how long to wait, and using it beats
     guessing — but only if we can read how they spelled it. The header is
     `Retry-After` in seconds; a JSON body says `retry_after`; and some send
     `retry-after-ms`, where the same number means a thousand times less. All
     three spellings, and the unit taken from the name rather than assumed. */
  let retryAfterMs: number | undefined;
  const m = body.match(/retry[-_ ]?after([-_ ]?ms)?[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)/i);
  if (m) retryAfterMs = Math.round(parseFloat(m[2]) * (m[1] ? 1 : 1000));
  else if (kind === "rate_limit") retryAfterMs = 8000;

  return { kind, message: messages[kind], action: actions[kind], retryAfterMs, detail: body.slice(0, 600) };
}

/**
 * One sentence of a provider's error body, or nothing.
 *
 * Every provider wraps its reason differently and all of them wrap it in
 * JSON; this digs out the human half and stops there. Truncated, stripped
 * of newlines, and never shown for the kinds that already have a sentence
 * of their own — a message that ends in a hundred characters of stack
 * trace is one nobody reads.
 */
function reasonFrom(body: string): string | null {
  let text = body.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const err = (parsed.error ?? parsed) as Record<string, unknown>;
    const m = err.message ?? (err as { error?: { message?: unknown } }).error?.message;
    if (typeof m === "string" && m.trim()) text = m.trim();
  } catch {
    /* Not JSON: an HTML error page or a proxy's plain text. */
  }
  if (/<html|<!doctype/i.test(text)) return null;
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) return null;
  return one.length > 200 ? one.slice(0, 197) + "…" : one;
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

export interface Turn {
  role: "user" | "assistant";
  text: string;
  images: ReturnType<typeof imagesOf>;
}

/**
 * The transcript, in the shape every provider will actually accept.
 *
 * This is the fix for the worst bug this app has had. A chat is a tree of
 * rows in a database, and a database is happy to hold things an API is not:
 * an answer that thought and then said nothing, a question whose answer
 * failed and was never stored, a row emptied by an abort. Sent as they are,
 * those produce a message with an empty text block and two questions in a
 * row — and Anthropic rejects both outright. So the first failure in a
 * thread poisoned every turn after it: the error was reported as
 * "something went wrong", the person retried, the same malformed history
 * went out, and the conversation was dead for good. Every section that
 * talks to a model went the same way, because they all come through here.
 *
 * Three rules, and they are the three the APIs impose:
 *
 *  - A turn with nothing in it is not a turn. Empty text, no image: gone.
 *  - Roles alternate. Two questions in a row are one question, joined, and
 *    the same for two answers.
 *  - A conversation opens with a question. A leading answer is dropped
 *    rather than sent, because there is nothing for it to be an answer to.
 *
 * Kept here rather than in each adapter so the three cannot drift, which is
 * how one of them ended up sending `{ type: "text", text: "" }` as a
 * deliberate fallback for a message with no content.
 */
export function usableTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const images = role === "user" ? imagesOf(m) : [];
    const text = textOf(m).trim();
    if (!text && !images.length) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.text = [last.text, text].filter(Boolean).join("\n\n");
      last.images = [...last.images, ...images];
      continue;
    }
    turns.push({ role, text, images });
  }
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns;
}

/**
 * Where a provider actually lives.
 *
 * Defaults are the real APIs. An override exists because plenty of people do
 * not talk to those directly: Azure fronts OpenAI, LiteLLM and OpenRouter
 * front everything, companies put a gateway in the middle for logging and
 * spend control, and anyone running a local model wants an OpenAI-shaped
 * endpoint on their own machine. Hard-coding the host makes all of that
 * impossible for no benefit.
 *
 * Read on the server only. A base URL is not a secret, but it is deployment
 * configuration and has no business in the browser bundle.
 */
export function baseUrlFor(provider: string, fallback: string): string {
  const raw = process.env[`${provider.toUpperCase()}_BASE_URL`];
  const v = raw?.trim();
  if (!v) return fallback;
  // A trailing slash here turns every request path into a double slash, which
  // some gateways 404 rather than normalise.
  return v.replace(/\/+$/, "");
}
