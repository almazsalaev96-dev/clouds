/**
 * The motion, asked for rather than admired.
 *
 * Animation is the easiest thing in an interface to believe you have shipped:
 * it looks right in the browser you wrote it in, and it is silently absent in
 * production because a class name changed or a build step dropped a rule. So
 * none of this is judged by eye. The indicator is asked where it is before and
 * after a click and has to have *travelled*; the view transition is asked
 * whether the browser actually started one; the named elements are asked
 * whether they carry their names.
 *
 * And the setting that turns all of it off is checked, because motion you
 * cannot refuse is not a feature.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-motion.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

async function open(reducedMotion) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return { ctx, page };
}

/* Every view transition this session, recorded as it starts. Patching the
   method is the only honest way to ask "did one actually run" — the pseudo
   elements it creates are not reachable from script. */
const SPY = `(() => {
  window.__vt = [];
  const real = document.startViewTransition;
  if (!real) return;
  document.startViewTransition = function (cb) {
    window.__vt.push(document.documentElement.dataset.nav ?? "?");
    const t = real.call(document, cb);
    t.ready.then(() => window.__vt[window.__vt.length - 1] += "!", () => {});
    return t;
  };
})()`;

const { ctx, page } = await open("no-preference");

console.log("\nThe selection slides");
{
  const where = async () => {
    const box = await page.locator(".composer-shell [role='radiogroup'][aria-label='Mode'] span[aria-hidden]").boundingBox();
    return box ? Math.round(box.x) : null;
  };
  const before = await where();
  check(before !== null, "the mode switch has one indicator, not a fill per button", `x=${before}`);

  /* Sampled across the move rather than once in the middle of it. A single
     sample proves only that it had not finished yet, which a delay would also
     satisfy; a position strictly between the two ends is travel. */
  await page.getByRole("radio", { name: "Creative", exact: true }).click();
  const track = [];
  for (let i = 0; i < 8; i++) {
    track.push(await where());
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(400);
  const after = await where();
  check(after !== before, "clicking the other option moves it", `${before} → ${after}`);
  const lo = Math.min(before, after), hi = Math.max(before, after);
  const between = track.filter((x) => x !== null && x > lo && x < hi);
  check(between.length > 0, "and it is caught in between on the way, rather than arriving instantly",
    `${before} → ${between.join(" → ")} → ${after}`);
  const t = await page.locator(".composer-shell [role='radiogroup'][aria-label='Mode'] span[aria-hidden]").evaluate((n) => getComputedStyle(n).transitionDuration);
  check(t !== "0s", "because it is a transition and not a jump", t);
}

console.log("\nRooms have a direction");
{
  await page.evaluate(SPY);
  check(await page.evaluate(() => typeof document.startViewTransition === "function"),
    "this browser can move between rooms rather than cut");
  check(await page.locator("main.vt-room").count() === 1, "the room is named, so it is animated as itself");
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("radio", { name: "Conversations" }).click();
  await page.waitForTimeout(700);
  const runs = await page.evaluate(() => window.__vt);
  check(runs.length === 2, "both moves ran one", JSON.stringify(runs));
  check(runs[0]?.startsWith("forward"), "down the list is forward", runs[0] ?? "");
  check(runs[1]?.startsWith("back"), "and back up it is back", runs[1] ?? "");
  check(runs.every((r) => r.endsWith("!")), "and the browser really started them, not just accepted the call");
  check(await page.evaluate(() => document.documentElement.dataset.nav) === undefined,
    "the direction is cleared afterwards, so an unrelated change is never accidentally directional");
}

console.log("\nThe bar travels with you");
{
  check(await page.locator(".vt-bar").count() === 1, "the message bar is named too — there is only ever one of it");
  const name = await page.locator(".vt-bar").evaluate((n) => getComputedStyle(n).viewTransitionName);
  check(name === "composer", "so the browser moves it rather than fading one out and another in", name);
  const before = await page.locator(".vt-bar").boundingBox();
  await page.getByRole("textbox", { name: "Message" }).fill("hello");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2600);
  const after = await page.locator(".vt-bar").boundingBox();
  check(after.y - before.y > 100, "and on the first send it has a long way to go", `${Math.round(before.y)} → ${Math.round(after.y)}`);
  await page.screenshot({ path: `${OUT}/motion-docked.png` });
}

await ctx.close();

console.log("\nAnd all of it can be refused");
{
  const { ctx: c2, page: p2 } = await open("reduce");
  await p2.evaluate(SPY);
  await p2.getByRole("button", { name: "Notebook", exact: true }).click();
  await p2.waitForTimeout(600);
  check((await p2.evaluate(() => window.__vt)).length === 0,
    "with reduced motion the room change does not start a transition at all");
  const named = await p2.locator("main.vt-room").evaluate((n) => getComputedStyle(n).viewTransitionName);
  check(named === "none", "and nothing is named, so nothing can be animated as itself", named);
  await c2.close();
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
