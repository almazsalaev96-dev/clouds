/**
 * Files people hand in, and code that runs in a box.
 *
 * A page becomes a Word file; a deck becomes a PowerPoint file and prints
 * one slide a page; the model can run JavaScript in a sandbox and read
 * what came out.
 *
 *   node e2e-office.mjs   (one company's key on the mock is enough)
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true };
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe model runs code in a sandbox and reads the result");
{
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("run code to total the scores in this table");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(7000);
  const main = await p.locator("main").innerText();
  check(/Ran code \(\d+ ms\)/.test(main), "the chip says the code ran, and how long it took", (main.split("\n").find((l) => /Ran code/.test(l)) ?? "").slice(0, 60));
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  const back = (last.toolResults ?? []).join("\n");
  check(/rows 3/.test(back) && /"total":\s*245/.test(back), "and what it printed and returned went back to the model", back.replace(/\s+/g, " ").slice(0, 80));
}

console.log("\nA page becomes a Word file");
{
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(800);
  const edit = p.getByRole("button", { name: /^Edit$/ });
  if (await edit.isVisible().catch(() => false)) await edit.click();
  await p.getByRole("textbox", { name: "Page content" }).fill("# Osmosis\n\nWater moves down a **water-potential** gradient.\n\n## The three words\n\n- Hypotonic\n- Isotonic\n- Hypertonic\n\n1. First\n2. Second");
  await p.waitForTimeout(600);
  const dl = p.waitForEvent("download", { timeout: 15000 });
  await p.getByRole("button", { name: "Save as Word" }).first().click();
  const file = await dl.catch(() => null);
  check(Boolean(file) && /\.docx$/.test(file.suggestedFilename()), "pressing Word saves a .docx", file?.suggestedFilename() ?? "no download");
  const path = file ? await file.path() : null;
  if (path) {
    const { statSync } = await import("node:fs");
    const size = statSync(path).size;
    check(size > 2000, "of a plausible size", `${size} bytes`);
  }
}

console.log("\nA deck becomes a PowerPoint file, and can be printed one slide a page");
{
  await p.locator("aside nav").getByRole("button", { name: "Creations" }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^All canvases/ }).click().catch(() => {});
  await p.waitForTimeout(300);
  const deck = `<!doctype html><html><head><title>Water cycle</title><style>.slide{height:100vh}@media print{.slide{page-break-after:always}}</style></head><body>
<section class="slide"><h1>The water cycle</h1><p>Ten slides</p><aside class="notes">Say hello.</aside></section>
<section class="slide"><h2>Evaporation</h2><ul><li>Sun heats water</li><li>Vapour rises</li></ul><aside class="notes">Mention oceans.</aside></section>
<section class="slide"><h2>Condensation</h2><ul><li>Vapour cools</li><li>Clouds form</li></ul></section>
<script>let i=0;</script></body></html>`;
  await p.getByLabel("Files to open").setInputFiles([{ name: "water-cycle.html", mimeType: "text/html", buffer: Buffer.from(deck) }]);
  await p.waitForTimeout(1500);
  check(await p.getByRole("button", { name: "Print or save as PDF" }).isVisible(), "a built page offers Print or save as PDF");
  const ppt = p.getByRole("button", { name: "Download as PowerPoint" });
  check(await ppt.isVisible(), "and a deck offers PowerPoint, which an ordinary page does not");
  const dl = p.waitForEvent("download", { timeout: 20000 });
  await ppt.click();
  const file = await dl.catch(() => null);
  check(Boolean(file) && /\.pptx$/.test(file.suggestedFilename()), "pressing it saves a .pptx", file?.suggestedFilename() ?? "no download");
  await p.waitForTimeout(800);
  check(/Saved 3 slides as PowerPoint/.test(await p.locator("main").innerText()), "and says how many slides it holds");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
