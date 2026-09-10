/**
 * A web app in the Code section, end to end.
 *
 * The claim is not "there is a file tab strip". It is that the folder runs:
 * index.html resolves its own <link> and <script> against the other files, the
 * page executes, its console comes back out, and an error in your code lands
 * somewhere you can see it. Everything below is measured inside the sandboxed
 * frame or read off the database.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-web.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
/* The preview frame's errors surface as the page's, and one of them is put
   there on purpose below. `breaking` marks that window so a deliberate
   ReferenceError does not read as a bug in the app around it. */
const errs = [];
let breaking = false;
page.on("pageerror", (e) => { if (!breaking) errs.push("PAGE: " + e.message); });
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text()); });

let failed = 0;
const check = (pass, label, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);
};
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* --------------------------------------------------------------- create -- */

await page.getByRole("button", { name: "Code", exact: true }).first().click();
await page.waitForTimeout(400);
check(await page.getByRole("button", { name: /Web app/ }).isVisible().catch(() => false), "the index offers the three shapes a canvas can be");

await page.getByRole("button", { name: /Web app/ }).click();
await page.waitForTimeout(1200);

const tabs = await page.locator('[aria-current]').filter({ hasText: /\./ }).allInnerTexts();
check(tabs.join(" ").includes("index.html"), "the folder opens with its files as tabs", tabs.join(" "));

const stored = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const tx = d.transaction(["canvases", "canvasFiles"]);
  const c = await new Promise((r) => { const q = tx.objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
  const f = await new Promise((r) => { const q = tx.objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return { kind: c[0]?.kind, content: c[0]?.content, files: f.map((x) => x.name).sort() };
});
check(stored.kind === "web", "it is stored as a web canvas", stored.kind);
check(JSON.stringify(stored.files) === '["app.js","index.html","style.css"]', "three files, on their own rows", JSON.stringify(stored.files));
check(stored.content === "", "and the canvas keeps no second copy of the text");

/* ------------------------------------------------------------------ run -- */

const frame = () => page.frames().find((f) => f !== page.mainFrame());
await page.waitForTimeout(1400);
const f = frame();
check(Boolean(f), "the app is running beside the editor");
check((await f.locator("h1").innerText().catch(() => "")) === "Counter", "index.html rendered");

const bg = await f.evaluate(() => getComputedStyle(document.body).display).catch(() => "");
check(bg === "grid", "the <link> resolved against style.css — the CSS is applied", bg);

await f.locator("#up").click();
await f.locator("#up").click();
check((await f.locator("#value").innerText()) === "2", "the <script> resolved against app.js — clicking counts");

const origin = await f.evaluate(() => String(window.origin)).catch(() => "err");
check(origin === "null", "it runs on an opaque origin and cannot reach the app's storage", origin);
const reach = await f.evaluate(() => { try { return String(!!localStorage); } catch (e) { return "blocked: " + e.name; } });
check(reach.startsWith("blocked"), "storage really is denied inside the frame", reach);

await page.screenshot({ path: `${OUT}/web-run.png` });

/* -------------------------------------------------------------- console -- */

await page.getByRole("button", { name: /^Console/ }).click();
await page.waitForTimeout(300);
check((await page.locator("main").innerText()).includes("Nothing logged yet"), "a clean run has an empty console");

// Break it on purpose, in the file you would break it in.
await page.locator('button[aria-current]').filter({ hasText: "app.js" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Stop$/ }).click();     // back to the editor
await page.waitForTimeout(300);
breaking = true;
const ta = page.getByLabel("Canvas content");
await ta.fill('console.log("counting");\nnope.missing();\n');
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Run$/ }).click();
await page.waitForTimeout(1600);

const consoleText = await page.locator("main").innerText();
check(consoleText.includes("counting"), "a log from inside the frame comes back out");
check(/nope is not defined/.test(consoleText), "and so does a real error, with what broke");
check(/\(app\.js:2\)/.test(consoleText), "reported against the file you wrote, at the line you wrote it on", (consoleText.match(/\([^)]*:\d+\)/) ?? ["no location"])[0]);
check((await page.getByRole("button", { name: /^Console/ }).innerText()).match(/\d/), "the count is on the button, so an error is visible without opening it");
await page.screenshot({ path: `${OUT}/web-console.png` });

/* -------------------------------------------------------------- per file -- */

breaking = false;
await page.getByLabel("Version history").click();
await page.waitForTimeout(500);
const hist = await page.locator("aside").last().innerText();
check(/app\.js/i.test(hist), "history is per file, and says which", hist.split("\n")[0]);
await page.getByLabel("Close history").click();

/* ------------------------------------------------------------- shortcuts -- */

await page.getByRole("button", { name: /^Stop$/ }).click();
await page.waitForTimeout(300);
check(await page.getByRole("button", { name: "Add comments" }).isVisible(), "the one-press edits are on the canvas");
await page.getByRole("button", { name: "Add comments" }).click();
await page.waitForTimeout(3500);
const diff = await page.locator("main").innerText();
check(/\+\d+\s+−\d+/.test(diff), "a shortcut comes back as a diff like any other change", (diff.match(/\+\d+\s+−\d+/) ?? [""])[0]);
check(diff.includes("Add comments"), "labelled with what it was asked to do");

const beforeKeep = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const f = await new Promise((r) => { const q = d.transaction(["canvasFiles"]).objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return f.find((x) => x.name === "app.js")?.content ?? "";
});
check(!beforeKeep.includes("appended by the mock"), "nothing is written until it is kept");
await page.getByRole("button", { name: /Keep/ }).click();
await page.waitForTimeout(900);
const afterKeep = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const tx = d.transaction(["canvasFiles", "canvasVersions"]);
  const f = await new Promise((r) => { const q = tx.objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
  const v = await new Promise((r) => { const q = tx.objectStore("canvasVersions").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return { js: f.find((x) => x.name === "app.js")?.content ?? "", named: v.filter((x) => x.fileName === "app.js").length, other: v.filter((x) => x.fileName === "style.css").length };
});
check(afterKeep.js.includes("appended by the mock"), "keeping writes it to that file");
check(afterKeep.named >= 3, "and records it in that file's history", `${afterKeep.named} versions of app.js`);
check(afterKeep.other >= 1, "the other files keep their own history", `${afterKeep.other} of style.css`);

/* ----------------------------------------------------------- add a file -- */

await page.getByLabel("Add a file").click();
await page.waitForTimeout(200);
await page.getByLabel("New file name").fill("about.html");
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
check((await page.locator("main").innerText()).includes("about.html"), "a new file appears as a tab");
const langGuess = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const f = await new Promise((r) => { const q = d.transaction(["canvasFiles"]).objectStore("canvasFiles").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return f.find((x) => x.name === "about.html")?.lang;
});
check(langGuess === "html", "its language is taken from the extension", String(langGuess));

// index.html cannot be deleted: without it the folder has nothing to open.
const delIndex = await page.getByLabel("Delete index.html").count();
check(delIndex === 0, "index.html has no delete control");

console.log(errs.length ? "\n  ✗ runtime errors:\n" + errs.map((e) => "    " + e).join("\n") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
