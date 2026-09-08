import type { ChatRequest, StreamEvent, StopReason } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, textOf, imagesOf } from "./shared";

export async function* streamGoogle(
  req: ChatRequest,
  key: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const model = getModel(req.modelId);

  // Gemini calls the assistant "model" and merges consecutive same-role turns,
  // so the transcript is folded before it is sent.
  const contents: { role: string; parts: unknown[] }[] = [];
  for (const m of req.messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const parts: unknown[] = [];
    if (m.role === "user") {
      for (const img of imagesOf(m)) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
      }
    }
    const text = textOf(m);
    if (text) parts.push({ text });
    if (!parts.length) continue;

    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: req.params.temperature,
      topP: req.params.topP,
      maxOutputTokens: Math.min(req.params.maxTokens, model.maxOutput),
    },
  };
  if (req.systemPrompt) body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  if (model.reasoning && req.params.reasoningEffort) {
    const budgets = { low: 2000, medium: 8000, high: 24000 } as const;
    (body.generationConfig as Record<string, unknown>).thinkingConfig = {
      thinkingBudget: budgets[req.params.reasoningEffort],
      includeThoughts: true,
    };
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model.apiName}:streamGenerateContent?alt=sse`;

  const res = await fetch(url, {
    method: "POST",
    signal,
    // The key goes in a header, never the query string: URLs end up in logs,
    // referrers and browser history in a way headers do not.
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    yield { type: "error", error: classifyError("google", res.status, await res.text()) };
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: StopReason = "stop";

  for await (const line of sseLines(res, signal)) {
    const ev = sseData(line) as Record<string, any> | null;
    if (!ev) continue;

    const cand = ev.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      if (typeof part.text !== "string") continue;
      if (part.thought) yield { type: "reasoning", text: part.text };
      else yield { type: "text", text: part.text };
    }
    if (cand?.finishReason === "MAX_TOKENS") stopReason = "length";
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") stopReason = "refusal";

    if (ev.usageMetadata) {
      inputTokens = ev.usageMetadata.promptTokenCount ?? inputTokens;
      outputTokens =
        (ev.usageMetadata.candidatesTokenCount ?? 0) + (ev.usageMetadata.thoughtsTokenCount ?? 0);
    }
  }

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}
