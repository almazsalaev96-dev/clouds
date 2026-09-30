/**
 * Which part of a long book, in the Notebook and the Studio.
 *
 * The claims, at the wire: a question asked of a notebook whose source is a
 * long book is answered from the passages about the question — found by
 * search, with pages — and the book is not read in parts first; the Studio,
 * given a long book, first asks which part, finds the chapter for a typed
 * topic, and then works from that chapter alone.
 *
 *   bash /tmp/claude-0/one.sh e2e-scope
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const last = async (kind) => JSON.stringify((await (await fetch(`${MOCK}/__last${kind ? `?kind=${kind}` : ""}`)).json()) ?? {});
const waitFor = async (loc, ms = 15000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };

let page = 0;
const chapter = (title, topic, pages) => `Chapter ${title}\n\n` + Array.from({ length: pages }, () => `--- page ${++page} ---\n` + `This page explains ${topic} with careful examples for students. `.repeat(40)).join("\n");
const BOOK = [
  chapter("1 Cells", "cell membranes and organelles", 40),
  chapter("2 Enzymes", "enzymes, active sites and activation energy", 40),
  chapter("3 Photosynthesis", "chlorophyll and light", 40) + "\n\nThe Calvin cycle fixes carbon dioxide into glucose using ATP and NADPH from the light-dependent reactions.",
  chapter("4 Respiration", "mitochondria and ATP", 40),
].join("\n\n");

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(600);
console.log(`\nA book of ${BOOK.length.toLocaleString()} characters, ${page} pages`);

console.log("\nA notebook question about a long book");
{
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "New notebook" }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Add sources" }).first().click();
  await p.getByRole("dialog", { name: "Add sources" }).getByLabel("Choose files to add as sources").setInputFiles({ name: "biology-book.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
  await p.waitForTimeout(2500);
  if (await p.getByRole("dialog", { name: "Add sources" }).count()) await p.getByRole("dialog", { name: "Add sources" }).getByRole("button", { name: /Close|Done/ }).first().click().catch(() => {});
  await p.waitForTimeout(800);
  await fetch(`${MOCK}/__reset`);
  const t0 = Date.now();
  await p.getByRole("textbox", { name: "Ask about your sources" }).fill("How does the Calvin cycle make glucose?");
  await p.keyboard.press("Enter");
  for (let i = 0; i < 60; i++) { if ((await recent()).some((r) => /Calvin/.test(r.asked ?? ""))) break; await p.waitForTimeout(250); }
  await p.waitForTimeout(1500);
  const calls = await recent();
  const sent = await last("answer");
  check(!calls.some((r) => /You are reading part \d+ of \d+/.test(r.head ?? "")), "the book is not read in parts first", `${calls.length} calls in ${Date.now() - t0} ms`);
  check(sent.includes("[The passages of biology-book.txt") && sent.includes("Calvin cycle fixes carbon dioxide"), "the passage that answers it is sent, said to be passages");
  check(/\[page \d+\]/.test(sent), "with its page");
  check(sent.length < 150_000, "and a fraction of the book", `${Math.round(sent.length / 1000)}k of ${Math.round(BOOK.length / 1000)}k characters`);
}

console.log("\nThe Studio, given a long book");
{
  await p.locator("aside nav").getByRole("button", { name: "Studio" }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Make study materials from a book or notes/ }).click();
  await p.getByLabel("Choose a file to make study material from").setInputFiles({ name: "biology-book.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
  const which = p.getByRole("region", { name: "Which part of biology-book.txt?" });
  check(await waitFor(which), "asks which part first");
  const parts = await which.getByRole("list", { name: "Parts of the book" }).getByRole("listitem").allInnerTexts();
  check(parts.length === 4 && /Chapter 2 Enzymes\s*pp\. \d+–\d+/.test(parts[1]), "the book's chapters, with pages", parts.map((t) => t.replace(/\s+/g, " ")).join(" | "));
  await fetch(`${MOCK}/__reset`);
  await which.getByLabel("Find a topic").fill("active sites");
  await which.getByRole("button", { name: "Use the best match" }).click();
  const what = p.getByRole("region", { name: "What it is" });
  check(await waitFor(what), "then reads that part and says what it is");
  const reading = await last("reading");
  check(reading.includes("enzymes, active sites") && !reading.includes("chlorophyll and light") && !reading.includes("mitochondria and ATP"), "from the chapter about the topic, and nothing else");
  check(await p.getByText(/Working from Chapter 2 Enzymes/).first().isVisible().catch(() => false), "and says which part it is working from");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
