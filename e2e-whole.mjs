/**
 * The project, as something the code is part of.
 *
 * A project already held instructions and material that every chat inside it
 * could see. The code in that same project could not — so the conventions you
 * wrote once, for the thing you were building, were the one context missing
 * from every edit to the thing you were building. And there was no way to ask
 * a question about the project as a whole: you could ask about the file you
 * had open, which means you had to know the answer to ask the question.
 *
 * Three claims, each read at the wire or out of the database rather than
 * inferred from what the screen says:
 *
 *   1. a canvas can belong to a project, and says so;
 *   2. the project's instructions reach every edit made in it, ahead of the
 *      file's own rules, so the narrower one can win;
 *   3. a question is answered across every file in the project at once.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-whole.mjs
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

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

console.log("\nCode that belongs to something");
{
  await page.locator("aside nav").getByRole("button", { name: "Projects", exact: true }).first().click();
  await page.getByRole("button", { name: /New project/i }).first().waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /New project/i }).first().click();
  await page.waitForTimeout(700);
  await page.getByLabel("Project name").fill("Counter course");
  await page.getByLabel("Project instructions").fill("Never use var. Every function needs a JSDoc block.");
  await page.waitForTimeout(1200);

  check((await page.getByRole("button", { name: /New code here/ }).count()) === 1,
    "a project is somewhere code can live, not only chats");

  await page.getByRole("button", { name: /New code here/ }).click();
  await page.waitForTimeout(1400);

  const where = await page.getByLabel("Project this belongs to").inputValue();
  check(Boolean(where), "and code made there belongs to it from the first keystroke");
  const shown = await page.getByLabel("Project this belongs to").evaluate((n) => n.selectedOptions[0]?.text ?? "");
  check(shown === "Counter course", "the canvas says which project it is in", shown);

  const area = page.getByLabel("Canvas content");
  await area.click();
  await area.fill("function double(n) {\n  var out = n * 2;\n  return out;\n}\n");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/whole-canvas.png` });
}

console.log("\nThe project reaches every edit made in it");
{
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("add a helper that halves a number");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2800);

  const asked = await last();
  check(/Never use var\. Every function needs a JSDoc block\./.test(asked),
    "the project's instructions are sent with a change to its code");
  check(/From the project “Counter course”/.test(asked),
    "said to come from the project, so it is clear what is speaking");
  check(/STANDING RULES/.test(asked), "and marked as standing rather than mixed into the request");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(600);
}

console.log("\nA file may still overrule the project it is in");
{
  await page.getByRole("button", { name: /^House rules/ }).click();
  await page.waitForTimeout(400);
  await page.getByLabel("House rules for this file").fill("This one file is plain ES5. var is fine here.");
  await page.waitForTimeout(700);

  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("tidy this up");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2800);

  const asked = await last();
  check(/This one file is plain ES5/.test(asked), "the file's own rules go too");
  check(asked.indexOf("This one file is plain ES5") > asked.indexOf("Never use var"),
    "after the project's, because the narrower one has to be able to win");
  check(/For this file in particular/.test(asked), "and the two are told apart");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(600);
}

console.log("\nAsking about the whole thing, not the file you have open");
{
  await page.locator("aside nav").getByRole("button", { name: "Projects", exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Counter course/ }).first().click().catch(() => {});
  await page.waitForTimeout(900);

  const box = page.getByLabel("Ask about this project");
  check(await box.isVisible(), "a project can be asked about as a whole");

  await box.fill("where is the counter?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.waitForTimeout(3000);

  const asked = await last();
  check(/^\{.*Answer a question about this project/.test(asked) || /Answer a question about this project/.test(asked),
    "the model is asked a question rather than for a rewrite");
  check(/Do not rewrite anything\. This is a question\./.test(asked), "with no licence to edit");
  check(/function double/.test(asked),
    "and is given the project's own code — the file was never opened for this");
  check(/Name the files/.test(asked),
    "asked to say where things are, because “it is in the billing logic” is not an answer");
  check(/a confident guess about somebody's own code is worse than nothing/.test(asked),
    "and to admit when the answer is not there");

  const shown = await page.locator("main").innerText();
  check(/Counter \/ app\.js|Counter \/ index\.html|index\.html/.test(shown) || /app\.js/.test(shown),
    "the answer comes back naming files");
  await page.screenshot({ path: `${OUT}/whole-ask.png` });
}

console.log("\nAnd deleting the project does not delete the work");
{
  const before = await page.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["canvases"]).objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows.length;
  });

  await page.getByRole("button", { name: /All projects/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Delete .*Counter course|Delete/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);

  const after = await page.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["canvases"]).objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows;
  });
  check(after.length === before,
    "the canvas survives — tidying a folder is not saying burn what was in it",
    `${before} → ${after.length}`);
  check(after.every((c) => !c.projectId), "it is simply no longer in a project");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
