/**
 * The whole job, with the mouse unplugged.
 *
 * Every control in this app has an accessible name and a focus ring — `audit`
 * checks both — and neither of those facts tells you whether a person who
 * cannot use a pointer can actually ask a question and read the answer. That
 * is a different claim and it needs a different test: start at the top of the
 * page, press Tab, and see whether the app leads somewhere or strands you.
 *
 * Four things are asserted, in the order they would bite:
 *
 *   1. Tab reaches the composer without an unreasonable number of presses, and
 *      the answer's controls afterwards.
 *   2. Focus is always visible and always on screen — a ring drawn below the
 *      fold is the same as no ring.
 *   3. Tab order follows reading order. A tab stop that jumps backwards up the
 *      page is a person losing their place.
 *   4. Nothing traps you. Every dialog closes on Escape and hands focus back to
 *      whatever opened it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node keys.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

/* What has focus, and whether a person could tell. */
const FOCUS = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  /* Whether a person can tell cannot be read off this element alone. Several
     controls here put the ring on a wrapper — the search field brightens its
     row, the composer lifts its whole shell — which is right, and invisible to
     anything that only looks at the input. So mark the node and take a picture
     of how it and its first few ancestors are painted; the walk compares that
     against the same nodes with nothing focused at all. */
  el.setAttribute("data-keys-stop", String((window.__keysStop = (window.__keysStop ?? 0) + 1)));
  const paint = (n) => {
    const c = getComputedStyle(n);
    return [c.outlineWidth, c.outlineStyle, c.outlineColor, c.boxShadow, c.borderColor, c.borderWidth, c.backgroundColor, c.color, c.opacity].join("|");
  };
  const chain = [];
  for (let n = el, i = 0; i < 4 && n; i++, n = n.parentElement) chain.push(paint(n));
  return {
    lit: chain.join("//"),
    stop: el.getAttribute("data-keys-stop"),
    tag: el.tagName.toLowerCase(),
    name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40),
    onScreen: r.top >= -1 && r.bottom <= innerHeight + 1 && r.right > 0 && r.left < innerWidth,
    top: Math.round(r.top),
    left: Math.round(r.left),
    w: Math.round(r.width),
    h: Math.round(r.height),
    inDialog: Boolean(el.closest("[role=dialog]")),
  };
};

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

console.log("\nTab all the way round the page and see what it passes");
/* The composer takes focus on load, which is right — it is the thing you came
   to use. So the walk cannot start there: it presses Tab until it comes back
   round to where it began, which is the whole of what a keyboard can reach. */
const stops = [];
let cycled = false;
for (let i = 0; i < 60; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);          // these rings fade in; read them settled
  const f = await page.evaluate(FOCUS);
  if (f.none) { cycled = true; continue; }        // out through the browser's own chrome
  if (stops.length && f.tag === stops[0].tag && f.name === stops[0].name) { cycled = true; break; }
  stops.push({ ...f, fresh: cycled && (cycled = false, true) });
}
stops.forEach((f, i) => console.log(`    ${i + 1}. <${f.tag}> "${f.name}" @ ${f.left},${f.top} ${f.w}x${f.h}`));

const composerAt = stops.findIndex((f) => f.tag === "textarea");
check(composerAt >= 0, "Tab reaches the place you type", composerAt >= 0 ? `stop ${composerAt + 1} of ${stops.length}` : "never, in 60 presses");
check(stops.length >= 8, "and the rest of the page is reachable too", `${stops.length} stops`);

/* Each stop above recorded how it was painted while it held focus. Now let go
   of everything and paint them again: a stop that looks the same either way is
   one a person cannot find. */
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
await page.waitForTimeout(300);
const dark = await page.evaluate(() => {
  const paint = (n) => {
    const c = getComputedStyle(n);
    return [c.outlineWidth, c.outlineStyle, c.outlineColor, c.boxShadow, c.borderColor, c.borderWidth, c.backgroundColor, c.color, c.opacity].join("|");
  };
  const out = {};
  for (const el of document.querySelectorAll("[data-keys-stop]")) {
    const chain = [];
    for (let n = el, i = 0; i < 4 && n; i++, n = n.parentElement) chain.push(paint(n));
    out[el.getAttribute("data-keys-stop")] = chain.join("//");
  }
  return out;
});
const invisible = stops.filter((f) => dark[f.stop] === f.lit);
check(invisible.length === 0, "every stop on the way shows you where you are", invisible.map((f) => `${f.tag} "${f.name}"`).join(", "));
const offscreen = stops.filter((f) => !f.onScreen);
check(offscreen.length === 0, "and every stop is on screen when it gets focus", offscreen.map((f) => `${f.tag} "${f.name}" at y=${f.top}`).join(", "));

console.log("\nTab order follows the order things are read in");
/* A stop may move down the page, or hold its row and move right. Going back up
   is the failure: that is the reader losing their place. */
const backwards = [];
for (let i = 1; i < stops.length; i++) {
  const a = stops[i - 1], c = stops[i];
  if (c.fresh) continue;                           // a new lap round the page, not a jump
  if (c.left >= a.left + a.w) continue;             // starts past the last one: the next column
  const sameRow = Math.abs(c.top - a.top) < Math.max(a.h, c.h);
  if (sameRow ? c.left < a.left - 1 : c.top < a.top - 1) backwards.push(`${a.name || a.tag} → ${c.name || c.tag}`);
}
check(backwards.length === 0, `${stops.length} stops, none of them jump back up the page`, backwards.join(" | "));

console.log("\nAsk a question and read the answer, without touching the mouse");
/* Tab to the composer rather than clicking it: the point is that this is
   reachable, not that Playwright can call focus(). */
for (let i = 0; i < 60; i++) {
  await page.keyboard.press("Tab");
  if ((await page.evaluate(FOCUS)).tag === "textarea") break;
}
check((await page.evaluate(FOCUS)).tag === "textarea", "Tab lands in the composer");
await page.keyboard.type("what is a debounce");
await page.keyboard.press("Enter");
await page.waitForTimeout(2600);
const answered = await page.locator(".prose").count();
check(answered > 0, "Enter sent it and the answer came back", `${answered} answer${answered === 1 ? "" : "s"}`);

/* The answer's own controls have to be reachable from where you are left
   standing. Shift+Tab walks back up into the message that was just written. */
let foundCopy = null;
for (let i = 0; i < 25 && !foundCopy; i++) {
  await page.keyboard.press("Shift+Tab");
  const f = await page.evaluate(FOCUS);
  if (/copy/i.test(f.name)) foundCopy = { ...f, presses: i + 1 };
}
check(Boolean(foundCopy), "the answer's own controls are reachable from the composer", foundCopy ? `Shift+Tab x${foundCopy.presses} -> "${foundCopy.name}"` : "never reached a Copy");
if (foundCopy) check(foundCopy.onScreen, "and reaching them scrolls them into view", `y=${foundCopy.top}`);

console.log("\nNothing you can open traps you inside it, and closing it gives you back your place");
/* Radix hands focus back to its <Dialog.Trigger>; none of these has one, so
   without the app remembering the opener itself, Escape used to land on <body>
   — the top of the document, and the whole page to tab through again. */
const anchor = page.getByRole("button", { name: /Settings/ }).first();
const dialogs = [
  ["the shortcut sheet", async () => page.keyboard.press("Shift+Slash")],
  ["the command palette", async () => page.keyboard.press("Control+k")],
  ["settings", async () => page.keyboard.press("Enter")],
];
for (const [what, open] of dialogs) {
  await anchor.focus();
  const before = await page.evaluate(FOCUS);
  await open();
  await page.waitForTimeout(900);
  const inside = await page.evaluate(FOCUS);
  check(inside.inDialog, `${what} takes focus into itself`, `${inside.tag} "${inside.name}"`);

  let escaped = null;
  for (let i = 0; i < 30 && !escaped; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(FOCUS);
    if (!f.none && !f.inDialog) escaped = f;
  }
  check(!escaped, `and Tab keeps you inside ${what}`, escaped ? `leaked to ${escaped.tag} "${escaped.name}"` : "");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const after = await page.evaluate(FOCUS);
  check(!after.inDialog && !after.none, `Escape closes ${what} without dropping you on the page`, after.none ? "focus went to <body>" : `${after.tag} "${after.name}"`);
  check(after.name === before.name && after.tag === before.tag, `and puts focus back where it was`, `"${before.name}" → "${after.name}"`);
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nkeys PASS");
process.exit(failed ? 1 : 0);
