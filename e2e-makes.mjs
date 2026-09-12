/**
 * The things you can make, driven in the frame they run in.
 *
 * A starter that renders is not a starter that works, and a screenshot cannot
 * tell the two apart: a flashcard that does not flip and one that flips
 * instantly look identical in a still. So each of these is opened, run, and
 * *used* — pressed, typed at, answered — and then asked whether the thing it
 * was supposed to do actually happened.
 *
 * The console bridge earns its keep here: every make also has to run clean.
 * An uncaught error inside the sandbox is invisible from the outside, and a
 * starter that throws on load is the worst possible first impression.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-makes.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "creative", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* The row lives in the Code room, which is the whole point: the answer to
   "make me a timetable" should not be a paragraph about timetables, and the
   place you go to make things is the room named after making them.

   It used to be offered on a blank chat page as well, gated on a Creative mode
   you switched into by hand. That switch is gone — the app reads the request —
   and the duplicate went with it rather than being left on a page with nothing
   to turn it on. */
console.log("\nThe offer");
await page.getByRole("radio", { name: "Code" }).first().click();
await page.waitForTimeout(700);
const row = page.getByRole("button", { name: "Flashcards" });
check(await row.isVisible().catch(() => false), "the Code room offers things you can make, not only things to ask");
await page.screenshot({ path: `${OUT}/makes-code.png` });

await page.getByRole("radio", { name: "Conversations" }).first().click();
await page.waitForTimeout(600);
check(!(await row.isVisible().catch(() => false)), "and a blank chat page does not — it is a different question");
await page.screenshot({ path: `${OUT}/makes-chat.png` });
await page.getByRole("radio", { name: "Code" }).first().click();
await page.waitForTimeout(700);

/** Press a make, land in Code with it running, and hand back its frame. */
async function open(name) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForTimeout(1200);
  const frame = page.frameLocator("iframe");
  await frame.locator("body").waitFor({ timeout: 8000 });
  return frame;
}
/* Back out to the Code index, which is where the row lives now. It used to
   need a second hop to a blank Creative chat page; the row is in one place
   these days, so the first half is the whole journey. */
async function back() {
  await page.getByRole("button", { name: "All canvases" }).click();
  await page.waitForTimeout(700);
}
const consoleErrors = async () => {
  const n = await page.getByRole("button", { name: /Console/ }).textContent().catch(() => "");
  return (n ?? "").replace(/\D/g, "");
};

console.log("\nFlashcards");
{
  const f = await open("Flashcards");
  check((await f.locator("#front").textContent()) === "ser" || (await f.locator("#front").innerText()).length > 0,
    "a deck is on screen, with a card face up", await f.locator("#front").innerText());
  const before = await f.locator("#front").innerText();
  await f.locator("#card").click();
  await page.waitForTimeout(700);
  const turned = await f.locator("#card").evaluate((n) => getComputedStyle(n).transform);
  check(turned !== "none" && turned !== "matrix(1, 0, 0, 1, 0, 0)", "clicking it turns the card over", turned.slice(0, 28));
  check(await f.locator(".face.back").isVisible(), "and the answer is the side facing you");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const after = await f.locator("#front").innerText();
  check(after !== before, "the right arrow moves on", `${before} → ${after}`);
  const pos = await f.locator("#pos").innerText();
  const width = await f.locator("#bar").evaluate((n) => n.style.width);
  check(pos === "2" && width !== "0%", "and the count and the bar both follow", `${pos} of 6, bar ${width}`);
  await f.locator("#again").click();
  await page.waitForTimeout(400);
  check((await f.locator("#again-note").innerText()).includes("see again"),
    "“Again” puts the card back in the queue rather than dropping it", await f.locator("#again-note").innerText());
  await page.screenshot({ path: `${OUT}/make-flashcards.png` });
  check((await consoleErrors()) === "", "it runs without a single error", "console clean");
  await back();
}

console.log("\nTimetable");
{
  const f = await open("Timetable");
  const blocks = await f.locator(".block").count();
  check(blocks === 9, "the week is laid out as blocks, not as a list", `${blocks} events`);
  const tall = await f.locator(".block").first().evaluate((n) => n.getBoundingClientRect().height);
  check(tall > 20, "and a block's height is its length", `${Math.round(tall)}px`);
  const laned = await f.locator(".lane.is-today").count();
  check(laned === 1, "today's column is marked");
  const legend = await f.locator(".legend b").count();
  check(legend >= 3, "every kind of thing gets its own colour, and a key", `${legend} tags`);
  await f.locator(".block").first().click();
  await page.waitForTimeout(400);
  check(await f.locator("#sheet-title").isVisible(), "clicking a block opens it", await f.locator("#sheet-title").innerText());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(await f.locator("#sheet").evaluate((n) => n.hidden), "and Escape closes it");
  await page.screenshot({ path: `${OUT}/make-timetable.png` });
  check((await consoleErrors()) === "", "it runs without a single error", "console clean");
  await back();
}

console.log("\nQuiz");
{
  const f = await open("Quiz");
  check((await f.locator(".options button").count()) === 4, "a question with its options");
  await f.locator(".options button").nth(2).click();
  await page.waitForTimeout(400);
  const right = await f.locator(".options button.right").count();
  const mark = await f.locator(".options button.right .key").innerText();
  check(right === 1 && mark === "✓", "answering marks the right one, with a tick and not only a colour", mark);
  check(await f.locator("#why").isVisible(), "and says why", (await f.locator("#why").innerText()).slice(0, 40) + "…");
  await f.locator("#next").click();
  await page.waitForTimeout(400);
  await f.locator(".options button").nth(0).click();
  await page.waitForTimeout(300);
  await f.locator("#next").click();
  await page.waitForTimeout(400);
  await f.locator(".options button").nth(2).click();
  await page.waitForTimeout(300);
  await f.locator("#next").click();
  await page.waitForTimeout(1300);
  check(await f.locator("#score").isVisible(), "the last answer ends it", await f.locator("#score-line").innerText());
  /* Read the score off the page rather than assuming one: the three answers
     above are all correct, so a "between 0 and 327" assertion would fail on a
     full ring for the wrong reason. */
  const [got, all] = (await f.locator("#score-line").innerText()).split(" of ").map(Number);
  const off = await f.locator("#ring").evaluate((n) => Number(getComputedStyle(n).strokeDashoffset.replace("px", "")));
  const want = 327 - (got / all) * 327;
  check(Math.abs(off - want) < 2, "and the score is drawn round the ring, not printed", `offset ${Math.round(off)}, ${got} of ${all}`);
  await page.screenshot({ path: `${OUT}/make-quiz.png` });
  check((await consoleErrors()) === "", "it runs without a single error", "console clean");
  await back();
}

console.log("\nChecklist");
{
  const f = await open("Checklist");
  const items = await f.locator(".item").count();
  check(items === 8, "a grouped list", `${items} items`);
  check((await f.locator("h2.group").count()) === 3, "under its own headings");
  await f.locator(".item").first().click();
  await page.waitForTimeout(400);
  check((await f.locator(".item.on").count()) === 1, "tapping a line ticks it");
  const drawn = await f.locator(".item.on .box path").evaluate((n) => getComputedStyle(n).strokeDashoffset);
  check(drawn.startsWith("0"), "the tick draws itself rather than appearing", `dashoffset ${drawn}`);
  check((await f.locator("#tail-count").innerText()).startsWith("1 of"), "and the count follows", await f.locator("#tail-count").innerText());
  for (let i = 1; i < items; i++) { await f.locator(".item").nth(i).click(); }
  await page.waitForTimeout(500);
  check(await f.locator("#cheer").isVisible(), "finishing the list says so", await f.locator("#cheer").innerText());
  await page.screenshot({ path: `${OUT}/make-checklist.png` });
  check((await consoleErrors()) === "", "it runs without a single error", "console clean");
  await back();
}

console.log("\nTimer");
{
  const f = await open("Timer");
  check((await f.locator("#clock").innerText()) === "25:00", "a phase, ready to go", await f.locator("#clock").innerText());
  await f.locator("#toggle").click();
  await page.waitForTimeout(1600);
  const now = await f.locator("#clock").innerText();
  check(now !== "25:00" && now.startsWith("24:"), "starting it runs the clock down", now);
  check((await f.locator("#toggle").innerText()) === "Pause", "and the button becomes the other thing");
  const swept = await f.locator("#ring").evaluate((n) => Number(getComputedStyle(n).strokeDashoffset.replace("px", "")));
  check(swept > 0, "the ring sweeps with it", `offset ${swept.toFixed(1)}`);
  await f.locator("#toggle").click();
  const held = await f.locator("#clock").innerText();
  await page.waitForTimeout(1400);
  check((await f.locator("#clock").innerText()) === held, "pausing stops it where it is", held);
  await f.locator("#skip").click();
  await page.waitForTimeout(400);
  /* textContent, not innerText: the heading is uppercased by CSS, and asking
     for the rendered text would be testing the stylesheet. */
  const phase = await f.locator("#phase-name").textContent();
  check(phase === "Break", "and skip moves to the next phase", phase ?? "");
  await page.screenshot({ path: `${OUT}/make-timer.png` });
  check((await consoleErrors()) === "", "it runs without a single error", "console clean");
}

console.log("\nAfterwards");
{
  const box = page.getByRole("textbox", { name: "Ask for a change" });
  const seeded = await box.inputValue();
  check(seeded.length > 0, "the box under it is not blank — the starter left its half of the sentence", `“${seeded}”`);
  check((await page.getByRole("button", { name: "Ask for a change" }).count()) === 0,
    "and the box and its button do not answer to the same name");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
