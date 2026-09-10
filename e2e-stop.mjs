/**
 * Stopping, and what survives it.
 *
 * The one path the suite never took, because the mock answered in a third of
 * a second and the button was gone before a click could land. `MOCK_SLOW`
 * stretches the stream so the mid-flight state can be inspected at all.
 *
 *   MOCK_SLOW=1 node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-stop.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

const ta = page.locator("textarea").first();
await ta.click(); await ta.type("explain debounce", { delay: 3 });
await page.keyboard.press("Enter");
await page.waitForTimeout(900);

/* Send and Stop share one slot, stacked. Whatever is on top has to be the one
   that is live, or the button is a picture of a button. Asked of the browser
   by hit-testing the middle of the slot, not by reading a class. */
const onTop = await page.evaluate(() => {
  const slot = document.querySelector('[aria-label="Stop generating"]')?.parentElement;
  if (!slot) return "no slot";
  const r = slot.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return hit?.closest("button")?.getAttribute("aria-label") ?? "nothing";
});
check(onTop === "Stop generating", "mid-stream, Stop is the button under the cursor", onTop);

const partial = await page.evaluate(() => document.body.innerText);
check(/debounce/.test(partial), "text is on screen before it is finished");

await page.locator('[aria-label="Stop generating"]').click();
await page.waitForTimeout(1200);

const after = await page.evaluate(() => document.body.innerText);
check(/waits for silence/.test(after), "what had arrived is kept, not discarded");
check(!/enforces a floor/.test(after), "and the rest never came", "stopped early");

const stored = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["messages"]).objectStore("messages").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  const a = rows.find((m) => m.role === "assistant");
  return { stop: a?.stopReason, len: (a?.content?.[0]?.text ?? "").length };
});
check(stored.stop === "aborted", "the message records that it was stopped", String(stored.stop));
check(stored.len > 0, "with the partial text saved", `${stored.len} chars`);

const back = await page.evaluate(() => {
  const slot = document.querySelector('[aria-label="Send message"]')?.parentElement;
  const r = slot.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button")?.getAttribute("aria-label");
});
check(back === "Send message", "and Send is back on top afterwards", String(back));

await ta.click(); await ta.type("carry on", { delay: 3 });
await page.keyboard.press("Enter");
await page.waitForTimeout(9000);
check(await page.evaluate(() => document.body.innerText.includes("enforces a floor")), "the thread still works after a stop");

console.log(errs.length ? "\n  ✗ " + errs.join("; ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
