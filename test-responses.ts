/* A tool round on OpenAI, end to end against the mock.
 *
 * The fault this covers was not subtle and not caught: every turn this app
 * sent to OpenAI carried its rooms as tools and an effort, the two together
 * are refused on chat/completions, and so the provider answered nothing at
 * all — on every message, for every model it has here. What the suite had
 * was a check that the *body* was well formed, which it was; nothing drove
 * a whole round through an OpenAI-shaped endpoint and read what came back.
 *
 * So this does, on the endpoint the app moved to: the call goes out with
 * tools and an effort in the same request, the answer comes back as items,
 * the call is recognised, the result goes back in the shape that endpoint
 * takes, and the answer after it is written from what the result said.
 *
 *   node mock-provider.mjs &
 *   npx jiti test-responses.ts */
import { streamOpenAIResponses } from "./lib/providers/responses";
import type { ChatRequest, Message, StreamEvent } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const MOCK = "http://127.0.0.1:8787";
process.env.OPENAI_BASE_URL = MOCK;

const ACTIONS = [
  { name: "save_cards", description: "Save flashcards to a deck", schema: { type: "object", properties: { deck: { type: "string" } } } },
];

const user = (text: string): Message => ({
  id: "m" + Math.random().toString(36).slice(2), conversationId: "c", parentId: null,
  role: "user", content: [{ type: "text", text }], createdAt: 0,
} as Message);

async function run(messages: Message[]): Promise<StreamEvent[]> {
  const req = {
    modelId: "gpt-5.6-luna",
    messages,
    systemPrompt: "You are Armi.",
    params: { maxTokens: 4096, temperature: 0.7, topP: 1, reasoningEffort: "high" },
    actions: ACTIONS,
  } as unknown as ChatRequest;
  const out: StreamEvent[] = [];
  for await (const ev of streamOpenAIResponses(req, "sk-mock", new AbortController().signal)) out.push(ev);
  return out;
}

const alive = await fetch(`${MOCK}/__last`).then(() => true).catch(() => false);
if (!alive) {
  console.log("  ✗ the mock is not running — start it first");
  process.exit(1);
}

console.log("\nA turn that offers tools comes back with an answer");
{
  const evs = await run([user("What is a debounce")]);
  const err = evs.find((e) => e.type === "error");
  check(!err, "the request is not refused", err ? JSON.stringify((err as { error: unknown }).error) : "");
  const said = evs.filter((e): e is Extract<StreamEvent, { type: "text" }> => e.type === "text").map((e) => e.text).join("");
  check(said.length > 20, "and there is an answer in it", `${said.length} characters`);
  /* The thing chat/completions never sent. */
  const thought = evs.filter((e): e is Extract<StreamEvent, { type: "reasoning" }> => e.type === "reasoning").map((e) => e.text).join("");
  check(thought.length > 0, "with the thinking shown, which this provider never used to send", thought.slice(0, 40));
  const usage = evs.find((e) => e.type === "usage");
  check(Boolean(usage), "and the usage is read off the wire rather than guessed");
  const done = evs.find((e): e is Extract<StreamEvent, { type: "done" }> => e.type === "done");
  check(done?.stopReason === "stop", "and it ended because it was finished", String(done?.stopReason));
}

console.log("\nAnd a turn the model wants a tool for goes round and comes back");
{
  const ask = user("make me some cards about debounce");
  const first = await run([ask]);
  const acting = first.find((e): e is Extract<StreamEvent, { type: "acting" }> => e.type === "acting");
  check(acting?.name === "save_cards", "the room it wants is named while the arguments are still arriving", String(acting?.name));
  const calls = first.find((e): e is Extract<StreamEvent, { type: "calls" }> => e.type === "calls");
  check(calls?.calls.length === 1, "the call arrives whole", JSON.stringify(calls?.calls?.[0]?.name));
  check(Boolean(calls?.calls[0].input?.deck), "with its arguments parsed from the fragments they came in",
    JSON.stringify(calls?.calls[0].input).slice(0, 60));
  const done = first.find((e): e is Extract<StreamEvent, { type: "done" }> => e.type === "done");
  check(done?.stopReason === "tool", "and the turn stops because something is wanted, not because it finished", String(done?.stopReason));

  /* The round handed back. The whole of what the model produced goes with
     it — the thinking included — because this endpoint refuses a result for
     a round whose items have been edited. */
  const raw = (calls as unknown as { raw: { provider: string; content: unknown } }).raw;
  check(Array.isArray(raw.content), "the round is kept as the list of items it was", typeof raw.content);
  check((raw.content as Record<string, unknown>[]).some((i) => i.type === "reasoning"),
    "with the thinking still in it, which is what makes the next turn legal");

  const second = await run([
    ask,
    { id: "a1", conversationId: "c", parentId: null, role: "assistant", content: [], raw, createdAt: 0 } as unknown as Message,
    { id: "r1", conversationId: "c", parentId: null, role: "user", createdAt: 0,
      content: [{ type: "tool_result", toolUseId: calls!.calls[0].id, text: "Saved 3 cards to Debounce." }] } as unknown as Message,
  ]);
  const err = second.find((e) => e.type === "error");
  check(!err, "the result is accepted", err ? JSON.stringify((err as { error: unknown }).error) : "");
  const after = second.filter((e): e is Extract<StreamEvent, { type: "text" }> => e.type === "text").map((e) => e.text).join("");
  check(/Saved 3 cards/.test(after), "and the answer after it is written from what actually happened", after.slice(0, 60));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
