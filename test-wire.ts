/* What each adapter actually puts on the wire.
 *
 * "OpenAI-compatible" means compatible-ish, and the gaps are exactly where
 * this app breaks silently: a field one provider requires and another
 * rejects, a name that is right for OpenAI and unknown to Moonshot. The
 * mock in the browser suite speaks two of the four dialects, so the two it
 * does not speak had nothing checking them at all — which is how Kimi went
 * out with its output limit under a name Moonshot has never heard of.
 *
 * No network: `fetch` is replaced, the body is captured, and the stream is
 * one canned frame so the generator finishes.
 *
 *   npx jiti test-wire.ts */
import { adapterFor } from "./lib/providers";
import { MODELS, getModel } from "./lib/models";
import type { ChatRequest } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const FRAME = 'data: {"type":"message_stop"}\n\ndata: [DONE]\n\n';

/** Run one turn through an adapter and hand back what it sent. */
async function sent(modelId: string, params: Partial<ChatRequest["params"]> = {}, extra: Partial<ChatRequest> = {}) {
  let url = "";
  let body: Record<string, unknown> = {};
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string, init: RequestInit) => {
    url = String(u);
    body = JSON.parse(String(init.body));
    return new Response(new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(FRAME)); c.close(); },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  try {
    const req: ChatRequest = {
      modelId,
      messages: [{ id: "m1", conversationId: "c", parentId: null, role: "user", content: [{ type: "text", text: "hello" }], createdAt: 0 }],
      params: { maxTokens: 4096, temperature: 0.7, topP: 1, reasoningEffort: "high", ...params },
      ...extra,
    } as ChatRequest;
    for await (const _ of adapterFor(modelId)(req, "sk-test", new AbortController().signal)) { /* drain */ }
  } finally {
    globalThis.fetch = real;
  }
  return { url, body };
}

console.log("\nEach one is addressed to its own API, under its own name");
{
  for (const [id, host] of [
    ["claude-opus-5", "api.anthropic.com"],
    ["gpt-5.6-terra", "api.openai.com"],
    ["kimi-k3", "api.moonshot.ai"],
    ["deepseek-v4-pro", "api.deepseek.com"],
  ] as const) {
    const { url, body } = await sent(id);
    check(url.includes(host), `${id} goes to ${host}`, url);
    check(body.model === getModel(id).apiName, "under the name that provider uses", String(body.model));
  }
}

console.log("\nThe output limit is spelled the way each provider spells it");
{
  /* Every provider on this wire format takes `max_tokens`, and sending the
     wrong one is either a hard 400 or — worse — a silently unlimited answer.
     OpenAI's spelling was `max_completion_tokens` for as long as this app
     spoke to it on chat/completions; on the endpoint it speaks to now the
     name is `max_output_tokens`, and the point the check is making is the
     one it always made: nobody gets somebody else's name for it. */
  const openai = await sent("gpt-5.6-terra");
  check(openai.body.max_output_tokens !== undefined
    && openai.body.max_tokens === undefined && openai.body.max_completion_tokens === undefined,
    "OpenAI takes max_output_tokens, and one name only", Object.keys(openai.body).filter((k) => /tokens/.test(k)).join(", "));

  const kimi = await sent("kimi-k3");
  check(kimi.body.max_tokens !== undefined && kimi.body.max_completion_tokens === undefined,
    "Kimi takes max_tokens, whatever it is capable of", Object.keys(kimi.body).filter((k) => /tokens/.test(k)).join(", "));

  const r1 = await sent("deepseek-v4-pro");
  check(r1.body.max_tokens !== undefined && r1.body.max_completion_tokens === undefined,
    "and so does DeepSeek's reasoner", Object.keys(r1.body).filter((k) => /tokens/.test(k)).join(", "));

  const chat = await sent("kimi-k2.6");
  check(chat.body.max_tokens !== undefined, "as does a model that does not reason at all");
  check(chat.body.temperature !== undefined, "which gets sampling parameters too");

  /* And the one thing OpenAI's reasoning models actually refuse. */
  check(openai.body.temperature === undefined && openai.body.top_p === undefined,
    "a reasoning model is sent no sampling parameters");
  check((openai.body.reasoning as { effort?: string } | undefined)?.effort === "high",
    "but is told how hard to think", JSON.stringify(openai.body.reasoning));
}

console.log("\nAnthropic is its own shape, and one sampling parameter at a time");
{
  const { body } = await sent("claude-haiku-4-5");
  check(typeof body.max_tokens === "number", "max_tokens, which is required there");
  check(Boolean(body.thinking), "a thinking budget where the effort asked for one", JSON.stringify(body.thinking));
  /* Claude 4 rejects `temperature` alongside `top_p`, and rejects it outright
     with thinking enabled. One, or none. */
  const n = ["temperature", "top_p"].filter((k) => body[k] !== undefined).length;
  check(n === 0, "and no sampling parameter beside it, which that API refuses", String(n));
}

console.log("\nAnd thinking is asked for in the shape the model on the other end accepts");
{
  /* The one this file exists for, caught late. Anthropic replaced the
     extended-thinking block with `output_config.effort` from the 4.6
     generation on, and the models that take effort do not ignore the old
     block — they reject the request. So this app could not call Opus 5,
     Sonnet 5 or Fable 5.1 at all: every one of them was sent a shape that
     comes back 400, which reads to a person exactly like a bad key.
     
     Read off `thinks` in the registry, and asserted in both directions:
     nobody gets both, and nobody gets neither. */
  for (const id of MODELS.filter((m) => m.provider === "anthropic").map((m) => m.id)) {
    const { body } = await sent(id);
    const wants = getModel(id).thinks;
    const effort = (body.output_config as { effort?: string } | undefined)?.effort;
    if (wants === "effort") {
      const t = body.thinking as { type?: string; display?: string; budget_tokens?: number } | undefined;
      check(effort === "high" && t?.type === "adaptive" && t.display === "summarized" && t.budget_tokens === undefined,
        `${id} is told how hard to think, and asked for its reasoning as a summary — never a budget`, `effort=${effort} thinking=${JSON.stringify(t)}`);
    } else if (wants === "budget") {
      check(Boolean(body.thinking) && body.output_config === undefined,
        `${id} is given a thinking budget, and no effort`, JSON.stringify(body.thinking));
    } else {
      check(body.thinking === undefined && body.output_config === undefined,
        `${id} is asked for neither`);
    }
    const bt = body.thinking as { budget_tokens?: number } | undefined;
    check(!(bt?.budget_tokens && body.output_config), `${id} is never sent a budget and an effort at once`);
  }
  /* And a model that thinks by effort gets no sampling parameters either:
     these models decide for themselves whether to think, so there is no
     request where temperature is reliably safe beside it. */
  const { body } = await sent("claude-opus-5");
  check(body.temperature === undefined && body.top_p === undefined,
    "and an effort model is sent no sampling parameters at all");
}

console.log("\nA turn that offers this app's rooms is a turn OpenAI will take");
{
  /* Reported from the live app, on every single message: "Function tools
     with reasoning_effort are not supported for gpt-5.6-luna in
     /v1/chat/completions. To use function tools, use /v1/responses or set
     reasoning_effort to 'none'."

     This app offers its own rooms as tools on nearly every turn and asks
     every reasoning model how hard to think, so the two always arrived
     together and OpenAI refused the pair outright. Every model that
     provider has in this registry reasons, which made the whole of the
     OpenAI side unusable — and it read to a person as the app being
     broken, because it was.

     The remedy is the one the refusal names. The other one it names —
     effort "none" — is buying tools back by turning the thinking off
     without saying so, on a model chosen for thinking. */
  const ACT = [{ name: "save_card", description: "Save a card", schema: { type: "object", properties: {} } }];
  const withTools = await sent("gpt-5.6-luna", {}, { actions: ACT });
  check(withTools.url.endsWith("/responses"), "OpenAI is asked on the endpoint that takes both", withTools.url);
  check(withTools.body.reasoning_effort === undefined,
    "so the field that cannot sit beside a tool is not sent", String(withTools.body.reasoning_effort));
  check((withTools.body.reasoning as { effort?: string } | undefined)?.effort === "high",
    "and the effort rides in the shape this endpoint takes",
    JSON.stringify(withTools.body.reasoning));
  const tools = withTools.body.tools as Record<string, unknown>[] | undefined;
  check(Array.isArray(tools) && tools.length === 1 && tools[0].name === "save_card" && tools[0].function === undefined,
    "with the tool flat, which is this endpoint's shape and not the other's", JSON.stringify(tools?.[0]));
  check(withTools.body.max_output_tokens !== undefined && withTools.body.max_completion_tokens === undefined,
    "and the output limit under the name it uses here",
    Object.keys(withTools.body).filter((k) => /tokens/.test(k)).join(", "));

  /* Nothing about tools changed the endpoint: a turn with none goes to the
     same place, or half the app would be on one API and half on another. */
  const plain = await sent("gpt-5.6-luna");
  check(plain.url.endsWith("/responses"), "a turn with no tools goes to the same place", plain.url);

  /* And the two providers that borrow this wire format are not OpenAI and
     do not have this endpoint. Sending them there is a 404 on every turn. */
  for (const id of ["kimi-k3", "deepseek-v4-pro"]) {
    const { url, body } = await sent(id, {}, { actions: ACT });
    check(url.endsWith("/chat/completions"), `${id} still speaks chat/completions`, url);
    check(Array.isArray(body.tools) && (body.tools as Record<string, any>[])[0].function?.name === "save_card",
      "with the nested tool shape that format wants", JSON.stringify((body.tools as unknown[])?.[0]));
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
