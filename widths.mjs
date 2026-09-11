/**
 * Every width between a phone and a desk, not just the two ends of it.
 *
 * The layout was checked at 390 and at 1440, which are the two widths where a
 * responsive design is least likely to be wrong: one is the phone it was drawn
 * for and the other is the monitor it was drawn on. Everything interesting
 * happens in between — the band where the sidebar is still open and the column
 * beside it has stopped being wide enough, where a row of six controls has one
 * too many for the space, where a breakpoint fires a hundred pixels after it
 * should have.
 *
 * So: sweep it. At each width, with an answer on screen, assert the four things
 * that make a layout usable rather than merely present —
 *
 *   nothing spills sideways off the page;
 *   nothing that matters is off the right edge or under the composer;
 *   the line length stays inside the band a person can actually read;
 *   and the controls stay big enough to hit.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node widths.mjs
 */
import { chromium } from "playwright";

const WIDTHS = [360, 390, 430, 560, 640, 768, 834, 900, 1024, 1180, 1280, 1440, 1680, 1920];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
await page.keyboard.press("Enter");
await page.waitForTimeout(2800);

/* Characters per line, by the font's own average advance rather than by any
   one letter's. Measuring a single character gets you the width of whichever
   letter happened to come first, which for "A debounce waits..." is a capital
   A and around forty per cent wide of the truth. */
const MEASURE = () => {
  const p = [...document.querySelectorAll(".prose p")].find((n) => (n.textContent ?? "").length > 60);
  if (!p) return null;
  const cs = getComputedStyle(p);
  const c = document.createElement("canvas").getContext("2d");
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const alpha = "abcdefghijklmnopqrstuvwxyz ";
  const avg = c.measureText(alpha).width / alpha.length;
  return Math.round(p.getBoundingClientRect().width / avg);
};

const SPILLS = () => {
  const doc = document.documentElement;
  const bad = [];
  if (doc.scrollWidth > doc.clientWidth + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== "fixed") {
        bad.push(`${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? "").toString().split(" ")[0]} to ${Math.round(r.right)}`);
        if (bad.length > 3) break;
      }
    }
  }
  return { over: doc.scrollWidth - doc.clientWidth, bad };
};

/* Anything a person is meant to press has to be on the page and not buried
   under the bar that floats over the bottom of it. */
const BURIED = () => {
  const bar = document.querySelector(".composer-shell")?.getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll("button, a[href], input, textarea, [role=radio], [role=tab]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0" || el.hasAttribute("disabled")) continue;
    // A closed drawer is parked off the left edge on purpose, and says so.
    if (el.closest('[aria-hidden="true"]')) continue;
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    if (r.right > innerWidth + 1 || r.left < -1) out.push(`"${name}" off the side (${Math.round(r.left)}..${Math.round(r.right)})`);
    else if (
      bar && (cs.position === "fixed" || cs.position === "sticky") &&
      r.top < bar.bottom && r.bottom > bar.top && r.right > bar.left && r.left < bar.right &&
      !el.closest(".composer-dock") && !el.closest("[class*=composer]")
    ) {
      // Only something pinned in place is truly buried. A control in the
      // transcript that happens to be under the bar right now can be scrolled
      // out from under it, which is what a bar floating over a scroller means.
      out.push(`"${name}" pinned under the composer`);
    }
    if (out.length > 5) break;
  }
  return out;
};

const SMALL = () => {
  const out = [];
  for (const el of document.querySelectorAll("button, a[href], [role=radio]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    // The hit area may be larger than the ink: a padded parent, or ::before.
    const hit = Math.min(r.width, r.height);
    if (hit < 24) out.push(`"${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (out.length > 5) break;
  }
  return out;
};

console.log("\nFourteen widths, from a small phone to a wide monitor");
for (const w of WIDTHS) {
  /* Reload rather than drag: the sidebar is a drawer below 768 and a column
     above it, and the question at each width is what a device that size gets,
     not what a desktop window looks like on the way down. */
  await page.setViewportSize({ width: w, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const [spill, buried, small, chars] = await Promise.all([
    page.evaluate(SPILLS), page.evaluate(BURIED), page.evaluate(SMALL), page.evaluate(MEASURE),
  ]);
  const notes = [];
  if (spill.over > 1) notes.push(`spills ${spill.over}px (${spill.bad.join(", ")})`);
  if (buried.length) notes.push(buried.join(", "));
  if (small.length) notes.push(`too small: ${small.join(", ")}`);
  // Below ~400px there is no width at which 45 characters fit at a readable size.
  if (chars !== null && w >= 560 && (chars < 45 || chars > 85)) notes.push(`${chars} characters a line`);
  check(notes.length === 0, `${w}px`, notes.join(" · ") || `${chars ?? "—"} characters a line`);
}

console.log("\nAnd at the two densities nobody had looked at");
/* `--density` multiplies Tailwind's whole spacing unit — 0.75 and 1.25 — so
   changing it moves every gap, inset and control in the app at once. Three
   widths each is enough to catch a layout that only holds at 1.0. */
for (const density of ["compact", "spacious"]) {
  for (const w of [390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.evaluate((d) => {
      const s = JSON.parse(localStorage.getItem("store.settings.v1"));
      s.state.density = d;
      localStorage.setItem("store.settings.v1", JSON.stringify(s));
    }, density);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const [spill, buried, chars] = await Promise.all([page.evaluate(SPILLS), page.evaluate(BURIED), page.evaluate(MEASURE)]);
    const notes = [];
    if (spill.over > 1) notes.push(`spills ${spill.over}px (${spill.bad.join(", ")})`);
    if (buried.length) notes.push(buried.join(", "));
    if (chars !== null && w >= 560 && (chars < 45 || chars > 85)) notes.push(`${chars} characters a line`);
    check(notes.length === 0, `${density} at ${w}px`, notes.join(" · ") || `${chars ?? "—"} characters a line`);
  }
}
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("store.settings.v1"));
  s.state.density = "comfortable";
  localStorage.setItem("store.settings.v1", JSON.stringify(s));
});

console.log("\nWith the drawer pulled out over a phone");
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Show sidebar|Open sidebar|sidebar/i }).first().click();
await page.waitForTimeout(700);
const drawer = await page.evaluate(() => {
  const a = document.querySelector("aside");
  const r = a?.getBoundingClientRect();
  const scrim = [...document.querySelectorAll("div")].find((d) => {
    const c = getComputedStyle(d);
    return c.position === "fixed" && d.getBoundingClientRect().width >= innerWidth - 1 && c.backgroundColor !== "rgba(0, 0, 0, 0)" && Number(c.zIndex) > 0 && Number(c.zIndex) < 40;
  });
  return { left: r ? Math.round(r.left) : null, width: r ? Math.round(r.width) : null, scrim: Boolean(scrim), gap: r ? Math.round(innerWidth - r.width) : null };
});
check(drawer.left === 0, "the drawer comes all the way in", `left ${drawer.left}`);
check(drawer.gap >= 100, "and leaves enough of the page behind it to show what it is covering", `${drawer.gap}px of 390`);
check(drawer.scrim, "with a scrim over that page, so a tap anywhere closes it");
const drawerBuried = await page.evaluate(BURIED);
check(drawerBuried.length === 0, "and everything in it is on screen", drawerBuried.join(", "));
const drawerSmall = await page.evaluate(SMALL);
check(drawerSmall.length === 0, "at a size you can hit", drawerSmall.join(", "));

console.log("\nAnd the same page turned on its side on a phone");
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(600);
const land = await page.evaluate(SPILLS);
const landBuried = await page.evaluate(BURIED);
check(land.over <= 1, "844x390 does not spill sideways", land.bad.join(", "));
check(landBuried.length === 0, "and nothing is stranded off the edge or under the bar", landBuried.join(", "));
const composerFits = await page.evaluate(() => {
  const bar = document.querySelector(".composer-shell")?.getBoundingClientRect();
  return bar ? { top: Math.round(bar.top), bottom: Math.round(bar.bottom), h: Math.round(bar.height) } : null;
});
check(composerFits && composerFits.h < 390 * 0.6, "the composer leaves room to read above it", composerFits ? `${composerFits.h}px of 390` : "no composer");

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nwidths PASS");
process.exit(failed ? 1 : 0);
