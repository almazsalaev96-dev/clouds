import type { ChatRequest, StreamEvent, StopReason } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, textOf, imagesOf, baseUrlFor } from "./shared";
import { thinkingBudget } from "./thinking";

export async function* streamAnthropic(
  req: ChatRequest,
  key: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const model = getModel(req.modelId);

  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const content: unknown[] = [];
      if (m.role === "user") {
        for (const img of imagesOf(m)) {
          content.push({
            type: "image",
            source: { type: "base64", media_type: img.mimeType, data: img.data },
          });
        }
      }
      const text = textOf(m);
      if (text) content.push({ type: "text", text });
      return { role: m.role, content: content.length ? content : [{ type: "text", text: "" }] };
    })
    .filter((m) => m.content.length > 0);

  const body: Record<string, unknown> = {
    model: model.apiName,
    max_tokens: Math.min(req.params.maxTokens, model.maxOutput),
    messages,
    stream: true,
  };

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
  // Anthropic rejects temperature alongside extended thinking, so the two are
  // mutually exclusive rather than both sent and hoping for the best.
  const budget = model.reasoning
    ? thinkingBudget(body.max_tokens as number, req.params.reasoningEffort)
    : null;
  if (budget) {
    body.thinking = { type: "enabled", budget_tokens: budget };
  } else {
    body.temperature = req.params.temperature;
    body.top_p = req.params.topP;
  }

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

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: StopReason = "stop";
  let block: "text" | "thinking" | null = null;

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
        inputTokens = fresh + Math.round(read * 0.1) + Math.round(written * 1.25);
        break;
      }
      case "content_block_start":
        block = ev.content_block?.type === "thinking" ? "thinking" : "text";
        break;
      case "content_block_delta": {
        const d = ev.delta ?? {};
        if (d.type === "thinking_delta" && d.thinking) yield { type: "reasoning", text: d.thinking };
        else if (d.type === "text_delta" && d.text) yield { type: "text", text: d.text };
        break;
      }
      case "content_block_stop":
        block = null;
        break;
      case "message_delta":
        outputTokens = ev.usage?.output_tokens ?? outputTokens;
        if (ev.delta?.stop_reason === "max_tokens") stopReason = "length";
        if (ev.delta?.stop_reason === "refusal") stopReason = "refusal";
        break;
      case "error":
        yield { type: "error", error: classifyError("anthropic", 500, JSON.stringify(ev.error ?? {})) };
        return;
    }
  }
  void block;

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}
