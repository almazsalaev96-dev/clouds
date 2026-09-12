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

/* Asked for a picture, answer with one. The app can draw Mermaid now and
   nothing could prove it without a fence to draw. */
const DRAWN = `A request goes through three gates before it reaches a provider.

\`\`\`mermaid
%% title: how a turn reaches a provider
flowchart TD
  A[You press enter] --> B{Key configured?}
  B -- no --> C[Add a key]
  B -- yes --> D[Trim the thread to fit]
  D --> E[Place the cache breakpoint]
  E --> F[Provider]
  F --> G{Rate limited?}
  G -- yes --> H[Wait, once] --> F
  G -- no --> I[Stream the answer]
\`\`\`

The wait is taken once rather than in a loop.`;

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
let lastTitle = null;
let rateLimitOnce = process.env.MOCK_RATE_LIMIT === "1";
let failNext = null;

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
  /* Cleared so a test can ask "was a model called at all since I last looked"
     — which is the only way to check that a sum reached none. */
  if (req.url === "/__reset") {
    lastSeen = null;
    lastTitle = null;
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
    return;
  }
  /* Arm the next answer to fail. A whole layer of this app — every sentence a
     person reads when something goes wrong, and every button offered to fix it
     — had never been rendered by a test, because nothing could make it fail on
     purpose. `POST /__fail {status, body, times}` makes it fail on purpose. */
  if ((req.url ?? "").startsWith("/__fail")) {
    const q = new URL(req.url, "http://x").searchParams;
    failNext = q.get("status")
      ? { status: Number(q.get("status")), body: q.get("body") ?? "", left: Number(q.get("times") ?? 1) }
      : null;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(failNext ?? {}));
    return;
  }
  if (req.url === "/__title") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(lastTitle ?? {}));
    return;
  }
  /* The title request is not the work.
     Every first message is followed by a small call that names the
     conversation, and it arrives *after* the answer — so `/__last` used to
     mean "the last thing the app did", which on every new thread is the
     titler. A suite asserting which model answered was reading the model that
     wrote the title. Recorded separately instead, so both can be asked about
     and neither is mistaken for the other. */
  const titling = (body.max_tokens ?? 4096) <= 64;
  if (titling) {
    lastTitle = { model: body.model };
  } else lastSeen = {
    // Which model the request was actually addressed to. The router's whole
    // claim is about this field, and asking the app what it believes it chose
    // would prove nothing.
    model: body.model,
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
    /* How the instructions were *split*, not just what they said. The stable
       half is what the provider caches and the per-turn half is what changes,
       so a test has to be able to see that the second one did not land inside
       the first and move the breakpoint. */
    systemBlocks: Array.isArray(body.system) ? body.system.length : body.system ? 1 : 0,
    cachedSystemBlocks: Array.isArray(body.system)
      ? body.system.filter((b) => b.cache_control).length
      : 0,
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

  /* Armed by /__fail. Titles are spared: an error on the little naming call
     would be a second failure the test did not ask for, and it arrives after
     the answer, so it would land on whichever message came next. */
  if (failNext && failNext.left > 0 && (body.max_tokens ?? 4096) > 64) {
    failNext.left -= 1;
    res.writeHead(failNext.status, { "content-type": "application/json" });
    res.end(failNext.body || JSON.stringify({ type: "error", error: { message: "mock failure" } }));
    return;
  }

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
  const drawing = /\bdraw\b|\bdiagram\b|\bflowchart\b/i.test(asked);

  /* A plan has to come back as JSON with runnable steps in it, because the
     whole claim of the feature is that a step can be pressed. An essay here
     would pass a test of "something came back" and prove nothing. */
  const planning = /^Plan how you would change this/.test(asked);
  const PLAN = JSON.stringify({
    summary: "Two things: the loop rebuilds the array on every pass, and there is no guard on bad input.",
    steps: [
      { title: "Push instead of concat", why: "concat copies the whole array each time round, which makes the loop quadratic.", instruction: "Replace the concat in the loop with a push so the array is not copied on every pass." },
      { title: "Guard the input", why: "A non-array argument throws deep inside the loop rather than at the boundary.", instruction: "Throw a clear TypeError at the top of the function when items is not an array." },
    ],
  });

  /* A check is about a diff and is prose, not a file: answering it with the
     revision machinery below would hand back a "checked" document. */
  /* An element change comes back as {file, content}: the whole feature is that
     the app decides *where* the change goes from what the model names, so a
     mock that answered with a bare file would leave that untested. The file is
     the stylesheet, because "make it smaller" is the case worth exercising —
     you point at markup and the change lands somewhere else. */
  const pointing = /^Someone is looking at this page running/.test(asked);
  let POINTED = "{}";
  if (pointing) {
    const folder = asked.slice(asked.indexOf("\nTHE FOLDER\n"));
    const at = folder.indexOf("--- style.css ---");
    const body = at === -1 ? "" : folder.slice(at + "--- style.css ---\n".length).split("\n--- ")[0];
    POINTED = JSON.stringify({ file: "style.css", content: body.replace(/\s+$/, "") + "\n\n.picked-by-the-mock { font-size: 12px; }" });
  }

  /* A question about the whole project. Answered by naming files, because the
     assertion worth making is that the app fed it every file in the project —
     not that something came back. */
  const asking = /^Answer a question about this project/.test(asked);
  const ASK = `The counter lives in two places.

The markup is in **Counter / index.html** — the \`#value\` output and the two buttons.

The behaviour is in **Counter / app.js**, which wires \`#up\` and \`#down\` to it.

Nothing in **notes.md** touches it.`;

  /* Something made out of sources, with citations in it.
     One of the three is deliberately a quote that is NOT in the material. The
     app's claim is that it checks citations rather than trusting them, and a
     mock that only ever produces true ones would leave the half that matters —
     what happens when a model invents evidence — untested. */
  const making_from = /^Make what is asked for below, out of the material/.test(asked);
  let MADE_FROM = "";
  if (making_from) {
    const material = asked.slice(asked.indexOf("\nTHE MATERIAL\n") + "\nTHE MATERIAL\n".length);
    const body = material.replace(/^--- [^\n]* ---\n/, "");
    const name = (material.match(/^--- ([^\n]*) ---/) ?? [, "source"])[1];
    const sentences = body.split(/(?<=\.)\s+/).map((x) => x.trim()).filter((x) => x.length > 24);
    const one = sentences[0] ?? body.slice(0, 80);
    const two = sentences[1] ?? sentences[0] ?? body.slice(0, 80);
    MADE_FROM = `## What it says

The first thing it establishes [[cite: ${name} | ${one}]]

It goes on from there [[cite: ${name} | ${two}]]

## A claim with no basis

It also reports a figure of nine hundred percent [[cite: ${name} | the result was nine hundred percent higher than anyone expected in the third quarter]]`;
  }

  /* A second opinion. Comes back as JSON with a verdict, and the verdict is a
     *disagreement* on purpose: a mock that always agrees would leave the only
     interesting half of the feature — what a real disagreement looks like on
     screen — completely untested. */
  const verifying = /^Someone asked a question and got the answer below/.test(asked);
  const VERDICT = JSON.stringify({
    agrees: "partly",
    text: "The description of debouncing is right.\n\nBut the second paragraph calls the trailing edge the default; it is not, and the code above it does not do that either.",
  });

  const checking = /^A change was just made to this/.test(asked);
  const CHECK = `It does what was asked: the concat is gone and the loop pushes instead.

It also renamed \`out\` to \`result\`, which was not asked for.

Nothing here looks like it breaks a caller — the return type is the same array.`;

  let text = isTitle
    ? "Debouncing a search input"
    : verifying
    ? VERDICT
    : making_from
    ? MADE_FROM
    : asking
    ? ASK
    : pointing
      ? POINTED
      : planning
        ? PLAN
        : checking
          ? CHECK
          : making
            ? MADE
            : drawing
              ? DRAWN
              : REPLY;
  if (revising) {
    const current = asked.slice(asked.indexOf("\nCURRENT\n") + "\nCURRENT\n".length);
    const lines = current.replace(/\s+$/, "").split("\n");
    lines[0] = `// revised: ${lines[0]}`;
    lines.push("// appended by the mock");
    text = lines.join("\n");
  }

  const gap = process.env.MOCK_SLOW ? 140 : 12;
  const chunks = text.match(/[\s\S]{1,14}/g) ?? [];

  /* The same answers, in OpenAI's wire format.
     ---------------------------------------------------------------------
     Everything this app does across *two* providers — and the second opinion
     is the whole point of holding several keys — was untestable, because the
     harness only ever spoke Anthropic. A request the app correctly routed to
     another provider left the harness entirely and died against a real
     endpoint, which looks exactly like the feature being broken.
     Same content, same pacing, different envelope. */
  if ((req.url ?? "").includes("/chat/completions")) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const frame = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { role: "assistant" } }] });
    for (const chunk of chunks) {
      frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { content: chunk } }] });
      await new Promise((r) => setTimeout(r, gap));
    }
    frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 412, completion_tokens: 386, total_tokens: 798 } });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
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
  for (const chunk of chunks) {
    send(res, "content_block_delta", { index: 0, delta: { type: "text_delta", text: chunk } });
    await new Promise((r) => setTimeout(r, gap));
  }

  send(res, "content_block_stop", { index: 0 });
  /* A safety system cutting an answer short is a real ending and the app has
     to say so, so it needs a way to happen on purpose. Asked for by the
     question rather than by a switch, because it belongs to one turn. */
  send(res, "message_delta", {
    delta: { stop_reason: /\brefuse this\b/i.test(asked) ? "refusal" : "end_turn" },
    usage: { output_tokens: 386 },
  });
  send(res, "message_stop", {});
  res.end();
}).listen(8787, "127.0.0.1", () => console.log("mock provider on http://127.0.0.1:8787"));
