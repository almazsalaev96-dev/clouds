import type { ChatRequest, StreamEvent, StopReason } from "../types";
import { getModel, estimateCost } from "../models";
import { classifyError, sseData, sseLines, usableTurns, baseUrlFor } from "./shared";

/**
 * OpenAI, on the endpoint that takes tools and thinking at once.
 *
 * The chat/completions adapter served this provider for as long as it could,
 * and then stopped being able to. OpenAI's reasoning models refuse a request
 * that carries function tools *and* an effort:
 *
 *   Function tools with reasoning_effort are not supported for gpt-5.6-luna
 *   in /v1/chat/completions. To use function tools, use /v1/responses or set
 *   reasoning_effort to 'none'.
 *
 * This app offers its own rooms as tools on nearly every turn and asks every
 * reasoning model how hard to think, and every OpenAI model in the registry
 * reasons — so the pair always arrived together and the whole provider was
 * refused, on every message, which read to the person using it as the app
 * being broken. It was.
 *
 * Of the two remedies the refusal names, the second is worse than the fault:
 * effort "none" buys the tools back by turning the thinking off, silently, on
 * a model somebody chose for thinking. So this is the first one.
 *
 * It is not only a repair. This endpoint is the only place OpenAI streams a
 * summary of the model's reasoning; on chat/completions it never sent one, so
 * the panel this app draws under an answer had been empty for that provider
 * since it was built. Moonshot and DeepSeek borrow OpenAI's wire format but
 * are not OpenAI and have no such endpoint, so they stay where they are.
 */
export async function* streamOpenAIResponses(
  req: ChatRequest,
  key: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const model = getModel(req.modelId);
  const baseUrl = baseUrlFor("openai", "https://api.openai.com/v1");

  /* This format has one field for the instructions rather than a message, so
     the two halves join the way they do on the other wire: the cacheable
     prefix first, the part that changes every turn last, where it costs
     least. */
  const instructions = [req.systemPrompt, req.turnPrompt].filter(Boolean).join("\n\n");

  const input: Record<string, unknown>[] = [];
  for (const t of usableTurns(req.messages, "openai")) {
    /* A tool round, kept in the shape it arrived in. Here that shape is a
       list of output items rather than one message with `tool_calls` on it,
       so anything stored in the older shape is not something this endpoint
       can be handed — it goes back as nothing, and the results answering it
       are dropped with it rather than arriving as answers to a call that is
       no longer in the conversation. */
    if (t.raw) {
      if (Array.isArray(t.raw)) input.push(...(t.raw as Record<string, unknown>[]));
      continue;
    }
    if (t.results) {
      const answering = input.some((i) => i.type === "function_call");
      if (!answering) continue;
      for (const r of t.results) {
        input.push({ type: "function_call_output", call_id: r.toolUseId, output: r.text });
      }
      continue;
    }
    if (t.role === "assistant") {
      input.push({ role: "assistant", content: [{ type: "output_text", text: t.text }] });
      continue;
    }
    const content: Record<string, unknown>[] = [];
    if (t.images.length && model.vision) {
      for (const i of t.images) {
        content.push({ type: "input_image", image_url: `data:${i.mimeType};base64,${i.data}` });
      }
    }
    if (t.text) content.push({ type: "input_text", text: t.text });
    if (content.length) input.push({ role: "user", content });
  }

  const body: Record<string, unknown> = {
    model: model.apiName,
    input,
    stream: true,
    max_output_tokens: Math.min(req.params.maxTokens, model.maxOutput),
    /* Nothing of this conversation is kept on their machines to be listed in
       a dashboard later. This app holds its own history, in the browser, and
       a copy sitting somewhere the person cannot see or delete is not a thing
       to opt out of after the fact. */
    store: false,
  };
  if (instructions) body.instructions = instructions;

  /* Flat, which is this endpoint's shape: a name and a schema at the top
     level rather than nested under `function`. The other wire wants the
     nesting, and each rejects the other's spelling. */
  if (req.actions?.length) {
    body.tools = req.actions.map((a) => ({
      type: "function",
      name: a.name,
      description: a.description,
      parameters: a.schema,
    }));
  }

  if (model.reasoning) {
    /* The field that could not sit beside a tool on the other endpoint, in
       the shape this one takes — and `summary`, which is what makes the
       thinking visible rather than merely paid for. */
    body.reasoning = { effort: req.params.reasoningEffort ?? "medium", summary: "auto" };
  } else {
    body.temperature = req.params.temperature;
    body.top_p = req.params.topP;
  }

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    yield { type: "error", error: classifyError("openai", res.status, await res.text()) };
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: StopReason = "stop";
  /* Every item the model produced, in order, so the round can be handed back
     exactly as it came — a reasoning item dropped from the middle of a tool
     round is a request this endpoint rejects on the next turn. Keyed by the
     item's own id, because the argument fragments arrive tagged with it and
     out of order with everything else. */
  const items = new Map<string, Record<string, any>>();
  const order: string[] = [];

  for await (const line of sseLines(res, signal)) {
    const ev = sseData(line) as Record<string, any> | null;
    if (!ev) continue;

    switch (ev.type) {
      case "error":
      case "response.failed": {
        const err = ev.response?.error ?? ev.error ?? ev;
        yield { type: "error", error: classifyError("openai", 500, JSON.stringify(err)) };
        return;
      }
      case "response.output_text.delta":
        if (ev.delta) yield { type: "text", text: ev.delta };
        break;
      /* The summary, which is the whole reason this endpoint is worth the
         move rather than merely required by it. */
      case "response.reasoning_summary_text.delta":
        if (ev.delta) yield { type: "reasoning", text: ev.delta };
        break;
      case "response.output_item.added": {
        const item = ev.item as Record<string, any> | undefined;
        if (!item?.id) break;
        if (!items.has(item.id)) order.push(item.id);
        items.set(item.id, { ...item });
        if (item.type === "function_call" && item.name) yield { type: "acting", name: item.name };
        break;
      }
      case "response.function_call_arguments.delta": {
        const item = items.get(ev.item_id);
        if (item) item.arguments = (item.arguments ?? "") + (ev.delta ?? "");
        break;
      }
      case "response.output_item.done": {
        const item = ev.item as Record<string, any> | undefined;
        if (!item?.id) break;
        if (!items.has(item.id)) order.push(item.id);
        /* The finished item is the authority: the fragments were only there
           so the name could be shown while they arrived. */
        items.set(item.id, { ...item });
        break;
      }
      case "response.incomplete":
        if (ev.response?.incomplete_details?.reason === "max_output_tokens") stopReason = "length";
        break;
      case "response.completed":
      case "response.done": {
        const u = ev.response?.usage;
        if (u) {
          inputTokens = u.input_tokens ?? inputTokens;
          outputTokens = u.output_tokens ?? outputTokens;
        }
        if (ev.response?.status === "incomplete"
          && ev.response?.incomplete_details?.reason === "max_output_tokens") stopReason = "length";
        break;
      }
    }
  }

  const produced = order.map((id) => items.get(id)!).filter(Boolean);
  const asked = produced.filter((i) => i.type === "function_call" && i.call_id && i.name);
  if (asked.length) {
    stopReason = "tool";
    yield {
      type: "calls",
      calls: asked.map((c) => {
        let input: Record<string, unknown> = {};
        try {
          input = c.arguments ? (JSON.parse(c.arguments) as Record<string, unknown>) : {};
        } catch { /* unfinished arguments are an empty ask */ }
        return { id: c.call_id as string, name: c.name as string, input };
      }),
      /* Everything the model produced this round, as it came. The reasoning
         items travel with the calls because this endpoint will not accept a
         tool result for a round whose thinking has been edited out. */
      raw: { provider: "openai", content: produced },
    };
  }

  yield { type: "usage", usage: { inputTokens, outputTokens, costUsd: estimateCost(model, inputTokens, outputTokens) } };
  yield { type: "done", stopReason };
}
