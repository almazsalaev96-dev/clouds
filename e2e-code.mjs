/**
 * The three things a coding surface needs that this one did not have.
 *
 * Measured against what ChatGPT's canvas and Claude's artifacts actually give
 * you. Canvas ships five one-press edits — review, add logs, add comments, fix
 * bugs, port to a language — and this had four of them: **Review** was the
 * missing one, and it is the only one of the five that never touches the file.
 * Claude added editing a *selection* in place in June 2026, which is the
 * difference between "make this a loop" costing six lines and costing four
 * hundred. And neither of those matters in a file you cannot search, which is
 * every file past about fifty lines.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-code.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const SOURCE = `export function add(a, b) {
  return a + b;
}

export function slow(items) {
  let out = [];
  for (let i = 0; i < items.length; i++) {
    out = out.concat([items[i] * 2]);
  }
  return out;
}

export function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
`;

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

await page.getByRole("button", { name: "Code" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Code file/ }).click();
await page.waitForTimeout(900);
const area = page.getByLabel("Canvas content");
await area.click();
await area.fill(SOURCE);
await page.waitForTimeout(900);

console.log("\nFinding your way around a file");
{
  await area.click();
  await page.keyboard.press("Control+f");
  await page.waitForTimeout(400);
  const bar = page.getByRole("textbox", { name: "Find in this file" });
  check(await bar.isVisible(), "the key everybody presses opens a find bar");
  await bar.fill("out");
  await page.waitForTimeout(400);
  const count = await page.locator("text=/\\d+ of \\d+/").first().innerText();
  check(/of 4$/.test(count), "and it counts what it found", count);

  const first = await area.evaluate((n) => [n.selectionStart, n.selectionEnd]);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const second = await area.evaluate((n) => [n.selectionStart, n.selectionEnd]);
  check(second[0] > first[0], "Enter walks to the next one", `${first[0]} → ${second[0]}`);
  check(await area.evaluate((n) => n.value.slice(n.selectionStart, n.selectionEnd)) === "out",
    "landing on the match rather than near it");
  await page.keyboard.press("Shift+Enter");
  await page.waitForTimeout(400);
  check((await area.evaluate((n) => n.selectionStart)) === first[0], "and Shift-Enter walks back");
  await page.screenshot({ path: `${OUT}/code-find.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(!(await bar.isVisible().catch(() => false)), "Escape closes it");
}

console.log("\nA review, which never touches the file");
{
  const before = await area.inputValue();
  await page.getByRole("button", { name: /^Review$/ }).click();
  await page.waitForTimeout(2600);
  const said = await page.getByText("Review", { exact: true }).count();
  check(said > 0, "the fifth one-press edit is here now");
  const sent = await (await fetch("http://127.0.0.1:8787/__last")).json();
  const prompt = JSON.stringify(sent);
  check(/the way a careful colleague would/.test(prompt), "it asks for a review rather than a rewrite");
  check(/Do not rewrite the file/.test(prompt), "and says so twice, because that is the whole difference");
  check(/nothing here worries me/.test(prompt),
    "with permission to find nothing — a review that must find fault invents it");
  check((await area.inputValue()) === before, "the file is untouched", "unchanged");
  await page.screenshot({ path: `${OUT}/code-review.png` });
  await page.getByRole("button", { name: /Close review/ }).click();
  await page.waitForTimeout(300);
}

console.log("\nChanging only what you selected");
{
  // Select the body of slow() — lines 5 to 11.
  /* A real selection, made the way a person makes one: caret to the top of the
     file, down to the line the function starts on, then shift-down to its
     closing brace. Setting selectionStart by hand and firing a `select` event
     looks equivalent and is not — React emulates onSelect from selectionchange
     and the pointer/key events around it, so a hand-dispatched one arrives at
     nobody, and the test would be asserting against a selection the app was
     never told about. */
  await area.click();
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+End");
  await page.waitForTimeout(500);

  const chip = await page.locator(".composer-shell").innerText();
  check(/Lines \d+–\d+/.test(chip), "the bar says what it is about to change", (chip.match(/Lines[^\n]*/) ?? [""])[0]);
  check((await page.getByPlaceholder(/Change just these lines/).count()) === 1,
    "and asks a narrower question than it does for a whole file");

  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("use map");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2800);

  const sent = await (await fetch("http://127.0.0.1:8787/__last")).json();
  const prompt = JSON.stringify(sent);
  check(/Rewrite ONLY the selected part/.test(prompt), "the model is asked for the selection alone");
  check(/THE SELECTION \(rewrite this\)/.test(prompt) && /export function slow/.test(prompt),
    "with the selected lines marked as the thing to replace");
  check(/context only — do not return this/.test(prompt),
    "and the rest of the file sent as context — six lines rewritten blind invents a signature");
  check(!/export function add\(a, b\)[\s\S]*THE SELECTION/.test(prompt.split("THE SELECTION")[1] ?? ""),
    "the untouched parts are not in the answer it asks for");

  const diff = await page.getByRole("button", { name: /^Keep/ }).count();
  check(diff === 1, "the change still arrives as a diff — nothing lands unseen");
  await page.screenshot({ path: `${OUT}/code-selection.png` });

  await page.getByRole("button", { name: /^Keep/ }).click();
  await page.waitForTimeout(900);
  const after = await area.inputValue();
  check(after.includes("export function add(a, b)") && after.includes("export function mean"),
    "keeping it leaves everything outside the selection exactly as it was");
  check(!(await page.locator(".composer-shell").innerText()).includes("Lines "),
    "and the selection is let go once the change is in");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
