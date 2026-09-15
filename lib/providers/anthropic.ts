import type { ChatRequest, StreamEvent, StopReason } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, usableTurns, baseUrlFor } from "./shared";
import { thinkingBudget } from "./thinking";

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
