/** Context fitting and prompt caching, measured at the wire. */
const N = (n) => "word ".repeat(n);
const post = (messages, extra = {}) =>
  fetch("http://localhost:3100/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: "claude-sonnet-4-5", messages,
      params: { temperature: 1, maxTokens: 2048, topP: 1 }, ...extra }),
  }).then((r) => r.text());
const seen = () => fetch("http://127.0.0.1:8787/__last").then((r) => r.json());
const msg = (role, text) => ({ id: role + Math.random(), conversationId: "c", parentId: null, role, content: [{ type: "text", text }], createdAt: Date.now() });
const check = (p, l, d = "") => console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`);

// Short thread: nothing dropped, nothing cached.
await post([msg("user", "hello")]);
let s = await seen();
check(s.turns === 1, "short thread sent whole", `${s.turns} turn`);
check(s.cachedBlocks === 0, "no cache breakpoint on a short prefix", `${s.cachedBlocks}`);

// Long thread: a prefix worth caching.
const long = [];
for (let i = 0; i < 8; i++) {
  long.push(msg("user", `Question ${i}. ${N(400)}`));
  long.push(msg("assistant", `Answer ${i}. ${N(400)}`));
}
long.push(msg("user", "and finally?"));
await post(long);
s = await seen();
check(s.cachedBlocks === 1, "exactly one cache breakpoint on a long prefix", `${s.cachedBlocks}`);
check(s.turns === long.length, "nothing dropped — 17 turns fit a 200K window", `${s.turns}/${long.length}`);

// A system prompt long enough to be worth caching.
await post([msg("user", "hi")], { systemPrompt: N(1200) });
s = await seen();
check(s.system === "object", "a long system prompt is sent as a cacheable block", s.system);
await post([msg("user", "hi")], { systemPrompt: "be brief" });
s = await seen();
check(s.system === "string", "a short one stays a plain string", s.system);
