/**
 * Projects and styles, read at the wire.
 *
 * The only question that matters about either feature is whether what the page
 * claims is being sent is actually being sent. So this drives the browser and
 * then asks the mock provider what it received — the system prompt as bytes,
 * not as state the app believes it has.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-project.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text()); });

let failed = 0;
const check = (pass, label, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);
};

/** What the provider actually received on the last request. */
const lastSystem = async () => {
  const res = await fetch("http://127.0.0.1:8787/__last", { method: "POST" });
  const j = await res.json();
  return typeof j.systemText === "string" ? j.systemText : "";
};

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* -------------------------------------------------------------- project -- */

await page.locator("aside nav").getByRole("button", { name: "Projects", exact: true }).first().click();
/* Waited for rather than slept through. Projects is fetched on demand now, so
   a fixed 400ms is a race this test would win on a fast machine and lose on a
   slow one — and losing it would report a broken empty state rather than a
   section that had not arrived yet. */
await page.getByText("No projects yet.").waitFor({ timeout: 5000 }).catch(() => {});
check(await page.getByText("No projects yet.").isVisible().catch(() => false), "the empty state says what a project is for");

await page.getByRole("button", { name: /New project/i }).first().click();
await page.waitForTimeout(600);
await page.getByLabel("Project name").fill("Thermodynamics");
await page.getByLabel("Project description").fill("Second-year course");
await page.getByLabel("Project instructions").fill("Always answer in SI units and name the law you used.");
await page.waitForTimeout(1200);

// Knowledge, added the way a person adds it.
await page.setInputFiles('input[aria-label="Add files to this project"]', {
  name: "syllabus.md",
  mimeType: "text/markdown",
  buffer: Buffer.from("# Syllabus\n\nWeek 3 covers the Carnot cycle and reversibility."),
});
await page.waitForTimeout(900);
const listed = await page.evaluate(() => document.body.innerText);
check(listed.includes("syllabus.md"), "the file is listed");
check(/% of the knowledge/.test(listed), "the capacity meter says how much of it reaches the model");

// A binary file is refused with a reason rather than stored as noise.
await page.setInputFiles('input[aria-label="Add files to this project"]', {
  name: "diagram.png",
  mimeType: "image/png",
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
});
await page.waitForTimeout(600);
check(
  (await page.evaluate(() => document.body.innerText)).includes("isn't a text file"),
  "a file with no text in it is refused, and says why",
);

/* ------------------------------------------------ a chat inside it ------- */

await page.getByRole("button", { name: /New chat here/ }).click();
await page.waitForTimeout(700);
check(
  (await page.locator("header").first().innerText()).includes("Thermodynamics"),
  "the chat says which project it is in",
);

const ta = page.locator("textarea").first();
await ta.click();
await ta.type("what is entropy", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const sys = await lastSystem();
check(sys.includes("Always answer in SI units"), "the project's instructions were sent");
check(sys.includes("Week 3 covers the Carnot cycle"), "the project's knowledge was sent");
check(sys.includes('<document name="syllabus.md">'), "each document is named, so the model can cite it", "");
check(!sys.includes("## Response style"), "Normal adds no style instructions at all");

/* ---------------------------------------------------------------- style -- */

/* Through the palette. The style picker used to sit in the composer and is
   gone — nothing in a sentence says how you want to be talked to, so it is
   still a choice, but it is one command among the others rather than a control
   over the box you type in. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.getByRole("textbox", { name: "Command palette" }).fill("Concise style");
await page.waitForTimeout(400);
await page.getByRole("option", { name: /Answer in the Concise style/ }).first().click();
await page.waitForTimeout(500);
await ta.click();
await ta.type("and enthalpy", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const sys2 = await lastSystem();
check(sys2.includes("## Response style"), "a chosen style is sent");
check(sys2.includes("No preamble"), "and it is the one that was chosen", "Concise");
check(
  sys2.indexOf("## Response style") > sys2.indexOf("Week 3 covers"),
  "style comes last, after the material it has to survive",
);
check(sys2.includes("Always answer in SI units"), "the project is still there alongside it");

const stuck = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["conversations"]).objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return rows[0] ?? null;
});
check(stuck?.styleId === "concise", "the style is remembered on the thread, not the app", stuck?.styleId);
check(Boolean(stuck?.projectId), "and so is the project");

/* --------------------------------------------------- a style you wrote --- */

// Settings → Styles → start from a built-in, edit it, then use it. The built-in
// is the template on purpose: a blank box titled "Instructions" is where most
// people give up on writing one.
await page.keyboard.press("Control+,");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Start from this/ }).first().click();
await page.waitForTimeout(700);
await page.getByLabel("Style name").first().fill("Exam answers");
await page.getByLabel("Style instructions").first().fill("Show every step of the working. Never skip algebra.");
await page.waitForTimeout(1200);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.getByRole("textbox", { name: "Command palette" }).fill("Exam answers");
await page.waitForTimeout(400);
const inPicker = await page.evaluate(() => document.body.innerText.includes("Exam answers"));
check(inPicker, "a style you wrote is offered like any other");
await page.getByRole("option", { name: /Answer in the Exam answers style/ }).first().click();
await page.waitForTimeout(500);
await ta.click();
await ta.type("and free energy", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const sys3 = await lastSystem();
check(sys3.includes("Never skip algebra"), "and it is what gets sent");

/* ------------------------------------------------- deleting a project ---- */

await page.locator("aside nav").getByRole("button", { name: "Projects", exact: true }).first().click();
await page.waitForTimeout(500);
await page.locator("li").first().hover();
await page.locator('button[aria-label^="Delete"]').last().click();
await page.waitForTimeout(700);
const after = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const tx = d.transaction(["conversations", "projects"]);
  const convs = await new Promise((r) => { const q = tx.objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
  const projs = await new Promise((r) => { const q = tx.objectStore("projects").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return { convs: convs.length, orphaned: convs.filter((c) => !c.projectId).length, projs: projs.length };
});
check(after.projs === 0, "the project is gone");
check(after.convs === 1 && after.orphaned === 1, "its chat survived, without a project", JSON.stringify(after));

await page.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(800);
const restored = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const tx = d.transaction(["conversations", "projects", "projectFiles"]);
  const convs = await new Promise((r) => { const q = tx.objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
  const projs = await new Promise((r) => { const q = tx.objectStore("projects").getAll(); q.onsuccess = () => r(q.result); });
  const files = await new Promise((r) => { const q = tx.objectStore("projectFiles").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return { projs: projs.length, files: files.length, rejoined: convs.filter((c) => c.projectId).length };
});
check(restored.projs === 1 && restored.files === 1, "undo brings back the project and its files", JSON.stringify(restored));
check(restored.rejoined === 1, "and puts the chat back inside it");

console.log(errs.length ? "\n  ✗ runtime errors:\n" + errs.map((e) => "    " + e).join("\n") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
