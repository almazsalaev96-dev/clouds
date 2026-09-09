/**
 * The happy path, end to end, in a real browser against a real stream.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text()); });

const check = (pass, label, detail = "") => console.log(`${pass ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const ta = page.locator("textarea").first();
await ta.click();
await ta.type("debounce vs throttle", { delay: 5 });
await page.keyboard.press("Enter");

// Mid-flight. Sampled every 60ms rather than at one guessed moment: the mock
// finishes in well under a second, and a single late sample says "not drawn"
// about something that was drawn and has correctly gone away.
let sawRing = false;
let sawTokens = false;
for (let i = 0; i < 24 && !(sawRing && sawTokens); i++) {
  sawRing ||= (await page.locator(".live-ring").count()) > 0;
  sawTokens ||= await page.evaluate(() => document.body.innerText.includes("debounce"));
  await page.waitForTimeout(60);
}
check(sawTokens, "tokens appear while the stream is still open");
check(sawRing, "the live ring is drawn during generation");

await page.waitForFunction(() => !document.querySelector('[aria-label="Stop generating"]:not([class*="opacity-0"])'), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2200);

const text = await page.evaluate(() => document.body.innerText);
check(text.includes("waits for silence"), "the whole answer rendered");
check(text.includes("enforces a floor"), "the last paragraph arrived, not just the first");

const strong = await page.locator(".msg strong").count();
check(strong >= 2, "markdown parsed — bold rendered as bold", `${strong} <strong>`);

const codeLines = await page.locator(".msg pre code span").count();
check(codeLines > 10, "the code block is syntax-highlighted", `${codeLines} tokens`);
const codeTitle = await page.locator(".msg figure").innerText().catch(() => "");
check(codeTitle.includes("debounce.ts"), "the code block kept its filename", codeTitle.split("\n")[0]);

check((await page.locator(".msg-settled").count()) === 0, "the arrival glow has already expired");

// The title request is a second, separate call to the provider.
await page.waitForTimeout(1500);
const sidebarTitle = await page.evaluate(() =>
  [...document.querySelectorAll("aside button")].map((b) => b.getAttribute("title") || b.textContent.trim()).find((t) => t && t.includes("Debouncing")));
check(Boolean(sidebarTitle), "the conversation named itself from the answer", sidebarTitle || "still 'New chat'");

// Persistence: reload and see if it is all still there.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);
const after = await page.evaluate(() => document.body.innerText);
check(after.includes("waits for silence"), "the answer survived a reload");

const usage = await page.evaluate(async () => {
  const d = await new Promise((r, j) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const rows = await new Promise((r, j) => { const q = d.transaction(["messages"]).objectStore("messages").getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  d.close();
  const a = rows.find((m) => m.role === "assistant");
  return a ? { out: a.usage?.outputTokens, cost: a.usage?.costUsd, stop: a.stopReason, latency: Boolean(a.latencyMs) } : null;
});
check(usage?.out === 386, "token usage recorded from the stream", JSON.stringify(usage));
check(typeof usage?.cost === "number" && usage.cost > 0, "cost computed", String(usage?.cost));
check(usage?.stop === "stop", "stop reason recorded", usage?.stop);
check(usage?.latency, "latency recorded");

// Regenerate: a second turn on the same parent.
await page.locator('[aria-label="Regenerate"]').first().click();
await page.waitForTimeout(4000);
const siblings = await page.evaluate(() => document.body.innerText.match(/\b2\/2\b/) ? "2/2" : null);
check(Boolean(siblings), "regenerate created a sibling and the branch nav shows it", siblings || "no branch nav");

await page.screenshot({ path: `${OUT}/e2e-final.png` });
console.log(errs.length ? "\n  ✗ runtime errors:\n" + errs.map((e) => "    " + e).join("\n") : "\n  ✓ no runtime errors");
await b.close();
