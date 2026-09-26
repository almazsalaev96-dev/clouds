/**
 * A table you can do something with.
 *
 * A model asked to compare answers with a table, and until now it was a
 * picture of one. The claims: a column of figures sorts as figures (2 before
 * 30 before 100 — the thing text sorting gets wrong), blanks sink whichever
 * way the column points, the cells keep whatever the renderer made of them,
 * and the CSV that comes out is one a spreadsheet reads back correctly.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.getByRole("textbox", { name: "Message" }).fill("Compare debounce, throttle and polling");
await p.keyboard.press("Meta+Enter");
await p.waitForTimeout(4500);

const table = p.locator(".msg table").last();
const column = async (i) => (await table.locator("tbody tr").all()).length
  ? Promise.all((await table.locator("tbody tr").all()).map((r) => r.locator("td").nth(i).innerText()))
  : [];

console.log("\nThe table arrives with its headers pressable");
{
  check(await table.isVisible(), "a table was drawn");
  const heads = await table.locator("th button").allInnerTexts();
  check(heads.length === 4, "and every header is a button", heads.join(" · "));
  check((await column(0)).join(",") === "Debounce,Throttle,Polling,Long poll",
    "in the order the model wrote it, until asked otherwise");
}

console.log("\nFigures sort as figures");
{
  await table.getByRole("button", { name: /Sort by Latency/ }).click();
  await p.waitForTimeout(300);
  let col = await column(1);
  /* First press on a column of numbers opens largest-first: that is what
     somebody pressing it is nearly always looking for. */
  check(col.join(",") === "2000,300,100,n/a", "first press: largest first, and the non-answer last", col.join(","));
  await table.getByRole("button", { name: /Sort by Latency/ }).click();
  await p.waitForTimeout(300);
  col = await column(1);
  check(col.join(",") === "100,300,2000,n/a", "second press: smallest first — 100 before 300 before 2000, which text sorting gets wrong", col.join(","));
  check((await table.locator("th[aria-sort='ascending']").count()) === 1, "and the header says which way it is pointing");
}

console.log("\nBlanks sink, and a currency column is still a column of figures");
{
  await table.getByRole("button", { name: /Sort by Cost/ }).click();
  await p.waitForTimeout(300);
  const col = await column(2);
  check(col.join("|") === "£1,200|£12|£0.10|", "£1,200 outranks £12 outranks £0.10 — so the commas and the pound sign were read through, and the blank went last", col.join("|"));
}

console.log("\nThe cells are the renderer's own, not a retype of them");
{
  /* A cell that held markup must still hold it after a sort. The mock's
     table is plain text, so the check is that the row's *elements* moved:
     the same `<tr>` that was first is now elsewhere, not a fresh one. */
  const marks = await table.locator("tbody tr").evaluateAll((rows) => rows.map((r) => { r.dataset.mark = r.dataset.mark ?? Math.random().toString(36).slice(2); return r.dataset.mark; }));
  await table.getByRole("button", { name: /Sort by Approach/ }).click();
  await p.waitForTimeout(300);
  const after = await table.locator("tbody tr").evaluateAll((rows) => rows.map((r) => r.dataset.mark));
  check(new Set(after).size === 4 && after.every((m) => marks.includes(m)),
    "sorting moved the existing rows rather than rebuilding them", `${after.filter((m) => marks.includes(m)).length} of 4 rows are the same elements`);
}

console.log("\nAnd the same table saves as an Excel workbook");
{
  const dl = p.waitForEvent("download", { timeout: 20000 });
  await table.locator("..").locator("..").getByRole("button", { name: "Save as Excel" }).click();
  const file = await dl.catch(() => null);
  check(Boolean(file) && /\.xlsx$/.test(file.suggestedFilename()), "pressing Save as Excel downloads a .xlsx", file?.suggestedFilename() ?? "no download");
  if (file) {
    await file.saveAs("/tmp/claude-0/table.xlsx").catch(() => {});
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.createReadStream().then((st) => new Promise((res) => { const chunks = []; st.on("data", (c) => chunks.push(c)); st.on("end", () => res(Buffer.concat(chunks))); })));
    const sheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    const book = await zip.file("xl/workbook.xml")?.async("string");
    check(Boolean(sheet) && Boolean(book) && Boolean(zip.file("[Content_Types].xml")), "with the parts a workbook is made of", Object.keys(zip.files).join(" "));
    check(/<t xml:space="preserve">Approach<\/t>/.test(sheet ?? "") && /<row r="5">/.test(sheet ?? "") && !/<row r="6">/.test(sheet ?? ""), "the header and four rows, no more", (sheet ?? "").match(/<row r="\d+">/g)?.join(" "));
    check(/<c r="B2"><v>\d+<\/v><\/c>/.test(sheet ?? ""), "and the latency column is numbers, not text, so it sums", (sheet ?? "").match(/<c r="B2"[^>]*>.*?<\/c>/)?.[0]);
    check(/Floor between calls, see Smith, J\./.test(sheet ?? ""), "a cell with a comma is one cell", "");
    check(/<pane ySplit="1"/.test(sheet ?? "") && /<autoFilter/.test(sheet ?? ""), "the header row is frozen and filterable");
  }
}

console.log("\nAnd the CSV is one a spreadsheet reads back correctly");
{
  await table.locator("..").locator("..").getByRole("button", { name: /Copy as CSV/ }).click();
  await p.waitForTimeout(400);
  const csv = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check(csv.startsWith("Approach,Latency (ms),Cost,Notes"), "the header row is first", csv.split("\n")[0]);
  check(/"Floor between calls, see Smith, J\."/.test(csv),
    "a cell with a comma in it is quoted — otherwise that row grows a column", csv.split("\n").find((l) => /Smith/.test(l)));
  check(csv.split("\n").length === 5, "one line per row, and no extras", `${csv.split("\n").length} lines`);
  /* The export follows the sort on screen: what you see is what you get. */
  check(csv.split("\n")[1].startsWith("Debounce"), "in the order currently on screen", csv.split("\n")[1].slice(0, 20));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
