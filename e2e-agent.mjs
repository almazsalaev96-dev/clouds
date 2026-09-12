/**
 * The parts of an agent workflow a browser can actually honour.
 *
 * Terminal agents get their leverage from a loop this app does not have: run
 * the tests, read the failure, fix, run again. There is no shell here and
 * there are no tests, so most of that list is not available and pretending
 * otherwise would be theatre. Four of them are real, and they are the four
 * that were missing:
 *
 *   plan     say what you would change before changing anything, in steps
 *            that can be approved one at a time
 *   rules    the things that are true of this file every time, said once
 *   check    look at the change again before keeping it
 *   fix      a failure the page actually produced, turned into an edit
 *
 * The last one is the loop, as far as a browser goes: a web canvas genuinely
 * runs, and its console genuinely comes back.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-agent.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
/* The last section breaks the page on purpose to get a real error out of a
   real run, and that error reaches this handler like any other. Flagged rather
   than filtered by message: a suite that ignores errors matching a pattern
   ignores the regression that happens to match it. */
let breaking = false;
page.on("pageerror", (e) => { if (!breaking) errs.push("PAGE: " + e.message); });
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const last = async () => JSON.stringify(await (await fetch("http://127.0.0.1:8787/__last")).json());
/* What the file said before the change now waiting on a decision. The editor
   is not on screen while a diff is — the diff replaces it — so "checking did
   not change anything" has to be asked after discarding, not during. */
let fileBeforeAsk = "";

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const SOURCE = `export function slow(items) {
  let out = [];
  for (let i = 0; i < items.length; i++) {
    out = out.concat([items[i] * 2]);
  }
  return out;
}
`;

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Code" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Code file/ }).click();
await page.waitForTimeout(900);
const area = page.getByLabel("Canvas content");
await area.click();
await area.fill(SOURCE);
await page.waitForTimeout(800);

console.log("\nSaying what it would do, before it does it");
{
  await page.getByRole("button", { name: "Plan" }).click();
  await page.waitForTimeout(2600);

  const asked = await last();
  check(/Plan how you would change this/.test(asked), "the model is asked to plan rather than to edit");
  check(/Do NOT write the change/.test(asked), "and told in as many words not to write it");
  check(/an invented step costs more than an honest nothing/i.test(asked),
    "with permission to find nothing — a plan that must produce steps produces them");

  check((await page.getByText("Plan — nothing has changed yet").count()) === 1,
    "the panel says the file is untouched, because that is the whole promise");
  const steps = page.getByRole("button", { name: /^Do this step:/ });
  check((await steps.count()) === 2, "each step is a thing you can press", `${await steps.count()} steps`);
  check(await area.inputValue() === SOURCE, "and nothing has been changed yet");

  /* The names are the point: four buttons reading "Do this" are four buttons
     a screen reader cannot tell apart, and the name is all it announces. */
  const names = await steps.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check(new Set(names).size === names.length, "the steps are told apart by name, not by position", names[0]);
  await page.screenshot({ path: `${OUT}/agent-plan.png` });
}

console.log("\nApproving one step at a time");
{
  await page.getByRole("button", { name: /^Do this step:/ }).first().click();
  await page.waitForTimeout(2600);

  const asked = await last();
  check(/Replace the concat in the loop with a push/.test(asked),
    "the step is sent as the instruction it was written to be — no retyping in between");
  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 1,
    "and it arrives as a diff like every other change");

  await page.getByRole("button", { name: /^Keep/ }).click();
  await page.waitForTimeout(1000);
  const done = await page.getByRole("button", { name: /^Do again:/ }).count();
  check(done === 1, "keeping it ticks that step off");
  check((await page.getByRole("button", { name: /^Do this step:/ }).count()) === 1,
    "and leaves the other one to do");
}

console.log("\nThings that are true every time");
{
  await page.getByRole("button", { name: /^House rules/ }).click();
  await page.waitForTimeout(400);
  const box = page.getByLabel("House rules for this file");
  check(await box.isVisible(), "there is somewhere to put them");
  await box.fill("Never use var. Every function gets a JSDoc block.");
  await page.waitForTimeout(600);

  /* Set once, then survive a reload and a walk back in: a rule you have to
     retype at the top of every request is the thing rules replace. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.getByRole("button", { name: "Code" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Untitled/ }).first().click();
  await page.waitForTimeout(1200);
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  fileBeforeAsk = await area.inputValue();
  await bar.fill("add a second helper");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2600);

  const asked = await last();
  check(/Never use var\. Every function gets a JSDoc block\./.test(asked),
    "and they ride along with a change asked for after a reload");
  /* The heading is no longer "for this file": rules now arrive in two layers,
     the project's and the file's, and the body says which is which. */
  check(/STANDING RULES/.test(asked) && /For this file in particular/.test(asked),
    "marked as standing, and as being this file's rather than the project's");
  check(asked.indexOf("STANDING RULES") > asked.indexOf("add a second helper"),
    "after the instruction, so the rule wins when the two disagree");
}

console.log("\nLooking again before keeping it");
{
  check((await page.getByRole("button", { name: /Check it/ }).count()) === 1,
    "the diff offers a second look");
  await page.getByRole("button", { name: /Check it/ }).click();
  await page.waitForTimeout(2600);

  const asked = await last();
  check(/A change was just made to this/.test(asked), "the check is about the change");
  check(asked.includes("BEFORE") && asked.includes("AFTER") && /export function slow/.test(asked),
    "and is given both sides of it, not just the result");
  check(/Do not rewrite anything\. This is a check\./.test(asked), "with no licence to edit");
  check(/is a correct and welcome answer/.test(asked),
    "and permission to say it is fine — a checker that must object, objects");

  check((await page.getByText("Check of this change").count()) === 1, "the answer lands under the diff");
  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 1,
    "and the decision is still yours to make");
  await page.screenshot({ path: `${OUT}/agent-check.png` });

  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(800);
  check(await area.inputValue() === fileBeforeAsk,
    "and a change you checked and then discarded leaves the file exactly as it was");
}

console.log("\nAn error the page actually produced");
{
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.getByRole("button", { name: "Code" }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Web app/ }).click();
  await page.waitForTimeout(1600);

  // Break it on purpose, in the file the console will have to name.
  breaking = true;
  await page.locator("button[aria-current]").filter({ hasText: "app.js" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Stop$/ }).click();
  await page.waitForTimeout(300);
  const js = page.getByLabel("Canvas content");
  await js.fill("missingFunction();\n");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Run$/ }).click();
  /* No click on Console: an error opens the drawer by itself, and clicking it
     here closes the thing the assertions are about. */
  await page.waitForTimeout(2000);

  const fix = page.getByRole("button", { name: /^Fix this error:/ });
  check((await fix.count()) >= 1, "an error in the console is a thing you can act on");
  const label = await fix.first().getAttribute("aria-label");
  check(/missingFunction|is not defined/.test(label ?? ""),
    "and the button says which error it is about", (label ?? "").slice(0, 60));
  await page.screenshot({ path: `${OUT}/agent-fix.png` });

  await fix.first().click();
  await page.waitForTimeout(2800);
  const asked = await last();
  check(/This file was just run and it produced the error below/.test(asked),
    "the request carries what actually happened, not a description of the code");
  check(/is not defined/.test(asked), "including the error itself");
  check(/Not the symptom/.test(asked),
    "and asks for the cause, not a guard around the line that threw");
  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 1,
    "and the fix arrives as a diff — nothing lands unseen, least of all in a hurry");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
