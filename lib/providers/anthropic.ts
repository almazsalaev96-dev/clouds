import type { ChatRequest, StreamEvent, StopReason } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, usableTurns, baseUrlFor } from "./shared";
import { thinkingBudget } from "./thinking";
import { URL_RE, webTools } from "./tools";

export async function* streamAnthropic(
  req: ChatRequest,
  key: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const model = getModel(req.modelId);

  /* Empty blocks and repeated roles are rejected outright here, so the
     transcript is put in order before it is sent rather than hopefully. The
     old fallback — an empty text block for a message with no content — was
     a 400 with a friendly name on it. */
  const messages = usableTurns(req.messages).map((t) => {
    const content: unknown[] = [];
    for (const img of t.images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.data },
      });
    }
    if (t.text) content.push({ type: "text", text: t.text });
    return { role: t.role, content };
  });

  if (!messages.length) {
    yield {
      type: "error",
      error: {
        kind: "unknown",
        message: "There is nothing in this conversation to send. Try saying it again.",
        action: "retry",
      },
    };
    return;
  }

  const body: Record<string, unknown> = {
    model: model.apiName,
    max_tokens: Math.min(req.params.maxTokens, model.maxOutput),
    messages,
    stream: true,
  };

  /* The web, where the conversation asked for it. A search happens on the
     provider's servers inside this same response; this only offers it. */
  const hasUrl = messages.some((m) =>
    (m.content as { type: string; text?: string }[]).some((c) => c.type === "text" && URL_RE.test(c.text ?? "")),
  );
  const tools = webTools(model, req.tools ?? [], { hasUrl });
  if (tools.length) body.tools = tools;

  /* Prompt caching.
     ---------------------------------------------------------------------
     Every turn in a conversation re-sends everything before it. By the tenth
     exchange the same opening is being paid for and re-read ten times, and it
     is the dominant cost and the dominant wait on any long thread.

     A cache breakpoint tells Anthropic to keep the prefix up to that point;
     later turns reuse it at a tenth of the price and skip the work of reading
     it again. The breakpoint goes on the *second to last* message rather than
     the last: the last one changes every turn, so caching it would write a new
     entry that is never read.

     Writing to the cache costs 25% more than not caching, so it is only worth
     doing once the prefix is big enough to pay that back — which is also
     roughly where Anthropic's own minimum sits. Below that this does nothing. */
  const CACHE_MIN_CHARS = 8_000;
  const prefixChars = messages
    .slice(0, -1)
    .reduce((n, m) => n + JSON.stringify(m.content).length, 0);

  if (prefixChars >= CACHE_MIN_CHARS && messages.length >= 3) {
    const mark = messages[messages.length - 2];
    const last = mark.content[mark.content.length - 1];
    if (last && typeof last === "object") {
      (last as Record<string, unknown>).cache_control = { type: "ephemeral" };
    }
  }

  if (req.systemPrompt) {
    // A system prompt is the same on every single turn, so it is the one part
    // of the request that is always worth caching when it is long enough to
    // qualify.
    body.system =
      req.systemPrompt.length >= 2_000
        ? [{ type: "text", text: req.systemPrompt, cache_control: { type: "ephemeral" } }]
        : req.systemPrompt;
  }
  /* The volatile half, in its own block after the cached one. Anthropic takes
     an array of system blocks and caches up to the marked one, so a line that
     changes every turn can sit behind the breakpoint instead of moving it. */
  if (req.turnPrompt) {
    const before = body.system;
    body.system = [
      ...(Array.isArray(before) ? before : before ? [{ type: "text", text: before }] : []),
      { type: "text", text: req.turnPrompt },
    ];
  }
  /* How to ask for thinking, which changed under this app's feet.
     
     Every Anthropic model up to the 4.6 generation took an extended-thinking
     block: `thinking: {type: "enabled", budget_tokens: n}`, a slice of the
     same ceiling the answer has to fit inside. From the 4.6 generation on it
     is `output_config.effort`, a word rather than a number, and the models
     that take effort do not merely ignore the old block — they reject the
     request. So this is not a preference, it is which of two wire shapes the
     model on the other end will accept, and it is written down per model in
     the registry rather than inferred from anything.
     
     Temperature is mutually exclusive with both: Anthropic rejects sampling
     parameters alongside thinking, so it is one or the other and never both
     sent in the hope that something lands. */
  const budget =
    model.thinks === "budget"
      ? thinkingBudget(body.max_tokens as number, req.params.reasoningEffort)
      : null;
  if (model.thinks === "effort") {
    /* Effort only, and no sampling parameters at all. These models think
       adaptively — they decide for themselves whether this question is worth
       thinking about — so there is no request where temperature is reliably
       safe to send alongside. Omitting effort is not a gap: the API's own
       default is `high`, and the docs say omitting it behaves exactly as
       passing it. */
    if (req.params.reasoningEffort) body.output_config = { effort: req.params.reasoningEffort };
    /* Thinking is on regardless — these models decide for themselves — but
       what comes back of it is not: the default leaves the thinking blocks
       empty, and the person sees a long pause and then an answer. Asked for
       as a summary, the reasoning streams while it happens, which is what
       the "working it through" line in the row is for. Adaptive is the only
       on-mode here; a budget on one of these models is refused outright. */
    body.thinking = { type: "adaptive", display: "summarized" };
  } else if (budget) {
    body.thinking = { type: "enabled", budget_tokens: budget };
  } else if (req.params.topP < 1) {
    /* One or the other, never both. Claude 4 and later reject a request
       carrying `temperature` and `top_p` together — which is what every
       call from the canvas, the notebook and the titler was sending, so
       "ask for a change" on a non-thinking model failed every time with
       "the model didn't return a usable revision". Top-p only when it has
       been narrowed on purpose; otherwise temperature, which is the one
       the app's own controls actually expose. */
    body.top_p = req.params.topP;
  } else {
    body.temperature = req.params.temperature;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: StopReason = "stop";
  /* Pages met so far, numbered in order of meeting. A citation names a URL;
     the reader needs a number that matches the strip under the answer. */
  const numbered = new Map<string, number>();
  const meet = (url: string, title: string, quote?: string) => {
    const known = numbered.get(url);
    if (known) return { n: known, fresh: false };
    const n = numbered.size + 1;
    numbered.set(url, n);
    return { n, fresh: true, source: { n, url, title: title || url, quote } };
  };

  /* A server tool runs a loop on the provider's side, and after ten rounds
     of it the response stops with `pause_turn` rather than an answer. The
     way on is to send the turn back exactly as it came — the assistant's
     blocks, tool calls and results included — and the server picks up where
     it left off. So each round's blocks are kept as they stream, in the
     provider's own shape, and three resumptions is the ceiling: a search
     that has not found its answer in forty rounds is not going to. */
  for (let round = 0; ; round++) {
    const res = await fetch(`${baseUrlFor("anthropic", "https://api.anthropic.com")}/v1/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      yield { type: "error", error: classifyError("anthropic", res.status, await res.text()) };
      return;
    }

    const blocks: Record<string, any>[] = [];
    const partial = new Map<number, string>();
    let paused = false;

    for await (const line of sseLines(res, signal)) {
      const ev = sseData(line) as Record<string, any> | null;
      if (!ev) continue;

      switch (ev.type) {
        case "message_start": {
          /* Cached input is reported separately and priced differently: a read
             from the cache is a tenth of the normal rate, a write is a quarter
             more. Counting only `input_tokens` would under-report a cached turn
             by most of its prompt and make the running cost quietly wrong — and
             a cost readout that is wrong in the cheap direction is the kind of
             thing nobody notices until the bill. */
          const u = ev.message?.usage ?? {};
          const fresh = u.input_tokens ?? 0;
          const read = u.cache_read_input_tokens ?? 0;
          const written = u.cache_creation_input_tokens ?? 0;
          inputTokens += fresh + Math.round(read * 0.1) + Math.round(written * 1.25);
          break;
        }
        case "content_block_start": {
          const cb = ev.content_block ?? {};
          const i = ev.index as number;
          blocks[i] = { ...cb };
          if (cb.type === "text") blocks[i].text = cb.text ?? "";
          if (cb.type === "thinking") blocks[i].thinking = cb.thinking ?? "";
          if (cb.type === "server_tool_use") blocks[i].input = cb.input ?? {};

          /* The results of a search, all at once. A success is a list; an
             error is an object with a code in it, which is reported as
             nothing found rather than as a red box — the model says so in
             its own words a moment later. */
          if (cb.type === "web_search_tool_result" && Array.isArray(cb.content)) {
            for (const r of cb.content) {
              if (r?.type !== "web_search_result" || !r.url) continue;
              const m = meet(r.url, r.title ?? "");
              if (m.fresh && m.source) yield { type: "source", source: m.source };
            }
          }
          if (cb.type === "web_fetch_tool_result" && cb.content?.type === "web_fetch_result" && cb.content.url) {
            const m = meet(cb.content.url, cb.content.content?.title ?? cb.content.url);
            if (m.fresh && m.source) yield { type: "source", source: m.source };
          }
          break;
        }
        case "content_block_delta": {
          const d = ev.delta ?? {};
          const i = ev.index as number;
          const b = blocks[i] ?? (blocks[i] = { type: "text", text: "" });
          if (d.type === "thinking_delta" && d.thinking) {
            b.thinking = (b.thinking ?? "") + d.thinking;
            yield { type: "reasoning", text: d.thinking };
          } else if (d.type === "text_delta" && d.text) {
            b.text = (b.text ?? "") + d.text;
            yield { type: "text", text: d.text };
          } else if (d.type === "signature_delta" && d.signature) {
            b.signature = d.signature;
          } else if (d.type === "input_json_delta") {
            partial.set(i, (partial.get(i) ?? "") + (d.partial_json ?? ""));
          } else if (d.type === "citations_delta" && d.citation) {
            /* The text just streamed rests on this page. The marker goes out
               now, at the place the citation attaches, and the strip under
               the answer carries the same number. */
            const c = d.citation;
            if (c.url) {
              const m = meet(c.url, c.title ?? "", c.cited_text);
              if (m.fresh && m.source) yield { type: "source", source: m.source };
              (b.citations ??= []).push(c);
              /* The passage rides on the citation, not on the result that
                 first named the page — so it goes out here, and the client
                 attaches it to the source it already has. */
              yield { type: "cite", n: m.n, quote: typeof c.cited_text === "string" ? c.cited_text : undefined };
            }
          }
          break;
        }
        case "content_block_stop": {
          const i = ev.index as number;
          const b = blocks[i];
          const json = partial.get(i);
          if (b && json !== undefined) {
            try { b.input = JSON.parse(json); } catch { /* an unfinished input is kept as it was */ }
            partial.delete(i);
            if (b.type === "server_tool_use" && b.name === "web_search" && typeof b.input?.query === "string") {
              yield { type: "searching", query: b.input.query };
            }
          }
          break;
        }
        case "message_delta":
          outputTokens += ev.usage?.output_tokens ?? 0;
          if (ev.delta?.stop_reason === "max_tokens") stopReason = "length";
          if (ev.delta?.stop_reason === "refusal") stopReason = "refusal";
          if (ev.delta?.stop_reason === "pause_turn") paused = true;
          break;
        case "error":
          yield { type: "error", error: classifyError("anthropic", 500, JSON.stringify(ev.error ?? {})) };
          return;
      }
    }

    if (paused && round < 3) {
      messages.push({ role: "assistant", content: blocks.filter(Boolean) });
      body.messages = messages;
      continue;
    }
    break;
  }

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}
