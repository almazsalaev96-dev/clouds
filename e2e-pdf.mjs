/**
 * PDFs, read in the browser and sent as text.
 *
 * Fixtures are two PDFs built by hand in the test — really in the test, see
 * `buildPdf`: one with a real text layer
 * across two pages, one that is a filled rectangle and nothing else — a scan,
 * in effect. The second one matters as much as the first: the honest answer to
 * a scan is "there is nothing in this to read", not an empty attachment that
 * the model then confabulates around.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-pdf.mjs
 */
import { chromium } from "playwright";

/**
 * The two fixtures, built here rather than read from disk.
 *
 * They used to be files in a scratch directory, and the directory belonged to
 * the session that made them — so this suite could not be run again by
 * anybody, on any machine, including the one that wrote it. A test whose
 * fixture is a path is a test that has already stopped running; it just has
 * not said so yet.
 *
 * Both are assembled by hand because that is the only way to be sure what is
 * in them. `paper` has a real text layer over two pages. `scan` has a filled
 * rectangle and no font at all, which is what a photographed page looks like
 * to an extractor — and the honest answer to one is "there is nothing in this
 * to read", not an empty attachment the model then confabulates around.
 */
function buildPdf(pages) {
  const objs = [];
  const push = (body) => objs.push(body) && objs.length; // 1-based object number

  const font = pages.some((p) => p.text);
  const kids = [];
  const catalog = 1;
  const tree = 2;
  objs.push(null, null); // reserved for the catalog and the page tree

  const fontNum = font ? push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>") : 0;

  for (const page of pages) {
    const stream = page.text
      ? `BT /F1 14 Tf 72 700 Td (${page.text.replace(/([()\\])/g, "\\$1")}) Tj ET`
      : "0 0 0 rg 72 72 468 648 re f";
    const contents = push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const resources = font ? `<< /Font << /F1 ${fontNum} 0 R >> >>` : "<< >>";
    kids.push(
      push(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] ` +
          `/Resources ${resources} /Contents ${contents} 0 R >>`,
      ),
    );
  }

  objs[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objs[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  // Offsets have to be counted in bytes, not characters, or the xref table
  // points into the middle of an object and pdf.js falls back to guessing.
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) out += `${String(at).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const paper = buildPdf([
  { text: "The Carnot cycle is reversible." },
  { text: "Week three covers entropy." },
]);
const scan = buildPdf([{ rect: true }]);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const lastPrompt = async () => {
  const j = await (await fetch("http://127.0.0.1:8787/__last", { method: "POST" })).json();
  return JSON.stringify(j);
};

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

/* ------------------------------------------------------------ the chat -- */

await page.setInputFiles('input[aria-label="Choose photos and files to attach"]', {
  name: "paper.pdf", mimeType: "application/pdf", buffer: paper,
});
await page.waitForTimeout(3000);

const composer = await page.locator(".composer-shell").innerText();
check(/paper\.pdf/i.test(composer), "the PDF attaches", composer.split("\n")[0]);
check(!/isn't a text/i.test(await page.evaluate(() => document.body.innerText)), "and is not refused");

const ta = page.locator("textarea").first();
await ta.click(); await ta.type("what does it say", { delay: 3 });
await page.keyboard.press("Enter");
await page.waitForTimeout(5000);

const sent = await lastPrompt();
check(/Carnot cycle is reversible/.test(sent), "its text reaches the model");
check(/Week three covers entropy/.test(sent), "including page two");
check(/2 pages/.test(sent), "with the page count, so the model knows how much it got");

/* ------------------------------------------------------------- a scan --- */

await page.setInputFiles('input[aria-label="Choose photos and files to attach"]', {
  name: "scan.pdf", mimeType: "application/pdf", buffer: scan,
});
await page.waitForTimeout(3000);
const body = await page.evaluate(() => document.body.innerText);
check(/scan/i.test(body), "a PDF with no text layer says it is a scan", (body.match(/[^\n]*scan[^\n]*/i) ?? [""])[0].trim().slice(0, 80));
check(!/scan\.pdf.*\n?.*KB/i.test(await page.locator(".composer-shell").innerText()), "and is not attached as an empty file");

/* --------------------------------------------------- project knowledge -- */

await page.locator("aside nav").getByRole("button", { name: "Projects", exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /New project/i }).first().click();
await page.waitForTimeout(600);
await page.setInputFiles('input[aria-label="Add files to this project"]', {
  name: "syllabus.pdf", mimeType: "application/pdf", buffer: paper,
});
await page.waitForTimeout(3000);
check((await page.locator("main").innerText()).includes("syllabus.pdf"), "a project takes a PDF as knowledge");

const stored = await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const rows = await new Promise((r) => { const q = d.transaction(["projectFiles"]).objectStore("projectFiles").getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return rows[0]?.text ?? "";
});
check(/Carnot cycle is reversible/.test(stored), "and stores the text, not the bytes");

console.log(errs.length ? "\n  ✗ " + errs.join("; ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || errs.length ? 1 : 0);
