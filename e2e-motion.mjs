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
  await page.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
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
  /* On a canvas's file tabs — and scoped to `main`, which is the whole reason
     this comment is longer than it was. There are two of these components on
     the page again now that the navigation rows have one, the sidebar comes
     first in the document, and `.first()` quietly changed which control this
     block was measuring. Pressing a file tab changes which file you are
     editing rather than which page you are on, so the indicator stays put
     while the rest of the page does not, which is what makes it watchable. */
  await page.locator("aside nav").getByRole("button", { name: "Creative" }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Flashcards/ }).first().click();
  await page.waitForTimeout(2600);

  const where = async () => {
    const box = await page.locator("main .relative.isolate > span[aria-hidden]").first().boundingBox();
    return box ? Math.round(box.x) : null;
  };
  const before = await where();
  check(before !== null, "the file tabs have one indicator, not a fill per tab", `x=${before}`);

  /* Sampled across the move rather than once in the middle of it. A single
     sample proves only that it had not finished yet, which a delay would also
     satisfy; a position strictly between the two ends is travel. */
  await page.getByRole("button", { name: /style\.css/ }).first().click();
  const track = [];
  for (let i = 0; i < 8; i++) {
    track.push(await where());
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(400);
  const after = await where();
  check(after !== before, "pressing another tab moves it", `${before} → ${after}`);
  const lo = Math.min(before, after), hi = Math.max(before, after);
  const between = track.filter((x) => x !== null && x > lo && x < hi);
  check(between.length > 0, "and it is caught in between on the way, rather than arriving instantly",
    `${before} → ${between.join(" → ")} → ${after}`);
  const t = await page.locator("main .relative.isolate > span[aria-hidden]").first().evaluate((n) => getComputedStyle(n).transitionDuration);
  check(t !== "0s", "because it is a transition and not a jump", t);

  await page.locator("aside nav").getByRole("button", { name: "Conversations" }).first().click();
  await page.waitForTimeout(600);
}

console.log("\nAnd so does the room you are in");
{
  /* The rooms used to be a segmented switch in the header and had this for
     free; moving them into the navigation list as rows dropped it, and for a
     while the mark for "you are here" vanished off one row and appeared on
     another with nothing joining the two. This is the same component, so it
     is the same measurement — down the list rather than across it. */
  const nav = page.locator("aside nav");
  const where = async () => {
    const box = await nav.locator(".relative.isolate > span[aria-hidden]").first().boundingBox();
    return box ? Math.round(box.y) : null;
  };

  await nav.getByRole("button", { name: "Conversations" }).click();
  await page.waitForTimeout(600);
  const before = await where();
  check(before !== null, "the rooms have one indicator, not a fill per row", `y=${before}`);

  const top = await nav.getByRole("button", { name: "Conversations" }).boundingBox();
  check(before !== null && Math.abs(before - Math.round(top.y)) <= 1,
    "and it sits on the row that is on", `indicator ${before}, row ${Math.round(top.y)}`);

  /* Sampled from inside the page, on animation frames, rather than by asking
     across the wire eight times. Two things make the round trip the wrong
     instrument here and neither applies to the file tabs above: a room change
     also starts a view transition, which holds the main thread long enough
     that whole 100ms stretches go unpainted, and each query costs more than
     the gap it is trying to resolve. In-page the frames are whatever the
     browser actually drew. */
  await page.evaluate(() => {
    window.__track = [];
    const el = document.querySelector("aside nav .relative.isolate > span[aria-hidden]");
    const t0 = performance.now();
    const tick = () => {
      window.__track.push(Math.round(el.getBoundingClientRect().y));
      if (performance.now() - t0 < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await nav.getByRole("button", { name: "Creative" }).click();
  await page.waitForTimeout(1300);
  const track = await page.evaluate(() => window.__track);
  const after = await where();
  check(after !== before, "pressing another room moves it down the list", `${before} → ${after}`);

  const row = await nav.getByRole("button", { name: "Creative" }).boundingBox();
  check(after !== null && Math.abs(after - Math.round(row.y)) <= 1,
    "and it arrives on that row rather than near it", `indicator ${after}, row ${Math.round(row.y)}`);

  /* "Somewhere that is neither end", not "between the two ends". The easing is
     a spring and it overshoots — the frame after the midpoint of this move is
     four pixels *past* the row it is landing on — so a filter that only
     accepts positions strictly between the endpoints throws away the clearest
     evidence of travel there is and calls the result a jump. */
  const moving = track.filter((y) => y !== before && y !== after);
  check(moving.length > 0, "having been caught on the way rather than arriving instantly",
    `${before} → ${moving.join(" → ")} → ${after}`);

  /* The rows keep their own marks too. The fill travelling is the change; the
     accent on the icon and the weight of the label are what say which row it
     has arrived on once it has stopped moving, and they are what a screen
     reader never sees either way — hence `aria-current`. */
  check(await nav.locator('[aria-current="true"]').count() === 1,
    "exactly one row says it is the current one, in words rather than in colour");

  await nav.getByRole("button", { name: "Conversations" }).click();
  await page.waitForTimeout(600);
}

console.log("\nRooms have a direction");
{
  await page.evaluate(SPY);
  check(await page.evaluate(() => typeof document.startViewTransition === "function"),
    "this browser can move between rooms rather than cut");
  check(await page.locator("main.vt-room").count() === 1, "the room is named, so it is animated as itself");
  await page.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator("aside nav").getByRole("button", { name: "Conversations" }).click();
  await page.waitForTimeout(700);
  const runs = await page.evaluate(() => window.__vt);
  check(runs.length === 2, "both moves ran one", JSON.stringify(runs));
  check(runs[0]?.startsWith("forward"), "down the list is forward", runs[0] ?? "");
  check(runs[1]?.startsWith("back"), "and back up it is back", runs[1] ?? "");
  check(runs.every((r) => r.endsWith("!")), "and the browser really started them, not just accepted the call");
  /* Waited for rather than guessed at. The attribute is cleared when the
     transition finishes, and a fixed sleep asserts "within 700ms" — which is a
     statement about this machine's load, not about the app. */
  const cleared = await page
    .waitForFunction(() => document.documentElement.dataset.nav === undefined, null, { timeout: 5000 })
    .then(() => true, () => false);
  check(cleared, "the direction is cleared afterwards, so an unrelated change is never accidentally directional");
}

console.log("\nThe bar travels with you");
{
  check(await page.locator(".vt-bar").count() === 1, "the message bar is named too — there is only ever one of it");
  const name = await page.locator(".vt-bar").evaluate((n) => getComputedStyle(n).viewTransitionName);
  check(name === "composer", "so the browser moves it rather than fading one out and another in", name);
  const before = await page.locator(".vt-bar").boundingBox();
  await page.getByRole("textbox", { name: "Message" }).fill("hello");
  await page.getByRole("button", { name: "Send message" }).click();

  /* While that answer is on its way, the thing that says so. */
  {
    const sheen = page.locator(".sheen").first();
    const there = await sheen.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false);
    check(there, "an answer on its way says so in a word, not a spinner",
      there ? await sheen.innerText().then((t) => t.replace(/\s+/g, " ")) : "no .sheen appeared");
    if (there) {
      const how = await sheen.evaluate((n) => {
        const cs = getComputedStyle(n);
        return { dur: cs.animationDuration, name: cs.animationName, colour: cs.color,
                 lit: cs.getPropertyValue("--sheen-lit").trim(), paint: cs.backgroundImage.slice(0, 60) };
      });
      check(how.dur !== "0s" && how.name !== "none", "with a light travelling through it", `${how.name} ${how.dur}`);
      /* The word is painted out of the gradient, which only works while the
         text itself is transparent — and a `currentColor` in that gradient
         resolves to the same transparent and leaves the word visible only
         inside the band. Asserted because it is invisible when wrong and the
         screenshot of it looks like a rendering glitch. */
      check(how.colour === "rgba(0, 0, 0, 0)", "painted out of that gradient rather than beside it", how.colour);
      check(!how.paint.includes("currentColor") && how.paint.startsWith("linear-gradient"),
        "and out of named colours, so it is legible between the sweeps", how.paint);
      /* Monochrome. This used to be the app's brightest hue on the one piece
         of text whose whole job is to stop mattering the moment words land. */
      const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
      check(!how.paint.includes(accent) && how.lit !== "", "in the text's own colours and not the accent",
        `lit ${how.lit}, accent ${accent}`);
    }
    /* And the two animations it replaced are gone from a live answer: a ring
       spinning in the corner and a bar sweeping the width of the reply, both
       claiming what the word now says on its own. */
    const live = page.locator(".live-ring").first();
    check(await live.locator(".think-orb").count() === 0, "and it is the only thing moving — no ring beside it");
    check(await live.locator(".field-line").count() === 0, "and no bar sweeping under it");
  }

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
  /* The indicator too. A view transition is refused by the code that starts
     one; this is a CSS transition on a class, so what refuses it is the
     blanket rule at the end of globals.css that caps every duration in the
     document at a hundredth of a millisecond. Which is why the number to
     assert is "near enough nothing" and not "0s" — the rule does not remove
     the transition, it makes it finish before it can be seen, and a test that
     insisted on a literal zero would have been failing an escape that works. */
  const slide = await p2
    .locator("aside nav .relative.isolate > span[aria-hidden]")
    .first()
    .evaluate((n) => parseFloat(getComputedStyle(n).transitionDuration));
  check(slide < 0.01, "and the selection arrives instead of travelling", `${slide}s`);
  await c2.close();
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
