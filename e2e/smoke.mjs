/**
 * End-to-end smoke test.
 *
 * Drives a real browser through the whole loop — onboard, practise, self-mark,
 * generate a mistake, persist, reload — and asserts against IndexedDB as well
 * as the rendered page. It exists because the interesting failures in this
 * product are not render errors: they are a session that silently stops
 * advancing, or attempts that look saved and are not.
 *
 * Usage:
 *   npm run build && npx next start -p 3111 &
 *   node e2e/smoke.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.LODESTAR_URL ?? "http://localhost:3111";
const EXECUTABLE = process.env.CHROMIUM_PATH; // set when using a preinstalled browser


/**
 * Fill in whatever question type is on screen. Kept exhaustive deliberately:
 * the adaptive engine chooses what to serve, so the test cannot assume a type,
 * and a helper that silently fails to answer produces a disabled submit button
 * and a thirty-second timeout rather than a useful failure.
 */
async function answerWhateverIsOnScreen(page) {
  const choices = page.locator(".choice");
  if (await choices.count()) {
    await choices.first().click();
    return "choice";
  }

  const numeric = page.locator('input[type="number"]');
  if (await numeric.count()) {
    await numeric.first().fill("8000");
    return "numeric";
  }

  // Cloze / diagram labelling: inline text inputs inside the prompt.
  const blanks = page.locator('p input[type="text"]');
  const blankCount = await blanks.count();
  if (blankCount) {
    for (let i = 0; i < blankCount; i++) await blanks.nth(i).fill("power");
    return "cloze";
  }

  // Matching: one select per left-hand item.
  const selects = page.locator("select");
  const selectCount = await selects.count();
  if (selectCount) {
    for (let i = 0; i < selectCount; i++) await selects.nth(i).selectOption({ index: 1 });
    return "match";
  }

  const textarea = page.locator("textarea");
  if (await textarea.count()) {
    await textarea
      .first()
      .fill(
        "Contribution is selling price minus variable cost per unit, therefore break-even output is fixed costs divided by contribution, which means this firm must sell 8000 units before it makes any profit.",
      );
    return "text";
  }

  // Ordering questions arrive pre-filled and are always submittable.
  return "none";
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
};

const browser = await chromium.launch(
  EXECUTABLE ? { executablePath: EXECUTABLE, args: ["--no-sandbox"] } : {},
);
const ctx = await browser.newContext();
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

// --- onboarding ------------------------------------------------------------
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /What are you studying/i }).waitFor({ timeout: 20000 });
await page.getByRole("button", { name: /Business/ }).first().click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Full A Level" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Build my plan" }).click();
await page.waitForTimeout(2000);
const home = await page.locator("main").innerText();
check("onboarding produces a command centre", /mission/i.test(home) && /readiness/i.test(home));
check("no grade is projected from zero evidence", /—/.test(home) && !/Range [A-U]/.test(home));

// --- practice loop ---------------------------------------------------------
await page.goto(`${BASE}/practice`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Start practising/i }).click();

let answered = 0;
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(800);
  await answerWhateverIsOnScreen(page);

  const submit = page.getByRole("button", { name: /Check answer|Submit and mark/ });
  if (!(await submit.count())) break;
  if (await submit.isDisabled()) {
    // Nothing the helper knows how to answer. Skip rather than hang.
    const skip = page.getByRole("button", { name: /^Skip$/ });
    if (await skip.count()) { await skip.click(); continue; }
    break;
  }
  await submit.click();

  const confident = page.getByRole("button", { name: /Fairly sure/ });
  if (await confident.count()) await confident.click();
  await page.waitForTimeout(500);

  const reveal = page.getByRole("button", { name: /Show the mark scheme/i });
  if (await reveal.count()) {
    await reveal.click();
    await page.waitForTimeout(300);
    const hits = page.getByRole("button", { name: "Hit", exact: true });
    const n = await hits.count();
    // Deliberately miss the final point so a classified mistake is produced.
    for (let k = 0; k < Math.max(0, n - 1); k++) await hits.nth(k).click();
    const miss = page.getByRole("button", { name: "Miss", exact: true });
    if (await miss.count()) {
      await miss.last().click();
      const reason = page.locator("select").last();
      if (await reason.count()) await reason.selectOption({ index: 1 });
    }
    const save = page.getByRole("button", { name: /Save and continue/i });
    if (await save.count()) await save.click();
  } else {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    if (await cont.count()) await cont.click();
  }
  answered++;
  await page.waitForTimeout(600);
}
check("the adaptive loop keeps serving questions", answered >= 4, `${answered} answered`);

// --- persistence, read straight from IndexedDB -----------------------------
await page.waitForTimeout(1200);
const stored = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("lodestar");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const val = await new Promise((res, rej) => {
    const g = db.transaction("state", "readonly").objectStore("state").get("lodestar:student");
    g.onsuccess = () => res(g.result);
    g.onerror = () => rej(g.error);
  });
  return val
    ? { attempts: val.attempts.length, mistakes: val.mistakes.length, cards: val.cards.length, events: val.events.length }
    : null;
});
check("attempts persist to IndexedDB", (stored?.attempts ?? 0) >= 4, JSON.stringify(stored));
check("mistakes are minted from lost marks", (stored?.mistakes ?? 0) >= 1, `${stored?.mistakes ?? 0} mistakes`);
check("review cards are minted from mistakes", (stored?.cards ?? 0) >= 1, `${stored?.cards ?? 0} cards`);
check("events are logged", (stored?.events ?? 0) >= 8, `${stored?.events ?? 0} events`);

// --- survives a fresh page -------------------------------------------------
const fresh = await ctx.newPage();
await fresh.goto(`${BASE}/mistakes`, { waitUntil: "networkidle" });
await fresh.waitForTimeout(1500);
const lab = await fresh.locator("main").innerText();
check("Mistake Lab shows a real diagnosis after reload", /marks lost, and why/i.test(lab), lab.split("\n")[2] ?? "");

// --- every route renders ---------------------------------------------------
for (const [route, expected] of [
  ["/subjects", /Topic map/i],
  ["/readiness", /eight dimensions/i],
  ["/progress", /Trajectory|Nothing measured/i],
  ["/plan", /Next four weeks/i],
  ["/technique", /command word/i],
  ["/review", /Review|due|Nothing is due/i],
  ["/mock", /Sit a paper|mock/i],
  ["/library", /Content status/i],
  ["/settings", /Preferences/i],
  ["/glossary", /Terminology|No terms/i],
  ["/notes", /Notes/i],
  ["/tutor", /tutor/i],
]) {
  await fresh.goto(BASE + route, { waitUntil: "networkidle" });
  await fresh.waitForTimeout(700);
  const text = await fresh.locator("main").innerText();
  check(`route ${route}`, expected.test(text), expected.test(text) ? "" : text.slice(0, 90));
}

// --- command bar -----------------------------------------------------------
await fresh.goto(BASE, { waitUntil: "networkidle" });
await fresh.waitForTimeout(1200);
await fresh.keyboard.press("Control+k");
await fresh.locator(".cmd input").waitFor({ timeout: 5000 });
await fresh.locator(".cmd input").fill("35");
const commands = await fresh.locator(".cmd-item").allInnerTexts();
check("command bar reads a number as a session length", commands.some((c) => /35-minute session/.test(c)));

// --- summary ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (pageErrors.length) console.log(`page errors: ${[...new Set(pageErrors)].join(" | ")}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
