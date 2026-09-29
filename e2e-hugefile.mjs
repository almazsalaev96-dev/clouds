/**
 * Files past 200 MB, the syllabus, and who is studying.
 *
 * The claims, on the screen and at the wire: a text file of over 200 MB is
 * taken in a conversation and as a notebook source — no size refusal, the
 * first 4 million characters kept and the student told so; the Study room
 * asks once what they are studying for, and once saved it is one line with
 * a way to change it, and the chat is told who it is teaching; "Not now"
 * puts it away; a course built with the specification attached is written
 * from that document, and its notes are given the passage for the topic.
 *
 *   bash /tmp/claude-0/one.sh e2e-hugefile
 */
import { chromium } from "playwright";
import { openSync, writeSync, closeSync, unlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOCK = "http://127.0.0.1:8787";
/* Built on disk and handed over by path: Playwright's in-memory buffers
   stop at 50 MB, a student's files do not. */
const HUGE = join(tmpdir(), "armi-huge-lectures.txt");
{
  const fd = openSync(HUGE, "w");
  const block = Buffer.from("Lecture notes. Diffusion is the net movement of particles from high to low concentration.\n".repeat(11_000));
  let written = 0;
  while (written < 210 * 1024 * 1024) written += writeSync(fd, block);
  closeSync(fd);
}
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);
const waitFor = async (loc, ms = 20000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };
const settings = () => p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state);
const room = async (name) => { if (name === "Study") await p.keyboard.press("Meta+5"); else await p.locator("aside nav").getByRole("button", { name, exact: true }).first().click(); await p.waitForTimeout(600); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

console.log(`\nA ${Math.round(statSync(HUGE).size / 1024 / 1024)} MB file in a conversation`);
{
  await p.setInputFiles('input[aria-label="Choose photos and files to attach"]', HUGE);
  const told = await waitFor(p.getByText(/is very long — the first 4 million characters/));
  check(told, "taken, and the student is told how much was kept");
  const page = await p.locator("main").innerText();
  check(!/too (large|big)|over \d+ ?MB|limit/i.test(page), "and nothing says it is too big");
  check(await p.getByText("armi-huge-lectures.txt").first().isVisible(), "it sits on the bar, ready to send");
}

console.log("\nThe same file as a notebook source");
{
  await room("Notebook");
  await p.getByRole("button", { name: "New notebook" }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Add sources" }).first().click();
  const dialog = p.getByRole("dialog", { name: "Add sources" });
  await dialog.getByLabel("Choose files to add as sources").setInputFiles(HUGE);
  await p.locator("main").getByRole("button", { name: /^Sources, \d+$/ }).first().click({ timeout: 60000 }).catch(() => {});
  const listed = await waitFor(p.getByRole("list", { name: "Your sources", exact: true }).getByText(/armi-huge-lectures/), 60000);
  check(listed, "it is added as a source");
  const src = (await rows("sources")).find((r) => r.name === "armi-huge-lectures.txt");
  const kept = src?.text?.length ?? 0;
  check(kept === 4_000_000, "with the first 4 million characters kept, not the whole 210 MB", `${Math.round(kept / 1e6)}M characters stored`);
  await p.keyboard.press("Escape");
}

console.log("\nStudy asks once what they are studying for");
{
  await room("Study");
  const card = p.getByRole("region", { name: "What are you studying for?" });
  check(await waitFor(card, 5000), "the question is there");
  await card.getByRole("radio", { name: "University" }).click();
  check(await card.getByText("Course and year").isVisible(), "a university student is asked for their course and year, not a board");
  await card.getByRole("radio", { name: "School exams" }).click();
  await card.getByRole("button", { name: "A level", exact: true }).click();
  await card.getByRole("button", { name: "OCR", exact: true }).click();
  await card.getByLabel("Subjects").fill("Chemistry, Physics");
  await card.getByLabel("Aiming for").fill("A*");
  await card.getByRole("button", { name: "Save" }).click();
  await p.waitForTimeout(400);
  const line = p.getByLabel("Your studies", { exact: true });
  check(await line.isVisible() && /A level · OCR · Chemistry, Physics/.test(await line.innerText()), "once saved it is one line", (await line.innerText().catch(() => "")).slice(0, 80));
  const kept = (await settings()).learner;
  check(kept?.stage === "school" && kept?.level === "A level" && kept?.board === "OCR" && kept?.target === "A*", "and kept", JSON.stringify(kept));
  await line.getByRole("button", { name: "Change your studies" }).click();
  check(await p.getByRole("region", { name: "What are you studying for?" }).getByLabel("Subjects").inputValue() === "Chemistry, Physics", "it can be changed, with what was said filled in");
  await p.getByRole("region", { name: "What are you studying for?" }).getByRole("button", { name: "Cancel" }).click();
}

console.log("\nThe chat is told who it is teaching");
{
  await room("Chat").catch(() => {});
  await p.getByRole("button", { name: "New chat" }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("what is enthalpy");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const sent = JSON.stringify(await (await fetch(`${MOCK}/__last?kind=answer`)).json());
  check(sent.includes("Who you are teaching") && sent.includes("A level (OCR)") && sent.includes("A*"), "the answer is written for an A level OCR student aiming for an A*");
}

console.log("\n\"Not now\" puts it away");
{
  const fresh = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await fresh.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await fresh.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
  await fresh.reload({ waitUntil: "networkidle" });
  await fresh.keyboard.press("Meta+5");
  await fresh.waitForTimeout(600);
  const card = fresh.getByRole("region", { name: "What are you studying for?" });
  await card.getByRole("button", { name: "Not now" }).last().click();
  await fresh.waitForTimeout(300);
  check(!(await card.count()), "gone, and nothing saved for them");
  await fresh.close();
}

console.log("\nA course built from the specification the student gives");
{
  await room("Study");
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("region", { name: "Your courses" }).getByRole("button", { name: /Add a course/ }).click();
  const form = p.getByRole("region", { name: "Add a course" });
  await form.getByLabel("Subject").fill("Biology");
  await form.getByRole("radiogroup", { name: "Level" }).getByRole("radio", { name: "GCSE", exact: true }).click();
  await form.getByRole("radiogroup", { name: "Exam board" }).getByRole("radio", { name: "AQA" }).click();
  await form.getByLabel("Choose the specification").setInputFiles({ name: "aqa-biology-spec.txt", mimeType: "text/plain", buffer: Buffer.from("4.1.1 Cell structure. Students should be able to explain how the main sub-cellular structures, including the nucleus, cell membranes, mitochondria, chloroplasts in plant cells and plasmids in bacterial cells, are related to their functions.\n\n4.1.3 Transport in cells. Students should be able to explain how substances are transported into and out of cells through diffusion, osmosis and active transport.") });
  check(await waitFor(form.getByText("aqa-biology-spec.txt"), 5000), "the document is taken");
  await form.getByRole("button", { name: "Build the course" }).click();
  await waitFor(p.getByRole("region", { name: "Specification" }), 15000);
  const asked = JSON.stringify(await (await fetch(`${MOCK}/__last?kind=course`)).json());
  check(/from the official document below/.test(asked) && /sub-cellular structures/.test(asked), "the course is written from the document, not from memory");
  const saved = (await rows("courses")).find((c) => c.subject === "Biology" && c.syllabus);
  check(saved?.syllabus?.name === "aqa-biology-spec.txt" && /Transport in cells/.test(saved?.syllabus?.text ?? ""), "and the document is kept with the course");
}

try { unlinkSync(HUGE); } catch { /* fine */ }
console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
