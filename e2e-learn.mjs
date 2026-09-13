/**
 * The app gets better at deciding, because it watches what happens.
 *
 * Every turn is answered with a decision — what kind of job this is, which
 * model, how hard to think, whether the answer needs checking — and until
 * now every one of those decisions was thrown away the moment the answer
 * went out. So the thousandth request was answered by exactly the same
 * reasoning as the first, however badly the first went.
 *
 * Now the decision is written down with what became of it, and the only
 * honest measure of an answer is what the person did about it: a
 * thumbs-down, a regenerate, a Tighten and a rewritten question all mean
 * the same thing. Once enough answers of one shape from one model have
 * needed another go, the next one of that shape is checked by a second
 * model without anybody asking for it.
 *
 * Two providers, because a second opinion from the same model is the same
 * model agreeing with itself.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=… OPENAI_BASE_URL=… npx next start -p 3100
 *   node e2e-learn.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const box = p.locator(".composer-shell textarea").first();
const turns = () => p.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => {
    const q = r.result.transaction("turns").objectStore("turns").getAll();
    q.onsuccess = () => { r.result.close(); ok(q.result); };
  };
}));
/* A fresh thread each time: the point is four answers of the same shape, not
   one conversation that drifts into another kind of work. */
const askCoding = async (q) => {
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(250);
  await box.fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);
};
const thumbDown = async () => {
  await p.getByRole("button", { name: "Not good" }).last().click();
  await p.waitForTimeout(250);
  await p.getByRole("group", { name: "What was wrong" }).getByRole("button", { name: "Skip" }).click();
  await p.waitForTimeout(250);
};

console.log("\nWhat was decided is written down");
{
  await askCoding("write a function that debounces calls in javascript");
  const rows = await turns();
  check(rows.length === 1, "one answer, one decision recorded", `${rows.length} rows`);
  const t = rows[0];
  check(t.kind === "coding", "with what kind of work it was read as", t.kind);
  check(t.strategy === "answer" && t.check === "lint", "what it decided to do about it", `${t.strategy}/${t.check}`);
  check(typeof t.ms === "number" && t.ms > 0, "and what it cost", `${t.ms}ms`);
  check(!t.outcome, "with nothing yet said about whether it was any good");
}

console.log("\nAnd what the person did about it");
{
  await thumbDown();
  const t = (await turns())[0];
  check(t.outcome === "bad", "a thumbs-down is the answer not being worth having", String(t.outcome));
}

console.log("\nFour like that, and the next one is checked without being asked");
{
  for (const q of [
    "write a python function that sorts a list of objects by key",
    "debug this javascript function, it throws a TypeError on empty input",
    "write a typescript function that retries a failed fetch",
  ]) {
    await askCoding(q);
    await thumbDown();
  }
  const before = await turns();
  const bad = before.filter((t) => t.kind === "coding" && t.outcome && t.outcome !== "good").length;
  check(bad >= 4, "four answers of one shape have now needed another go", `${bad} of ${before.length}`);

  await askCoding("write a javascript function that formats a date");
  /* The check runs on its own, after the answer. */
  await p.waitForTimeout(3500);
  check(await p.getByText("Second opinion").count() >= 1, "the next answer of that shape arrives already checked");
  const t = (await turns()).find((x) => !x.outcome && x.kind === "coding");
  check(t?.check === "second", "and the decision says that is what it decided to do", String(t?.check));
  check(/needed another go/.test(t?.why ?? ""), "in the words a person would use", t?.why ?? "");
}

console.log("\nIt says what it thinks it knows, and can be made to forget it");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Memory" }).click();
  await p.waitForTimeout(400);
  const learned = p.getByRole("list", { name: "What the app has learned" });
  check(await learned.count() === 1, "Settings shows the record it is acting on");
  check(/coding/.test(await learned.innerText()), "naming the kind of work and the model", (await learned.innerText()).split("\n")[0]);
  check(/checking/.test(await learned.innerText()), "and marking the one it is now checking");
  await p.getByRole("button", { name: "Forget what it learned" }).click();
  await p.waitForTimeout(500);
  check((await turns()).length === 0, "and it can be forgotten", `${(await turns()).length} rows`);
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
