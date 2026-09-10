/**
 * Chat and Creative, read at the wire.
 *
 * A mode toggle is worth nothing unless it changes the request. So this drives
 * the browser and then asks the mock provider what it actually received: the
 * mode's instructions in the system prompt, and — the half a prompt cannot do
 * — the sampling temperature it was sent with.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-mode.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const last = async () => (await fetch("http://127.0.0.1:8787/__last", { method: "POST" })).json();

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

check(await page.getByRole("radio", { name: "Chat", exact: true }).isVisible(), "the composer offers two ways to ask");
check((await page.getByRole("radio", { name: "Chat", exact: true }).getAttribute("aria-checked")) === "true", "Chat is the one you start in");

const ta = page.locator("textarea").first();
await ta.click(); await ta.type("write me an opening line", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const chat = await last();
check(!/## Mode/.test(chat.systemText ?? ""), "Chat adds nothing to the prompt at all");
check(chat.temperature === 1 || chat.temperature === undefined, "and does not touch the sampling", String(chat.temperature));

await page.getByRole("radio", { name: "Creative", exact: true }).click();
await page.waitForTimeout(400);
check((await page.getByRole("radio", { name: "Creative", exact: true }).getAttribute("aria-checked")) === "true", "switching is one press");

/* The room changes with the mode, not just the request. Chat asks how it can
   help and offers you broken things to fix; Creative asks what to make and
   offers you things to make. An opener that says "Explain this error" under a
   mode that widens the sampling distribution is the app offering the one job
   that mode is worst at. */
check(
  (await page.getByPlaceholder("What should we make?").count()) === 1,
  "the composer asks a different question in Creative",
);

await ta.click(); await ta.type("again, differently", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const creative = await last();
check(/## Mode: Creative/.test(creative.systemText ?? ""), "Creative reaches the model as an instruction");
check(/never in what you claim is true/.test(creative.systemText ?? ""), "and it keeps accuracy non-negotiable");
/* Sonnet reasons, and Anthropic rejects `temperature` alongside extended
   thinking — so on this model the prompt does the work alone. That is the
   provider's rule, and the app is right to obey it rather than turning
   thinking off to win the argument. */
check(creative.temperature === undefined, "on a thinking model the sampling is left alone, as the provider requires", String(creative.temperature));

// On a model without a thinking budget, the other half lands.
await page.getByRole("button", { name: /^Model:/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Haiku/ }).first().click();
await page.waitForTimeout(400);
await ta.click(); await ta.type("once more", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const wide = await last();
check(/## Mode: Creative/.test(wide.systemText ?? ""), "the instruction carries across a model change");
check(wide.temperature === 1, "and where the provider allows it, the sampling widens too", String(wide.temperature));
check(wide.topP === 0.98, "top_p with it", String(wide.topP));

// Openers change with it, on a page that has one.
await page.getByRole("button", { name: /New chat/ }).first().click();
await page.waitForTimeout(700);
const chips = await page.locator("main").innerText();
check(!/Explain this error/.test(chips), "and the blank page stops offering diagnostics");
check(/ten names|opening line|nobody has tried|forward|nerve|wrong on purpose|three directions|obvious words/i.test(chips),
  "offering things to make instead", (chips.match(/[^\n]*(names|line|tried|forward|nerve|purpose|directions|words)[^\n]*/i) ?? [""])[0].slice(0, 60));

const saved = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["conversations"]).objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return rows[0]?.mode;
});
check(saved === "creative", "the mode belongs to the thread, not the app", String(saved));

console.log(errs.length ? "\n  ✗ " + errs.join("; ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
