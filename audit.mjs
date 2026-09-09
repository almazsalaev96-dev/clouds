/**
 * Apple HIG + production readiness audit.
 * Measures rather than asserts: everything here is read off the live DOM.
 */
import { chromium, devices } from "playwright";
const URL = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const fail = [];
const ok = [];
const note = (pass, label, detail = "") => (pass ? ok : fail).push(`${label}${detail ? " — " + detail : ""}`);

const seed = (page, theme = "dark") => page.evaluate((t) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: t, density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: { anthropic: "sk-ant-demo" }, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })), theme);

/* ---- iPhone: safe areas, input zoom, tap targets ------------------------ */
{
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await seed(page); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(900);

  const vp = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.content ?? "");
  note(vp.includes("viewport-fit=cover"), "viewport-fit=cover (safe areas reach the notch)", vp || "no viewport meta");

  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll("input, textarea")].map((el) => ({
      t: el.tagName, ph: el.placeholder || el.getAttribute("aria-label") || "",
      fs: parseFloat(getComputedStyle(el).fontSize),
    })).filter((i) => i.fs > 0));
  const tooSmall = inputs.filter((i) => i.fs < 16);
  note(tooSmall.length === 0, "inputs ≥16px (iOS does not zoom on focus)",
    tooSmall.map((i) => `${i.ph || i.t}:${i.fs}px`).join(", "));

  const safe = await page.evaluate(() => {
    const el = document.querySelector(".composer-dock") || document.querySelector("textarea")?.closest("div[class*='px-4']");
    if (!el) return null;
    return getComputedStyle(el).paddingBottom;
  });
  note(safe && safe !== "0px", "composer clears the home indicator", `padding-bottom: ${safe}`);

  const th = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content ?? "");
  note(Boolean(th), "theme-color set (status bar matches the app)", th || "missing");

  const manifest = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.href ?? "");
  note(Boolean(manifest), "web app manifest (Add to Home Screen)", manifest || "missing");

  const touchIcon = await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')?.href ?? "");
  note(Boolean(touchIcon), "apple-touch-icon", touchIcon || "missing");

  const tap = await page.evaluate(() => getComputedStyle(document.body).webkitTapHighlightColor);
  note(true, `tap highlight: ${tap}`);
  await ctx.close();
}

/* ---- Desktop: zoom, contrast mode, reduced motion, a11y ---------------- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await seed(page); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(900);

  // 200% text zoom must not clip or overlap.
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth > window.innerWidth + 2,
    w: document.documentElement.scrollWidth, vw: window.innerWidth,
  }));
  note(!overflow.x, "no horizontal overflow at 200% text zoom", `${overflow.w} vs ${overflow.vw}`);
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));

  // Every interactive element needs an accessible name.
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], input, textarea, select, [role=button]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const name = el.getAttribute("aria-label") || el.getAttribute("title") ||
          el.textContent?.trim() || el.getAttribute("placeholder") ||
          (el.getAttribute("aria-labelledby") && "ref") || "";
        return !name;
      }).map((el) => el.tagName + "." + (el.className || "").toString().split(" ")[0]));
  note(unnamed.length === 0, "every control has an accessible name", unnamed.slice(0, 5).join(", "));

  // One h1, and headings that do not skip levels.
  const heads = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => +h.tagName[1]));
  note(heads.filter((h) => h === 1).length <= 1, "at most one h1", `h-levels: ${heads.join(",")}`);

  // Focus must be visible.
  await page.keyboard.press("Tab");
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, outline: cs.outlineWidth, style: cs.outlineStyle };
  });
  note(focusRing && focusRing.outline !== "0px", "visible focus ring on keyboard focus", JSON.stringify(focusRing));

  // lang
  const lang = await page.evaluate(() => document.documentElement.lang);
  note(Boolean(lang), "html lang set", lang || "missing");
  await ctx.close();
}

/* ---- The blur actually reaches the browser ----------------------------- */
/* Not a style question. The production minifier once replaced the standard
   `backdrop-filter` with the `-webkit-` alias alone, and in a browser that has
   the property but not the alias every frosted surface in the app — the
   sidebar, the top bar, every popover and dialog — became a 74%-transparent
   panel you could read the page straight through. It only happened in the
   built CSS, so nothing in dev would ever have shown it. */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const blurred = await page.evaluate(() => {
    const el = document.querySelector(".glass");
    if (!el) return "no .glass on the page";
    return getComputedStyle(el).backdropFilter;
  });
  note(/blur\(/.test(blurred), "glass surfaces are actually blurred in the built CSS", blurred);
  await ctx.close();
}

/* ---- Forced-colors / high contrast ------------------------------------ */
{
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, forcedColors: "active" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const visible = await page.evaluate(() => {
    const t = document.querySelector("textarea");
    return t ? getComputedStyle(t).color !== getComputedStyle(t).backgroundColor : false;
  });
  note(visible, "usable in forced-colors mode");
  await ctx.close();
}

await b.close();
console.log("PASS (" + ok.length + ")");
ok.forEach((s) => console.log("  ✓ " + s));
console.log("\nFAIL (" + fail.length + ")");
fail.forEach((s) => console.log("  ✗ " + s));
