/**
 * The document engine, from the chat: asked for a worksheet, the model
 * makes one; it is kept in the Library as a document with its kind and its
 * style; Save as PDF sets it as that kind (name line, writing space, the
 * callout's title, page numbers) in that style; Word saves a .docx; and a
 * presentation asked for in the chat is a real deck too.
 *
 *   bash /tmp/claude-0/one.sh e2e-document
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => { window.print = () => { window.__printed = true; }; });
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true };
const say = async (text) => { await p.getByRole("textbox", { name: "Message" }).fill(text); await p.keyboard.press("Meta+Enter"); };
const lastRow = () => p.locator(".msg").last();
/* The print frame lives for a moment; look for it rather than wait. */
const printed = async (want = /./) => {
  for (let i = 0; i < 120; i += 1) {
    for (const f of p.frames()) {
      if (f === p.mainFrame()) continue;
      const r = await f.evaluate(() => ({ prints: [...document.scripts].some((x) => x.textContent.includes("armiPrint")), html: document.documentElement.outerHTML, title: document.title })).catch(() => null);
      if (r?.prints && want.test(r.html)) return r;
    }
    await p.waitForTimeout(25);
  }
  return null;
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nAsked for a worksheet, the model makes one");
{
  await fetch(`${MOCK}/__reset`);
  await say("make me a fractions worksheet as a printable");
  await p.waitForTimeout(5500);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Made a worksheet: “Fractions practice”/.test(await chip.innerText().catch(() => "")), "the chip says a worksheet was made", (await chip.innerText().catch(() => "")).replace(/\s+/g, " "));
  const last = await fetch(`${MOCK}/__last?kind=answer`).then((r) => r.json());
  check((last.tools ?? []).includes("make_document") && (last.tools ?? []).includes("make_presentation"), "the model is offered both engines", (last.tools ?? []).filter((t) => /make_/.test(t)).join(","));
  await chip.getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(1200);
  check((await p.getByLabel("Document type").inputValue().catch(() => "")) === "worksheet", "it opens as a document that knows it is a worksheet");
  check((await p.getByLabel("PDF style").inputValue().catch(() => "")) === "modern", "in the style the model chose");
}

console.log("\nSave as PDF sets it as a worksheet");
{
  await p.getByRole("button", { name: "Save as PDF" }).click();
  const got = await printed();
  check(Boolean(got), "the document goes to the print dialog, in a frame of the page");
  const html = got?.html ?? "";
  check(got?.title === "Fractions practice", "titled for the file", got?.title);
  check(/class="fields"/.test(html) && />Name</.test(html) && />Date</.test(html), "with a name and a date to fill in");
  check(/class="lines" style="--n:4"/.test(html) && /class="blank"/.test(html), "space to write, and blanks where the model left them");
  check(/class="callout tip"><strong class="callout-title">Remember/.test(html), "the tip set as a callout, with its title");
  check(/counter\(pages\)/.test(html) && /Year 7 · show your working/.test(html), "numbered pages, the line under the title");
  check(/#5B3CF5/i.test(html), "in the Modern style");
  /* And it really prints: the same page, as a PDF, one sheet. */
  const q = await ctx.newPage();
  await q.setContent(html.replace(/<script>[\s\S]*?armiPrint[\s\S]*?<\/script>/, ""));
  const pdf = await q.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  check(pdf.length > 5_000 && pages === 1, "a real one-page PDF", `${pages} page(s), ${pdf.length} bytes`);
  await q.close();
  await p.getByLabel("PDF style").selectOption("academic");
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Save as PDF" }).click();
  const again = await printed(/#7A1F2B/i);
  check(/#7A1F2B/i.test(again?.html ?? ""), "change the style and the PDF changes with it");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), p.getByRole("button", { name: "Save as Word" }).click()]);
  check(Boolean(dl) && /\.docx$/.test(dl?.suggestedFilename() ?? ""), "and Word saves a .docx", dl?.suggestedFilename());
}

console.log("\nAsked for a spreadsheet, the model makes a real workbook with live formulas");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(500);
  await fetch(`${MOCK}/__reset`);
  await say("make me a spreadsheet for my trip budget");
  await p.waitForTimeout(5500);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Made a spreadsheet: “Бюджет поездки”, 2 sheets, 6 rows/.test(await chip.innerText().catch(() => "")), "the chip names it and counts sheets and rows", (await chip.innerText().catch(() => "")).replace(/\s+/g, " "));
  await chip.getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(1200);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), p.getByRole("button", { name: "Save as Excel" }).click()]);
  check(Boolean(dl) && dl.suggestedFilename() === "byudzhet-poezdki.xlsx", "Excel saves a .xlsx, the Russian title in Latin letters so the name survives", dl?.suggestedFilename());
  if (dl) {
    const path = await dl.path();
    const { execFileSync } = await import("node:child_process");
    const read = (name) => execFileSync("python3", ["-c", `import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())`, path, name]).toString();
    const book = read("xl/workbook.xml");
    const one = read("xl/worksheets/sheet1.xml");
    check(/name="Costs"/.test(book) && /name="Notes"/.test(book), "two sheets, named by the model", (book.match(/sheet name="[^"]+"/g) ?? []).join(" "));
    check(/<f>B2\*C2<\/f>/.test(one) && /<f>SUM\(D2:D4\)<\/f>/.test(one) && /fullCalcOnLoad="1"/.test(book), "the totals are formulas, worked out when it opens");
    check(/<v>45<\/v>/.test(one) && /Food \| snacks/.test(one), "figures are numbers, and a | in a cell survives");
    check(/state="frozen"/.test(one) && /s="1"/.test(one), "the header row is styled and frozen");
  }
  const [word] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), p.getByRole("button", { name: "Save as Word" }).click()]);
  if (word) {
    const { execFileSync } = await import("node:child_process");
    const xml = execFileSync("python3", ["-c", `import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode())`, await word.path()]).toString();
    check((xml.match(/<w:tbl>/g) ?? []).length === 2, "and in Word the tables are real tables", `${(xml.match(/<w:tbl>/g) ?? []).length} tables`);
  } else check(false, "and in Word the tables are real tables", "no download");
}

console.log("\nAsked for a presentation, the model makes a real deck");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(500);
  await fetch(`${MOCK}/__reset`);
  await say("make me a presentation about osmosis");
  await p.waitForTimeout(5500);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Made a presentation: “.+”, 9 slides/.test(await chip.innerText().catch(() => "")), "the chip names it and counts the slides", (await chip.innerText().catch(() => "")).replace(/\s+/g, " "));
  await chip.getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(1500);
  check(await p.getByRole("button", { name: "Download as PowerPoint" }).isVisible().catch(() => false), "and it opens ready to download as PowerPoint");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
