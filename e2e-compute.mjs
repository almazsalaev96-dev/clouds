/**
 * A number that was worked out, not remembered.
 *
 * The one class of question where being fluent is dangerous: a model asked
 * for the average of ten numbers writes a number that looks exactly like
 * the right one. ChatGPT, Claude and Gemini all solved it the same way —
 * let the model write the computation and then actually run it — and this
 * is that loop, end to end: the answer carries a calculation, the app runs
 * it in a sandbox, the output appears under the answer, and the reply that
 * follows is written from the output rather than from a memory of it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-compute.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const box = p.locator(".composer-shell textarea").first();
const worked = p.getByRole("group", { name: "Worked out" });

console.log("\nThe model says it will work it out, and the app works it out");
{
  await box.fill("what is the average of 12, 47, 8, 93, 16, 55, 4, 71, 28, 60");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);

  check(await worked.count() === 1, "the answer carries a calculation, shown as one");
  const out = await worked.innerText();
  check(/mean 39\.4/.test(out), "and what is under it is what the code printed", out.replace(/\n/g, " · ").slice(0, 70));
  check(/count 10/.test(out) && /total 394/.test(out), "every line of it, in order");
  check(!/reduce|const xs/.test(out), "the code itself is not in the way — it is behind a press");
}

console.log("\nThe working is one press away");
{
  await worked.getByRole("button", { name: /Working/ }).click();
  await p.waitForTimeout(300);
  check(/reduce/.test(await worked.innerText()), "pressing it shows the code that produced the numbers");
  await worked.getByRole("button", { name: /Working/ }).click();
  await p.waitForTimeout(200);
}

console.log("\nAnd the answer that follows is written from the output");
{
  await p.waitForTimeout(3000);
  const msgs = await p.locator(".msg").count();
  check(msgs >= 3, "a reply follows the calculation on its own", `${msgs} messages`);
  const last = await p.locator(".msg").last().innerText();
  check(/39\.4/.test(last), "carrying the number the code printed", last.slice(0, 60));
  check(await p.getByRole("group", { name: "Worked out" }).count() === 1,
    "and it does not carry a second calculation of its own");
}

console.log("\nIt is asked for once, not on every reading");
{
  /* The block re-runs whenever the conversation is reopened, which is free
     and gives the same numbers. The turn it produces must not happen twice,
     and the mark that stops it has to survive a reload — which is the whole
     reason it is on the message rather than in memory. */
  const before = await p.locator(".msg").count();
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(4500);
  const after = await p.locator(".msg").count();
  check(after === before, "reopening the conversation does not ask for another answer", `${before} → ${after}`);
  const again = await p.getByRole("group", { name: "Worked out" }).innerText();
  check(/mean 39\.4/.test(again), "though the calculation is run again on sight, and prints the same thing");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
