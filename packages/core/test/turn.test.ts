import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, type Store } from "../src/store/index.ts";
import { ingestDocument } from "../src/documents/ingest.ts";
import { ModelRouter } from "../src/model/router.ts";
import { ScriptedProvider, type ScriptedTurn } from "../src/model/scripted.ts";
import { defaultToolRegistry } from "../src/tools/registry.ts";
import { runTurn, runTurnToCompletion, type Engine, type TurnEvent } from "../src/orchestrator/turn.ts";

const U = "u1";
const W = "w1";

function setup(turns: ScriptedTurn[]) {
  const store = createStore();
  const ingested = ingestDocument(store, U, {
    workspaceId: W,
    text: "# Elasticity\n\nDemand is inelastic when PED is below one.\n\n## Revenue\n\nRaising price raises total revenue for an inelastic good.\n",
  });
  assert.ok(ingested.ok);
  const conversation = store.conversations.insert(U, {
    workspaceId: W, projectId: null, title: "New conversation", pinnedDocumentIds: [],
  } as never);
  const provider = new ScriptedProvider({ turns });
  const engine: Engine = {
    store,
    router: new ModelRouter().register(provider),
    tools: defaultToolRegistry(),
  };
  return { store, engine, provider, conversation, blocks: ingested.value.blocks };
}

const collect = async (engine: Engine, req: Parameters<typeof runTurn>[1]) => {
  const events: TurnEvent[] = [];
  for await (const e of runTurn(engine, req)) events.push(e);
  return events;
};

test("a turn streams context, text, then a persisted message", async () => {
  const { engine, store, conversation } = setup([{ text: "Inelastic demand means PED below one." }]);
  const events = await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "What is inelastic demand?",
  });

  assert.equal(events[0].type, "context");
  assert.ok(events.some((e) => e.type === "text"));
  const done = events.at(-1);
  assert.equal(done?.type, "done");

  // Both the user's message and the answer are persisted, in order.
  const messages = store.messages.list(U, { sort: (a, b) => a.createdAt - b.createdAt });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[1].role, "assistant");
  assert.equal(messages[1].text, "Inelastic demand means PED below one.");
  assert.ok(messages[1].contextTrace, "the answer records what it was given");
});

test("the model is given the user's material as citable context", async () => {
  const { engine, provider, conversation } = setup([{ text: "ok" }]);
  await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "explain elasticity",
  });
  const system = provider.received[0].system;
  assert.match(system, /THEIR MATERIAL/);
  assert.match(system, /\[block:[a-f0-9-]+\]/);
  assert.match(system, /Demand is inelastic/);
});

test("a real citation survives; a fabricated one is stripped and flagged", async () => {
  const { engine, store, conversation, blocks } = setup([]);
  const target = blocks.find((b) => b.text.startsWith("Demand is inelastic"))!;

  // Rebuild with a script that cites one real block and one invented id.
  const provider = new ScriptedProvider({
    turns: [{ text: `PED below one is inelastic.[[cite:${target.id}]] Also page 99 says so.[[cite:invented]]` }],
  });
  const engine2: Engine = { ...engine, router: new ModelRouter().register(provider) };

  const events = await collect(engine2, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "is demand inelastic?",
  });

  const cited = events.find((e) => e.type === "citations");
  assert.ok(cited && cited.type === "citations");
  assert.equal(cited.citations.length, 1);
  assert.equal(cited.citations[0].blockId, target.id);

  const message = store.messages.list(U).find((m) => m.role === "assistant")!;
  assert.doesNotMatch(message.text, /\[\[cite:/);
  assert.doesNotMatch(message.text, /invented/);
  // The user is told a reference could not be verified rather than it vanishing silently.
  assert.ok(message.failure, "an unverifiable citation must be surfaced");
  assert.match(message.failure.message, /could not be verified/);
});

test("tool calls actually run and are recorded with their real results", async () => {
  const { engine, store, conversation } = setup([
    { toolUse: { name: "calculate", input: { expression: "(340000 / 500000) * 100" } } },
    { text: "Gearing is 68%." },
  ]);
  const events = await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "what is the gearing ratio?",
  });

  const toolEvent = events.find((e) => e.type === "tool");
  assert.ok(toolEvent && toolEvent.type === "tool");
  assert.equal(toolEvent.record.toolName, "calculate");
  assert.deepEqual(toolEvent.record.output, { expression: "(340000 / 500000) * 100", value: 68 });
  assert.ok(toolEvent.record.elapsedMs >= 0);

  const message = store.messages.list(U).find((m) => m.role === "assistant")!;
  assert.equal(message.toolCalls.length, 1);
  assert.equal(message.toolCalls[0].toolName, "calculate");
});

test("a failing tool is recorded as a failure, not as a fabricated success", async () => {
  const { engine, store, conversation } = setup([
    { toolUse: { name: "calculate", input: { expression: "1 / 0" } } },
    { text: "That cannot be computed." },
  ]);
  await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "divide by zero",
  });
  const message = store.messages.list(U).find((m) => m.role === "assistant")!;
  assert.equal(message.toolCalls.length, 1);
  assert.ok(message.toolCalls[0].failure, "the failure must be recorded");
  assert.equal(message.toolCalls[0].output, undefined, "no invented output");
});

test("search_knowledge widens what may be cited to what it actually returned", async () => {
  const { store, conversation, blocks } = setup([]);
  const target = blocks.find((b) => b.text.startsWith("Raising price"))!;
  const provider = new ScriptedProvider({
    turns: [
      { toolUse: { name: "search_knowledge", input: { query: "revenue inelastic" } } },
      { text: `Revenue rises.[[cite:${target.id}]]` },
    ],
  });
  const engine: Engine = {
    store, router: new ModelRouter().register(provider), tools: defaultToolRegistry(),
  };
  const events = await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "what happens to revenue?",
  });
  const cited = events.find((e) => e.type === "citations");
  assert.ok(cited && cited.type === "citations", "a block returned by search must be citable");
  assert.equal(cited.citations[0].blockId, target.id);
});

test("an artifact created by the model is real and stored", async () => {
  const { engine, store, conversation } = setup([
    {
      toolUse: {
        name: "create_artifact",
        input: {
          kind: "quiz", title: "Elasticity check",
          blocks: [
            { kind: "quizQuestion", text: "What does PED below one mean?", answer: "Inelastic demand" },
            { kind: "quizQuestion", text: "What happens to revenue if price rises?", answer: "It rises" },
          ],
        },
      },
    },
    { text: "Made you a two-question quiz." },
  ]);
  await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "quiz me on elasticity",
  });

  const artifacts = store.artifacts.list(U);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].title, "Elasticity check");
  assert.equal(artifacts[0].blocks.length, 2);
  assert.equal(artifacts[0].conversationId, conversation.id);
  assert.equal(artifacts[0].blocks[0].answer, "Inelastic demand");
});

test("with no model available the turn fails honestly and keeps the user's message", async () => {
  const store = createStore();
  const conversation = store.conversations.insert(U, {
    workspaceId: W, projectId: null, title: "New conversation", pinnedDocumentIds: [],
  } as never);
  const provider = new ScriptedProvider({ turns: [], available: false });
  const engine: Engine = {
    store, router: new ModelRouter().register(provider), tools: defaultToolRegistry(),
  };

  const events = await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "hello",
  });
  const failure = events.find((e) => e.type === "failure");
  assert.ok(failure && failure.type === "failure");

  const messages = store.messages.list(U, { sort: (a, b) => a.createdAt - b.createdAt });
  assert.equal(messages[0].text, "hello", "the user's message is never lost");
  assert.ok(messages[1].failure, "the gap is explained rather than silent");
});

test("a model error mid-stream is reported and does not throw", async () => {
  const { engine, store, conversation } = setup([
    { failure: { code: "model_error", message: "Upstream timed out.", retryable: true } },
  ]);
  const result = await runTurnToCompletion(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "hi",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.code, "model_error");
  assert.ok(store.messages.list(U).some((m) => m.failure));
});

test("runaway tool loops are stopped with an actionable message", async () => {
  const turns = Array.from({ length: 12 }, () => ({
    toolUse: { name: "calculate", input: { expression: "1+1" } },
  }));
  const { engine, conversation } = setup(turns);
  const result = await runTurnToCompletion(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id, text: "loop forever",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.failure.message, /too many steps/);
});

test("conversation history is carried into the next turn", async () => {
  const { engine, provider, conversation } = setup([{ text: "First." }, { text: "Second." }]);
  const base = { userId: U, workspaceId: W, conversationId: conversation.id };
  await collect(engine, { ...base, text: "first question" });
  await collect(engine, { ...base, text: "second question" });

  const second = provider.received[1];
  const texts = second.messages.map((m) => (typeof m.content === "string" ? m.content : ""));
  assert.ok(texts.includes("first question"), "prior turn must be present");
  assert.ok(texts.includes("First."), "prior answer must be present");
  assert.equal(texts.at(-1), "second question");
});

test("an untitled conversation is named from its first message", async () => {
  const { engine, store, conversation } = setup([{ text: "ok" }]);
  await collect(engine, {
    userId: U, workspaceId: W, conversationId: conversation.id,
    text: "Explain price elasticity of demand",
  });
  assert.equal(
    store.conversations.get(U, conversation.id)!.title,
    "Explain price elasticity of demand",
  );
});
