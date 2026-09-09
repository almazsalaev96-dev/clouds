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

const send = (res, type, data) =>
  res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);

createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || "{}");
  // Titles come through as a short one-shot with a low max_tokens; answering
  // them with the essay would make the sidebar unreadable.
  const isTitle = (body.max_tokens ?? 4096) <= 64;
  const text = isTitle ? "Debouncing a search input" : REPLY;

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  send(res, "message_start", {
    message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], usage: { input_tokens: 412, output_tokens: 0 } },
  });
  send(res, "content_block_start", { index: 0, content_block: { type: "text", text: "" } });

  // Chunked the way a real stream arrives: a few tokens at a time, not a wall.
  const chunks = text.match(/[\s\S]{1,14}/g) ?? [];
  for (const chunk of chunks) {
    send(res, "content_block_delta", { index: 0, delta: { type: "text_delta", text: chunk } });
    await new Promise((r) => setTimeout(r, 12));
  }

  send(res, "content_block_stop", { index: 0 });
  send(res, "message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 386 } });
  send(res, "message_stop", {});
  res.end();
}).listen(8787, "127.0.0.1", () => console.log("mock provider on http://127.0.0.1:8787"));
