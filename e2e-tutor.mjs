/**
 * Working through a document, in a real browser with a real PDF.
 *
 * The claim is not "a file uploads". It is that the page is drawn, that
 * pointing at part of it sends that part, and that the answer arrives beside
 * the page rather than instead of it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-tutor.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

/* A real PDF, by hand: two pages with a line of text on each, so the probe
   proves page rendering and per-page text rather than mocking them. */
function pdf() {
  const page = (text) => `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const streams = [page("Photosynthesis happens in the chloroplast."), page("Respiration happens in the mitochondrion.")];
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const at = [];
  objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const a of at) out += `${String(a).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
await p.waitForTimeout(600);

console.log("\nA document is taken in and its pages are drawn");
{
  check(await p.getByRole("button", { name: "Work through a document" }).isVisible(), "the room offers to work through one");
  await p.getByLabel("A document to work through").setInputFiles({ name: "biology.pdf", mimeType: "application/pdf", buffer: pdf() });
  const img = p.getByRole("img", { name: /Page 1 of biology\.pdf/ });
  check(await img.waitFor({ timeout: 20000 }).then(() => true).catch(() => false), "the page itself is on screen, drawn from the file");
  const drawn = await img.evaluate((el) => el.naturalWidth > 400 && el.naturalHeight > 400).catch(() => false);
  check(drawn, "at a size worth pointing at");
  check(/1 \/ 2/.test(await p.locator("header").last().innerText()), "and it knows how many pages there are");
}

console.log("\nThe conversation sits beside it, not instead of it");
{
  const beside = await p.evaluate(() => {
    const page = document.querySelector('img[alt^="Page 1"]')?.getBoundingClientRect();
    const chat = document.querySelector('[aria-label="Working through it"]')?.getBoundingClientRect();
    return page && chat ? { pageRight: Math.round(page.right), chatLeft: Math.round(chat.left), sameRow: Math.abs(page.top - chat.top) < 400 } : null;
  });
  check(Boolean(beside) && beside.chatLeft >= beside.pageRight - 8 && beside.sameRow, "the page is on the left and the chat is on the right", JSON.stringify(beside));
}

console.log("\nPointing at part of the page is the question");
{
  const box = await p.getByRole("img", { name: /Page 1 of/ }).boundingBox();
  /* A pencil, as far as the browser is concerned: a pointer that says it is
     one. The same gesture is a finger or a mouse. */
  await p.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.10);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.22, { steps: 12 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  check(/That region goes with your next question/.test(await p.locator("main").innerText()), "dragging a box over it makes a region");
  const asks = await p.getByRole("group", { name: "Ask about this" }).getByRole("button").allInnerTexts();
  check(asks.includes("Why is it wrong?"), "and the things you ask about your own working are offered", asks.join(" · "));

  await fetch(`${MOCK}/__reset`);
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Explain this" }).click();
  await p.waitForTimeout(4000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  const body = JSON.stringify(sent);
  check(sent.images >= 1, "the region is sent as a picture, so it can be looked at", `${sent.images} image(s) on the wire`);
  check(/Photosynthesis happens in the chloroplast/.test(body), "with the words of the page it came from");
  check(/page 1/.test(body), "and which page that was");
  const chat = await p.locator('[aria-label="Working through it"]').innerText();
  check(chat.length > 40 && /page 1/.test(chat), "the answer lands beside the page", chat.replace(/\s+/g, " ").slice(0, 60));
}

console.log("\nThe next page is a different page");
{
  await p.getByRole("button", { name: "Next page" }).click();
  await p.waitForTimeout(2500);
  check(await p.getByRole("img", { name: /Page 2 of biology\.pdf/ }).isVisible().catch(() => false), "it draws page two");
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Explain this page" }).click();
  await p.waitForTimeout(4000);
  const body = JSON.stringify(await fetch(`${MOCK}/__last`).then((r) => r.json()));
  check(/Respiration happens in the mitochondrion/.test(body), "and asks about what is on that page, not the one before");
}

console.log("\nAnd it is still there tomorrow");
{
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(700);
  const list = await p.getByRole("list", { name: "Documents" }).innerText();
  check(/biology\.pdf/.test(list) && /page 2 of 2/.test(list), "the document is in the room, open where you left it", list.replace(/\s+/g, " ").slice(0, 60));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
