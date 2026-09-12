/**
 * The canvas, end to end, in a real browser against a real stream.
 *
 * The thing worth proving is not that a textarea holds text. It is that a
 * revision from the model lands as a *reviewable* change: shown as a diff
 * before it touches the document, recorded as a version once accepted, and
 * reachable again afterwards. And that the preview, which runs whatever is in
 * the file, cannot reach the app's storage while it does.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-canvas.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
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

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* --------------------------------------------------------------- create -- */

await page.locator("aside nav").getByRole("button", { name: "Code" }).first().click();
await page.waitForTimeout(400);
check(await page.getByText("No canvases yet.").isVisible().catch(() => false), "the empty state explains what a canvas is");

await page.getByRole("button", { name: /New canvas/i }).first().click();
await page.waitForTimeout(600);

const body = page.getByLabel("Canvas content");
check(await body.isVisible().catch(() => false), "a new canvas opens straight into the editor");

// Long enough that the unchanged middle is worth folding away.
const SOURCE = `export function add(a: number, b: number) {
  return a + b;
}

export function sub(a: number, b: number) {
  return a - b;
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}`;
await body.click();
await body.fill(SOURCE);
await page.getByLabel("Canvas title").fill("math.ts");
await page.waitForTimeout(1200);

const saved = await page.evaluate(async () => {
  const d = await new Promise((r, j) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const rows = await new Promise((r, j) => { const q = d.transaction(["canvases"]).objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  d.close();
  return rows[0] ?? null;
});
check(saved?.content?.includes("export function sub"), "the edit autosaved to the database");
check(saved?.title === "math.ts", "the title saved", saved?.title);

/* --------------------------------------------------------------- revise -- */

const ask = page.getByLabel("Ask for a change").first();
await ask.click();                       // also blurs the textarea → records a version
await ask.fill("add a multiply function");
await page.keyboard.press("Enter");
await page.waitForTimeout(3500);

const diffHeader = await page.evaluate(() => document.body.innerText);
check(/\+2/.test(diffHeader) && /−1/.test(diffHeader), "the diff counts the change", (diffHeader.match(/\+\d+\s+−\d+/) ?? ["none"])[0]);
check(diffHeader.includes("add a multiply function"), "the diff is labelled with what was asked");
check(diffHeader.includes("// appended by the mock"), "the added line is shown");
check(diffHeader.includes("unchanged line"), "the untouched middle is folded away");

const stillOld = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["canvases"]).objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return rows[0]?.content ?? "";
});
check(!stillOld.includes("appended by the mock"), "nothing is written until it is accepted");

await page.screenshot({ path: `${OUT}/canvas-diff.png` });

/* --------------------------------------------------------------- accept -- */

await page.getByRole("button", { name: /Keep/ }).click();
await page.waitForTimeout(900);

const after = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const tx = d.transaction(["canvases", "canvasVersions"]);
  const canvases = await new Promise((r) => { const q = tx.objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
  const versions = await new Promise((r) => { const q = tx.objectStore("canvasVersions").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return { content: canvases[0]?.content ?? "", versions: versions.map((v) => ({ by: v.by, note: v.note, len: v.content.length })) };
});
check(after.content.includes("// appended by the mock"), "the accepted revision is now the document");
check(after.content.includes("export function sub"), "the untouched part survived the rewrite");
check(after.versions.length >= 2, "both the before and the after are in history", `${after.versions.length} versions`);
check(after.versions.some((v) => v.by === "model" && v.note === "add a multiply function"), "the model's version carries the instruction");

const onScreen = await page.getByLabel("Canvas content").inputValue();
check(onScreen.includes("// appended by the mock"), "the editor shows the accepted text");

/* -------------------------------------------------------------- history -- */

await page.getByLabel("Version history").click();
await page.waitForTimeout(500);
const historyText = await page.locator("aside").last().innerText();
check(historyText.includes("Current"), "history lists the current state first");

// Second entry is the pre-revision state. Restoring it should put the old
// document back without destroying the newer version.
await page.locator("aside").last().locator("li button").nth(1).click();
await page.waitForTimeout(800);
const reverted = await page.getByLabel("Canvas content").inputValue();
check(!reverted.includes("appended by the mock"), "restoring an earlier version brings the old text back");
const kept = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["canvasVersions"]).objectStore("canvasVersions").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return rows.length;
});
check(kept >= 3, "reverting added a version rather than deleting the ones after it", `${kept} versions`);

/* -------------------------------------------------------------- preview -- */

await page.getByRole("button", { name: /^Preview$/ }).click();
await page.waitForTimeout(900);
const highlighted = await page.locator("pre code span").count();
check(highlighted > 5, "preview renders the code highlighted", `${highlighted} tokens`);
await page.getByRole("button", { name: /^Edit$/ }).click();
await page.waitForTimeout(300);

/* ------------------------------------------------------------------ run -- */

// An HTML canvas gets a Run button, and what it runs must not be able to read
// this app's IndexedDB.
await page.getByLabel("Language").selectOption("html");
await page.waitForTimeout(400);
await page.getByLabel("Canvas content").fill('<p id="x">hello from the sandbox</p><script>document.title="ran"</script>');
await page.waitForTimeout(900);
await page.getByRole("button", { name: /^Run$/ }).click();
await page.waitForTimeout(900);

const frame = page.frames().find((f) => f !== page.mainFrame());
const framed = frame ? await frame.locator("#x").innerText().catch(() => "") : "";
check(framed.includes("hello from the sandbox"), "the preview runs the document", framed);
const scriptRan = frame ? await frame.evaluate(() => document.title).catch(() => "") : "";
check(scriptRan === "ran", "scripts inside the preview execute");
const origin = frame ? await frame.evaluate(() => window.origin).catch(() => "err") : "err";
check(origin === "null" || origin === "err", "the preview is opaque-origin — it cannot reach app storage", String(origin));

await page.screenshot({ path: `${OUT}/canvas-run.png` });

/* ------------------------------------------------------------ from chat -- */

await page.getByRole("button", { name: /New chat/ }).first().click();
await page.waitForTimeout(400);
const ta = page.locator("textarea").first();
await ta.click();
await ta.type("debounce vs throttle", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(6000);

await page.locator('[aria-label="More actions"]').last().click();
await page.waitForTimeout(400);
const item = page.getByRole("menuitem", { name: /canvas/i });
check(await item.isVisible().catch(() => false), "an answer can be lifted out of the thread into a canvas");
await item.click();
await page.waitForTimeout(1200);
const lifted = await page.getByLabel("Canvas content").inputValue().catch(() => "");
check(lifted.includes("export function debounce"), "the fenced code block came across, not the prose around it");
const langNow = await page.getByLabel("Language").inputValue().catch(() => "");
check(langNow === "ts", "the canvas picked up the block's language", langNow);
const titleNow = await page.getByLabel("Canvas title").inputValue().catch(() => "");
check(titleNow === "debounce.ts", "the canvas is named after the block's filename", titleNow);

await page.screenshot({ path: `${OUT}/canvas-from-chat.png` });

console.log(errs.length ? "\n  ✗ runtime errors:\n" + errs.map((e) => "    " + e).join("\n") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
