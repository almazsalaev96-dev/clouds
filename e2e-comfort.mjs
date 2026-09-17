/**
 * The comforts: the things that are not features, and are the difference
 * between using something and putting up with it.
 *
 * Arrow keys turn a page. Escape drops a region you did not mean to draw. The
 * chat beside the page follows the answer instead of writing it below the
 * fold. A dropped file is taken. A deleted document can be got back.
 *
 * Each of these existed somewhere else in the app and not here, which is the
 * kind of gap nobody files a bug about and everybody feels.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-comfort.mjs
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


console.log("\nA dropped file is taken, the same as a picked one");
{
  const dropped = await p.evaluate(async (bytes) => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Work through a document/.test(b.textContent || ""));
    const zone = btn?.parentElement;
    if (!zone) return "no zone";
    const file = new File([new Uint8Array(bytes)], "dropped.pdf", { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(file);
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
    return "sent";
  }, [...pdf()]);
  check(dropped === "sent", "the block that offers to open a document accepts one dropped on it", dropped);
  const img = p.getByRole("img", { name: /Page 1 of dropped\.pdf/ });
  check(await img.waitFor({ timeout: 20000 }).then(() => true).catch(() => false), "and opens it, drawn, without a dialog ever appearing");
}

console.log("\nThe arrow keys turn the page");
{
  await p.locator("body").click({ position: { x: 5, y: 5 } });
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(2200);
  check(await p.getByRole("img", { name: /Page 2 of dropped\.pdf/ }).isVisible().catch(() => false), "right goes forward");
  await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(2200);
  check(await p.getByRole("img", { name: /Page 1 of dropped\.pdf/ }).isVisible().catch(() => false), "left goes back");

  /* The one case where they must not: the arrows belong to the caret while a
     question is being typed, and a page that turned under a half-written
     question would take the page it was about with it. */
  const box = p.getByLabel("Ask about this page");
  await box.click();
  await box.fill("what is this");
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(1200);
  check(await p.getByRole("img", { name: /Page 1 of dropped\.pdf/ }).isVisible().catch(() => false), "but not while you are typing a question");
  await box.fill("");
}

console.log("\nEscape drops a region drawn by accident");
{
  const box = await p.getByRole("img", { name: /Page 1 of/ }).boundingBox();
  await p.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.1);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  check(/That region goes with your next question/.test(await p.locator("main").innerText()), "a drag makes one");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  check(!/That region goes with your next question/.test(await p.locator("main").innerText()), "and Escape takes it off again");
}

console.log("\nThe chat beside the page follows the answer");
{
  await fetch(`${MOCK}/__reset`);
  for (let i = 0; i < 4; i++) {
    await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Explain this page" }).click();
    await p.waitForTimeout(3500);
  }
  const at = await p.evaluate(() => {
    const el = document.querySelector('[aria-label="Working through it"]');
    return el ? { top: Math.round(el.scrollTop), gap: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight), over: el.scrollHeight > el.clientHeight + 20 } : null;
  });
  check(Boolean(at) && at.over, "four answers fill it past its own height", JSON.stringify(at));
  check(Boolean(at) && at.gap < 80, "and it is sitting at the newest one rather than the first", `${at?.gap}px from the bottom`);

  // Scrolled up to re-read, it must stay put rather than yank you back down.
  await p.evaluate(() => { document.querySelector('[aria-label="Working through it"]').scrollTop = 0; });
  await p.waitForTimeout(300);
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Explain this page" }).click();
  await p.waitForTimeout(3500);
  const held = await p.evaluate(() => Math.round(document.querySelector('[aria-label="Working through it"]').scrollTop));
  check(held < 120, "and it lets go the moment you scroll up to re-read something", `held at ${held}`);
}

console.log("\nCards from the same document go to one deck, not one deck per press");
{
  await p.getByRole("button", { name: "Make cards" }).click();
  await p.waitForTimeout(5000);
  await p.getByRole("button", { name: "Make cards" }).click();
  await p.waitForTimeout(5000);
  const decks = await p.evaluate(async () => {
    const req = indexedDB.open("clouds");
    const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
    const rows = await new Promise((ok, no) => {
      const r = db.transaction("decks").objectStore("decks").getAll();
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    return rows.filter((d) => String(d.source || "").startsWith("lesson:")).map((d) => d.name);
  });
  check(decks.length === 1, "twice through leaves one deck, not two with the same name", decks.join(" · ") || "none");
}

console.log("\nA deleted document can be got back");
{
  await p.getByRole("button", { name: "Back to study" }).or(p.locator("header").last().getByRole("button").first()).first().click();
  await p.waitForTimeout(800);
  const list = p.getByRole("list", { name: "Documents" });
  check(/dropped\.pdf/.test(await list.innerText()), "it is in the room");
  await p.getByRole("button", { name: "Remove dropped.pdf" }).click();
  await p.waitForTimeout(500);
  /* Scoped to the document list, not the room: the deck made from this
     document carries the same name, and it is meant to survive. */
  const listed = async () => (await list.count()) > 0 && /dropped\.pdf/.test(await list.innerText());
  check(!(await listed()), "removing it takes it out");
  const bar = p.getByRole("status");
  check(await bar.filter({ hasText: /dropped\.pdf/ }).first().isVisible().catch(() => false), "and offers the way back, by name");
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(900);
  check(await listed(), "which brings the document, and the session spent on it, back");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
