import type { ChatRequest, StreamEvent, StopReason, ProviderId } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, usableTurns, baseUrlFor } from "./shared";

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
  /* One system message rather than two: this wire format has no notion of a
     cache breakpoint inside it, and both providers cache on an exact prefix
     anyway, so the volatile half simply goes last where it costs least. */
  const system = [req.systemPrompt, req.turnPrompt].filter(Boolean).join("\n\n");
  if (system) messages.push({ role: "system", content: system });

  for (const t of usableTurns(req.messages, provider)) {
    /* A tool round, in this format's shape: the assistant message with its
       `tool_calls` as it came, then one `tool` message per result. */
    if (t.raw) {
      messages.push(t.raw as Record<string, unknown>);
      continue;
    }
    if (t.results) {
      for (const r of t.results) messages.push({ role: "tool", tool_call_id: r.toolUseId, content: r.text });
      continue;
    }
    if (t.images.length && model.vision) {
      messages.push({
        role: t.role,
        content: [
          ...t.images.map((i) => ({
            type: "image_url",
            image_url: { url: `data:${i.mimeType};base64,${i.data}` },
          })),
          ...(t.text ? [{ type: "text", text: t.text }] : []),
        ],
      });
    } else {
      messages.push({ role: t.role, content: t.text });
    }
  }

  const body: Record<string, unknown> = {
    model: model.apiName,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  /* This app's rooms, as functions the model may call. */
  if (req.actions?.length) {
    body.tools = req.actions.map((a) => ({
      type: "function",
      function: { name: a.name, description: a.description, parameters: a.schema },
    }));
  }

  /* Reasoning models reject sampling parameters and take a different
     token-limit field — but `max_completion_tokens` is OpenAI's spelling and
     OpenAI's alone. Moonshot and DeepSeek speak this wire format and still
     take `max_tokens`, so every "reasoning" model outside OpenAI was being
     sent a limit under a name it does not know: rejected outright by one
     provider and, worse, silently ignored by another, which is an answer
     with no ceiling on it and a bill to match.

     This is the cost of "OpenAI-compatible" meaning compatible-ish. The rule
     is the provider's, not the model's capability. */
  if (model.reasoning) {
    if (provider === "openai") {
      body.max_completion_tokens = Math.min(req.params.maxTokens, model.maxOutput);
      if (req.params.reasoningEffort) body.reasoning_effort = req.params.reasoningEffort;
    } else {
      body.max_tokens = Math.min(req.params.maxTokens, model.maxOutput);
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
  /* Tool calls arrive in pieces: an id and a name first, then the arguments
     as fragments of JSON, each piece tagged with the call's index. Gathered
     here and read once the stream ends. */
  const calls: { id: string; name: string; args: string }[] = [];
  let wantsTools = false;
  let said = "";

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
      if (d.content) {
        said += d.content;
        yield { type: "text", text: d.content };
      }
      for (const tc of (d.tool_calls ?? []) as Record<string, any>[]) {
        const i = typeof tc.index === "number" ? tc.index : calls.length;
        const c = (calls[i] ??= { id: "", name: "", args: "" });
        if (typeof tc.id === "string") c.id = tc.id;
        if (typeof tc.function?.name === "string" && !c.name) {
          c.name = tc.function.name;
          yield { type: "acting", name: c.name };
        }
        if (typeof tc.function?.arguments === "string") c.args += tc.function.arguments;
      }
      if (choice.finish_reason === "length") stopReason = "length";
      if (choice.finish_reason === "content_filter") stopReason = "refusal";
      if (choice.finish_reason === "tool_calls") wantsTools = true;
    }

    if (ev.usage) {
      inputTokens = ev.usage.prompt_tokens ?? inputTokens;
      outputTokens = ev.usage.completion_tokens ?? outputTokens;
    }
  }

  const asked = calls.filter((c) => c.id && c.name);
  if ((wantsTools || asked.length) && asked.length) {
    stopReason = "tool";
    yield {
      type: "calls",
      calls: asked.map((c) => {
        let input: Record<string, unknown> = {};
        try { input = c.args ? (JSON.parse(c.args) as Record<string, unknown>) : {}; } catch { /* unfinished arguments are an empty ask */ }
        return { id: c.id, name: c.name, input };
      }),
      /* The message as this format wants it back: text if there was any,
         and the calls with their arguments as the string they arrived as. */
      raw: {
        provider,
        content: {
          role: "assistant",
          content: said || null,
          tool_calls: asked.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
        },
      },
    };
  }

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}

export const streamOpenAI = (req: ChatRequest, key: string, signal: AbortSignal) =>
  streamOpenAICompatible(req, key, signal, "openai", baseUrlFor("openai", "https://api.openai.com/v1"));

/**
 * Moonshot speaks OpenAI's wire format exactly, so Kimi costs one line rather
 * than one file: the same adapter, a different endpoint and key.
 */
export const streamMoonshot = (req: ChatRequest, key: string, signal: AbortSignal) =>
  streamOpenAICompatible(req, key, signal, "moonshot", baseUrlFor("moonshot", "https://api.moonshot.ai/v1"));

export const streamDeepSeek = (req: ChatRequest, key: string, signal: AbortSignal) =>
  streamOpenAICompatible(req, key, signal, "deepseek", baseUrlFor("deepseek", "https://api.deepseek.com/v1"));
