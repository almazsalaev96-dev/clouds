/**
 * Models on this computer: the address read however it is typed, a tag
 * made into a name, what the server says it has, the answer streamed in
 * the app's own frames — and never, by any path, sent to a company.
 *
 *   npx jiti test-local.ts
 */
import { normaliseUrl, nameOf, specOf, discover, localResponse, localId } from "./lib/local";
import { getModel, isLocalModel, setLocalModels, MODELS, DEFAULT_MODEL_ID } from "./lib/models";
import { canCall } from "./lib/configured";
import { adapterFor } from "./lib/providers";
import { route } from "./lib/route";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const real = globalThis.fetch;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

(async () => {
  console.log("\nThe address, however it is typed");
  check(normaliseUrl("") === "http://localhost:11434/v1", "nothing typed is Ollama's own address");
  check(normaliseUrl("1234") === "http://localhost:1234/v1", "a bare port is a port on this computer");
  check(normaliseUrl("localhost:11434/") === "http://localhost:11434/v1", "no scheme, a trailing slash, no /v1");
  check(normaliseUrl("http://192.168.1.20:11434/v1") === "http://192.168.1.20:11434/v1", "a full address is kept");

  console.log("\nA tag made into a name");
  check(nameOf("qwen3.8:27b") === "Qwen3.8 27b", "size kept", nameOf("qwen3.8:27b"));
  check(nameOf("gemma4:latest") === "Gemma4", "\"latest\" dropped");
  check(nameOf("lmstudio-community/gemma-4-12b-it-GGUF") === "Gemma-4-12b-it", "a repo path and GGUF dropped", nameOf("lmstudio-community/gemma-4-12b-it-GGUF"));
  const s = specOf({ name: "qwen3.5:4b", vision: true, tools: false });
  check(s.id === "local/qwen3.5:4b" && s.apiName === "qwen3.5:4b" && s.provider === "local" && s.priceIn === 0 && s.vision && !s.tools, "a spec: free, its own name on the wire, the capabilities the server gave");
  check(s.contextWindow === 8_192, "a small window unless the server said otherwise, so nothing is cut off at the other end");

  console.log("\nWhat is installed");
  globalThis.fetch = (async (u: string | URL, init?: RequestInit) => {
    const url = String(u);
    if (url.endsWith("/v1/models")) return json({ data: [{ id: "qwen3.5:4b" }, { id: "nomic-embed-text" }, { id: "gpt-oss:20b" }] });
    if (url.endsWith("/api/show")) {
      const name = JSON.parse(String(init?.body)).model;
      return json(name === "qwen3.5:4b"
        ? { capabilities: ["completion", "vision", "tools", "thinking"], model_info: { "qwen35.context_length": 262144 } }
        : { capabilities: ["completion", "tools", "thinking"], model_info: { "gptoss.context_length": 131072 } });
    }
    return json({}, 404);
  }) as typeof fetch;
  const got = await discover("localhost:11434", "https://armi.example");
  check(got.ok && got.models.length === 2, "the chat models, the embedding one left out", got.ok ? got.models.map((m) => m.name).join(", ") : got.message);
  if (got.ok) {
    const q = got.models.find((m) => m.name === "qwen3.5:4b")!;
    check(q.vision && q.tools && q.thinks === true && q.context === 32_768, "what each can do, from Ollama itself; the window capped to what is sensible", JSON.stringify(q));
    check(!got.models.find((m) => m.name === "gpt-oss:20b")!.vision, "a text-only model is not offered pictures");
  }
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  const off = await discover("localhost:11434", "https://armi.example");
  check(!off.ok && off.why === "unreachable" && off.message.includes("OLLAMA_ORIGINS=https://armi.example"), "unreachable: says to start it, and gives this site's own address to allow", off.ok ? "" : off.message);
  const lm = await discover("1234", "https://armi.example");
  check(!lm.ok && /Enable CORS/.test(lm.message), "for LM Studio, its own switch");
  globalThis.fetch = (async () => json({ data: [] })) as typeof fetch;
  const empty = await discover("localhost:11434");
  check(!empty.ok && empty.why === "empty" && /ollama pull/.test(empty.message), "connected but empty: what to download");

  console.log("\nKnown to the app, chosen only by hand");
  setLocalModels([specOf({ name: "qwen3.5:4b", vision: true, tools: false })]);
  check(isLocalModel("local/qwen3.5:4b") && getModel("local/qwen3.5:4b").provider === "local", "a registered model is found by id");
  check(canCall("local/qwen3.5:4b", "local", {}, {}), "and callable with no key at all");
  check(!canCall("local/llama:7b", "local", {}, {}), "one not installed is not");
  check(!MODELS.some((m) => m.provider === "local"), "never in the list Auto and the tactics choose from");
  const r = route("explain photosynthesis", { configured: { anthropic: true, openai: true }, keys: {}, effort: "auto", current: "claude-sonnet-5" } as never);
  check(!String(JSON.stringify(r)).includes("local/"), "Auto does not land on it");

  console.log("\nNever sent to a company");
  setLocalModels([]);
  check(getModel("local/qwen3.5:4b").id === DEFAULT_MODEL_ID, "on the server nothing is registered, so the id would fall to the default engine…");
  const events: string[] = [];
  for await (const ev of adapterFor("local/qwen3.5:4b")({ modelId: "local/qwen3.5:4b", messages: [], params: { maxTokens: 10, temperature: 1, topP: 1 } } as never, "sk-ant-real", new AbortController().signal)) events.push(ev.type);
  check(events.join() === "error", "…so the adapter is chosen by the id's shape and answers an error, never the default company", events.join());

  console.log("\nAn answer, in the app's own frames");
  setLocalModels([specOf({ name: "qwen3.5:4b", vision: true, tools: false })]);
  let sent: Record<string, unknown> = {};
  let where = "";
  globalThis.fetch = (async (u: string | URL, init?: RequestInit) => {
    where = String(u);
    sent = JSON.parse(String(init?.body));
    const sse = [
      { choices: [{ delta: { reasoning: "Light in, sugar out." } }] },
      { choices: [{ delta: { content: "Plants make " } }] },
      { choices: [{ delta: { content: "glucose." }, finish_reason: "stop" }] },
    ].map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  const res = localResponse({ modelId: localId("qwen3.5:4b"), messages: [{ id: "m", conversationId: "c", parentId: null, role: "user", content: [{ type: "text", text: "photosynthesis?" }], createdAt: 0 }], systemPrompt: "Be brief.", params: { maxTokens: 400, temperature: 0.5, topP: 1 } } as never);
  const text = await res.text();
  const evs = text.split("\n\n").filter((f) => f.startsWith("data: ")).map((f) => JSON.parse(f.slice(6)));
  check(where === "http://localhost:11434/v1/chat/completions" && sent.model === "qwen3.5:4b", "asked of this computer, by the model's own name", `${where} ${sent.model}`);
  check(evs.filter((e) => e.type === "text").map((e) => e.text).join("") === "Plants make glucose." && evs.some((e) => e.type === "reasoning") && evs.at(-1)?.type === "done", "text, thinking and done, as /api/chat would send them", evs.map((e) => e.type).join(","));
  const usage = evs.find((e) => e.type === "usage");
  check(!usage || usage.usage.costUsd === 0, "and it cost nothing");

  globalThis.fetch = real;
  console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
  process.exit(failed ? 1 : 0);
})();
