/**
 * Watching it work.
 *
 * Chat streamed from the beginning. Everything else in the app was built on the
 * one-shot path — right for generating a conversation title, wrong for anything
 * a person is sitting in front of. The tokens were always arriving a few at a
 * time; they were being poured into a buffer nobody could see, so a revision of
 * a long file was a spinner with no way to tell thinking from hung, no idea how
 * far along it was, and nothing to press.
 *
 * Two claims, and the second is the one worth being careful about:
 *
 *   1. you can see it arriving, and you can stop it;
 *   2. stopping a *file* changes nothing, because a file that stopped arriving
 *      is a file with its end missing — and a diff of that reads as "the rest
 *      was deleted". A stopped *review* is kept, because half a review is half
 *      a review. Same abort, opposite handling, and getting it the other way
 *      round is how pressing stop silently truncates somebody's code.
 *
 *   node mock-slow.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-watch.mjs
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

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

/* A real file's worth, on purpose. The mock streams 14 characters every 140ms,
   so a seven-line toy finishes before the first assertion can look at it —
   which is also the honest reason this feature exists: nobody minds a spinner
   for a second, and everybody minds one for forty. */
const SOURCE = Array.from({ length: 22 }, (_, i) => `
export function step${i}(items, options) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    out.push(transform(items[i], options.mode${i}));
  }
  return out;
}
`).join("");

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("radio", { name: "Code" }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Code file/ }).click();
await page.waitForTimeout(900);
const area = page.getByLabel("Canvas content");
await area.click();
await area.fill(SOURCE);
await page.waitForTimeout(800);

console.log("\nThe answer, arriving");
{
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("use map instead of the loop");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(1100);

  const shown = await page.locator("main").innerText();
  check(/Writing the change/i.test(shown), "it says what it is doing, not just that it is busy");
  check(/characters/.test(shown), "and how far it has got");
  await page.screenshot({ path: `${OUT}/watch-live.png` });

  // Growing, not a spinner: the number has to actually move.
  const first = Number((shown.match(/([\d,]+) characters/) ?? [0, "0"])[1].replace(/,/g, ""));
  await page.waitForTimeout(1300);
  const later = await page.locator("main").innerText();
  const second = Number((later.match(/([\d,]+) characters/) ?? [0, "0"])[1].replace(/,/g, ""));
  check(second > first, "and the count moves, which a spinner cannot tell you", `${first} → ${second}`);

  check((await page.getByRole("button", { name: "Stop generating" }).count()) === 1,
    "with the send button turned into stop, in place");
}

console.log("\nStopping a file changes nothing");
{
  const before = await area.inputValue();
  await page.getByRole("button", { name: "Stop generating" }).click();
  await page.waitForTimeout(1400);

  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 0,
    "a half-written file is never offered as a change — a diff of it would read as “the rest was deleted”");
  check(await area.inputValue() === before, "the file is exactly as it was");
  const shown = await page.locator("main").innerText();
  check(/Stopped\. Nothing was changed\./.test(shown), "and it says so plainly", "Stopped. Nothing was changed.");
  check(!/Writing the change/i.test(shown), "the pane goes away rather than sitting there finished");
  await page.screenshot({ path: `${OUT}/watch-stopped.png` });
}

console.log("\nBut half a review is worth keeping");
{
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.waitForTimeout(1500);
  const during = await page.locator("main").innerText();
  check(/Reading it/i.test(during), "a review says what it is doing too", "Reading it");

  await page.getByRole("button", { name: "Stop generating" }).click();
  await page.waitForTimeout(1400);

  const shown = await page.locator("main").innerText();
  check(/Stopped — this is as far as it got/.test(shown),
    "stopping it keeps what arrived, and says that is what it is");
  check(/REVIEW/i.test(shown), "the partial review is on screen rather than thrown away");
  await page.screenshot({ path: `${OUT}/watch-partial.png` });
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
