/**
 * Pointing at the thing you can see.
 *
 * The one idea this app was missing. Everywhere else it lets you *describe* a
 * change; nothing let you *indicate* one, and "the blue button roughly in the
 * middle of the dashboard" is a translation step where the intent goes
 * missing. The page is already running in a frame beside the editor, so the
 * answer is to let you click it.
 *
 * Three things have to be true for it to be worth anything, and each is
 * asserted here rather than eyeballed:
 *
 *   1. the click chooses rather than presses — the page's own handler must not
 *      fire, or you submit the form you were trying to describe;
 *   2. the model is told *which* element, by its markup and not by a
 *      description of where it is on screen;
 *   3. the change lands in the file it belongs in, which is usually not the
 *      file you were looking at when you pointed.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-point.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const last = async () => JSON.stringify(await (await fetch("http://127.0.0.1:8787/__last")).json());

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Code" }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Web app/ }).click();
await page.waitForTimeout(1800);

const frame = page.frameLocator('iframe[title="Preview"]');

console.log("\nThe page is running, and you can point at it");
{
  check((await page.getByRole("button", { name: /Point at it/ }).count()) === 1,
    "there is a way to say “that one”");

  /* First: a click while NOT pointing must still work the page. The picker is
     a mode, and a mode that leaks would make the running app unusable. */
  const plus = frame.locator("button").filter({ hasText: "+" }).first();
  await plus.click();
  await page.waitForTimeout(400);
  const counted = await frame.locator("#value").innerText();
  check(counted.trim() === "1", "with the picker off, a click still presses the button", counted.trim());

  await page.getByRole("button", { name: /Point at it/ }).click();
  await page.waitForTimeout(500);

  const cursor = await frame.locator("html").evaluate((n) => getComputedStyle(n).cursor);
  check(cursor === "crosshair", "turning it on says so with the cursor", cursor);

  /* Hover lights up what is under the pointer. Without it you are aiming at
     something you cannot see the edges of. */
  await plus.hover();
  await page.waitForTimeout(300);
  const outline = await plus.evaluate((n) => n.style.outline);
  check(/solid/.test(outline), "hovering shows you what you are about to choose", outline);
  await page.screenshot({ path: `${OUT}/point-hover.png` });
}

console.log("\nChoosing is not pressing");
{
  const before = await frame.locator("#value").innerText();
  await frame.locator("button").filter({ hasText: "+" }).first().click();
  await page.waitForTimeout(700);
  const after = await frame.locator("#value").innerText();
  check(before === after,
    "the page's own handler does not fire — you chose the button, you did not press it",
    `${before} → ${after}`);

  check((await page.getByRole("button", { name: /Point at it/ }).count()) === 1,
    "and the mode ends with the pick, so the next click is not an accident");
}

console.log("\nThe bar is now about that element");
{
  const bar = await page.locator(".composer-shell").innerText();
  check(/button/.test(bar), "the chip says what was chosen", (bar.split("\n").find((l) => /button/.test(l)) ?? "").slice(0, 40));
  check((await page.getByPlaceholder(/^Change the/).count()) === 1,
    "and the question narrows to it rather than to the file");
  await page.screenshot({ path: `${OUT}/point-chip.png` });
}

console.log("\nSaying what to do with it");
{
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("make it smaller and calmer");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(3000);

  const asked = await last();
  check(/Someone is looking at this page running/.test(asked),
    "the model is told this is about one element of a running page");
  check(/THE ELEMENT THEY POINTED AT/.test(asked) && /<button/.test(asked),
    "and is given the element's own markup, not a description of where it is");
  /* An id wins and the walk stops there: `button#up` is a better anchor than
     four levels of tag names above it, and a path that keeps climbing past an
     id is describing the room rather than the thing in it. */
  check(/Where it sits: \S/.test(asked), "with where it sits in the page",
    (asked.match(/Where it sits: [^"\\]*/) ?? [""])[0].slice(0, 50));
  check(/Pick the file the change actually belongs in/.test(asked),
    "and asked which file the change belongs in — appearance is rarely the markup");
  check(/THE FOLDER/.test(asked) && /style\.css/.test(asked) && /index\.html/.test(asked),
    "with the whole folder to choose from");
}

console.log("\nAnd it lands where it belongs");
{
  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 1,
    "the change arrives as a diff, like every other change");
  const head = await page.locator("main").innerText();
  check(/style\.css/.test(head.split("\n").slice(0, 6).join(" ")),
    "the diff says which file it is of — you pointed at markup and this is the stylesheet");
  await page.screenshot({ path: `${OUT}/point-diff.png` });

  await page.getByRole("button", { name: /^Keep/ }).click();
  await page.waitForTimeout(1200);

  // The edit really went into style.css, not into the file that was on screen.
  const css = await page.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["canvasFiles"]).objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows.find((f) => f.name === "style.css")?.content ?? "";
  });
  check(/picked-by-the-mock/.test(css), "and the stylesheet is what actually changed on disk");

  const html = await page.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["canvasFiles"]).objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows.find((f) => f.name === "index.html")?.content ?? "";
  });
  check(!/picked-by-the-mock/.test(html), "while the file you were looking at was left alone");

  const bar = await page.locator(".composer-shell").innerText();
  check(!/Change the/.test(bar) || !/button/.test(bar.split("\n")[0] ?? ""),
    "and the element is let go once its change is in — it may not exist in that shape any more");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
