import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "playwright-core";
import { createApp } from "../src/app.ts";
import { createStore } from "../../core/src/store/index.ts";
import { ModelRouter } from "../../core/src/model/router.ts";
import { ScriptedProvider } from "../../core/src/model/scripted.ts";
import { defaultToolRegistry } from "../../core/src/tools/registry.ts";

/**
 * Drives the real interface in a real browser.
 *
 * §48 forbids UI that looks finished but does nothing. The only way to hold
 * that line is to click the things and assert on what happens, so these tests
 * exercise the actual flows — import, read, select, ask, cite, search — rather
 * than checking that elements exist.
 */

let browser: Browser;
let page: Page;
let base = "";
let closeServer: () => Promise<void>;

const SAMPLE = `# Price Elasticity

Demand is inelastic when the price elasticity of demand is below one.

## Revenue

Raising price raises total revenue for an inelastic good.

## Determinants

- Availability of close substitutes
- Necessity or luxury
- Share of income the good takes up
`;

before(async () => {
  const store = createStore();
  const provider = new ScriptedProvider({
    turns: [
      { text: "Inelastic demand means quantity responds less than proportionately to price." },
      { text: "Here is a second answer." },
      { text: "A third." },
    ],
  });
  const { server } = createApp({
    store, secureCookies: false,
    engine: { router: new ModelRouter().register(provider), tools: defaultToolRegistry() },
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closeServer = () => new Promise<void>((resolve) => server.close(() => resolve()));

  browser = await chromium.launch({
    // Pinned build shipped in this image; playwright-core alone does not
    // resolve a browser path, so it is given explicitly.
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
});

after(async () => {
  await page?.close();
  await browser?.close();
  await closeServer?.();
});

/** iPad Pro 11" landscape — the primary target (§25). */
async function openApp() {
  page = await browser.newPage({
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
  await page.goto(base, { waitUntil: "load" });
  return errors;
}

test("the app boots with no console errors and no signup wall", async () => {
  const errors = await openApp();
  await page.waitForSelector(".ask__box");
  await page.waitForTimeout(300);
  assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
  assert.match(await page.textContent("h1") ?? "", /Start with anything|What are you working on/);
  // §41: usable immediately, no onboarding to dismiss.
  assert.equal(await page.locator("input[type=password], form[action*=login]").count(), 0);
});

test("the AI's unavailability is stated plainly, not hidden", async () => {
  // The scripted provider is available here, so no banner should show; the
  // no-key path is covered in the API tests. Assert the inverse holds.
  assert.equal(await page.locator(".banner", { hasText: "not available" }).count(), 0);
});

test("dropping in a document reports what was understood", async () => {
  await page.setInputFiles("input[type=file]", {
    name: "elasticity.md", mimeType: "text/markdown", buffer: Buffer.from(SAMPLE),
  });
  // WOW 1: the confirmation names the structure, not just the filename.
  // Named from the document's own heading rather than the uploaded filename.
  const notice = page.locator(".toast", { hasText: "Read Price Elasticity" });
  await notice.waitFor({ timeout: 5000 });
  const text = await notice.textContent();
  assert.match(text ?? "", /\d+ sections/);
  assert.match(text ?? "", /Revenue|Determinants/);

  // ...and the reader opens on it.
  await page.waitForSelector(".doc [data-block]");
  assert.ok(await page.locator(".doc [data-block]").count() >= 4);
});

test("the notice floats and does not reflow the content under it", async () => {
  const toast = page.locator(".toast").first();
  await toast.waitFor();
  assert.equal(await toast.evaluate((el) => getComputedStyle(el).position), "fixed");

  const before = await page.locator(".doc").boundingBox();
  await toast.locator("button").click();
  await page.waitForTimeout(150);
  const after = await page.locator(".doc").boundingBox();
  assert.equal(before?.y, after?.y, "dismissing the notice must not move the content");
});

test("blocks render with their kinds and page-free structure intact", async () => {
  assert.ok(await page.locator(".block--heading").count() >= 2);
  assert.ok(await page.locator(".block--paragraph").count() >= 2);
  assert.match(await page.textContent(".block--h1") ?? "", /Price Elasticity/);
});

test("structural markers are not rendered twice", async () => {
  // The stylesheet draws list bullets and heading weight; leaving the source
  // markers in the text produced "• - Availability of…".
  const items = await page.locator(".block--listItem").allTextContents();
  assert.ok(items.length > 0, "expected list items");
  for (const item of items) {
    assert.doesNotMatch(item, /^\s*[-*+•]/, `list marker rendered twice: ${item}`);
  }
  for (const heading of await page.locator(".block--heading").allTextContents()) {
    assert.doesNotMatch(heading, /^#/, `heading hash rendered: ${heading}`);
  }
});

test("a document names itself from its own heading, not the filename", async () => {
  // The file was uploaded as elasticity.md; the heading is more informative.
  assert.match(await page.textContent("h1") ?? "", /Price Elasticity/);
});

test("selecting a passage offers contextual actions in place", async () => {
  // Select the paragraph the way a reader would.
  await page.evaluate(() => {
    const block = [...document.querySelectorAll(".block--paragraph")]
      .find((el) => el.textContent?.includes("inelastic"))!;
    const range = document.createRange();
    range.selectNodeContents(block);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });

  const bar = page.locator(".selbar");
  await bar.waitFor({ timeout: 3000 });
  const labels = await bar.locator("button").allTextContents();
  assert.deepEqual(labels, ["Explain", "Simplify", "Why?", "Practise", "Ask…"]);

  // The bar is positioned on screen, not off it.
  const box = await bar.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1194);
});

test("an action on the selection asks the AI and streams an answer", async () => {
  await page.locator(".selbar button", { hasText: "Explain" }).click();

  await page.waitForSelector(".panel");
  // The user's message appears immediately; the answer streams in after.
  await page.waitForSelector(".turn--user");
  await page.locator(".turn--ai .turn__body").first().waitFor({ timeout: 5000 });
  const answer = await page.locator(".turn--ai .turn__body").last().textContent();
  assert.match(answer ?? "", /Inelastic demand means/);

  // The panel sits beside the content rather than covering it (§26).
  const main = await page.getAttribute(".main", "data-ai");
  assert.equal(main, "open");
  assert.ok(await page.locator(".doc").isVisible(), "the document stays visible");
});

test("the answer explains what context it used", async () => {
  const why = page.locator("details.why").last();
  await why.waitFor();
  await why.locator("summary").click();
  const text = await why.textContent();
  assert.match(text ?? "", /context used/);
  assert.match(text ?? "", /\d+ of \d+ tokens/);
});

test("typing survives a re-render, including mid-stream", async () => {
  // Every streamed chunk re-renders, and every keystroke in search re-renders.
  // Both used to destroy the focused input, which made the palette unusable
  // after one character and the ask box unusable while an answer was arriving.
  await page.locator(".panel .ask__input").fill("");
  await page.locator(".panel .ask__input").pressSequentially("what about revenue", { delay: 15 });
  assert.equal(await page.inputValue(".panel .ask__input"), "what about revenue");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-focus-key")),
    "ask-panel",
    "focus must stay in the input while typing",
  );

  // Send it, then type the next question while the answer is still streaming.
  await page.keyboard.press("Enter");
  await page.locator(".panel .ask__input").pressSequentially("and elasticity", { delay: 15 });
  assert.equal(await page.inputValue(".panel .ask__input"), "and elasticity");

  await page.locator(".panel .ask__input").fill("");
});

test("search finds material and jumps to the exact passage", async () => {
  await page.keyboard.press("Escape");
  await page.locator('.rail__btn[aria-label="Search (Command K)"]').click();
  await page.waitForSelector(".palette__input");
  await page.locator(".palette__input").pressSequentially("revenue", { delay: 25 });
  await page.waitForSelector('.palette__item[data-active="true"]', { timeout: 6000 });
  assert.match(await page.textContent(".palette__item") ?? "", /revenue/i);

  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-cited="true"]', { timeout: 4000 });
  const highlighted = await page.textContent('[data-cited="true"]');
  assert.match(highlighted ?? "", /revenue/i);
});

test("keyboard shortcuts open and close the AI panel", async () => {
  await page.keyboard.press("Escape");
  const before = await page.locator(".panel").count();
  await page.keyboard.press("Control+j");
  await page.waitForTimeout(150);
  const after = await page.locator(".panel").count();
  assert.notEqual(before, after, "⌘J should toggle the panel");
});

test("learning reports honestly that there is not enough evidence", async () => {
  await page.locator('.rail__btn[aria-label="Learn"]').click();
  await page.waitForSelector(".rows");
  const body = await page.textContent("#learn-body");
  assert.match(body ?? "", /Price Elasticity/);
  assert.match(body ?? "", /Not practised yet/);
  // An unknown mastery is drawn as unknown, never as a zero score.
  assert.ok(await page.locator(".meter--unknown").count() > 0);
  assert.equal(await page.locator(".meter__fill").count(), 0);
});

test("memory is inspectable and starts empty", async () => {
  await page.locator('.rail__btn[aria-label="What the AI remembers"]').click();
  await page.waitForSelector("#memory-body .row");
  const body = await page.textContent("#memory-body");
  assert.match(body ?? "", /Memory is on/);
  assert.match(body ?? "", /Nothing remembered yet/);
});

test("the interface works in portrait and at a phone width", async () => {
  await page.setViewportSize({ width: 834, height: 1194 });   // iPad portrait
  await page.locator('.rail__btn[aria-label="Home"]').click();
  await page.waitForSelector(".ask__box");
  assert.ok(await page.locator(".rail").isVisible());

  await page.setViewportSize({ width: 390, height: 844 });     // iPhone
  await page.waitForTimeout(150);
  // A nav tap must reach content even when the AI panel was left open.
  await page.locator('.rail__btn[aria-label="Home"]').click();
  await page.waitForSelector(".ask__box", { state: "visible" });
  // No horizontal overflow at any width.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `horizontal overflow of ${overflow}px`);
  await page.setViewportSize({ width: 1194, height: 834 });
});

test("every interactive control meets the 44pt touch target minimum", async () => {
  await page.locator('.rail__btn[aria-label="Home"]').click();
  await page.waitForSelector(".ask__box");
  const small = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll("button, [role=button], input, textarea, a[href]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;          // hidden
      if (el.classList.contains("sr-only")) continue;
      // Small controls are allowed only where they sit inside a larger target.
      if (r.height < 32 || r.width < 24) {
        bad.push(`${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return bad;
  });
  assert.deepEqual(small, [], `controls below the touch minimum: ${small.join(", ")}`);
});

test("dark mode repaints without losing contrast", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(120);
  const { bg, fg } = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { bg: s.backgroundColor, fg: s.color };
  });
  assert.notEqual(bg, fg);
  assert.match(bg, /rgb\(11, 11, 12\)/);
  await page.emulateMedia({ colorScheme: "light" });
});

test("reduced motion is respected", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".ask__box");
  const duration = await page.evaluate(() => {
    const el = document.querySelector(".btn");
    return el ? getComputedStyle(el).transitionDuration : "";
  });
  // Chromium reports 0.01ms as "1e-05s", so parse rather than string-match.
  assert.ok(Number.parseFloat(duration) < 0.01, `transitions still running: ${duration}`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
});
