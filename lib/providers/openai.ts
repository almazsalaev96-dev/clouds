import type { ChatRequest, StreamEvent, StopReason, ProviderId } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, textOf, imagesOf } from "./shared";

/**
 * OpenAI and DeepSeek share a wire format, so one adapter serves both. The
 * differences that matter — endpoint, reasoning field, parameter names — are
 * arguments rather than a forked file.
 */
export async function* streamOpenAICompatible(
  req: ChatRequest,
  key: string,
  signal: AbortSignal,
  provider: ProviderId,
  baseUrl: string,
): AsyncGenerator<StreamEvent> {
  const model = getModel(req.modelId);

  const messages: Record<string, unknown>[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });

  for (const m of req.messages) {
    if (m.role === "system") continue;
    const text = textOf(m);
    const images = m.role === "user" ? imagesOf(m) : [];
    if (images.length && model.vision) {
      messages.push({
        role: m.role,
        content: [
          ...images.map((i) => ({
            type: "image_url",
            image_url: { url: `data:${i.mimeType};base64,${i.data}` },
          })),
          ...(text ? [{ type: "text", text }] : []),
        ],
      });
    } else {
      messages.push({ role: m.role, content: text });
    }
  }

  const body: Record<string, unknown> = {
    model: model.apiName,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Reasoning models on both providers reject sampling parameters and use a
  // different token-limit field. Sending the wrong one is a hard 400.
  if (model.reasoning) {
    body.max_completion_tokens = Math.min(req.params.maxTokens, model.maxOutput);
    if (provider === "openai" && req.params.reasoningEffort) {
      body.reasoning_effort = req.params.reasoningEffort;
    }
  } else {
    body.max_tokens = Math.min(req.params.maxTokens, model.maxOutput);
    body.temperature = req.params.temperature;
    body.top_p = req.params.topP;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    yield { type: "error", error: classifyError(provider, res.status, await res.text()) };
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: StopReason = "stop";

  for await (const line of sseLines(res, signal)) {
    const ev = sseData(line) as Record<string, any> | null;
    if (!ev) continue;

    if (ev.error) {
      yield { type: "error", error: classifyError(provider, 500, JSON.stringify(ev.error)) };
      return;
    }

    const choice = ev.choices?.[0];
    if (choice) {
      const d = choice.delta ?? {};
      // DeepSeek R1 streams its chain of thought in a separate field.
      if (d.reasoning_content) yield { type: "reasoning", text: d.reasoning_content };
      if (d.reasoning) yield { type: "reasoning", text: d.reasoning };
      if (d.content) yield { type: "text", text: d.content };
      if (choice.finish_reason === "length") stopReason = "length";
      if (choice.finish_reason === "content_filter") stopReason = "refusal";
    }

    if (ev.usage) {
      inputTokens = ev.usage.prompt_tokens ?? inputTokens;
      outputTokens = ev.usage.completion_tokens ?? outputTokens;
    }
  }

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}

export const streamOpenAI = (req: ChatRequest, key: string, signal: AbortSignal) =>
  streamOpenAICompatible(req, key, signal, "openai", "https://api.openai.com/v1");

export const streamDeepSeek = (req: ChatRequest, key: string, signal: AbortSignal) =>
  streamOpenAICompatible(req, key, signal, "deepseek", "https://api.deepseek.com/v1");
