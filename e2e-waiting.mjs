/**
 * What you see while the cast works, and what Stop does to it.
 *
 * The claims: on a full cast the status line names the stage before
 * anything streams (another company reading the question first; the
 * council sitting), Stop is offered from the first moment and the box
 * does not take a second question; pressing Stop during the brief ends
 * the turn with no answer and no further calls, and the line clears;
 * after an answer a line says a second company is checking it while the
 * verdict is on its way; and an answer that lands in a hidden tab puts
 * "Answer ready" in the tab's name until the tab is looked at.
 *
 *   bash /tmp/claude-0/two.sh e2e-waiting   (needs both companies on the mock)
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "astro", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const recent = async () => (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];
const ASK = "Should the school move to a four-day week next year? Weigh the money, the staff, and the exam results, and tell me what you would do.";

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe stage is named before anything streams, and Stop is there");
{
  await fetch(`${MOCK}/__reset`);
  /* A brief that takes as long as a real one, so the screen can be read
     while it is out. */
  await fetch(`${MOCK}/__slow?kind=brief&ms=2500`);
  const box = p.getByRole("textbox", { name: "Message" });
  await box.fill(ASK);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(600);
  const status = p.getByRole("status").filter({ hasText: /reading the question first/ });
  check(await status.isVisible(), "the line says another company is reading the question first", (await status.innerText().catch(() => "")).slice(0, 80));
  check(await p.getByRole("button", { name: "Stop generating" }).isVisible(), "and Stop is offered from the first moment");
  await box.fill("a second question typed too soon");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  const calls = await recent();
  check(calls.filter((r) => r.kind === "answer").length === 0, "the box does not send a second question while the cast is working", calls.map((r) => r.kind).join(" "));
  await p.getByRole("button", { name: "Stop generating" }).click();
  await p.waitForTimeout(1200);
  check((await p.getByRole("status").filter({ hasText: /reading the question|Council/ }).count()) === 0, "Stop clears the line");
  check(await p.getByRole("button", { name: "Stop generating" }).count() === 0, "and the Stop button goes");
  await p.waitForTimeout(2500);
  const after = await recent();
  check(!after.some((r) => r.kind === "answer" || r.kind === "council"), "no answer and no council were bought after Stop", after.map((r) => r.kind).join(" "));
  const main = await p.locator("main").innerText();
  check(main.includes("Should the school move to a four-day week") && !/Debounce|debounce waits/.test(main), "the question stays in the thread, unanswered, for a retry");
}

console.log("\nThe check is visible while it runs, and the tab says when the answer landed");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  /* A hidden tab, as far as the page can tell. */
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); });
  await p.getByRole("textbox", { name: "Message" }).fill(ASK);
  await p.keyboard.press("Enter");
  let sawChecking = false;
  for (let i = 0; i < 120 && !sawChecking; i += 1) {
    sawChecking = (await p.getByRole("status").filter({ hasText: /checking this answer/ }).count()) > 0;
    if (!sawChecking) await p.waitForTimeout(100);
  }
  check(sawChecking, "under the finished answer, a line says a second company is checking it");
  await p.waitForTimeout(6000);
  check((await p.getByRole("status").filter({ hasText: /checking this answer/ }).count()) === 0, "which goes when the verdict lands");
  check(/A second model|second opinion|partly|agrees/i.test(await p.locator("main").innerText()), "and the verdict is on the page");
  check((await p.title()).startsWith("Answer ready"), "the tab's name says the answer is ready", await p.title());
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(200);
  check(!(await p.title()).startsWith("Answer ready"), "and goes back to its own name once the tab is looked at", await p.title());
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
