/**
 * A stand-in for Anthropic that speaks the real wire format.
 *
 * The happy path — a 200 that streams tokens — is the one route no test in
 * this repo had ever taken, because it needs a key nobody had. This emits the
 * exact SSE event sequence the API documents, so everything downstream of the
 * socket is exercised for real: the adapter's parser, the normalisation into
 * StreamEvent, the app's own SSE framing, the reveal buffer, the throttled
 * markdown parse, persistence, and the title request that follows.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 npx next start -p 3100
 */
import { createServer } from "node:http";

/** A whole page, the way Creative answers a request to make something. */
const MADE = `Here it is.

\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Two minutes</title>
    <style>
      body { margin: 0; display: grid; place-items: center; min-height: 100vh; font: 16px system-ui; }
      output { font-size: 4rem; font-variant-numeric: tabular-nums; }
    </style>
  </head>
  <body>
    <main>
      <output id="t">02:00</output>
      <button id="go">Start</button>
    </main>
    <script>
      var left = 120;
      document.getElementById("go").addEventListener("click", function () {
        setInterval(function () {
          left = Math.max(0, left - 1);
          document.getElementById("t").textContent =
            String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
        }, 1000);
      });
    <\/script>
  </body>
</html>
\`\`\`

Change the number at the top of the script to make it longer.`;

const REPLY = `A **debounce** waits for silence: the call fires once the input has stopped changing for a set interval.

\`\`\`ts title="debounce.ts"
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
\`\`\`

A **throttle** enforces a floor between calls instead.`;

let lastSeen = null;
let rateLimitOnce = process.env.MOCK_RATE_LIMIT === "1";

const send = (res, type, data) =>
  res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);

createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || "{}");

  // /__last lets a test read what the app actually sent — how many turns
  // survived the context fitter, and whether a cache breakpoint was placed.
  if (req.url === "/__last") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(lastSeen ?? {}));
    return;
  }
  lastSeen = {
    turns: (body.messages ?? []).length,
    cachedBlocks: JSON.stringify(body).split('"cache_control"').length - 1,
    system: typeof body.system,
    temperature: body.temperature,
    topP: body.top_p,
    // The system prompt as it actually arrived, flattened across both shapes
    // the adapter can send it in. A test that asks the app what it thinks it
    // sent proves nothing; this is the wire.
    systemText: Array.isArray(body.system)
      ? body.system.map((b) => b.text ?? "").join("\n")
      : (body.system ?? ""),
    // And the turns themselves, so an attachment can be checked for actually
    // having arrived rather than for having been built.
    userText: (body.messages ?? [])
      .flatMap((m) => (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]))
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n"),
    images: (body.messages ?? [])
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((c) => c.type === "image").length,
  };

  // One 429 with a Retry-After, then behave. Proves the automatic retry both
  // waits and succeeds rather than surfacing an error the person must clear.
  if (rateLimitOnce && (body.max_tokens ?? 4096) > 64) {
    rateLimitOnce = false;
    res.writeHead(429, { "content-type": "application/json", "retry-after": "1" });
    res.end(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "retry-after 1" } }));
    return;
  }
  // Titles come through as a short one-shot with a low max_tokens; answering
  // them with the essay would make the sidebar unreadable.
  const isTitle = (body.max_tokens ?? 4096) <= 64;

  /* A canvas revision asks for the whole document back, so answering it with
     the essay would prove nothing about the diff. Instead the document is
     returned with one deterministic edit — the first line rewritten and a line
     appended — which is exactly +2 / −1 and can be asserted on. */
  const asked = (body.messages ?? [])
    .flatMap((m) => (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]))
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  const revising = /^Revise the /.test(asked) && asked.includes("\nCURRENT\n");



  /* Asked to make a thing, answer with a thing.
     Creative's whole claim is that "make me a timer" comes back as a timer,
     and the app decides from the shape of the block whether it has been handed
     a snippet or a working page. A mock that always answers with an essay
     cannot exercise the branch that tells them apart. */
  const making = /\bmake me a\b|\bbuild me a\b/i.test(asked);

  let text = isTitle ? "Debouncing a search input" : making ? MADE : REPLY;
  if (revising) {
    const current = asked.slice(asked.indexOf("\nCURRENT\n") + "\nCURRENT\n".length);
    const lines = current.replace(/\s+$/, "").split("\n");
    lines[0] = `// revised: ${lines[0]}`;
    lines.push("// appended by the mock");
    text = lines.join("\n");
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  send(res, "message_start", {
    message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], usage: { input_tokens: 412, output_tokens: 0 } },
  });
  send(res, "content_block_start", { index: 0, content_block: { type: "text", text: "" } });

  /* Chunked the way a real stream arrives: a few tokens at a time, not a wall.
     MOCK_SLOW stretches it, because anything that can only be tested *during*
     a stream — the stop button, the live ring, the reveal buffer — is
     untestable against a stream that finishes in a third of a second. */
  const gap = process.env.MOCK_SLOW ? 140 : 12;
  const chunks = text.match(/[\s\S]{1,14}/g) ?? [];
  for (const chunk of chunks) {
    send(res, "content_block_delta", { index: 0, delta: { type: "text_delta", text: chunk } });
    await new Promise((r) => setTimeout(r, gap));
  }

  send(res, "content_block_stop", { index: 0 });
  send(res, "message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 386 } });
  send(res, "message_stop", {});
  res.end();
}).listen(8787, "127.0.0.1", () => console.log("mock provider on http://127.0.0.1:8787"));
