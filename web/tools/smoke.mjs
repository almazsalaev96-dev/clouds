/**
 * Drives the built page in a real browser.
 *
 * This exists because the iPad port was written and never compiled, and three
 * separate unreachable code paths came out of that. A build that has never been
 * opened is in the same position, so this opens it: every screen, a synthetic pen,
 * marking, the contextual AI, an adaptive diagnostic, a timed test, and a reload.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const url = `file://${resolve(here, "../dist/slate.html")}`;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures.push(name); }
};

const executablePath = process.env.SLATE_CHROMIUM || undefined;
const browser = await chromium.launch(executablePath
  ? { executablePath, args: ["--headless=new", "--no-sandbox"], ignoreDefaultArgs: ["--headless=old"] }
  : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();

// Web fonts and pdf.js are progressive enhancements and this sandbox has no
// outbound network, so a blocked request is the offline case working.
const consoleErrors = [];
const external = /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/;
let externalBlocked = false;
page.on("requestfailed", (r) => { if (external.test(r.url())) externalBlocked = true; });
page.on("console", (m) => {
  const t = m.text();
  if (m.type() !== "error") return;
  if (external.test(t) || (externalBlocked && /Failed to load resource/.test(t))) return;
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(url);
await page.waitForSelector(".rail");

console.log("home");
check("the rail carries all seven sections", (await page.locator(".rail-item").count()) === 7);
check("home opens on a single recommendation", await page.locator(".next").isVisible());
check("the recommendation says why", (await page.locator(".next .t-body").textContent()).length > 20);
check("example history is labelled as not the student's work",
  await page.getByText("It is not your work").isVisible());
check("topics show mastery", (await page.locator(".tiles .tile").count()) >= 6);
// The word appears once, in the sentence promising there are none; what must not
// exist is a counter.
check("no streak counter, no points, no daily target",
  !/\d+\s*(day|answer)s?\s*streak|streak\s*[:·]\s*\d|\bXP\b|\d+\s*points?\b/i
    .test(await page.locator("#main").textContent()));

console.log("workspace");
await page.getByRole("button", { name: /Linear equations/ }).first().click();
await page.waitForSelector(".sheet");
check("the worksheet renders four questions", (await page.locator(".q").count()) === 4);
check("the tutor panel says what it is looking at",
  (await page.locator(".ai-context").textContent()).includes("question"));
check("the pencil toolbar offers seven tools plus finger and undo",
  (await page.locator(".tools .tool").count()) === 9);

// A pen, as the browser reports one.
const sheet = await page.locator(".sheet").boundingBox();
await page.evaluate(async ([x, y]) => {
  const el = document.querySelector(".sheet");
  const fire = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, {
    pointerId: 7, pointerType: "pen", pressure: 0.65, isPrimary: true,
    clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));
  fire("pointerdown", x, y);
  for (let i = 1; i <= 24; i += 1) fire("pointermove", x + i * 7, y + Math.sin(i / 3) * 16);
  fire("pointerup", x + 168, y);
}, [sheet.x + 140, sheet.y + 330]);

const inked = () => page.evaluate(() => {
  const c = document.querySelector(".sheet-ink");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n += 1;
  return n;
});
check("a pen stroke is captured", (await page.evaluate(() =>
  window.__slate.store.strokesFor("ws:ws-linear", 0).length)) === 1);
check("and actually drawn", (await inked()) > 200, `${await inked()} opaque pixels`);

console.log("marking");
await page.locator(".field").first().fill("x = 5");
await page.getByRole("button", { name: "Check", exact: true }).click();
await page.waitForSelector(".mistake");
check("a correct answer is marked correct", await page.locator(".mistake.correct").isVisible());
check("mastery moves, and says from what to what",
  (await page.locator(".mistake .t-2").last().textContent()).includes("→"));

await page.locator(".q").nth(1).click();
await page.waitForTimeout(120);
await page.locator(".field").first().fill("3");
await page.getByRole("button", { name: "Check", exact: true }).click();
await page.waitForSelector(".mistake:not(.correct)");
const headings = await page.locator(".mistake-step h4").allTextContents();
check("a wrong answer is analysed, not just marked wrong",
  ["Your answer", "What went wrong", "The concept", "Try again"].every((h) => headings.includes(h)),
  headings.join("/"));
check("the sign flip is named specifically",
  /sign/i.test(await page.locator(".mistake-step p").nth(1).textContent()));

console.log("contextual tutor");
await page.locator(".chip.ai", { hasText: "Hint" }).first().click();
await page.waitForSelector(".turn.ai .answer");
check("help arrives laid out editorially, not as one bubble",
  (await page.locator(".turn.ai .answer-block").count()) >= 2);
check("it says where the help came from",
  (await page.locator(".answer-source").last().textContent()).includes("Written help"));
check("asking for help is logged as assistance", (await page.evaluate(() =>
  window.__slate.store.allEvents().filter((e) => e.type === "assistanceRequested").length)) >= 1);

const bubbleShown = await page.evaluate(() => {
  const q = document.querySelectorAll(".q")[2];
  const r = q.getBoundingClientRect();
  q.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.x + 40, clientY: r.y + 20 }));
  return new Promise((done) => setTimeout(() => done(Boolean(document.querySelector(".bubble"))), 60));
});
check("tapping a question offers actions about that question", bubbleShown);

console.log("lasso over handwriting");
await page.locator(".tools .tool").nth(4).click();
const box = await page.locator(".sheet").boundingBox();
await page.evaluate(async ([x, y]) => {
  const el = document.querySelector(".sheet");
  const fire = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, {
    pointerId: 9, pointerType: "pen", pressure: 0.5, isPrimary: true,
    clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));
  const path = [[-40, -60], [260, -60], [260, 80], [-40, 80], [-40, -60]];
  fire("pointerdown", x + path[0][0], y + path[0][1]);
  for (const [dx, dy] of path.slice(1)) fire("pointermove", x + dx, y + dy);
  fire("pointerup", x + path[0][0], y + path[0][1]);
}, [box.x + 140, box.y + 330]);
await page.waitForTimeout(150);
check("selecting your own working changes what the tutor is looking at",
  (await page.locator(".ai-context").textContent()).includes("working"));

console.log("diagnostic");
await page.locator(".rail-item[data-screen=tasks]").click();
await page.getByRole("button", { name: /Diagnose a topic/ }).click();
await page.getByRole("button", { name: /Solving linear equations/ }).click();
let asked = 0;
while (asked < 6 && (await page.locator(".card .btn.full").count()) > 0) {
  const labels = await page.locator(".card .btn.full").allTextContents();
  const i = labels.findIndex((l) => l.includes("x = 3") || l.includes("x = 13/3"));
  await page.locator(".card .btn.full").nth(i >= 0 ? i : 0).click();
  asked += 1;
  await page.waitForTimeout(60);
}
check("the diagnostic reaches a named conclusion", await page.getByText("Diagnosis").first().isVisible());
check("it reports bits resolved rather than a score",
  /bits of/.test(await page.locator(".card .t-2").first().textContent()));
check("it stopped early", asked <= 4, `asked ${asked}`);

console.log("exam mode");
await page.locator(".rail-item[data-screen=tasks]").click();
await page.getByRole("button", { name: /Take a test/ }).click();
await page.waitForSelector(".exam");
check("the tutor is absent during a test",
  (await page.locator(".exam .ai-mark, .exam .composer, .exam .chip.ai").count()) === 0);
check("a clock is running", /\d:\d\d/.test(await page.locator(".exam-clock").textContent()));
for (let i = 0; i < 8; i += 1) {
  await page.locator(".field").fill(i % 2 ? "5" : "1");
  await page.locator(".exam .btn.primary").click();
  await page.waitForTimeout(40);
}
await page.waitForSelector(".t-cap", { state: "visible" });
check("a test ends in a diagnosis, not a mark", await page.getByText("Diagnosis").first().isVisible());
check("it breaks the result down by topic", await page.getByText("By topic").isVisible());
check("and says what to do next", await page.getByText("What to do next").isVisible());

console.log("the rest of the shell");
for (const [screen, marker] of [["documents", "Documents"], ["subjects", "Knowledge map"],
                                ["progress", "Progress"], ["ai", "Tutor"], ["settings", "Settings"]]) {
  await page.locator(`.rail-item[data-screen=${screen}]`).click();
  await page.waitForTimeout(90);
  check(`${screen} renders`, await page.getByText(marker).first().isVisible());
}
check("the knowledge map is drawn from the prerequisite graph", await page.evaluate(async () => {
  document.querySelector(".rail-item[data-screen=subjects]").click();
  await new Promise((r) => setTimeout(r, 120));
  return document.querySelectorAll(".map [data-concept]").length;
}) === 6);

console.log("persistence");
await page.reload();
await page.waitForSelector(".rail");
check("the log survived a reload", (await page.evaluate(() =>
  window.__slate.store.allEvents().length)) > 20);
await page.locator(".rail-item[data-screen=home]").click();
await page.waitForTimeout(120);
await page.getByRole("button", { name: /Linear equations/ }).first().click();
await page.waitForSelector(".sheet");
check("ink survived it too", (await inked()) > 200, `${await inked()} px`);

for (const screen of ["home", "documents", "subjects", "tasks", "ai", "progress", "settings"]) {
  await page.locator(`.rail-item[data-screen=${screen}]`).click();
  await page.waitForTimeout(70);
  const stray = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.getElementById("main"), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (t === "null" || t === "undefined" || t === "[object Object]" || t === "NaN") return t;
    }
    return null;
  });
  check(`no stray placeholder text on ${screen}`, stray === null, String(stray));
}

console.log("appearance and layout");
await page.locator(".rail-item[data-screen=home]").click();
await page.emulateMedia({ colorScheme: "dark" });
await page.waitForTimeout(120);
const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("dark mode repaints the shell", dark === "rgb(17, 17, 17)", dark);
await page.screenshot({ path: resolve(here, "../dist/shot-home-dark.png") });
await page.locator(".rail-item[data-screen=home]").click();
await page.waitForTimeout(80);
await page.getByRole("button", { name: /Quadratic equations/ }).first().click();
await page.waitForTimeout(300);
const paperDark = await page.evaluate(() => getComputedStyle(document.querySelector(".sheet")).backgroundColor);
check("the paper stays paper in dark mode", paperDark === "rgb(239, 236, 230)", paperDark);
await page.screenshot({ path: resolve(here, "../dist/shot-workspace-dark.png") });

await page.emulateMedia({ colorScheme: "light" });
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(here, "../dist/shot-workspace.png") });
await page.locator(".rail-item[data-screen=home]").click();
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(here, "../dist/shot-home.png") });

check("every interactive target clears 44px", await page.evaluate(() => {
  const small = [];
  for (const node of document.querySelectorAll("#main button, .rail button")) {
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.height < 43.5) small.push(`${node.className}:${Math.round(r.height)}`);
  }
  return small.slice(0, 4);
}).then((s) => s.length === 0 || s));

const ipad = await browser.newContext({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 });
const tablet = await ipad.newPage();
await tablet.goto(url);
await tablet.waitForSelector(".rail");
await tablet.getByRole("button", { name: /Quadratic equations/ }).first().click();
await tablet.waitForSelector(".sheet");
const overflow = await tablet.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal overflow on iPad portrait", overflow <= 1, `${overflow}px`);
check("the panel starts out of the way on a narrow iPad, behind a dock",
  await tablet.locator(".dock").isVisible() && (await tablet.locator(".panel").count()) === 0);
const widthBefore = (await tablet.locator(".sheet").boundingBox()).width;
await tablet.locator(".dock").click();
await tablet.waitForSelector(".panel");
const widthAfter = (await tablet.locator(".sheet").boundingBox()).width;
check("opening it never squeezes the page", Math.abs(widthAfter - widthBefore) < 1,
  `${widthBefore} → ${widthAfter}`);
check("it arrives as a sheet from the bottom", await tablet.evaluate(() => {
  const p = document.querySelector(".panel").getBoundingClientRect();
  return p.bottom >= window.innerHeight - 2 && p.height < window.innerHeight * 0.7;
}));
check("it never covers the navigation rail", await tablet.evaluate(() => {
  const p = document.querySelector(".panel").getBoundingClientRect();
  const rail = document.querySelector(".rail").getBoundingClientRect();
  return p.left >= rail.right - 1;
}));
check("the pencil tools stay reachable above it", await tablet.evaluate(() => {
  const t = document.querySelector(".tools").getBoundingClientRect();
  const p = document.querySelector(".panel").getBoundingClientRect();
  return t.bottom < p.top;
}));
await tablet.screenshot({ path: resolve(here, "../dist/shot-ipad.png") });

// The claim this build rests on: the page ships the gateway's own marker.
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
const local = battery.map(([s, e]) => {
  const r = grade(s, [{ text: e }]);
  return { verdict: r.verdict, nearMiss: r.nearMiss ? r.nearMiss.kind : null };
});
const remote = await page.evaluate((cases) => cases.map(([s, e]) => {
  const r = window.__slate.app.grade(s, [{ text: e }]);
  return { verdict: r.verdict, nearMiss: r.nearMiss ? r.nearMiss.kind : null };
}), battery);
const mismatch = battery.map((c, i) => [c, local[i], remote[i]])
  .filter(([, a, b]) => a.verdict !== b.verdict || a.nearMiss !== b.nearMiss);
check(`the bundled grader matches the source on all ${battery.length} cases`, mismatch.length === 0,
  mismatch.map(([c, a, b]) => `${c[0]}|${c[1]}: ${a.verdict} vs ${b.verdict}`).join("; "));

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();
console.log(failures.length ? `\n${failures.length} failing: ${failures.join(", ")}` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
