/**
 * Drives the built page in a real browser.
 *
 * This exists because the iPad port was written and never compiled, and three
 * separate unreachable code paths came out of that. A build that has never been
 * opened is in the same position, so this opens it: import a worksheet, draw with
 * a synthetic pen, answer a question right and wrong, walk the help ladder, run a
 * diagnostic to a conclusion, and reload to prove the log survived.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page_url = `file://${resolve(here, "../dist/slate.html")}`;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures.push(name); }
};

// SLATE_CHROMIUM points at a Chromium that Playwright did not install itself, which
// is how this runs in the sandbox here; CI lets Playwright resolve its own.
const executablePath = process.env.SLATE_CHROMIUM || undefined;
const browser = await chromium.launch(executablePath
  ? { executablePath, args: ["--headless=new", "--no-sandbox"], ignoreDefaultArgs: ["--headless=old"] }
  : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(page_url);
await page.waitForSelector("#app .nav");

console.log("desk");
check("nav renders five sections", (await page.locator(".nav-item").count()) === 5);
check("desk shows worksheets", await page.getByText("Worksheets").isVisible());

console.log("study");
await page.getByRole("button", { name: /Linear equations/ }).first().click();
await page.waitForSelector(".sheet");
check("worksheet renders four questions", (await page.locator(".ws-q").count()) === 4);
check("side panel shows the first question", (await page.locator(".side-prompt").textContent()).includes("3x + 7"));

// A pen, as the browser reports one.
const sheet = await page.locator(".sheet").boundingBox();
const pen = { pointerType: "pen", pressure: 0.6 };
await page.mouse.move(sheet.x + 120, sheet.y + 260);
await page.evaluate(async ([x, y]) => {
  const el = document.querySelector(".sheet");
  const fire = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, {
    pointerId: 7, pointerType: "pen", pressure: 0.65, isPrimary: true,
    clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));
  fire("pointerdown", x, y);
  for (let i = 1; i <= 20; i += 1) fire("pointermove", x + i * 6, y + Math.sin(i / 3) * 14);
  fire("pointerup", x + 120, y);
}, [sheet.x + 120, sheet.y + 300]);
const strokeCount = await page.evaluate(() =>
  window.__slate.store.strokesFor("ws:ws-linear", 0).length);
check("a pen stroke was captured and stored", strokeCount === 1, `got ${strokeCount}`);
const inked = async () => page.evaluate(() => {
  const c = document.querySelector(".sheet-ink");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n += 1;
  return n;
});
check("the stroke is actually drawn", (await inked()) > 200, `${await inked()} opaque pixels`);

console.log("checking answers");
await page.locator("input.answer").first().fill("x = 5");
await page.getByRole("button", { name: "Check" }).click();
await page.waitForSelector(".verdict");
check("correct answer marked correct", (await page.locator(".verdict-title").textContent()) === "Correct");
check("mastery moved", (await page.locator(".delta").textContent()).includes("→"));

// The sign-flip trap, which the deterministic grader should name.
await page.locator(".ws-q").nth(1).click();
await page.locator("input.answer").first().fill("3");
await page.getByRole("button", { name: "Check" }).click();
await page.waitForSelector(".verdict.specific, .verdict.wrong");
const fix = await page.locator(".verdict-fix").textContent();
check("sign flip diagnosed specifically", /sign/i.test(fix), fix);

console.log("help ladder");
await page.getByRole("button", { name: /Show the answer/ }).click();
check("solution is reachable without asking permission",
  (await page.locator(".answer-reveal").textContent()).includes("−3"));
check("cost of the solution is stated",
  await page.getByText("Does not count towards unaided mastery").isVisible());

console.log("diagnostic");
await page.locator(".nav-item[data-screen=diagnose]").click();
await page.getByRole("button", { name: /Solving linear equations/ }).click();
let asked = 0;
while (asked < 6 && (await page.locator(".option").count()) > 0) {
  // Answer as a student who flips signs: pick the sign-error option when offered.
  const labels = await page.locator(".option").allTextContents();
  const idx = labels.findIndex((l) => l.includes("x = 3") || l.includes("x = 13/3"));
  await page.locator(".option").nth(idx >= 0 ? idx : 0).click();
  asked += 1;
  await page.waitForTimeout(60);
}
await page.waitForSelector(".card.finding");
check("diagnostic reaches a named conclusion", (await page.locator(".card.finding h2").textContent()).length > 3);
check("diagnostic reports bits, not a score",
  /bits of/.test(await page.locator(".card.finding .small").textContent()));
check("it stopped early", asked <= 4, `asked ${asked}`);

console.log("progress and persistence");
await page.locator(".nav-item[data-screen=progress]").click();
await page.waitForSelector(".table");
check("progress lists topics with evidence", (await page.locator(".table tbody tr").count()) >= 1);

await page.reload();
await page.waitForSelector("#app .nav");
const events = await page.evaluate(() => window.__slate.store.allEvents().length);
check("the log survived a reload", events > 3, `${events} events`);
await page.locator(".nav-item[data-screen=study]").click();
await page.waitForTimeout(200);
check("the Page tab reopens the worksheet after a reload",
  (await page.locator(".ws-q").count()) === 4);
check("ink survived the reload too",
  (await page.evaluate(() => window.__slate.store.strokesFor("ws:ws-linear", 0).length)) === 1);
check("and is drawn again after switching back to the tab", (await inked()) > 200, `${await inked()} px`);

// `ParentNode.append` stringifies null, which put the word "null" on the page once.
for (const screen of ["desk", "study", "diagnose", "progress", "settings"]) {
  await page.locator(`.nav-item[data-screen=${screen}]`).click();
  await page.waitForTimeout(80);
  const stray = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.getElementById("main"), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (t === "null" || t === "undefined" || t === "[object Object]") return t;
    }
    return null;
  });
  check(`no stray placeholder text on ${screen}`, stray === null, String(stray));
}

console.log("appearance");
await page.emulateMedia({ colorScheme: "dark" });
await page.locator(".nav-item[data-screen=desk]").click();
await page.waitForTimeout(120);
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("dark mode repaints the page", bg !== "rgb(242, 239, 233)", bg);
await page.screenshot({ path: resolve(here, "../dist/shot-desk-dark.png"), fullPage: false });
await page.emulateMedia({ colorScheme: "light" });
await page.locator(".nav-item[data-screen=study]").click();
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(here, "../dist/shot-study.png") });

// iPad Pro, portrait, which is the device this was designed for.
const ipad = await browser.newContext({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: false });
const tablet = await ipad.newPage();
await tablet.goto(page_url);
await tablet.waitForSelector(".nav");
await tablet.getByRole("button", { name: /Quadratic equations/ }).first().click();
await tablet.waitForSelector(".sheet");
const overflow = await tablet.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal overflow on iPad portrait", overflow <= 1, `${overflow}px`);
await tablet.screenshot({ path: resolve(here, "../dist/shot-ipad.png") });

// The claim this build rests on is that the page ships the gateway's own marker
// rather than a lookalike. Check it by running the same battery through both.
console.log("grader parity, browser against the TypeScript source");
const { grade } = await import("../../server/src/grading/grade.ts");
const battery = [
  ["x = 5", "5"], ["10/2", "5"], ["-5", "5"], ["5.0", "5"],
  ["2x+4", "2*x + 4"], ["4 + 2x", "2*x + 4"], ["2x-4", "2*x + 4"],
  ["3, -2", "{-2,3}"], ["-2, 3", "{-2,3}"], ["3", "{-2,3}"],
  ["sin(30)", "0.5"], ["1/sqrt 2", "sqrt(2)/2"], ["1 1/4", "5/4"],
  ["(x+3)(x+4)", "x^2 + 7x + 12"], ["x^2+7x+12", "(x+3)(x+4)"],
  ["4x^2 + 1", "4x^2 - 4x + 1"], ["2/3", "11/12"], ["0.75", "3/4"],
  ["banana", "5"], ["", "5"], ["x=", "5"], ["1/0", "5"],
];
const local = battery.map(([sub, exp]) => {
  const r = grade(sub, [{ text: exp }]);
  return { verdict: r.verdict, nearMiss: r.nearMiss ? r.nearMiss.kind : null };
});
const remote = await page.evaluate((cases) => cases.map(([sub, exp]) => {
  const r = window.__slate.app.grade(sub, [{ text: exp }]);
  return { verdict: r.verdict, nearMiss: r.nearMiss ? r.nearMiss.kind : null };
}), battery);
const mismatches = battery
  .map((c, i) => [c, local[i], remote[i]])
  .filter(([, a, b]) => a.verdict !== b.verdict || a.nearMiss !== b.nearMiss);
check(`bundled grader matches the source on all ${battery.length} cases`, mismatches.length === 0,
  mismatches.map(([c, a, b]) => `${c[0]}|${c[1]}: ${a.verdict}/${a.nearMiss} vs ${b.verdict}/${b.nearMiss}`).join("; "));
console.log("   " + local.map((r, i) => `${battery[i][0] || "(empty)"}→${r.verdict}${r.nearMiss ? ":" + r.nearMiss : ""}`).join("  "));

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();
console.log(failures.length ? `\n${failures.length} failing: ${failures.join(", ")}` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
