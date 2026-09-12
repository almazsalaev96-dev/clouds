/**
 * Every tappable thing, on a phone, in every section, at every density.
 *
 * The earlier touch check only measured the chat composer, which is where the
 * icon buttons live and where `.ctl` already did its job — so it passed while
 * the navigation you have to go through to reach anything was 32px tall. This
 * walks the app instead of sampling it.
 *
 * And it walks it three times. `--density` multiplies Tailwind's whole spacing
 * unit — 0.75 for compact, 1.25 for spacious — so it is not a preference that
 * touches a few paddings, it is a number that moves every gap, every inset and
 * every control in the app at once. Only one of its three values had ever been
 * measured, which means two thirds of the people who change that setting were
 * getting a layout nobody had looked at.
 *
 *   node touch.mjs
 */
import { chromium } from "playwright";
const MIN = 44;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto("http://localhost:3100", { waitUntil: "networkidle" });

const load = async (density) => {
  await page.evaluate((d) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", density: d, modelId: "claude-sonnet-4-5", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })), density);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
};

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

/* A target can be 44pt and still be wrong.
 *
 * The row of actions under a message was a fixed 24 or 28 pixels tall while
 * every control inside it was raised to 44 by `.ctl` on a coarse pointer. The
 * children met the floor, so a check that only measures children passed — and
 * the top ten pixels of the Copy target sat on the last line of the answer
 * above it. Nothing clipped, because the overflow is visible, so nothing ever
 * saw it.
 *
 * So: a row of controls has to be at least as tall as the controls in it. That
 * is the whole rule, and it is the one that catches a box which lies about its
 * own height. */
const overflowing = () =>
  page.evaluate(() => {
    const out = [];
    for (const row of document.querySelectorAll("[id^=m-] .reveal, .msg .reveal")) {
      const kids = [...row.children].filter((k) => k.getBoundingClientRect().height > 0);
      if (kids.length < 2) continue;
      const r = row.getBoundingClientRect();
      if (r.height === 0) continue;
      const tallest = Math.max(...kids.map((k) => k.getBoundingClientRect().height));
      if (tallest > r.height + 0.5) out.push(`a row of ${kids.length} is ${Math.round(r.height)}px around a ${Math.round(tallest)}px control`);
    }
    return out;
  });

let bad = 0;
let density = "comfortable";
const report = async (where) => {
  const small = await measure();
  bad += small.length;
  console.log(small.length ? `  ✗ ${where}: ${small.join(", ")}` : `  ✓ ${where}`);
};

for (density of ["comfortable", "compact", "spacious"]) {
  console.log(`\n${density}`);
  await load(density);

  await page.getByRole("button", { name: /Show sidebar/i }).first().click();
  await page.waitForTimeout(500);
  await report("the navigation drawer");
  // The scrim, not Escape: closing the drawer by tapping beside it is how a
  // phone does it, and it is the path the test should take too.
  await page.mouse.click(370, 400);
  await page.waitForTimeout(500);

  for (const [name, open] of [["Code", true], ["Projects", true], ["Notebook", true]]) {
    await page.getByRole("button", { name: /Show sidebar/i }).first().click();
    await page.waitForTimeout(450);
    // Code lives in the header switch; the other two are rows in the list.
    const go = name === "Code"
      ? page.locator("aside nav").getByRole("button", { name: "Code" })
      : page.getByRole("button", { name, exact: true });
    await go.first().click();
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

  /* And with an answer on the page. Every step above this one measured an
     empty chat, so the row of controls under a finished answer — the most
     tapped thing in the app after the composer — had never been looked at on
     a phone, in any density. */
  await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  await report("the chat — an answer's own controls");

  const spilling = await overflowing();
  bad += spilling.length;
  console.log(spilling.length ? `  ✗ ${density}: ${spilling.join(", ")}` : `  ✓ every row of controls is as tall as the controls in it`);
}
console.log(bad ? `\n  ${bad} target(s) under ${MIN}pt` : `\n  every target is at least ${MIN}pt, at all three densities`);
await b.close();
process.exit(bad ? 1 : 0);
