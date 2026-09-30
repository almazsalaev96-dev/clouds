/**
 * A file bigger than any window the keys reach, dropped into a conversation.
 *
 * It used to go out whole to the model with the biggest window, and the
 * provider refused it: "prompt is too long". Now it is read in parts before
 * the turn goes out, the page says so above the bar, and what reaches the
 * answering model is the notes — small enough to hold, covering the whole.
 *
 * Needs the mock on 8787 and the app on 3100 (see gate.sh).
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

const BOOK = "Chapter one. Supply and demand.\n\n" + "A price rises when demand exceeds supply at the going price.\n\n".repeat(34_000) + "Chapter forty. The long run.\n\nIn the long run every input can be changed.\n\n";
console.log(`\nA file of ${BOOK.length.toLocaleString()} characters, in a conversation`);
await p.setInputFiles('input[aria-label="Choose photos and files to attach"]', { name: "economics.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
await p.waitForTimeout(800);
const asked = p.getByRole("region", { name: "Which part of economics.txt?" });
check(await asked.isVisible(), "a long book asks which part is wanted");
check(await asked.getByText("Chapter forty. The long run.").isVisible(), "listing its own chapters");
await asked.getByRole("button", { name: /^Whole book/ }).click();
check(!(await asked.count()) && await p.getByText("The whole book").first().isVisible(), "and the whole book is still one press away");
await fetch(`${MOCK}/__reset`);
await p.getByRole("textbox", { name: "Message" }).fill("What does the last chapter say?");
await p.keyboard.press("Enter");

let saw = "";
for (let i = 0; i < 120; i++) {
  const t = await p.getByRole("status").filter({ hasText: /Reading economics\.txt — part \d+ of \d+/ }).first().innerText().catch(() => "");
  if (t) saw = t;
  if ((await p.locator(".msg").count()) >= 2 && !(await p.getByRole("status").filter({ hasText: /Reading/ }).count())) break;
  await p.waitForTimeout(250);
}
await p.waitForTimeout(2500);

const last = await (await fetch(`${MOCK}/__last?kind=answer`)).json();
const sent = JSON.stringify(last ?? {});
console.log("\nRead before it is sent");
check(/part \d+ of \d+/.test(saw), "the page says it is reading, part by part, above the bar", saw);
check(/Read in \d+ parts/.test(sent), "what reached the model is the notes on every part");
check(sent.length < 1_000_000, "small enough to hold", `${Math.round(sent.length / 1000)}k characters sent, not ${Math.round(BOOK.length / 1000)}k`);
check((await p.locator(".msg").count()) >= 2, "and an answer came back rather than \"prompt is too long\"");

console.log("\nA part chosen: only that part, no reading first");
{
  await p.getByRole("button", { name: "New chat" }).last().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.setInputFiles('input[aria-label="Choose photos and files to attach"]', { name: "economics.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
  await p.waitForTimeout(800);
  const asked = p.getByRole("region", { name: "Which part of economics.txt?" });
  await asked.getByLabel("Find a topic").fill("long run inputs");
  await p.waitForTimeout(200);
  check(await asked.getByText("Chapter forty. The long run.").isVisible() && !(await asked.getByText("Chapter one. Supply and demand.").count()), "a topic finds the chapter about it");
  await asked.getByRole("button", { name: "Use the best match" }).click();
  check(await p.getByText(/Chapter forty\. The long run\./).first().isVisible(), "the chip names the part");
  await fetch(`${MOCK}/__reset`);
  const t0 = Date.now();
  await p.getByRole("textbox", { name: "Message" }).fill("Summarise it");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const sent2 = JSON.stringify((await (await fetch(`${MOCK}/__last?kind=answer`)).json()) ?? {});
  check(sent2.includes("[Only part of economics.txt") && sent2.includes("every input can be changed") && sent2.length < 50_000, "only that part is sent", `${Math.round(sent2.length / 1000)}k characters`);
  check(!/Read in \d+ parts/.test(sent2), "with no reading of the whole first", `${Date.now() - t0} ms`);
}

console.log("\nNo part chosen, a question asked: the passages about it");
{
  await p.getByRole("button", { name: "New chat" }).last().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.setInputFiles('input[aria-label="Choose photos and files to attach"]', { name: "economics.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
  await p.waitForTimeout(800);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What happens in the long run to inputs?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const sent3 = JSON.stringify((await (await fetch(`${MOCK}/__last?kind=answer`)).json()) ?? {});
  check(sent3.includes("[The passages of economics.txt") && sent3.includes("every input can be changed") && sent3.length < 120_000, "the question is the topic: the passages that answer it are found and sent", `${Math.round(sent3.length / 1000)}k characters`);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
