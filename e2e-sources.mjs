/**
 * Bring your world, and be able to check what it says about it.
 *
 * The notebook used to hold exactly one source, in memory, for as long as you
 * stayed on the page — which made it a converter rather than a place. It could
 * turn a book into lessons and then had no idea the book existed, so the only
 * question worth asking about a page somebody's model wrote had no answer:
 * where did that come from.
 *
 * The claim being tested here is stronger than "it cites its sources". Asking
 * a model for citations gets citations; it does not get *true* ones, because a
 * plausible page reference is as easy to produce as a plausible sentence and
 * much harder to notice. So the model is asked to quote, and the app goes and
 * looks for the words. The mock deliberately invents one of its three
 * citations, and the interesting assertion in this file is what happens to it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-sources.mjs
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

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const REPORT = `Quarterly review, internal.

The northern region grew by twenty-seven percent over the quarter, which nobody on the forecasting team had predicted.

Costs held flat despite the additional volume, largely because the new depot absorbed the overflow without extra staff.

The southern region was broadly unchanged and remains the weaker of the two.
`;

const NOTES = `Meeting notes, 3rd of the month.

Everyone agreed the depot decision looks better in hindsight than it did at the time.
`;

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Notebook/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /New page|New note/i }).first().click();
await page.waitForTimeout(1000);

console.log("\nBringing more than one thing");
{
  const input = page.locator('input[aria-label="Choose something to read"]');
  await input.setInputFiles({ name: "report.md", mimeType: "text/markdown", buffer: Buffer.from(REPORT) });
  await page.waitForTimeout(900);
  await input.setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from(NOTES) });
  await page.waitForTimeout(900);

  const shown = await page.locator("main").innerText();
  check(/report\.md/.test(shown) && /notes\.md/.test(shown),
    "a page can be made from several things at once, not one");

  /* Kept, not held for the session — the whole difference between a place and
     a converter. Reloaded and walked back in, because that is the journey a
     source has to survive, not a re-render. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /^Untitled note/ }).first().click();
  await page.waitForTimeout(1200);
  const after = await page.locator("main").innerText();
  check(/report\.md/.test(after) && /notes\.md/.test(after),
    "and they are still there after a reload — kept, not held for the session");
  await page.screenshot({ path: `${OUT}/sources-list.png` });
}

console.log("\nAsked to quote rather than to reference");
{
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("summarise what these say");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(3200);

  const asked = await last();
  check(/Make what is asked for below, out of the material/.test(asked),
    "the request is to make something out of the material");
  check(/Quote, do not paraphrase/.test(asked),
    "and the citation it is asked for is a quotation, not a page number");
  check(/checked against the file character by character/.test(asked),
    "told that the words will be checked, because they will be");
  check(/report\.md/.test(asked) && /notes\.md/.test(asked) && /twenty-seven percent/.test(asked),
    "with every source sent, not just the last one attached");
}

console.log("\nAnd the app checks them itself");
{
  const shown = await page.locator("main").innerText();
  check(!/\[\[cite:/.test(shown), "none of the machinery reaches the page");
  check(/\[1\]/.test(shown) || /1/.test(shown), "each claim carries a marker");
  /* The mock invents its third citation. If the app were trusting the model,
     this would look exactly like the other two. */
  check(/\?/.test(shown),
    "and an invented citation is marked differently from a real one, before it is even opened");

  const notice = shown;
  check(/could not be found in the sources/.test(notice),
    "with a count said out loud rather than left to be noticed",
    (notice.split("\n").find((l) => /could not be found/.test(l)) ?? "").slice(0, 70));
  await page.screenshot({ path: `${OUT}/sources-diff.png` });

  await page.getByRole("button", { name: /^Keep/ }).click();
  await page.waitForTimeout(1200);
}

console.log("\nOpening a claim");
{
  await page.getByRole("button", { name: /Preview|Read/ }).first().click().catch(() => {});
  await page.waitForTimeout(700);

  const links = page.locator('a[href^="#armi-cite-"]');
  const n = await links.count();
  check(n === 3, "every claim on the page is a thing you can press", `${n} markers`);

  await links.first().click();
  await page.waitForTimeout(600);
  const panel = await page.locator("main").innerText();
  check(/IN THE SOURCE/i.test(panel) && !/NOT FOUND/i.test(panel),
    "pressing one shows the passage it came from");
  check(/report\.md/.test(panel), "naming the file it is in");
  check(/twenty-seven percent/.test(panel),
    "with the quoted words shown where they actually sit");
  await page.screenshot({ path: `${OUT}/sources-cite.png` });

  // The invented one — the assertion this whole file exists for.
  await links.last().click();
  await page.waitForTimeout(600);
  const bad = await page.locator("main").innerText();
  check(/NOT FOUND IN THE SOURCE/i.test(bad),
    "and the invented one says so plainly rather than quietly failing to open");
  check(/treat it as the model/.test(bad),
    "telling the reader what to do about it");
  await page.screenshot({ path: `${OUT}/sources-bad.png` });
}

console.log("\nA page knows when its sources have moved on");
{
  const shownBefore = await page.locator("main").innerText();
  check(!/since this page was made/.test(shownBefore), "a page nobody has changed says nothing");

  const put = page.getByRole("button", { name: /Put notes\.md away/ });
  await put.click();
  await page.waitForTimeout(1000);

  const shown = await page.locator("main").innerText();
  check(/since this page was made/.test(shown),
    "removing a source says so — the page still says what it said then",
    (shown.split("\n").find((l) => /since this page/.test(l)) ?? "").slice(0, 70));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
