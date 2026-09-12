/**
 * One message bar, in every room.
 *
 * "It looks the same" is not a claim a screenshot can settle — two bars four
 * pixels apart in radius look identical side by side and wrong when you move
 * between them. So this asks the browser for the numbers: the shell's radius,
 * border, background and padding, the typing line's font and leading, and the
 * send disc's size and position, in chat, on a canvas and on a notebook page.
 * Then it asserts they are the same numbers, not similar ones.
 *
 * It also checks the things that used to differ in kind rather than degree:
 * the microphone existed in one room and not the others, and the notebook had
 * no way to say anything to the model at all.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-bar.mjs
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

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/**
 * Everything about a bar that a person would notice if it changed, read twice
 * — at rest and with the caret in it. Both matter and they are different
 * shadows: the first version of this test measured a focused chat bar against
 * two resting ones and reported a difference that was the focus ring.
 */
async function measure(label) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.waitForTimeout(250);
  const shot = await page.evaluate(() => {
    const area = document.querySelector("textarea.max-h-\\[45vh\\]");
    if (!area) return null;
    const shell = area.closest(".composer-shell");
    const send = document.querySelector('[aria-label="Send message"]');
    const cs = getComputedStyle(shell);
    const as = getComputedStyle(area);
    const ss = send ? getComputedStyle(send) : null;
    const sr = send ? send.getBoundingClientRect() : null;
    const shr = shell.getBoundingClientRect();
    return {
      radius: cs.borderRadius,
      border: cs.borderWidth + " " + cs.borderStyle,
      background: cs.backgroundColor,
      blur: cs.backdropFilter,
      shadow: cs.boxShadow,
      textPad: as.padding,
      font: as.fontSize + "/" + as.lineHeight,
      family: as.fontFamily.split(",")[0],
      send: ss ? Math.round(sr.width) + "×" + Math.round(sr.height) : "none",
      sendRadius: ss ? ss.borderRadius : "none",
      // Where the disc sits relative to the shell's bottom-right corner.
      inset: sr ? Math.round(shr.right - sr.right) + "," + Math.round(shr.bottom - sr.bottom) : "none",
      mic: Boolean(document.querySelector('[aria-label="Dictate"]')),
    };
  });
  if (!shot) { check(false, `${label}: no message bar found at all`); return null; }
  await page.locator("textarea.max-h-\\[45vh\\]").focus();
  await page.waitForTimeout(300);
  shot.focusShadow = await page.evaluate(() => {
    const area = document.querySelector("textarea.max-h-\\[45vh\\]");
    return getComputedStyle(area.closest(".composer-shell")).boxShadow;
  });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.waitForTimeout(200);
  return shot;
}

console.log("\nChat");
const chat = await measure("chat");
check(Boolean(chat), "the chat has a bar");
check(chat?.mic === true, "with a microphone in it");
await page.screenshot({ path: `${OUT}/bar-chat.png` });

console.log("\nA canvas");
await page.locator("aside nav").getByRole("button", { name: "Code" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Web app/ }).click();
await page.waitForTimeout(1400);
await page.getByRole("button", { name: /^Stop$/ }).click();
await page.waitForTimeout(500);
const canvas = await measure("canvas");
check(Boolean(canvas), "a canvas has one too");
check(canvas?.mic === true, "and it can be dictated to now, which it could not before");
check((await page.getByRole("group", { name: "Shortcuts" }).count()) === 1,
  "the one-press edits moved inside it, where chat keeps its attachments");
await page.screenshot({ path: `${OUT}/bar-canvas.png` });

console.log("\nA notebook page");
await page.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /New page/ }).first().click();
await page.waitForTimeout(800);
const note = await measure("notebook");
check(Boolean(note), "and so does a notebook page — the one room that had none");
check(note?.mic === true, "with the same microphone");

console.log("\nThe same, to the pixel");
if (chat && canvas && note) {
  check(chat.blur.includes("blur("), "the box is glass in its own right, not only where a dock is blurring behind it", chat.blur);
  for (const [key, human] of [
    ["radius", "the corner radius"],
    ["border", "the border"],
    ["background", "the fill"],
    ["blur", "the blur behind it"],
    ["shadow", "the lift under it, at rest"],
    ["focusShadow", "and the lift it takes when you click into it"],
    ["textPad", "the padding round what you type"],
    ["font", "the size and leading of it"],
    ["family", "the typeface"],
    ["send", "the send disc"],
    ["sendRadius", "the send disc's radius"],
    ["inset", "where the send disc sits in the corner"],
  ]) {
    const same = chat[key] === canvas[key] && chat[key] === note[key];
    check(same, human, same ? String(chat[key]) : `chat ${chat[key]} · canvas ${canvas[key]} · note ${note[key]}`);
  }
}

console.log("\nWhat the row says");
{
  // Back to a canvas, where both halves of the row have something in them.
  await page.locator("aside nav").getByRole("button", { name: "Code" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("listitem").first().click().catch(() => {});
  await page.waitForTimeout(900);
  const picker = await page.getByRole("button", { name: /^Model: / }).count();
  check(picker === 1, "the canvas says which model is about to rewrite the file — it used to pick one silently");
  const target = await page.locator(".composer-shell .font-mono").first().textContent().catch(() => null);
  check(Boolean(target), "and which file it is about to rewrite", target ?? "");
  await page.screenshot({ path: `${OUT}/bar-canvas-row.png` });
  await page.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("listitem").first().click().catch(() => {});
  await page.waitForTimeout(800);
}

console.log("\nAnd it works where it never used to");
{
  await page.getByRole("textbox", { name: "Page content" }).fill("The meeting was long and there were many things said in it that were not really necessary.");
  await page.waitForTimeout(400);
  const bar = page.getByRole("textbox", { name: "Ask for a change" });
  await bar.fill("make this shorter");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2600);
  const diff = await page.getByText(/Keep|Discard/).count();
  check(diff > 0, "a notebook page can be revised, and the revision arrives as a diff");
  await page.screenshot({ path: `${OUT}/bar-notebook.png` });
  await page.getByRole("button", { name: /^Keep/ }).click();
  await page.waitForTimeout(700);
  const after = await page.getByRole("textbox", { name: "Page content" }).inputValue();
  check(after.length > 0 && !after.startsWith("The meeting was long and there were many"),
    "keeping it writes it into the page", after.slice(0, 46) + "…");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
