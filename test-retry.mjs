/** The provider says "wait one second". Does the app wait, or make you click? */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const check = (p, l, d = "") => console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`);
await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", lastConversationId: null }, version: 1 })));
await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(900);
const ta = page.locator("textarea").first();
await ta.click(); await ta.type("hello", { delay: 4 });
const t0 = Date.now();
await page.keyboard.press("Enter");
// The first attempt 429s. Without the retry the app would settle on an error.
await page.waitForFunction(() => document.body.innerText.includes("waits for silence"), { timeout: 20000 })
  .then(() => check(true, "recovered from the rate limit on its own", `${Date.now() - t0}ms`))
  .catch(() => check(false, "recovered from the rate limit on its own", "never answered"));
const stillErroring = await page.evaluate(() => /rate-limit/i.test(document.body.innerText));
check(!stillErroring, "no error left on screen for the user to clear");
console.log(errs.length ? "  ✗ " + errs[0] : "  ✓ no runtime errors");
await b.close();
