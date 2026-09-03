import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.ts";
import { createStore } from "../../core/src/store/index.ts";
import { ModelRouter } from "../../core/src/model/router.ts";
import { ScriptedProvider } from "../../core/src/model/scripted.ts";
import { defaultToolRegistry } from "../../core/src/tools/registry.ts";

/** Exercised over real HTTP — sessions, streaming and status codes included. */
let base = "";
let close: () => Promise<void>;
let cookie = "";
const scripted = new ScriptedProvider({
  turns: [
    { text: "Inelastic demand means quantity moves less than price." },
    { text: "A second answer." },
  ],
});

before(async () => {
  const store = createStore();
  const { server } = createApp({
    store,
    secureCookies: false,
    engine: {
      router: new ModelRouter().register(scripted),
      tools: defaultToolRegistry(),
    },
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise<void>((resolve) => server.close(() => resolve()));
});

after(() => close());

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res;
}

test("first visit creates a session and a workspace with no signup", async () => {
  const res = await api("/api/state");
  assert.equal(res.status, 200);
  const state = await res.json();
  assert.ok(state.user.id);
  assert.ok(state.workspaceId);
  assert.deepEqual(state.documents, []);
  assert.ok(cookie.startsWith("session="));
});

let documentId = "";
let blockCount = 0;

test("a document is ingested, structured, and reports its concepts", async () => {
  const res = await api("/api/documents", {
    method: "POST",
    body: JSON.stringify({
      title: "Elasticity notes",
      text: "# Elasticity\n\nDemand is inelastic when PED is below one.\n\n## Revenue\n\nRaising price raises revenue for an inelastic good.\n",
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  documentId = body.document.id;
  blockCount = body.blocks;
  assert.equal(body.document.title, "Elasticity notes");
  assert.ok(blockCount >= 4);
  assert.deepEqual(body.concepts.sort(), ["Elasticity", "Revenue"]);
});

test("document blocks come back with exact, resolvable offsets", async () => {
  const res = await api(`/api/documents/${documentId}`);
  const body = await res.json();
  assert.equal(body.blocks.length, blockCount);
  for (const block of body.blocks) {
    assert.equal(body.text.slice(block.startOffset, block.endOffset), block.text);
  }
});

test("an empty document is refused with a readable message", async () => {
  const res = await api("/api/documents", { method: "POST", body: JSON.stringify({ text: "   " }) });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.failure.message, /empty/i);
});

test("search finds material by meaning-adjacent query through the graph", async () => {
  const res = await api(`/api/search?q=${encodeURIComponent("elasticity")}`);
  const body = await res.json();
  assert.ok(body.results.length > 0);
  assert.ok(body.results.some((r: { text?: string }) => /inelastic/i.test(r.text ?? "")));
});

test("an empty search returns nothing rather than everything", async () => {
  const body = await (await api("/api/search?q=")).json();
  assert.deepEqual(body.results, []);
});

let conversationId = "";

test("a turn streams context, text and completion over SSE", async () => {
  conversationId = (await (await api("/api/conversations", { method: "POST" })).json()).conversation.id;

  const res = await fetch(`${base}/api/conversations/${conversationId}/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ text: "What does inelastic demand mean?", openDocumentId: documentId }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);

  const body = await res.text();
  const events = body.split("\n\n").filter(Boolean).map((chunk) => {
    const event = /^event: (.+)$/m.exec(chunk)![1];
    const data = JSON.parse(/^data: (.+)$/m.exec(chunk)![1]);
    return { event, data };
  });

  assert.equal(events[0].event, "context", "context is reported before any text");
  assert.ok(events[0].data.trace.candidateCount > 0);
  assert.ok(events.some((e) => e.event === "text"));
  const done = events.at(-1)!;
  assert.equal(done.event, "done");
  assert.match(done.data.message.text, /Inelastic demand means/);
});

test("the conversation persists with its trace and is retrievable", async () => {
  const body = await (await api(`/api/conversations/${conversationId}`)).json();
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages[1].role, "assistant");
  assert.ok(body.messages[1].contextTrace.included.length > 0);
  assert.equal(body.conversation.title, "What does inelastic demand mean?");
});

test("memory refuses sensitive material over the API", async () => {
  const ok = await api("/api/memories", {
    method: "POST",
    body: JSON.stringify({ kind: "goal", text: "Preparing for exams in June", quote: "exams in June" }),
  });
  assert.equal(ok.status, 201);

  const refused = await api("/api/memories", {
    method: "POST",
    body: JSON.stringify({ kind: "fact", text: "Diagnosed with ADHD", quote: "I have ADHD" }),
  });
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).failure.message, /health/);

  const listed = await (await api("/api/memories")).json();
  assert.equal(listed.memories.length, 1);
});

test("turning memory off deletes what was stored", async () => {
  await api("/api/memory-settings", { method: "POST", body: JSON.stringify({ enabled: false }) });
  const listed = await (await api("/api/memories")).json();
  assert.equal(listed.enabled, false);
  assert.equal(listed.memories.length, 0);
  await api("/api/memory-settings", { method: "POST", body: JSON.stringify({ enabled: true }) });
});

test("concepts raised by a document are listed, with no mastery claimed yet", async () => {
  const body = await (await api("/api/concepts")).json();
  const names = body.concepts.map((c: { name: string }) => c.name).sort();
  assert.deepEqual(names, ["Elasticity", "Revenue"]);
  for (const concept of body.concepts) {
    assert.equal(concept.attempts, 0);
    assert.equal(concept.reportable, false, "no attempts means no reportable mastery");
    assert.ok(concept.documentIds.includes(documentId));
  }
  const state = await (await api("/api/state")).json();
  assert.deepEqual(state.nextActions, [], "nothing to suggest without evidence");
});

test("one graded attempt records mastery but still refuses to report it", async () => {
  const { concepts } = await (await api("/api/concepts")).json();
  const concept = concepts.find((c: { name: string }) => c.name === "Elasticity")!;

  const res = await api("/api/learning/attempt", {
    method: "POST",
    body: JSON.stringify({
      conceptId: concept.id, prompt: "What does PED < 1 mean?",
      response: "elastic", correct: false, difficulty: 0.4,
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.mastery.attempts, 1);
  assert.equal(body.mastery.reportable, false, "one attempt is not evidence");
  assert.deepEqual(body.nextActions, [], "and not yet grounds for a suggestion");
});

test("repeated failures become a reportable weakness and a next action", async () => {
  const { concepts } = await (await api("/api/concepts")).json();
  const concept = concepts.find((c: { name: string }) => c.name === "Elasticity")!;

  let last;
  for (let i = 0; i < 5; i++) {
    last = await (await api("/api/learning/attempt", {
      method: "POST",
      body: JSON.stringify({
        conceptId: concept.id, prompt: "q", response: "wrong", correct: false, difficulty: 0.5,
      }),
    })).json();
  }

  assert.ok(last.mastery.reportable, "six attempts is enough to report");
  assert.ok(last.mastery.estimate < 0.2);
  assert.ok(last.nextActions.length > 0, "a repeated mistake should surface an action");
  assert.equal(last.nextActions[0].kind, "fix_misconception");
  assert.match(last.nextActions[0].because, /attempts/);

  const learning = await (await api("/api/learning")).json();
  assert.equal(learning.concepts[0].name, "Elasticity");
  assert.equal(learning.concepts[0].reportable, true);
});

test("an attempt against an unknown concept is refused", async () => {
  const res = await api("/api/learning/attempt", {
    method: "POST",
    body: JSON.stringify({ conceptId: "not-a-real-concept", correct: true }),
  });
  assert.equal(res.status, 404);
});

test("unknown endpoints and missing records return honest 404s", async () => {
  assert.equal((await api("/api/nope")).status, 404);
  assert.equal((await api("/api/documents/does-not-exist")).status, 404);
  assert.equal((await api("/api/conversations/does-not-exist")).status, 404);
  assert.equal((await api("/api/artifacts/does-not-exist")).status, 404);
});

test("one user cannot read another user's material", async () => {
  const mine = cookie;
  cookie = "";                                   // become a new visitor
  await api("/api/state");
  assert.notEqual(cookie, mine);

  assert.equal((await api(`/api/documents/${documentId}`)).status, 404);
  assert.deepEqual((await (await api("/api/state")).json()).documents, []);
  assert.deepEqual((await (await api(`/api/search?q=elasticity`)).json()).results, []);

  cookie = mine;                                  // back to the original user
  assert.equal((await api(`/api/documents/${documentId}`)).status, 200);
});

test("a forged session cookie is rejected and issued a fresh identity", async () => {
  const mine = cookie;
  cookie = "session=someone-elses-id.forgedsignature";
  const state = await (await api("/api/state")).json();
  assert.deepEqual(state.documents, [], "a forged cookie must not grant access");
  cookie = mine;
});

test("the client's own files are served with correct content types", async () => {
  // Asserted before the traversal test below, so a guard that rejects
  // everything cannot pass by making the traversal assertions trivially true.
  for (const [path, pattern] of [
    ["/", /text\/html/],
    ["/index.html", /text\/html/],
    ["/app.js", /javascript/],
    ["/styles.css", /text\/css/],
    ["/lib.js", /javascript/],
    ["/state.js", /javascript/],
  ] as const) {
    const res = await fetch(`${base}${path}`, { headers: { cookie } });
    assert.equal(res.status, 200, `${path} returned ${res.status}`);
    assert.match(res.headers.get("content-type") ?? "", pattern, `${path} content-type`);
    assert.ok((await res.text()).length > 0, `${path} was empty`);
  }
});

test("path traversal cannot escape the web root", async () => {
  for (const attack of [
    "/../package.json", "/../../etc/passwd", "/..%2fpackage.json",
    "/../packages/server/src/app.ts", "/%2e%2e/package.json",
  ]) {
    const res = await fetch(`${base}${attack}`, { headers: { cookie } });
    assert.ok(res.status === 403 || res.status === 404, `${attack} returned ${res.status}`);
    const body = await res.text();
    assert.doesNotMatch(body, /"name": "understory"/, "server files must not be readable");
    assert.doesNotMatch(body, /ANTHROPIC_API_KEY/, "server source must not be readable");
  }
});

test("the interface is told plainly when no model is configured", async () => {
  const store = createStore();
  const { server } = createApp({
    store, secureCookies: false,
    engine: {
      router: new ModelRouter().register(
        new ScriptedProvider({ turns: [], available: false, id: "unavailable" }),
      ),
      tools: defaultToolRegistry(),
    },
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  const res = await fetch(`http://127.0.0.1:${port}/api/state`);
  const state = await res.json();
  assert.equal(state.model.available, false);
  assert.ok(state.model.failure.message.length > 0);

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("account deletion removes everything", async () => {
  const before = await (await api("/api/state")).json();
  assert.ok(before.documents.length > 0);

  const deleted = await api("/api/account", { method: "DELETE" });
  assert.equal(deleted.status, 200);

  cookie = "";
  const after = await (await api("/api/state")).json();
  assert.deepEqual(after.documents, []);
});
