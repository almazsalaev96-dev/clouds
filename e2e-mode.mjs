/**
 * Chat and Creative, decided from the request and read at the wire.
 *
 * It used to be a switch in the composer, and this suite used to press it. A
 * switch is the wrong shape for the decision: it asks a question about the
 * machine, before the person has said what they want, and it is answerable only
 * by someone who already knows what the two settings do — so the people who
 * most need the built thing were the least likely to find it.
 *
 * Now the app reads the sentence, the same way the router already reads it to
 * pick a model. Which makes the thing worth asserting the same as before and
 * harder: not that a control is on screen, but that asking for a *thing*
 * changes what actually leaves the browser — the instructions in the system
 * prompt and, the half a prompt cannot do, the sampling temperature — while
 * asking a question about the same subject does not.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-mode.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/** Ask in a fresh thread, then read what the provider was actually sent. */
const ask = async (q, ms = 3000) => {
  await fetch(`${MOCK}/__reset`);
  /* Back to the chat room first: asking for a thing now opens the thing, which
     means the previous question may have left us standing in the canvas. */
  await page.locator("aside nav").getByRole("button", { name: "Conversations" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(600);
  await page.getByRole("textbox", { name: "Message" }).fill(q);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(ms);
  return fetch(`${MOCK}/__last`).then((r) => r.json());
};

console.log("\nThere is nothing to switch");
{
  check(await page.getByRole("radio", { name: "Chat", exact: true }).count() === 0,
    "the composer no longer asks which of two ways you meant");
  check(await page.getByRole("button", { name: "Tools" }).count() === 0,
    "and it no longer asks how hard to think before you have typed the question");
}

console.log("\nAsking for a thing sends the instructions that build one");
{
  const seen = await ask("make me a web app that tracks my reading");
  const sys = seen.systemText ?? "";
  check(/Work in a creative register/.test(sys), "the creative register reaches the wire");
  check(/reply with one complete HTML document|complete HTML document/i.test(sys),
    "including the line that asks for a document this app can run");
  /* Not the temperature. `modes.ts` says why: Anthropic rejects `temperature`
     alongside extended thinking, so on a reasoning model — which the default
     is — the request correctly goes out without it and the instructions do the
     work alone. Asserting a number here would fail on exactly the models most
     people use, and passing would mean thinking had been turned off to win the
     argument. */
}

console.log("\nAsking about the same subject does not");
{
  const seen = await ask("how does a reading tracker usually store its data");
  const sys = seen.systemText ?? "";
  check(!/Work in a creative register/.test(sys), "a question gets no creative register");
  check(!/complete HTML document/i.test(sys), "and is not told to build anything");
}

console.log("\nAnd neither does asking for words");
{
  const seen = await ask("write me an email to my landlord about the boiler");
  check(!/Work in a creative register/.test(seen.systemText ?? ""),
    "prose is words, not a thing that runs");
}

console.log("\nSaying run is enough on its own");
{
  const seen = await ask("run it");
  check(/complete HTML document/i.test(seen.systemText ?? ""), "no artefact noun needed");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-mode PASS");
process.exit(failed ? 1 : 0);
