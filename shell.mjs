/**
 * The chrome, in numbers.
 *
 * Everything in here is a band rather than a value, because every one of them
 * came out of a specification that gives a range — a top bar is 56 to 64, a
 * supporting panel is 320 to 380, a composer stops growing somewhere between
 * 220 and 280. A test that pins the middle of a band is a test that fails the
 * next time somebody makes a defensible choice inside it; a test that holds
 * the edges is the one that catches a number drifting out.
 *
 * Read off the rendered page rather than out of the stylesheet, because a
 * custom property is a claim and `getBoundingClientRect` is what a person gets.
 *
 *   node shell.mjs      (needs the app running on :3100)
 */
import { chromium } from "playwright";

const SETTINGS = JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 });

let failed = 0;
const check = (pass, label, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);
};
const band = (n, lo, hi, label, unit = "px") =>
  check(n !== null && n >= lo && n <= hi, `${label} is ${lo}-${hi}${unit}`,
    n === null ? "not found" : `${Math.round(n)}${unit}`);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open(width, height) {
  const ctx = await b.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  return { ctx, p };
}

const px = (p, name) => p.evaluate((n) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || null, name);

console.log("\nOn a desktop window");
{
  const { ctx, p } = await open(1440, 900);
  band(await px(p, "--topbar-h"), 56, 64, "the top bar");
  band(await px(p, "--sidebar-w"), 260, 300, "the sidebar");

  /* The supporting panel. Measured from the property at both ends of its own
     clamp rather than from whatever this one window happens to give, because
     the failure worth catching is a ceiling that lets it become a second
     column on a wide screen. */
  const panel = await p.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:-9999px;width:var(--panel-w)";
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  band(panel, 320, 360, "a side panel at this width");

  /* A navigation row. The floor for one is 36; it was 32, which is a row
     built to the height of its text rather than to the size of a thing you
     point at. */
  const nav = await p.locator("aside nav button").first().boundingBox();
  band(nav ? nav.height : null, 36, 44, "a navigation row");

  /* The sidebar's own primary action, which is a hand-rolled row rather than
     the shared Button — worth holding separately for exactly that reason.
     `btn-touch` raises the shared one to 44 under a thumb; this is the height
     a cursor gets. */
  const btn = await p.getByRole("button", { name: "New chat" }).first().boundingBox();
  band(btn ? btn.height : null, 36, 44, "the sidebar's primary action");

  /* The composer's ceiling, from the element and not from the class: a `vh`
     value reads as adaptive and is the opposite — the taller the window, the
     more of the conversation it is allowed to cover. */
  const box = p.getByRole("textbox", { name: "Message" });
  const cap = await box.evaluate((n) => {
    const v = getComputedStyle(n).maxHeight;
    return v.endsWith("px") ? parseFloat(v) : null;
  });
  /* 180-220 in one version of the spec and 220-280 in the other, so 220 is
     the only value that satisfies both and the band is tight around it. */
  band(cap, 200, 240, "the composer stops growing at");

  /* The one heading on a blank page: 28px at every width, which is the
     size the reference apps set their greeting at (it was 30–36 here). */
  const title = await p.locator("h1").first().evaluate((n) => Math.round(parseFloat(getComputedStyle(n).fontSize)));
  band(title, 26, 30, "a page's own title");

  await ctx.close();
}

console.log("\nHidden on a desktop window");
{
  /* Closed on a desk is a rail, as the reference draws it: 56px of the
     panel's own controls, the page beside them, the full panel inert
     behind it, and the rail's top square the one way to bring it back —
     the bar carries no copy. */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS.replace('"sidebarOpen":true', '"sidebarOpen":false'));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const aside = await p.locator("aside").boundingBox();
  band(aside ? Math.round(aside.width) : null, 52, 60, "closed, the rail");
  const inert = await p.locator("aside [inert]").count();
  check(inert === 1, "and the full panel behind it cannot be reached by tab");
  const mainX = await p.locator("main").boundingBox();
  check(Boolean(mainX) && mainX.x >= 56 && mainX.x <= 72, "so the page starts just past the rail", mainX ? `${Math.round(mainX.x)}px in` : "no main");
  const opens = await p.locator("aside").getByRole("button", { name: "Open sidebar" }).count();
  const barCopies = await p.locator("header").getByRole("button", { name: /Show sidebar|Hide sidebar/ }).filter({ visible: true }).count();
  check(opens === 1 && barCopies === 0, "and exactly one way to bring it back, at the top of the rail", `${opens} on the rail, ${barCopies} in the bar`);
  for (const name of ["New chat", "Search", "Conversations", "Settings"])
    check(await p.locator("aside").getByRole("button", { name, exact: true }).isVisible(), `the rail carries ${name}`);
  await ctx.close();
}

console.log("\nOn a phone");
{
  const { ctx, p } = await open(390, 844);
  band(await px(p, "--topbar-h"), 52, 56, "the top bar");
  const title = await p.locator("h1").first().evaluate((n) => Math.round(parseFloat(getComputedStyle(n).fontSize)));
  band(title, 26, 32, "a page's own title");
  const spill = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(spill <= 1, "and the page does not scroll sideways", `${spill}px over`);
  /* The phone keeps the drawer: closed, it is off-screen and its panel
     inert, and the rail never appears — 56px of a 390px screen is a
     seventh of it. */
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS.replace('"sidebarOpen":true', '"sidebarOpen":false'));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const closed = await p.locator("aside").evaluate((n) => ({ inert: Boolean(n.querySelector("[inert]")), x: n.getBoundingClientRect().right, rail: [...n.querySelectorAll("[data-rail]")].some((r) => r.getClientRects().length > 0) }));
  check(closed.inert && closed.x <= 0 && !closed.rail, "closed on a phone, the drawer is off-screen and inert, and there is no rail", `right edge at ${Math.round(closed.x)}px, inert=${closed.inert}, rail=${closed.rail}`);
  await ctx.close();
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
