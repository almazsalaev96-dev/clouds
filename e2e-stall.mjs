/**
 * A silent provider is not a dead connection.
 *
 * Seen on a revision pack from a 988-page book: "The connection ended before
 * the answer did." Nothing had ended at the provider — a large source on a
 * reasoning model sits for a while before its first event, and everything in
 * between treats a silent stream as a dead one. So the route sends a byte at
 * once and one every ten seconds while the upstream is quiet.
 *
 * No browser: the claim is about what leaves the server and when, so the
 * route is read directly. The mock is started with MOCK_STALL so its first
 * event is held back, and the questions are: did anything arrive before it,
 * how soon, and did the answer still finish.
 *
 *   MOCK_STALL=4000 node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-stall.mjs
 */
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const t0 = Date.now();
const res = await fetch("http://localhost:3100/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    modelId: "claude-sonnet-4-5",
    messages: [{ id: "m1", conversationId: "c", parentId: null, role: "user", content: [{ type: "text", text: "What is a debounce" }], createdAt: 0 }],
    params: { maxTokens: 512, temperature: 0.7, topP: 1 },
  }),
});
check(res.ok, "the route answers", String(res.status));

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
let firstByteAt = null;
let firstDataAt = null;
let commentsBeforeData = 0;
let sawDone = false;
let text = "";
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (firstByteAt === null) firstByteAt = Date.now() - t0;
  buf += dec.decode(value, { stream: true });
  let nl;
  while ((nl = buf.indexOf("\n\n")) !== -1) {
    const chunk = buf.slice(0, nl);
    buf = buf.slice(nl + 2);
    if (chunk.startsWith(":")) {
      if (firstDataAt === null) commentsBeforeData++;
      continue;
    }
    if (!chunk.startsWith("data: ")) continue;
    if (firstDataAt === null) firstDataAt = Date.now() - t0;
    try {
      const ev = JSON.parse(chunk.slice(6));
      if (ev.type === "text") text += ev.text;
      if (ev.type === "done") sawDone = true;
    } catch { /* partial */ }
  }
}

console.log("\nBytes before the provider speaks");
check(firstByteAt !== null && firstByteAt < 1500, "the first byte arrives at once, not when the model does", `${firstByteAt}ms`);
check(firstDataAt !== null && firstDataAt >= 3500, "while the provider itself was silent for the stall", `first event at ${firstDataAt}ms`);
check(commentsBeforeData >= 1, "and what filled the silence was a comment frame the parsers skip", `${commentsBeforeData} before any data`);

console.log("\nAnd the answer still finishes");
check(sawDone, "the stream ends with done rather than just ending");
check(text.length > 20, "with an answer in it", `${text.length} characters`);

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
