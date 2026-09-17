/**
 * MarketLab, driven in a real browser.
 *
 * Checks the things a type-check cannot: that every route renders without a
 * console error, that moving a control actually changes a number, that the
 * charts draw, that the dark theme is applied before paint, and that the app
 * is usable at phone width.
 *
 *   npx next build && npx next start -p 3100
 *   node e2e-marketlab.mjs
 *
 * or against a server on another port:  URL=http://localhost:3000 node e2e-marketlab.mjs
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";

/* The pinned browser lives in a versioned directory that changes between
   images, so it is found rather than hardcoded. */
const ROOT = "/opt/pw-browsers";
const dir = readdirSync(ROOT).find((d) => /^chromium-\d+$/.test(d)) ?? "chromium";
const exe = `${ROOT}/${dir}/chrome-linux/chrome`;

/* 3100 is the port `gate.sh` serves on; override with URL= when driving a
   dev server by hand. */
const URL = process.env.URL ?? "http://localhost:3100";
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

let failed = 0;
const errs = [];
page.on("pageerror", (e) => errs.push(`PAGE: ${e.message}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("404") || t.includes("favicon")) return;
  errs.push(`CONSOLE: ${t}`);
});
const check = (p, label, detail = "") => {
  if (!p) failed++;
  console.log(`${p ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);
};

const go = async (path) => {
  errs.length = 0;
  await page.goto(URL + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
};

console.log("\nOnboarding: asked once, on the home page, and skippable");
{
  await go("/");
  await page.waitForTimeout(900);
  const dialog = page.locator('[role="dialog"]');
  check(await dialog.count() === 1, "a first visit to the home page is asked what it is here for");
  check(/look around/i.test(await page.evaluate(() => document.body.innerText)), "with a one-click way out");
  await page.getByRole("button", { name: /look around/i }).click();
  await page.waitForTimeout(400);
  check(await dialog.count() === 0, "dismissing it leaves the app usable");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check(await page.locator('[role="dialog"]').count() === 0, "and it is not asked again");
}

console.log("\nEvery route renders, with no page error");
for (const [path, must] of [
  ["/", "Understand markets"],
  ["/explore", "Start from a question"],
  ["/experiments", "Experiment Lab"],
  ["/experiments/elasticity", "Price elasticity"],
  ["/experiments/supply-demand", "market equilibrium"],
  ["/experiments/profit", "Break-even"],
  ["/experiments/competition", "market share"],
  ["/tools", "Business decision tools"],
  ["/research", "Research workspace"],
  ["/data", "Data"],
  ["/learn", "Learn"],
  ["/learn/elasticity", "Price elasticity of demand"],
  ["/about", "About MarketLab"],
]) {
  await go(path);
  const text = await page.evaluate(() => document.body.innerText);
  check(text.includes(must) && errs.length === 0, `${path}`, errs[0] ?? `${text.length} chars`);
}

console.log("\nA 404 is a page, not a crash");
await go("/experiments/does-not-exist");
check((await page.evaluate(() => document.body.innerText)).includes("nothing at this address"), "unknown experiment gets the 404 page");

console.log("\nThe hero chart is a model, not a picture");
await go("/");
{
  const before = await page.locator("#hero-shock").evaluate((el) => el.value);
  /* `innerText` reflects `text-transform`, and every label in this app is
     uppercased by CSS — so these reads are deliberately case-insensitive. */
  const readEq = () => page.evaluate(() => document.body.innerText.match(/equilibrium price\s*\n?\s*([^\n]+)/i)?.[1] ?? "");
  const priceBefore = await readEq();
  await page.locator("#hero-shock").fill("100");
  await page.waitForTimeout(150);
  const priceAfter = await readEq();
  check(priceBefore !== priceAfter, "shifting demand moves the equilibrium price", `${priceBefore} → ${priceAfter}`);
  check(before === "0", "and it starts at no shock");
  check((await page.locator("svg").count()) > 0, "the hero draws an SVG chart");
}

console.log("\nThe elasticity experiment recalculates");
await go("/experiments/elasticity");
{
  const read = () => page.evaluate(() => document.body.innerText);
  const t0 = await read();
  check(/−1\.22|-1\.22/.test(t0), "the default run gives PED = −1.22 by the midpoint method");
  check(t0.includes("Elastic"), "and classifies it as elastic");
  // 10 x 1000 = 10,000 before; 12 x 800 = 9,600 after.
  check(t0.includes("£10,000") && t0.includes("£9,600"), "revenue goes from £10,000 to £9,600",
    t0.match(/original revenue[^£]*(£[\d,]+)/i)?.[1]);

  // Switch to the base-year method: the same two points must give −1.00.
  await page.getByRole("radio", { name: "Base year" }).click();
  await page.waitForTimeout(200);
  const t1 = await read();
  check(/−1\.00|-1\.00/.test(t1), "the base-year method gives −1.00 for the same points");
  check(t1.includes("Unit elastic"), "which is unit elastic");

  const charts = await page.locator("figure svg").count();
  check(charts >= 2, "two charts are drawn", `${charts}`);

  // The data table is the accessible view of every chart.
  await page.getByRole("button", { name: "Show data" }).first().click();
  await page.waitForTimeout(150);
  check((await page.locator("table").count()) > 0, "every chart offers a data table");

  check((await read()).includes("What this model cannot tell you"), "the limitations are on the page, not in a footer");
  check(errs.length === 0, "no console errors while interacting", errs[0] ?? "");
}

console.log("\nThe profit simulator refuses to invent a break-even point");
await go("/experiments/profit");
{
  const before = await page.evaluate(() => document.body.innerText);
  check(/break-even/i.test(before), "break-even is reported");
  // Price below variable cost: there is no break-even quantity at all.
  const priceBox = page.locator('input[type="number"]').first();
  await priceBox.fill("5");
  await priceBox.blur();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.body.innerText);
  check(/below variable cost/.test(after), "selling below variable cost says why there is no break-even point");
  check(/\bNone\b/.test(after), "and reports None rather than a negative quantity");
}

console.log("\nPrice controls");
await go("/experiments/supply-demand");
{
  await page.getByRole("radio", { name: "Maximum" }).click();
  await page.waitForTimeout(250);
  const text = await page.evaluate(() => document.body.innerText);
  check(/shortage/i.test(text), "a maximum price reports a shortage");
  check(/binding/i.test(text), "and says whether the control binds");
}

console.log("\nThe business tools share one set of numbers");
await go("/tools");
{
  check(/contribution per unit/i.test(await page.evaluate(() => document.body.innerText)), "the pricing view opens first");
  await page.getByRole("radio", { name: "Break-even" }).click();
  await page.waitForTimeout(200);
  check(/margin of safety/i.test(await page.evaluate(() => document.body.innerText)), "break-even view shows margin of safety");
  await page.getByRole("radio", { name: "Report" }).click();
  await page.waitForTimeout(200);
  const report = await page.evaluate(() => document.body.innerText);
  check(report.includes("Business decision report"), "the report view opens");
  check(report.includes("MarketLab will not write this for you"), "and says it will not write the argument for you");
  check(report.includes("_Not yet written._"), "empty sections stay empty in the preview");
}

console.log("\nThe research workspace saves what you type");
await go("/research");
{
  await page.getByRole("button", { name: /New project/ }).first().click();
  await page.waitForTimeout(400);
  const editor = page.locator("textarea").first();
  await editor.fill("Does a price rise increase revenue for an inelastic good?");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const persisted = await page.locator("textarea").first().inputValue();
  check(persisted.includes("inelastic good"), "a section survives a reload", persisted.slice(0, 40));
  check(await page.locator('[role="dialog"]').count() === 0, "and no onboarding dialog interrupts a deep link");
  const text = await page.evaluate(() => document.body.innerText);
  check(/1 of 13 sections written/.test(text), "progress counts written sections", text.match(/\d+ of \d+ sections written/)?.[0]);
  check(/Model result/.test(text) && /Real-world observation/.test(text), "the three kinds of number are named on the page");
}

console.log("\nThe data page is honest about where its numbers come from");
await go("/data");
{
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => document.body.innerText);
  const live = /Live data/.test(text);
  const demo = /Demo data/.test(text);
  check(live || demo, "the mode is stated", live ? "live" : "demo");
  if (demo) {
    check(/illustrative demo figures, not real data/i.test(text), "demo data carries the warning in full");
    check(/must not be cited as data/i.test(text), "and says it must not be cited");
  }
  check(/source/i.test(text), "a source is attributed either way");
  check(/World Bank/.test(text), "and names the publisher");
}

console.log("\nThe Lab Assistant works with no API key configured");
await go("/");
{
  await page.getByRole("button", { name: /Lab Assistant/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("textbox", { name: /Ask the Lab Assistant/ }).fill("what is price elasticity of demand?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => document.body.innerText);
  check(/Offline answer/.test(text), "it answers offline and labels the answer as offline");
  check(/elasticity/i.test(text), "with something about elasticity in it");
  check(!/according to .{0,40}\(20\d\d\)/i.test(text), "and no invented citation");
}

console.log("\nDark mode is applied before the first paint");
{
  const fresh = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  const p2 = await fresh.newPage();
  await p2.goto(URL + "/", { waitUntil: "domcontentloaded" });
  const theme = await p2.evaluate(() => document.documentElement.dataset.mlTheme);
  check(theme === "dark", "a dark-preferring browser gets the dark attribute immediately", String(theme));
  const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg !== "rgb(255, 255, 255)" && bg !== "rgba(0, 0, 0, 0)", "and a dark background on the document, not white", bg);
  const html = await p2.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  check(html !== "rgb(255, 255, 255)" && html !== "rgba(0, 0, 0, 0)", "including the over-scroll gutter", html);
  await fresh.close();
}

console.log("\nEvery page fits every width");
{
  /* Sideways scroll is the defining symptom of a layout that was only ever
     looked at on a laptop, and it is invisible there — so it is measured on
     every route at every breakpoint rather than spot-checked. */
  const PATHS = ["/", "/explore", "/experiments", "/experiments/elasticity", "/experiments/supply-demand",
    "/experiments/profit", "/experiments/competition", "/tools", "/research", "/data", "/learn",
    "/learn/elasticity", "/learn/market-structures", "/about"];
  for (const [w, h, label] of [[360, 780, "small phone"], [390, 844, "phone"], [768, 1024, "iPad portrait"], [1024, 768, "iPad landscape"], [1440, 900, "desktop"]]) {
    const view = await b.newContext({ viewport: { width: w, height: h } });
    const px = await view.newPage();
    let worst = 0;
    let worstPath = "";
    for (const path of PATHS) {
      await px.goto(URL + path, { waitUntil: "networkidle" });
      await px.waitForTimeout(250);
      const o = await px.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > worst) { worst = o; worstPath = path; }
    }
    check(worst <= 1, `${label} (${w}px): no horizontal scroll on any page`, worst > 1 ? `${worstPath} +${worst}px` : "");
    await view.close();
  }

  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p3 = await phone.newPage();
  await p3.goto(URL + "/experiments/elasticity", { waitUntil: "networkidle" });
  check((await p3.locator('nav[aria-label="Sections"]').count()) === 1, "the bottom bar is present on a phone");
  // It is in the DOM at every width — it is CSS that hides it — so this has
  // to ask whether it is visible, not whether it exists.
  check(!(await p3.locator('aside nav[aria-label="Main"]').isVisible()), "and the desktop sidebar is hidden");
  await phone.close();
}

console.log("\nAccessibility basics");
await go("/experiments/elasticity");
{
  const oneH1 = await page.locator("h1").count();
  check(oneH1 === 1, "exactly one h1", `${oneH1}`);
  const unlabelled = await page.evaluate(() => {
    const controls = [...document.querySelectorAll("input, select, textarea")];
    return controls.filter((el) => {
      if (el.type === "hidden") return false;
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
      return !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    }).length;
  });
  check(unlabelled === 0, "every form control has a label", `${unlabelled} without`);
  const namelessButtons = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label")).length);
  check(namelessButtons === 0, "every button has an accessible name", `${namelessButtons} without`);
  const imgNoAlt = await page.evaluate(() =>
    [...document.querySelectorAll('svg[role="img"]')].filter((s) => !s.getAttribute("aria-label")).length);
  check(imgNoAlt === 0, "every chart carries a text description");
  await page.keyboard.press("Tab");
  const firstStop = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check(/Skip to content/i.test(firstStop ?? ""), "the first tab stop is skip-to-content", firstStop);
}

console.log("\nThe API routes answer");
{
  const assistant = await page.evaluate(async (u) => {
    const r = await fetch(u + "/api/lab-assistant", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "explain break-even" }),
    });
    return { status: r.status, body: await r.json() };
  }, URL);
  check(assistant.status === 200 && typeof assistant.body.answer === "string", "POST /api/lab-assistant returns an answer");
  check(["ai", "offline"].includes(assistant.body.mode), "and states its mode", assistant.body.mode);

  const bad = await page.evaluate(async (u) => {
    const r = await fetch(u + "/api/lab-assistant", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "" }),
    });
    return r.status;
  }, URL);
  check(bad === 400, "an empty question is refused", String(bad));

  const indicators = await page.evaluate(async (u) => {
    const r = await fetch(u + "/api/indicators?indicator=NY.GDP.MKTP.KD.ZG&country=GBR&from=2015&to=2020");
    return { status: r.status, body: await r.json() };
  }, URL);
  check(indicators.status === 200 && Array.isArray(indicators.body.points), "GET /api/indicators returns a series");
  check(["live", "demo"].includes(indicators.body.mode), "labelled live or demo", indicators.body.mode);
  check(typeof indicators.body.attribution === "string" && indicators.body.attribution.length > 20, "with an attribution string");

  const unknown = await page.evaluate(async (u) => (await fetch(u + "/api/indicators?indicator=made.up")).status, URL);
  check(unknown === 400, "an unknown indicator is refused rather than invented", String(unknown));

  const noKeyLeak = await page.evaluate(async (u) => {
    const html = await (await fetch(u + "/")).text();
    return /sk-ant|ANTHROPIC_API_KEY|x-api-key/i.test(html);
  }, URL);
  check(noKeyLeak === false, "no API key or key header name appears in the delivered page");
}

console.log("\nThe other app on this repo still works");
await go("/studio");
check((await page.evaluate(() => document.body.innerText)).length > 100, "/studio renders the previous app");

await b.close();
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
