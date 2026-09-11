/**
 * One AI that knows how to use every AI.
 *
 * The app held four providers' keys and asked you which to use, which is "all
 * the models in one app" — the weak version of the idea. The person asking the
 * question is the one least equipped to answer it: knowing that *this* request
 * wants the long-context model rather than the fast one means knowing what all
 * of them are, which is the work the app was supposed to be doing.
 *
 * Read at the wire, because the claim is about which model the request was
 * addressed to. Asking the app what it believes it chose would prove nothing.
 *
 * The most interesting assertion in here is the one where no model is called
 * at all.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *
 * One provider on purpose. The mock speaks Anthropic, so a request the router
 * sends to OpenAI or Google leaves the harness entirely and dies against a real
 * endpoint with no key — which looks exactly like the router failing and is the
 * router working. Anthropic alone still discriminates: fast, careful and
 * code-strong are three different models within it.
 *   node e2e-auto.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const wire = async () => (await (await fetch("http://127.0.0.1:8787/__last")).json());

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "auto", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1100);

const ask = async (text) => {
  await page.getByRole("button", { name: /New chat/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2600);
};

console.log("\nThe picker offers not choosing");
{
  const trigger = page.locator("button").filter({ hasText: /^Auto$/ }).first();
  check(await trigger.isVisible(), "Auto is what the composer says when nothing is chosen");
  await trigger.click();
  await page.waitForTimeout(500);
  check((await page.getByText("Let the app decide").count()) >= 1,
    "and it is offered on its own, above the models — it is not one of them");
  check((await page.getByText(/Reads what you asked for and picks/).count()) === 1,
    "with what it will do said plainly");
  await page.screenshot({ path: `${OUT}/auto-picker.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\nIt reads the request and routes on it");
{
  await ask("translate this into French: the meeting is on Tuesday");
  const quick = (await wire()).model;
  check(/haiku/i.test(quick ?? ""), "a one-line rewrite goes somewhere fast and cheap", quick);

  await ask("why would you choose an event-sourced architecture over a CRUD one here");
  const hard = (await wire()).model;
  check(hard !== quick, "a hard question does not go to the same place", `${quick} → ${hard}`);
  check(/opus/i.test(hard ?? ""), "it goes somewhere that thinks", hard);

  await ask("refactor this TypeScript function to remove the nested loop");
  const code = (await wire()).model;
  check(/sonnet|opus/i.test(code ?? ""), "and code goes somewhere good at code", code);
}

console.log("\nAnd it tells you, rather than deciding behind your back");
{
  const shown = await page.locator("main").innerText();
  check(/about code/i.test(shown), "the answer says why that model was chosen",
    (shown.split("\n").find((l) => /about code/i.test(l)) ?? "").slice(0, 60));
  await page.screenshot({ path: `${OUT}/auto-why.png` });
}

console.log("\nSometimes the right model is no model");
{
  /* Cleared first, so "no model was called" is a fact about this question
     rather than a coincidence about the last one. */
  await fetch("http://127.0.0.1:8787/__reset");
  await ask("948,392 × 73");
  const after = await wire();
  check(!after.model,
    "a sum reaches no model at all — nothing was sent for it",
    after.model ? `but ${after.model} was called` : "nothing on the wire");

  const shown = await page.locator("main").innerText();
  check(/69,232,616/.test(shown), "and the answer is exact, because it was worked out rather than predicted");
  check(/does not need a model/i.test(shown), "with the app saying that is what happened");
  /* And it is not attributed to a model. getModel falls back to the default
     for an id it does not know, which put "Claude Sonnet 4.5" above a sum that
     never left the browser — a small lie told by the one feature whose whole
     point is that it called nothing. */
  check(/Calculator/.test(shown) && !/Claude|GPT|Gemini|DeepSeek/.test(shown.split("948,392")[1] ?? ""),
    "and credited to the calculator rather than to a model that was never called");
  await page.screenshot({ path: `${OUT}/auto-sum.png` });
}

console.log("\nBut a question that merely contains a sum is still a question");
{
  await ask("what is 2+2 and why is addition commutative");
  const after = (await wire()).model;
  check(Boolean(after), "it goes to a model, as it should", after);
  const shown = await page.locator("main").innerText();
  check(!/does not need a model/i.test(shown), "and is not intercepted by the calculator");
}

console.log("\nChoosing a model yourself turns all of it off");
{
  await page.locator("button").filter({ hasText: /^Auto$/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: "Search models" }).fill("haiku");
  await page.waitForTimeout(500);
  await page.locator("button").filter({ hasText: /Claude Haiku/ }).first().click();
  await page.waitForTimeout(600);

  await ask("why would you choose an event-sourced architecture over a CRUD one here");
  const picked = (await wire()).model;
  check(/haiku/i.test(picked ?? ""),
    "the model you chose is the model that answers, however the router would have judged it",
    picked);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
