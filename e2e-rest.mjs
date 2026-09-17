/**
 * The bar at rest, and a thumbs-down that does something.
 *
 * Every one of the big assistants keeps the composer to a single row until
 * you write more than a line: controls beside the line, not under it. This
 * app stacked them from the first keystroke, which cost forty pixels of
 * every screen for a row of buttons nobody was pressing yet. So: at rest the
 * bar is one row and inside 52-64px; write past a line and it opens into
 * text-over-controls; empty it and it closes. A canvas, which carries its
 * shortcuts above the line, is stacked from the start — that is measured too,
 * because it is the case the single-row logic has to yield to.
 *
 * And the thumbs. Up is one press. Down asks why, and the reason chosen
 * produces another attempt at the same question — a message in the thread,
 * not a mark in a log — as a second version of the answer, the first kept
 * a step back.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-rest.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

const shell = () => p.locator(".composer-shell").first();
const box = p.locator(".composer-shell textarea").first();
/* Where the line sits against the send disc: same row means their vertical
   centres are within a few pixels; stacked means the line is well above. */
const arrangement = async () => {
  const t = await box.boundingBox();
  const s = await p.getByRole("button", { name: "Send message" }).boundingBox();
  const tc = t.y + t.height / 2, sc = s.y + s.height / 2;
  return Math.abs(tc - sc) < 12 ? "row" : "stacked";
};

console.log("\nThe bar at rest");
{
  const h = (await shell().boundingBox()).height;
  check(h >= 52 && h <= 64, "is one row, inside the band every assistant keeps", `${Math.round(h)}px`);
  check(await arrangement() === "row", "with the line beside the controls, not above them");
}

console.log("\nAnd it opens when you write past a line");
{
  await box.fill("A sentence long enough to wrap in the space beside the controls, which is what makes the bar open into the stacked arrangement rather than staying a single row.");
  await p.waitForTimeout(150);
  check(await arrangement() === "stacked", "the line takes the full width and the controls drop beneath it");
  const h = (await shell().boundingBox()).height;
  check(h > 64, "and the bar is taller than its resting band", `${Math.round(h)}px`);
  await box.fill("short");
  await p.waitForTimeout(150);
  check(await arrangement() === "stacked", "it stays open while there is text — a bar that flipped under the caret would be worse than one that never opened");
  await box.fill("");
  await p.waitForTimeout(150);
  check(await arrangement() === "row", "and closes once it is emptied");
}

console.log("\nA canvas is stacked from the start");
{
  await p.locator("aside nav").getByRole("button", { name: "Artifacts" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Web app/ }).click();
  await p.waitForTimeout(1400);
  await p.getByRole("button", { name: /^Stop$/ }).click().catch(() => {});
  await p.waitForTimeout(400);
  check(await arrangement() === "stacked", "because its shortcuts sit above the line and want the full width beneath them");
  await p.locator("aside nav").getByRole("button", { name: "Conversations" }).click();
  await p.waitForTimeout(500);
}

console.log("\nA thumbs-down that does something");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  await box.fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);
  const before = await p.locator(".msg").count();
  check(await p.getByRole("button", { name: "Good answer" }).count() === 1, "the answer offers a thumbs up");
  await p.getByRole("button", { name: "Not good" }).click();
  await p.waitForTimeout(200);
  const why = p.getByRole("group", { name: "What was wrong" });
  check(await why.count() === 1, "a thumbs-down asks why, once, in place");
  await why.getByRole("button", { name: "Too long" }).click();
  await p.waitForTimeout(3200);
  check(await p.getByRole("group", { name: "What was wrong" }).count() === 0, "the question closes once answered");
  /* The second attempt is a sibling of the first, not a message after it:
     the thread stays the same length and a pager appears on the answer,
     the way a regenerate does everywhere else. The marked one is version
     one, a step back. */
  check(await p.locator(".msg").count() === before, "and the new attempt replaces the old one in the thread rather than following it", `${before} → ${await p.locator(".msg").count()} messages`);
  const pager = p.getByRole("button", { name: "Previous version" });
  check(await pager.count() === 1 && await pager.isEnabled(), "with a pager on the answer, and version two showing");
  check(await p.getByRole("button", { name: "Marked not good" }).count() === 0, "the new attempt carries no mark of its own");
  await pager.click();
  await p.waitForTimeout(300);
  check(await p.getByRole("button", { name: "Marked not good" }).count() === 1, "and the mark stays on the answer it was given to, one step back");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
