/**
 * Every tappable thing, on a phone, in every section.
 *
 * The earlier touch check only measured the chat composer, which is where the
 * icon buttons live and where `.ctl` already did its job — so it passed while
 * the navigation you have to go through to reach anything was 32px tall. This
 * walks the app instead of sampling it.
 *
 *   node touch.mjs
 */
import { chromium } from "playwright";
const MIN = 44;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* Elements that are text by nature — a link inside a sentence, a word in a
   paragraph you can tap to expand — are not targets in the HIG sense and are
   measured against nothing. Everything shaped like a control is. */
const measure = () =>
  page.evaluate((MIN) => {
    const seen = [];
    for (const el of document.querySelectorAll("button, select, [role=button], [role=menuitem], [role=tab], input:not([type=hidden]), textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Off-canvas (the closed drawer) is not tappable, and counting it in
      // every section would report the same row eleven times.
      if (r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      if (el.tagName === "TEXTAREA") continue;                 // grows with content
      if (el.type === "file") continue;                        // opened by a button, never tapped itself
      if (el.closest("[data-touch-exempt]")) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 28);
      const where = el.className && typeof el.className === "string" ? el.className.split(" ").slice(0, 3).join(".") : "";
      if (r.height < MIN || r.width < MIN) seen.push(`${label || "·"} ${Math.round(r.width)}×${Math.round(r.height)} [${where}]`);
    }
    return seen;
  }, MIN);

let bad = 0;
const report = async (where) => {
  const small = await measure();
  bad += small.length;
  console.log(small.length ? `  ✗ ${where}: ${small.join(", ")}` : `  ✓ ${where}`);
};

await page.getByRole("button", { name: /Show sidebar/i }).first().click();
await page.waitForTimeout(500);
await report("the navigation drawer");
// The scrim, not Escape: closing the drawer by tapping beside it is how a
// phone does it, and it is the path the test should take too.
await page.mouse.click(370, 400);
await page.waitForTimeout(500);

for (const [name, open] of [["Projects", true], ["Code", true], ["Notes", true], ["Cards", true], ["Papers", true], ["Practice", false]]) {
  await page.getByRole("button", { name: /Show sidebar/i }).first().click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name, exact: true }).first().click();
  await page.waitForTimeout(700);
  await report(`${name} — the index`);
  if (open) {
    const nu = page.getByRole("button", { name: /^New / }).first();
    if (await nu.isVisible().catch(() => false)) {
      await nu.click();
      await page.waitForTimeout(800);
      await report(`${name} — an item open`);
    }
  }
}

await page.getByRole("button", { name: /Show sidebar/i }).first().click();
await page.waitForTimeout(450);
await page.getByRole("button", { name: /New chat/ }).first().click();
await page.waitForTimeout(700);
await report("the chat");

console.log(bad ? `\n  ${bad} target(s) under ${MIN}pt` : `\n  every target is at least ${MIN}pt`);
await b.close();
process.exit(bad ? 1 : 0);
