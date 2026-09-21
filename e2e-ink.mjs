/**
 * The page you can write on, and the tutor that writes back.
 *
 * The claims: a pen draws on the page and the ink is still there after a
 * page turn and a reload; what you wrote goes with the question as a
 * picture of the page; marking your working puts a tick or a cross beside
 * each step on the page itself; a line the tutor quotes can be found and lit
 * up on the page; and a study guide made from the document lands in the
 * Notebook. A pencil is a pointer that says it is one, so the strokes here
 * are pointer events dispatched with pointerType "pen" and a pressure.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-ink.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

function pdf() {
  const page = (text) => `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const streams = [page("Osmosis moves water across a membrane."), page("Water potential is measured in kilopascals.")];
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

/* A pen stroke: pointer events with pointerType "pen" and a pressure that
   rises and falls, dispatched on the page element at fractions of its box. */
const pen = async (pts) => {
  await p.evaluate((pts) => {
    const el = document.querySelector("[data-tool]");
    const r = el.getBoundingClientRect();
    const ev = (type, [fx, fy], pressure, i) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: "pen", isPrimary: true, pressure, button: 0, buttons: 1,
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy,
    }));
    ev("pointerdown", pts[0], 0.3);
    pts.slice(1).forEach((pt, i) => ev("pointermove", pt, 0.3 + 0.5 * Math.sin((Math.PI * (i + 1)) / pts.length)));
    ev("pointerup", pts[pts.length - 1], 0);
  }, pts);
  await p.waitForTimeout(150);
};
const paths = () => p.locator("[data-tool] svg path").count();

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
await p.waitForTimeout(600);
await p.getByLabel("A document to work through").setInputFiles({ name: "osmosis.pdf", mimeType: "application/pdf", buffer: pdf() });
await p.getByRole("img", { name: /Page 1 of osmosis\.pdf/ }).waitFor({ timeout: 20000 });
await p.waitForTimeout(600);

console.log("\nA pen draws on the page");
{
  const tools = p.getByRole("radiogroup", { name: "Tool" });
  check(await tools.isVisible(), "there is a pencil case in the page's header");
  await tools.getByRole("radio", { name: "Pen" }).click();
  check((await tools.getByRole("radio", { name: "Pen" }).getAttribute("aria-checked")) === "true", "and the pen can be picked up");
  await pen([[0.2, 0.3], [0.3, 0.32], [0.4, 0.3], [0.5, 0.33], [0.6, 0.3]]);
  check((await paths()) === 1, "a stroke of the pen is a line on the page", `${await paths()} path(s)`);
  const width = await p.locator("[data-tool] svg path").first().getAttribute("stroke-width");
  check(Number(width) > 1, "drawn with a width that came from the pressure", `${width}px`);
  await tools.getByRole("radio", { name: "Highlighter" }).click();
  await pen([[0.15, 0.12], [0.5, 0.12], [0.8, 0.12]]);
  check((await paths()) === 2, "and the highlighter is a second, wider one", `${await paths()} path(s)`);
  const hi = await p.locator("[data-tool] svg path").first().evaluate((el) => ({ w: Number(el.getAttribute("stroke-width")), o: el.getAttribute("opacity") }));
  check(hi.w > Number(width) * 2 && Number(hi.o) < 1, "translucent, under the pen's line", `${hi.w}px at ${hi.o}`);
  await tools.getByRole("radio", { name: "Point at a region" }).click();
  check(/ink goes with the next question/.test(await p.locator("main").innerText()), "with the pen put down, the line under the page says the ink goes with the question");
}

console.log("\nThe ink is kept");
{
  await p.getByRole("button", { name: "Next page" }).click();
  await p.getByRole("img", { name: /Page 2 of osmosis\.pdf/ }).waitFor({ timeout: 15000 });
  await p.waitForTimeout(500);
  check((await paths()) === 0, "the next page is clean");
  await p.getByRole("button", { name: "Previous page" }).click();
  await p.getByRole("img", { name: /Page 1 of osmosis\.pdf/ }).waitFor({ timeout: 15000 });
  await p.waitForTimeout(600);
  check((await paths()) === 2, "and the first page still has both strokes", `${await paths()} path(s)`);
  await p.getByRole("button", { name: "Take back the last stroke" }).click();
  await p.waitForTimeout(200);
  check((await paths()) === 1, "the last stroke can be taken back", `${await paths()} path(s)`);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /Open osmosis\.pdf/ }).click();
  await p.getByRole("img", { name: /Page 1 of osmosis\.pdf/ }).waitFor({ timeout: 20000 });
  await p.waitForTimeout(800);
  check((await paths()) === 1, "and it is there after a reload", `${await paths()} path(s)`);
}

console.log("\nWhat you wrote goes with the question");
{
  await fetch(`${MOCK}/__reset`);
  const asks = await p.getByRole("group", { name: "Ask about this" }).getByRole("button").allInnerTexts();
  check(asks[0] === "Give me a hint", "with ink on the page, a hint is the first thing offered", asks.join(" · "));
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Give me a hint" }).click();
  await p.waitForTimeout(4000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(sent.images >= 1, "the page goes as a picture — with the ink on it", `${sent.images} image(s)`);
  check(/written on it in ink/.test(JSON.stringify(sent)), "and the model is told the ink is the person's own");
}

console.log("\nIt writes back on the page");
{
  const quotes = p.getByRole("group", { name: "Show on the page" }).first();
  check(await quotes.isVisible().catch(() => false), "the line it quoted is offered as a press");
  await quotes.getByRole("button").first().click();
  await p.waitForTimeout(800);
  const lit = await p.locator("[data-tool] svg rect[data-highlight]").count();
  check(lit >= 1, "and pressing it lights the words up on the page", `${lit} box(es)`);
  const where = await p.locator("[data-tool] svg rect[data-highlight]").first().evaluate((el) => ({ x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")), w: Number(el.getAttribute("width")) }));
  check(where.y > 0.05 && where.y < 0.25 && where.w > 0.2, "where the line actually is — near the top, most of a line wide", JSON.stringify(where));

  /* Now a region of the person's working, marked. */
  await p.getByRole("radiogroup", { name: "Tool" }).getByRole("radio", { name: "Point at a region" }).click();
  const box = await p.getByRole("img", { name: /Page 1 of/ }).boundingBox();
  await p.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.25);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  check(/That region goes with your next question/.test(await p.locator("main").innerText()), "a region can still be dragged out with the point tool");
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Why is it wrong?" }).click();
  await p.waitForTimeout(4000);
  const marks = p.locator("[data-tool] [aria-label^='Step ']");
  const said = (await p.locator('[aria-label="Working through it"]').innerText()).replace(/\s+/g, " ");
  check((await marks.count()) === 3, "marking the working puts a mark beside each step on the page", `${await marks.count()} marks — chat ends: ${said.slice(-160)}`);
  const labels = await marks.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check(labels[0] === "Step 1: holds" && labels[1] === "Step 2: does not hold", "a tick where it holds and a cross where it does not", labels.join(" | "));
  const chat = await p.locator('[aria-label="Working through it"]').innerText();
  check(/2 steps do not hold/.test(chat) && /drops the unit/.test(chat), "and the chat says which, and why", chat.replace(/\s+/g, " ").slice(-90));
}

console.log("\nAnd a study guide made from it lands in the Notebook");
{
  await p.getByRole("group", { name: "Make from this" }).getByRole("button", { name: "Study guide" }).click();
  await p.waitForTimeout(4000);
  check(/is in the Notebook/.test(await p.locator("main").innerText()), "the room says where it went");
  await p.locator("aside nav").getByRole("button", { name: "Notebook" }).first().click();
  await p.waitForTimeout(800);
  check(/osmosis — Study guide/.test(await p.locator("main").innerText()), "and it is there, named for the document");
}

console.log("\nOn a phone the page keeps its share of the screen");
{
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /Open osmosis\.pdf/ }).click();
  await p.getByRole("img", { name: /Page 1 of osmosis\.pdf/ }).waitFor({ timeout: 20000 });
  await p.setViewportSize({ width: 430, height: 932 });
  await p.waitForTimeout(800);
  const img = await p.getByRole("img", { name: /Page 1 of/ }).boundingBox();
  const pane = await p.locator('[aria-label="Working through it"]').boundingBox();
  check(img && img.height > 250 && img.y < 400, "the page is a page, not a sliver above the chat", img ? `page ${Math.round(img.height)}px tall at y=${Math.round(img.y)}` : "missing");
  check(pane && pane.y + pane.height <= 932 && pane.height > 120, "and the chat scrolls in the rest of the screen", pane ? `chat ${Math.round(pane.height)}px ending at ${Math.round(pane.y + pane.height)}` : "missing");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
