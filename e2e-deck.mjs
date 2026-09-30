/**
 * A presentation, made and downloaded as a real PowerPoint.
 *
 * The claims, on the screen and in the file: the Studio offers a
 * Presentation; made from a topic, it comes back as slides of several kinds
 * and sits in the Library; the PowerPoint it downloads is a real .pptx in
 * the chosen theme, with one slide a slide, a native chart and a table that
 * stay editable, and the speaker's notes.
 *
 *   bash /tmp/claude-0/one.sh e2e-deck
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(500);

console.log("\nThe Studio makes a presentation");
{
  await p.locator("aside nav").getByRole("button", { name: "Studio" }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Make study materials from a book or notes/ }).click();
  await p.getByLabel("Topic").fill("Osmosis");
  await p.getByRole("button", { name: "Next" }).click();
  const list = p.getByRole("list", { name: "What to make" });
  await list.waitFor({ timeout: 10000 });
  for (const name of ["Revision notes", "Flashcards", "Exam paper", "Quiz"]) {
    const box = list.getByRole("checkbox", { name, exact: true });
    if ((await box.count()) && (await box.getAttribute("aria-checked")) === "true") await box.click();
  }
  const pres = list.getByRole("checkbox", { name: "Presentation", exact: true });
  check(await pres.isVisible(), "Presentation is one of the things it makes");
  await pres.click();
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: /^Make 1/ }).click();
  await p.getByText("Ready", { exact: true }).waitFor({ timeout: 30000 }).catch(() => {});
  const made = p.getByRole("list", { name: "What is being made" });
  check(/9 slides/.test(await made.innerText()), "the slides come back", (await made.innerText()).replace(/\s+/g, " ").slice(0, 100));
  const canv = (await rows("canvases")).find((c) => /Presentation/.test(c.title));
  const file = canv ? (await rows("canvasFiles")).find((f) => f.canvasId === canv.id) : null;
  check(!!canv && /id="armi-deck"/.test(file?.content ?? "") && (file.content.match(/<section class="slide /g) ?? []).length === 9, "and a deck that runs is kept in the Library");

  await made.getByLabel("Presentation theme").selectOption("midnight");
  const dl = p.waitForEvent("download", { timeout: 20000 });
  await made.getByRole("button", { name: /Download PowerPoint/ }).click();
  const d = await dl;
  const dir = mkdtempSync(join(tmpdir(), "deck-"));
  const path = join(dir, d.suggestedFilename());
  await d.saveAs(path);
  check(/\.pptx$/.test(d.suggestedFilename()), "a .pptx is downloaded", d.suggestedFilename());
  const names = execSync(`python3 -c "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))" ${path}`).toString().split("\n");
  const read = (n) => execSync(`python3 -c "import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())" ${path} ${n}`).toString();
  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  check(slides.length === 9, "one slide a slide", `${slides.length} slides`);
  check(names.some((n) => /^ppt\/charts\/chart\d*\.xml$/.test(n)), "the chart is a real, editable PowerPoint chart");
  const all = slides.map(read).join("\n");
  check(/<a:tbl>/.test(all), "the table is a real table");
  check(all.includes("0B1020"), "drawn in the chosen theme");
  check(names.some((n) => /notesSlide/.test(n)) && names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map(read).join("").includes("cell wall is the difference"), "with the speaker's notes");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
