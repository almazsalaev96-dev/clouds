/**
 * A thread survives its own failures, and a blank page can be written on.
 *
 * This is the regression test for the worst bug this app has had. One failed
 * turn used to kill a conversation permanently: the question was stored, its
 * answer never was, and every send after that carried two questions in a row
 * and an empty text block to a provider that rejects both. The error said
 * "something went wrong talking to Anthropic", the person pressed Retry, the
 * same malformed request went out, and nothing in that thread ever worked
 * again. The canvas had its own version of it — one request with both
 * `temperature` and `top_p`, which Claude 4 refuses — so "ask for a change"
 * answered "the model didn't return a usable revision" every single time.
 *
 * The mock now refuses exactly what the real API refuses, so the whole suite
 * guards the shape. This probe covers the two paths a person actually walks:
 * a failure and then another question, and a blank canvas asked for a thing.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-recover.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const arm = (status, body, times = 1) =>
  fetch(`${MOCK}/__fail?status=${status}&body=${encodeURIComponent(body)}&times=${times}`).then((r) => r.json());

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const box = p.locator(".composer-shell textarea").first();
const say = async (t, ms = 2600) => { await box.fill(t); await p.keyboard.press("Enter"); await p.waitForTimeout(ms); };

console.log("\nThe error says what the provider said");
{
  await arm(400, JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "messages.1.content.0.text: text content blocks must be non-empty" } }));
  await say("what is a debounce");
  const shown = await p.locator("main").innerText();
  check(/text content blocks must be non-empty/.test(shown),
    "the provider's own sentence reaches the screen, instead of “something went wrong”");
}

console.log("\nAnd the thread is not dead");
{
  /* The whole bug: the failed question is still in the thread with no
     answer under it, so the next send used to go out as two questions in a
     row. If this answers, the transcript was put in order before it left. */
  const before = await p.locator(".msg").count();
  await say("and what is a throttle");
  const after = await p.locator(".msg").count();
  check(after > before, "the next question is answered rather than failing the same way", `${before} → ${after} messages`);
  const text = await p.locator(".msg").last().innerText();
  check(!/went wrong|refused the request/i.test(text), "and the answer is an answer", text.slice(0, 50));
}

console.log("\nRetry, on the one that failed");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  await arm(400, JSON.stringify({ error: { message: "overloaded on purpose" } }));
  await say("explain recursion");
  const retry = p.getByRole("button", { name: /^Retry$/ });
  check(await retry.count() >= 1, "a failed turn offers a way to try again");
  await retry.first().click();
  await p.waitForTimeout(3000);
  check(await p.locator(".msg").count() >= 2, "and pressing it gets the answer the first attempt did not", `${await p.locator(".msg").count()} messages`);
}

console.log("\nA blank canvas is written on, not revised");
{
  await p.locator("aside nav").getByRole("button", { name: "Creations" }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /Code file/ }).click();
  await p.waitForTimeout(800);
  const ask = p.getByRole("textbox", { name: "Ask for a change" });
  await ask.fill("make me a page about space");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const screen = await p.locator("main").innerText();
  check(!/didn't return a usable revision/.test(screen),
    "an empty file asked for something does not answer “no usable revision”");
  check(/Accept|Replace|\+\d/.test(screen) || (await p.locator(".cm-content, textarea").first().innerText()).length > 20,
    "something was written", screen.slice(0, 60).replace(/\n/g, " "));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
