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
  if (req.systemPrompt) body.system = req.systemPrompt;
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
      case "message_start":
        inputTokens = ev.message?.usage?.input_tokens ?? 0;
        break;
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
