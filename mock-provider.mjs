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

/* A question the reader has to answer before the answer appears. */
const GATED = `\`reduce\` with no initial value takes the first element as the seed.

\`\`\`predict
{"q":"So what does it do on an empty list?","options":["returns 0","returns undefined","throws"],"answer":2,"why":"There is no first element to seed from, and no initial value was given, so it has nothing to return."}
\`\`\`

Pass an initial value and the empty case becomes that value instead.`;

/* The same answer, with a gate that cannot be rendered: its `answer` points
   past the end of its own options. What matters is not that the gate is
   missing — it is that the two paragraphs around it are still there. A parser
   that throws inside the renderer takes the whole message with it, which is a
   far worse failure than no gate at all. */
const BROKEN_GATE = `\`fold\` with no initial value takes the first element as the seed.

\`\`\`predict
{"q":"So what does it do on an empty list?","options":["returns 0","throws"],"answer":7}
\`\`\`

Pass an initial value and the empty case becomes that value instead.`;

const REPLY = `A **debounce** waits for silence: the call fires once the input has stopped changing for a set interval.

\`\`\`ts title="debounce.ts"
// The timer is reset on every call rather than only on the first, so a burst of input collapses into a single invocation at the end of it, which is what a search box wants and the exact opposite of a throttle.
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
\`\`\`

A **throttle** enforces a floor between calls instead.`;

/* Asked for a number over data, answer by working it out.
   The app runs the block and hands the output back, so a mock that replied
   with a number in prose would leave the whole loop untested — and the
   number it replied with would be the exact failure the loop exists to
   prevent. */
const COMPUTED = `Working out the mean of the ten numbers you gave.

\`\`\`compute
const xs = [12, 47, 8, 93, 16, 55, 4, 71, 28, 60];
const total = xs.reduce((a, b) => a + b, 0);
console.log("count", xs.length);
console.log("total", total);
console.log("mean", total / xs.length);
\`\`\``;

/* And the other half: handed the output, answer with it. */
const AFTER_COMPUTE = `The mean is 39.4, over ten numbers totalling 394.`;

let lastSeen = null;
let lastTitle = null;
const recent = [];
let rateLimitOnce = process.env.MOCK_RATE_LIMIT === "1";
let failNext = null;

/** The instructions as they arrived, in either wire format. */
const systemTextOf = (body) => {
  if (Array.isArray(body.system)) return body.system.map((b) => b.text ?? "").join("\n");
  if (typeof body.system === "string") return body.system;
  const first = (body.messages ?? [])[0];
  return first?.role === "system" && typeof first.content === "string" ? first.content : "";
};

const send = (res, type, data) =>
  res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);

createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || "{}");

  /* OpenAI's other API, folded into the shape the rest of this file reads.
     ---------------------------------------------------------------------
     `/v1/responses` is where OpenAI's models went, because it is the only
     endpoint of theirs that takes function tools and an effort in the same
     request. Its envelope is different — one `input` list of items instead
     of `messages`, the instructions in their own field, tools flat — but
     what a test wants to assert about a request is the same as ever: what
     it was told, which model, how hard to think, which tools were offered.
     So it is translated once, here, rather than every reader of it growing
     a second shape to know about. What goes back out is this endpoint's own
     envelope, at the bottom. */
  const isResponses = (req.url ?? "").includes("/responses");
  if (isResponses) {
    const msgs = [];
    if (body.instructions) msgs.push({ role: "system", content: String(body.instructions) });
    for (const item of body.input ?? []) {
      if (item.type === "function_call") {
        msgs.push({ role: "assistant", content: null, tool_calls: [{ id: item.call_id, type: "function", function: { name: item.name, arguments: item.arguments ?? "{}" } }] });
      } else if (item.type === "function_call_output") {
        msgs.push({ role: "tool", tool_call_id: item.call_id, content: String(item.output ?? "") });
      } else if (item.role) {
        const content = (Array.isArray(item.content) ? item.content : []).map((c) =>
          c.type === "input_image" ? { type: "image", image_url: c.image_url }
            : { type: "text", text: c.text ?? "" });
        msgs.push({ role: item.role, content });
      }
    }
    body.messages = msgs;
    // Every ceiling test in this file reads `max_tokens`; here it has another name.
    if (body.max_output_tokens !== undefined) body.max_tokens = body.max_output_tokens;
  }

  // /__last lets a test read what the app actually sent — how many turns
  // survived the context fitter, and whether a cache breakpoint was placed.
  if (req.url === "/__last") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(lastSeen ?? {}));
    return;
  }
  /* Every call since the last reset, in order, so a test can prove that one
     turn was two models: a brief to one company and the answer to another.
     Kept apart from `/__last` rather than folded into it, because an empty
     `/__last` is itself an assertion — "nothing was sent" — and adding a
     field to it made that read as something. */
  if (req.url === "/__recent") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ recent }));
    return;
  }
  /* Cleared so a test can ask "was a model called at all since I last looked"
     — which is the only way to check that a sum reached none. */
  if (req.url === "/__reset") {
    lastSeen = null;
    lastTitle = null;
    recent.length = 0;
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
    /* Who spoke last. A resumed pause_turn ends in the assistant's own tool
       blocks; a "continue" message would end in the user. */
    lastRole: (body.messages ?? []).at(-1)?.role ?? null,
    cachedBlocks: JSON.stringify(body).split('"cache_control"').length - 1,
    system: typeof body.system,
    temperature: body.temperature,
    topP: body.top_p,
    /* How hard it was asked to think, which is half of what an Armi model
       means: Nova and Orion can reach the same endpoint and must not reach it
       with the same budget. Null when thinking was never enabled. */
    thinking: body.thinking?.budget_tokens ?? null,
    /* The other way of asking for it. Anthropic replaced the budget with a
       word from the 4.6 generation on, so a probe that only ever looked at
       `thinking` would report "this model was not told to think" about every
       current model — which is how the shape got out of date unnoticed. */
    effort: body.output_config?.effort ?? null,
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
    /* Which web tools the app offered, by type. `e2e-research` reads this to
       prove the request carried the tool and not only that an answer came. */
    /* Name before type: a Responses-shaped tool is flat, {type:"function", name},
       and reading its type first reported every tool as "function". */
    tools: (body.tools ?? []).map((t) => t.function?.name ?? t.name ?? t.type),
    images: (body.messages ?? [])
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((c) => c.type === "image").length,
  };

  /* The mock refuses what the real one refuses.
     ---------------------------------------------------------------------
     A mock that accepts anything proves the app talks to itself, not to
     Anthropic. Two whole classes of failure lived behind that: an empty
     text block, which the API rejects outright, and `temperature` with
     `top_p`, which Claude 4 rejects outright. Between them they broke the
     chat after its first failed turn and broke every "ask for a change" in
     the canvas — and the suite was green throughout. So the rules the API
     actually enforces are enforced here, and a request that breaks one is
     a 400 with the API's own wording rather than a passing test.

     Alternation is the house rule of the three: the API merges consecutive
     turns rather than refusing them, but a transcript that arrives already
     in order is the only one whose token count and cache prefix are what
     the app thinks they are. */
  const problem = (() => {
    const all = body.messages;
    /* Which API this request is pretending to be. The rules below are
       Anthropic's, and applying them to an OpenAI-shaped body invents
       restrictions nobody has: OpenAI takes `temperature` and `top_p`
       together and every request the adapter sends carries both, so the mock
       was rejecting perfectly legal calls — which is how a council seat on
       GPT-4.1 quietly never happened. The adapter always sends
       `stream_options` on that format, which is the cleanest tell. */
    const openaiShape =
      isResponses ||
      Boolean(body.stream_options) ||
      body.max_completion_tokens !== undefined ||
      (Array.isArray(all) && all[0]?.role === "system");
    /* The refusals that sent this app to this endpoint in the first place.
       A mock that takes anything would have let the original fault — an
       effort sent beside a tool — go out again under a different name. */
    if (isResponses) {
      if (body.reasoning_effort !== undefined)
        return "Unknown parameter: 'reasoning_effort'. Use 'reasoning.effort'.";
      for (const t of body.tools ?? []) {
        if (t.type === "function" && !t.name)
          return "Missing required parameter: 'tools[0].name'.";
      }
      if (body.max_completion_tokens !== undefined)
        return "Unknown parameter: 'max_completion_tokens'. Use 'max_output_tokens'.";
    }
    if (!openaiShape) {
      if (body.temperature !== undefined && body.top_p !== undefined)
        return "`temperature` and `top_p` cannot both be specified for this model. Please use only one.";
      if (body.temperature !== undefined && body.thinking)
        return "`temperature` may not be used with extended thinking.";
      /* The two ways of asking for thinking are exclusive, and the real API
         rejects the old block outright on a model that takes the new one.
         The mock cannot know which model is which, but it can refuse the one
         request that is wrong for every model — both at once — which is what
         a client gets when it has not noticed the shape changed. */
      /* A budget and an effort are two answers to one question, and the
         real API refuses the pair. Adaptive thinking is not a budget: on
         the current models it rides alongside effort, and asking for its
         display as a summary is how the reasoning streams at all. */
      if (body.thinking && body.thinking.type !== "adaptive" && body.output_config)
        return "`thinking` and `output_config.effort` may not be used together.";
      if (body.thinking?.type === "adaptive" && body.thinking.budget_tokens !== undefined)
        return "`budget_tokens` is not accepted with adaptive thinking.";
      if (body.temperature !== undefined && body.output_config?.effort)
        return "`temperature` may not be used with `output_config.effort`.";
    }
    if (!Array.isArray(all) || all.length === 0) return "messages: at least one message is required";
    /* The OpenAI wire format carries the system prompt as the first message
       rather than as a field of its own. That is legal there and impossible
       in Anthropic's shape — the adapter sends `system` as a field — so it is
       skipped before alternation is judged rather than counted as a turn out
       of order. Rejecting it was the mock inventing a rule nobody has: it
       failed every OpenAI request that carried a system prompt, which is
       most of them. */
    const offset = all[0]?.role === "system" ? 1 : 0;
    const ms = all.slice(offset);
    if (!ms.length) return "messages: at least one message is required";
    let expect = "user";
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      /* The OpenAI shape's tool round: an assistant message whose content is
         null beside its `tool_calls`, then one `tool` message per call in
         the user's place. Both are legal there and the alternation rule
         reads them as the turns they stand in for. */
      if (openaiShape && m.role === "tool") {
        if (expect !== "user") return `messages.${i + offset}: a tool message must follow an assistant message with tool_calls`;
        if (i + 1 >= ms.length || ms[i + 1].role !== "tool") expect = "assistant";
        continue;
      }
      const blocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
      if (!blocks.length) return `messages.${i + offset}.content: must not be empty`;
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j];
        if (b && b.type === "text" && !String(b.text ?? "").trim() && !(openaiShape && m.tool_calls))
          return `messages.${i + offset}.content.${j}.text: text content blocks must be non-empty`;
      }
      if (m.role !== expect)
        return `messages.${i + offset}: roles must alternate between "user" and "assistant", but found "${m.role}" where "${expect}" was expected`;
      expect = expect === "user" ? "assistant" : "user";
    }
    return null;
  })();
  if (problem) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: problem } }));
    return;
  }

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
  /* A question about a number over data, and the turn that follows one.
     `systemText` carries the per-turn note, which is where the output of a
     calculation is handed back. */
  const computing = /\baverage\b|\bmean of\b/i.test(asked);
  /* Cards, when asked for cards. A deck is JSON with a shape the app
     parses, so a mock that answered with prose would leave the parsing,
     the de-duplication and the whole scheduler untested. */
  const carding = /^Write \d+ question-and-answer cards/.test(asked);
  const CARDS = JSON.stringify([
    { front: "What does a debounce wait for?", back: "Silence — it fires once the input has stopped changing for a set interval.", topic: "debounce" },
    { front: "How does a throttle differ from a debounce?", back: "A throttle enforces a floor between calls; a debounce waits for a gap.", topic: "throttle" },
    { front: "Which one fires during a continuous burst of events?", back: "The throttle. The debounce fires only after the burst ends.", topic: "throttle" },
    { front: "What is the usual argument to both?", back: "A number of milliseconds: the gap to wait for, or the floor between calls.", topic: "debounce" },
  ]);
  const afterCompute = /This app ran the computation/.test(
    [body.system, body.turnPrompt].map((x) => (typeof x === "string" ? x : JSON.stringify(x ?? ""))).join(" "),
  );
  const drawing = /\bdraw\b|\bdiagram\b|\bflowchart\b/i.test(asked);
  /* A comparison, as a table. Mixed on purpose: a figures column with a
     blank and an "n/a" in it, a text column, a currency column, and one cell
     with a comma — every case a sort or a CSV export gets wrong when it is
     wrong. A tidy table would prove nothing. */
  const tabling = /\bcompare\b|\bas a table\b/i.test(asked);
  /* A trend, as a chart fence. Two series so the legend has to appear, a
     gap in one so the line has to break, and thousands in the values so the
     axis has to group them. */
  const charting = /\bchart\b|\bplot\b|\btrend\b/i.test(asked);
  const CHART = [
    "Requests over the quarter, by route:",
    "",
    "```chart",
    JSON.stringify({ type: "line", title: "Requests per day", unit: "req", x: ["Jul", "Aug", "Sep", "Oct"],
      series: [{ name: "Search", values: [1200, 1800, null, 2600] }, { name: "Checkout", values: [400, 450, 700, 900] }] }),
    "```",
    "",
    "Search dropped its September number — the log for that month is missing.",
  ].join("\n");
  const TABLE = [
    "Three ways to wait, side by side:",
    "",
    "| Approach | Latency (ms) | Cost | Notes |",
    "|---|---|---|---|",
    "| Debounce | 300 | £0.10 | Fires after silence |",
    "| Throttle | 100 | £1,200 | Floor between calls, see Smith, J. |",
    "| Polling | n/a | £12 | Not recommended |",
    "| Long poll | 2000 | | Holds the line open |",
    "",
    "Pick by what the interaction needs.",
  ].join("\n");
  const gating = /\breduce\b|\bempty list\b/i.test(asked);
  const breaking = /\bfold\b/i.test(asked);

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

  /* The other half of a second opinion, bought before the answer exists
     rather than after it. An Armi model sends the question to a model from a
     different company and asks what a good answer has to get right; what
     comes back has to turn up inside the *next* request, which is the only
     assertion worth making about it. Deliberately quotable. */
  /* The record of the turns that no longer fit. Answered with something
     naming what it was told, so a test can prove the record was made from
     the dropped turns and then rode with the next request rather than
     merely having been asked for. */
  const recapping = /^Below is the opening of a conversation that has grown too long/.test(asked);
  const RECAP = `Here is the record:\n\nWorking on: ${/revision planner/i.test(asked) ? "a revision planner" : "a long thread"}. Said earlier: ${/pangolin/i.test(asked) ? "pangolins came up" : "nothing notable"}.`;

  const briefing = /^Another model is about to answer the question below/.test(asked);
  const BRIEF = `- say what a debounce delays rather than what it prevents
- the trailing edge is not the default
- one case where a throttle is the right tool instead`;

  /* One seat on the council. Three models are given three halves of the same
     question and none of them is asked for an answer, so the canned reply
     names its own half — which is how a test can prove that three *different*
     askings went out and that all three came back inside the request that
     carries the question. */
  const seated = /^You are one of three models working on this/.test(asked);
  const SEAT_OF = /your half is the strategy/.test(asked)
    ? "strategy"
    : /your half is the reasoning/.test(asked)
      ? "logic"
      : "knowledge";
  const SEAT = `- ${SEAT_OF}: the migration is the expensive half, whichever way this goes
- ${SEAT_OF}: and the deadline is the thing nobody has costed`;

  /* A second opinion. Comes back as JSON with a verdict, and the verdict is a
     *disagreement* on purpose: a mock that always agrees would leave the only
     interesting half of the feature — what a real disagreement looks like on
     screen — completely untested. */
  const verifying = /^Someone asked a question and got the answer below/.test(asked);
  const VERDICT = JSON.stringify({
    agrees: "partly",
    text: "The description of debouncing is right.\n\nBut the second paragraph calls the trailing edge the default; it is not, and the code above it does not do that either.",
  });

  /* Reading a page with someone. The answer quotes the page's own first
     sentence on a '> ' line, because the claim worth testing is that a
     quote can be found and lit up on the page — a made-up line could not
     be. Marking comes back as the JSON the app draws ticks from. */
  const tutorContent = ((body.messages ?? []).at(-1)?.content ?? []);
  const tutorAsked = (Array.isArray(tutorContent) ? tutorContent.filter((c) => c.type === "text").map((c) => c.text).join("\n") : String(tutorContent));
  const tutoring = /^We are working through/.test(tutorAsked);
  const marking = tutoring && /^Mark my working/m.test(tutorAsked);
  const pageSaid = (tutorAsked.match(/The page says:\n\n([^\n]+)/) ?? [, ""])[1].trim();
  const TUTORED = `It comes down to this line:\n\n> ${pageSaid || "what the page shows"}\n\nRead it once more, then tell me in your own words what it claims. Which word carries the claim?`;
  const MARKED = JSON.stringify({
    steps: [
      { text: "The first step follows from the page.", ok: true },
      { text: "The second step drops the unit.", ok: false, note: "The quantity on the left is in kilopascals and the right has none." },
      { text: "The conclusion restates the second step.", ok: false, note: "It inherits the missing unit." },
    ],
    summary: "One slip in the second step, carried through.",
  });
  const studio = /^Write a study guide|^Write eight exam-style questions|^Summarise this in five lines/.test(asked);
  const STUDIO = /^Write a study guide/.test(asked)
    ? "## Ten things to know\n\n1. Photosynthesis happens in the chloroplast.\n2. Respiration happens in the mitochondrion.\n\n## Key terms\n\n| Term | Meaning |\n|---|---|\n| Chloroplast | Where photosynthesis happens |\n\n## Three mistakes\n\n- Confusing the two organelles."
    : /^Write eight/.test(asked)
      ? "## Questions\n\n1. State where photosynthesis happens. (1)\n\n## Mark schemes\n\n1. Chloroplast (1)"
      : "- Photosynthesis happens in the chloroplast.\n- Respiration happens in the mitochondrion.\n\nIt does not cover the light-dependent stage.";

  const checking = /^A change was just made to this/.test(asked);
  const CHECK = `It does what was asked: the concat is gone and the loop pushes instead.

It also renamed \`out\` to \`result\`, which was not asked for.

Nothing here looks like it breaks a caller — the return type is the same array.`;

  /* Every call, in order, so a test can prove that one turn was two models:
     a brief to one company and the answer to another, in that order. `__last`
     alone can only ever show whichever was most recent. */
  recent.push({
    model: body.model,
    kind: isTitle ? "title" : recapping ? "recap" : briefing ? "brief" : seated ? "council" : verifying ? "verify" : "answer",
    /* What that call was told, bounded. `__last` is only ever the most
       recent request, and a turn that goes out three times — brief, answer,
       and the answer again after an objection — cannot be read from it: the
       claim being made is about the *second* answer, which by then is two
       requests old. */
    /* Generously capped: the per-turn half — the register, the stance, the
       brief, the objection — arrives *after* the house rules, so a tight
       slice keeps exactly the part nothing needs to assert about and drops
       the part everything does. */
    system: systemTextOf(body).slice(0, 20_000),
    /* And how hard it was asked to think. On `__last` alone this is only ever
       the most recent call, which on a tactic that briefs, answers, checks and
       answers again is a verdict rather than the answer. */
    thinking: body.thinking?.budget_tokens ?? null,
    /* The other way of asking for it. Anthropic replaced the budget with a
       word from the 4.6 generation on, so a probe that only ever looked at
       `thinking` would report "this model was not told to think" about every
       current model — which is how the shape got out of date unnoticed. */
    effort: body.output_config?.effort ?? null,
  });
  if (recent.length > 16) recent.shift();

  let text = isTitle
    ? "Debouncing a search input"
    : marking
    ? MARKED
    : tutoring
    ? TUTORED
    : studio
    ? STUDIO
    : recapping
    ? RECAP
    : briefing
    ? BRIEF
    : seated
    ? SEAT
    : verifying
    ? VERDICT
    : carding
    ? CARDS
    : afterCompute
    ? AFTER_COMPUTE
    : computing
    ? COMPUTED
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
              : tabling
                ? TABLE
                : charting
                  ? CHART
                  : breaking
                ? BROKEN_GATE
                : gating
                  ? GATED
                  : REPLY;
  if (revising) {
    const current = asked.slice(asked.indexOf("\nCURRENT\n") + "\nCURRENT\n".length);
    const lines = current.replace(/\s+$/, "").split("\n");
    lines[0] = `// revised: ${lines[0]}`;
    lines.push("// appended by the mock");
    text = lines.join("\n");
  }

  /* This app's own tools, when it offered them.
     ---------------------------------------------------------------------
     A tool call is the one thing a model does that the app has to *act*
     on rather than show, and the whole round trip — the ask in the
     provider's shape, the app running it against its own database, the
     result going back, the answer that follows — is untestable against a
     mock that only ever writes prose. So when the request carries one of
     the app's tools and the last thing the person said asks for what that
     tool does, the mock asks for the tool; and when the request comes back
     carrying a result, it answers with what the result said, so a test can
     prove the answer was written from what the app actually did. Decided
     from the last thing the person typed, not the whole transcript: after
     the cards are saved, the transcript still says "make me cards". */
  const isOpenAI = (req.url ?? "").includes("/chat/completions");
  /* Nested under `function` on chat/completions, flat on responses, and a
     name of its own on Anthropic's — one read that takes all three. */
  const offered = new Set((body.tools ?? []).map((t) => t.function?.name ?? t.name).filter(Boolean));
  const lastMsg = (body.messages ?? []).at(-1);
  const lastText = (m) => (Array.isArray(m?.content) ? m.content.filter((c) => c.type === "text").map((c) => c.text).join("\n") : typeof m?.content === "string" ? m.content : "");
  const lastAsk = [...(body.messages ?? [])].reverse().find((m) => m.role === "user" && lastText(m).trim());
  const ask = lastText(lastAsk);
  const resultText = isOpenAI || isResponses
    ? lastMsg?.role === "tool" ? String(lastMsg.content ?? "") : ""
    : Array.isArray(lastMsg?.content)
      ? lastMsg.content.filter((c) => c.type === "tool_result").map((c) => (typeof c.content === "string" ? c.content : JSON.stringify(c.content))).join("\n")
      : "";
  const wantsTool = (() => {
    if (!offered.size || resultText) return null;
    let m;
    if (/\bflashcards\b|\bmake me (some )?cards\b|\bcards (about|on|for)\b/i.test(ask) && offered.has("save_cards"))
      return { name: "save_cards", input: { deck: "Debounce", cards: [
        { front: "What does a debounce wait for?", back: "Silence — a gap in the input.", topic: "debounce" },
        { front: "What does a throttle enforce?", back: "A floor between calls.", topic: "throttle" },
        { front: "Which fires during a continuous burst?", back: "The throttle.", topic: "throttle" },
      ] } };
    if (/\bsave (this|that|it) (as|to) (a )?(note|page)\b/i.test(ask) && offered.has("save_note"))
      return { name: "save_note", input: { title: "Debounce, explained", content: "# Debounce, explained\n\nA debounce waits for silence: the call fires once the input has stopped changing for a set interval.\n\nA throttle enforces a floor between calls instead." } };
    if (/what('s| is) due\b|how('s| is) my (study|revision)/i.test(ask) && offered.has("study_status")) return { name: "study_status", input: {} };
    if ((m = /search my notes (?:for|about) (.+?)[?.]?$/i.exec(ask)) && offered.has("search_notes")) return { name: "search_notes", input: { query: m[1] } };
    if ((m = /(?:did we talk about|what did we say about) (.+?)[?.]?$/i.exec(ask)) && offered.has("search_conversations")) return { name: "search_conversations", input: { query: m[1] } };
    if (/what time is it|what('s| is) (the )?(date|day) today/i.test(ask) && offered.has("now")) return { name: "now", input: {} };
    if ((m = /(?:calculate|work out) (.+?)[?.]?$/i.exec(ask)) && offered.has("calculate")) return { name: "calculate", input: { expression: m[1] } };
    if (/\badd (this|that|it) to the project\b/i.test(ask) && offered.has("save_to_project")) return { name: "save_to_project", input: { name: "decisions.md", text: "We debounce the search box at 300ms." } };
    if (/what have i (made|built)/i.test(ask) && offered.has("list_made")) return { name: "list_made", input: {} };
    if ((m = /read (?:me )?my (.+?) page/i.exec(ask)) && offered.has("read_note")) return { name: "read_note", input: { title: m[1] } };
    if ((m = /add (?:this|that|a line) to my (.+?) page/i.exec(ask)) && offered.has("append_note")) return { name: "append_note", input: { title: m[1], content: "Added by the model: a throttle enforces a floor between calls." } };
    if ((m = /show me (?:the )?(.+?) i (?:made|built)/i.exec(ask)) && offered.has("read_made")) return { name: "read_made", input: { title: m[1] } };
    return null;
  })();
  if (resultText) {
    /* The answer after the doing, written from the result. The pause is
       the round trip a real provider takes to read it; without it the
       "Saving cards" line lives for less than a frame. */
    await new Promise((r) => setTimeout(r, 600));
    text = `Done — ${resultText.replace(/\s+/g, " ").slice(0, 300)}`;
  }

  const gap = process.env.MOCK_SLOW ? 140 : 12;
  /* MOCK_STALL=ms holds the first event back, the way a reasoning model on
     a long prompt does. What is being tested is not the mock's patience
     but the route's: whether bytes reach the browser while nothing has
     arrived from the provider yet. */
  const stall = () => (process.env.MOCK_STALL ? new Promise((r) => setTimeout(r, Number(process.env.MOCK_STALL))) : Promise.resolve());
  const chunks = text.match(/[\s\S]{1,14}/g) ?? [];

  /* The same answers, in OpenAI's wire format.
     ---------------------------------------------------------------------
     Everything this app does across *two* providers — and the second opinion
     is the whole point of holding several keys — was untestable, because the
     harness only ever spoke Anthropic. A request the app correctly routed to
     another provider left the harness entirely and died against a real
     endpoint, which looks exactly like the feature being broken.
     Same content, same pacing, different envelope. */
  /* And out again in this endpoint's own envelope.
     ---------------------------------------------------------------------
     Not a chat completion with different names on it: the answer arrives as
     a list of output *items*, each announced when it opens and handed back
     whole when it closes, with the text and the tool arguments streaming
     between the two as deltas tagged with the item's id. The adapter keeps
     every item in order so it can give the round back untouched, so the
     mock produces them in order too — a reasoning item before the one that
     speaks, exactly where a real one puts it. */
  if (isResponses) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const frame = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  await stall();
    frame({ type: "response.created", response: { id: "resp_mock", status: "in_progress" } });
    /* The summary, and only when it was asked for — this is the endpoint
       that has one, which is half the reason the app is here. */
    if (body.reasoning?.summary) {
      frame({ type: "response.output_item.added", output_index: 0, item: { id: "rs_mock", type: "reasoning", summary: [] } });
      for (const part of ["Working out what is being asked, ", "then answering it."]) {
        frame({ type: "response.reasoning_summary_text.delta", item_id: "rs_mock", delta: part });
        await new Promise((r) => setTimeout(r, gap));
      }
      frame({ type: "response.output_item.done", output_index: 0, item: { id: "rs_mock", type: "reasoning", summary: [{ type: "summary_text", text: "Working out what is being asked, then answering it." }] } });
    }
    if (wantsTool) {
      const args = JSON.stringify(wantsTool.input);
      const item = { id: "fc_mock", type: "function_call", call_id: "call_mock1", name: wantsTool.name, arguments: "" };
      frame({ type: "response.output_item.added", output_index: 1, item });
      const cut = Math.floor(args.length / 2);
      for (const part of [args.slice(0, cut), args.slice(cut)]) {
        frame({ type: "response.function_call_arguments.delta", item_id: "fc_mock", delta: part });
        await new Promise((r) => setTimeout(r, gap));
      }
      frame({ type: "response.output_item.done", output_index: 1, item: { ...item, arguments: args } });
      frame({ type: "response.completed", response: { id: "resp_mock", status: "completed", usage: { input_tokens: 412, output_tokens: 40 } } });
      res.end();
      return;
    }
    frame({ type: "response.output_item.added", output_index: 1, item: { id: "msg_mock", type: "message", role: "assistant", content: [] } });
    for (const chunk of chunks) {
      frame({ type: "response.output_text.delta", item_id: "msg_mock", delta: chunk });
      await new Promise((r) => setTimeout(r, gap));
    }
    frame({ type: "response.output_item.done", output_index: 1, item: { id: "msg_mock", type: "message", role: "assistant", content: [{ type: "output_text", text }] } });
    frame({ type: "response.completed", response: { id: "resp_mock", status: "completed", usage: { input_tokens: 412, output_tokens: 386 } } });
    res.end();
    return;
  }

  if ((req.url ?? "").includes("/chat/completions")) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const frame = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  await stall();
    frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { role: "assistant" } }] });
    if (wantsTool) {
      /* A call, in pieces: the id and name first, then the arguments as
         fragments of JSON, which is how this format streams them. */
      const args = JSON.stringify(wantsTool.input);
      frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_mock1", type: "function", function: { name: wantsTool.name, arguments: "" } }] } }] });
      const cut = Math.floor(args.length / 2);
      for (const part of [args.slice(0, cut), args.slice(cut)]) {
        frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: part } }] } }] });
        await new Promise((r) => setTimeout(r, gap));
      }
      frame({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 412, completion_tokens: 40, total_tokens: 452 } });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
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
  await stall();
  send(res, "message_start", {
    message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], usage: { input_tokens: 412, output_tokens: 0 } },
  });

  /* Research. When the app offered a web search, the mock searches: a
     server_tool_use block with the query, a result block with two pages, and
     — once the text is under way — a citation on it, in the provider's own
     shapes, so the app's translation of all three is what gets tested. A
     question that says "keep searching" pauses the turn after the tool
     blocks, which is how the provider ends a round it has not finished; the
     app is expected to send the turn straight back, and the resumed request
     (its last message an assistant turn) gets the text. */
  if (wantsTool) {
    /* The ask, in this provider's shape: a tool_use block whose input
       arrives as fragments of JSON, then the turn stops on `tool_use`. */
    const args = JSON.stringify(wantsTool.input);
    send(res, "content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_mock1", name: wantsTool.name, input: {} } });
    const cut = Math.floor(args.length / 2);
    for (const part of [args.slice(0, cut), args.slice(cut)]) {
      send(res, "content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: part } });
      await new Promise((r) => setTimeout(r, gap));
    }
    send(res, "content_block_stop", { index: 0 });
    send(res, "message_delta", { delta: { stop_reason: "tool_use" }, usage: { output_tokens: 40 } });
    send(res, "message_stop", {});
    res.end();
    return;
  }

  const searching = (body.tools ?? []).some((t) => /^web_search/.test(t.type ?? ""));
  const resumed = (body.messages ?? []).at(-1)?.role === "assistant";
  let idx = 0;
  const PAGES = [
    { type: "web_search_result", url: "https://example.org/debounce", title: "Debounce and throttle, explained", page_age: "2 weeks ago", encrypted_content: "x" },
    { type: "web_search_result", url: "https://example.org/throttle", title: "Throttling in practice", page_age: "1 month ago", encrypted_content: "x" },
  ];
  if (searching && !resumed) {
    send(res, "content_block_start", { index: idx, content_block: { type: "server_tool_use", id: "srvtoolu_mock", name: "web_search", input: {} } });
    send(res, "content_block_delta", { index: idx, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: asked.replace(/\s+/g, " ").slice(0, 60) }) } });
    send(res, "content_block_stop", { index: idx });
    idx++;
    /* A search takes a moment, and the app has a line for that moment. Emitting
       the results in the same tick as the query would make "Searching for …"
       live for less than a frame, which is untestable and untrue to the thing
       being mocked. */
    await new Promise((r) => setTimeout(r, 700));
    send(res, "content_block_start", { index: idx, content_block: { type: "web_search_tool_result", tool_use_id: "srvtoolu_mock", content: PAGES } });
    send(res, "content_block_stop", { index: idx });
    idx++;
    if (/\bkeep searching\b/i.test(asked)) {
      send(res, "message_delta", { delta: { stop_reason: "pause_turn" }, usage: { output_tokens: 40 } });
      send(res, "message_stop", {});
      res.end();
      return;
    }
  }
  send(res, "content_block_start", { index: idx, content_block: { type: "text", text: "" } });

  /* Chunked the way a real stream arrives: a few tokens at a time, not a wall.
     MOCK_SLOW stretches it, because anything that can only be tested *during*
     a stream — the stop button, the live ring, the reveal buffer — is
     untestable against a stream that finishes in a third of a second. */
  for (const [k, chunk] of chunks.entries()) {
    send(res, "content_block_delta", { index: idx, delta: { type: "text_delta", text: chunk } });
    /* The citation lands after the first sentence, the way a real one
       attaches to the text it supports rather than to the whole answer. */
    if (searching && k === 1) {
      send(res, "content_block_delta", { index: idx, delta: { type: "citations_delta", citation: {
        type: "web_search_result_location", url: PAGES[0].url, title: PAGES[0].title,
        cited_text: "A debounce waits for silence", encrypted_index: "x",
      } } });
    }
    await new Promise((r) => setTimeout(r, gap));
  }

  send(res, "content_block_stop", { index: idx });
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
