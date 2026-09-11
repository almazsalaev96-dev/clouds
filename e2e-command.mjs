/**
 * One command, wherever you are.
 *
 * ⌘K could find things and could do nothing to them, so a sentence typed into
 * it was a search that failed. That is backwards: "make this shorter" is the
 * first thing anybody tries in a box that opens over whatever they are looking
 * at, and it was the one thing it could not do.
 *
 * Now the same box knows what is on screen. A file gets revised, a page gets
 * rewritten, a conversation gets it as the next message, and an empty chat
 * becomes one — and searching still works, which is the part that is easy to
 * break: "settings" must never become an instruction.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-command.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const wire = async () => (await (await fetch("http://127.0.0.1:8787/__last")).json());

const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const open = async (p = page) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(500); };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1100);

console.log("\nIt still finds things");
{
  await open();
  const box = page.getByRole("textbox", { name: "Command palette" });
  check(await box.isVisible(), "the palette opens on the key everybody presses");
  await box.fill("settings");
  await page.waitForTimeout(400);
  const shown = await page.locator('[role="listbox"]').innerText();
  check(/Settings/i.test(shown), "one word finds the thing it names");
  check(!/Say what you want/i.test(shown),
    "and is not turned into an instruction — that would make search unusable");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\nOn a file, a sentence changes the file");
{
  await page.getByRole("radio", { name: "Code" }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Code file/ }).click();
  await page.waitForTimeout(1000);
  const area = page.getByLabel("Canvas content");
  await area.click();
  await area.fill("export function add(a, b) {\n  return a + b;\n}\n");
  await page.waitForTimeout(700);

  await open();
  const box = page.getByRole("textbox", { name: "Command palette" });
  check(/say what to do with this file/i.test(await box.getAttribute("placeholder") ?? ""),
    "the box says what it is standing in front of",
    await box.getAttribute("placeholder"));

  await box.fill("add a doc comment to every function");
  await page.waitForTimeout(500);
  const shown = await page.locator('[role="listbox"]').innerText();
  check(/Say what you want/i.test(shown), "a sentence is offered as an instruction");
  check(/open file/i.test(shown), "and says what it would do it to", (shown.split("\n")[1] ?? "").slice(0, 50));
  await page.screenshot({ path: `${OUT}/command-file.png` });

  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  const asked = JSON.stringify(await wire());
  check(/add a doc comment to every function/.test(asked), "pressing it sends that instruction");
  check(/export function add/.test(asked), "about the file that was open, without being told which");
  check((await page.getByRole("button", { name: /^Keep/ }).count()) === 1,
    "and the change arrives as a diff like any other — nothing lands unseen");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(600);
}

console.log("\nIn a conversation, it is the next thing you said");
{
  /* Out of the canvas first: the section switcher lives in the shell's header,
     which a canvas takes over while it is open. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  /* "Conversations", not "Chat" — the latter is the composer's Chat/Creative
     mode toggle, which is a different control in a different place. */
  await page.getByRole("radio", { name: "Conversations" }).first().click();
  await page.waitForTimeout(800);
  await open();
  const box = page.getByRole("textbox", { name: "Command palette" });
  check(/new chat|conversation/i.test(await box.getAttribute("placeholder") ?? ""),
    "the same box, standing somewhere else, offers something else",
    await box.getAttribute("placeholder"));

  await box.fill("explain what a closure is");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2800);

  const shown = await page.locator("main").innerText();
  check(/explain what a closure is/i.test(shown), "it arrives as a message in the thread");
  const asked = JSON.stringify(await wire());
  check(/explain what a closure is/.test(asked), "and went to a model as one");
  await page.screenshot({ path: `${OUT}/command-chat.png` });
}

console.log("\nA short word is never an instruction");
{
  await open();
  const box = page.getByRole("textbox", { name: "Command palette" });
  await box.fill("code");
  await page.waitForTimeout(400);
  const shown = await page.locator('[role="listbox"]').innerText();
  check(!/Say what you want/i.test(shown),
    "one word stays a search however much is on screen to act on");
  /* Two words that find something stay a search. This is the invariant that
     matters: the instruction row goes *above* real matches only at three words
     or more, so a short query that matched cannot be displaced by it and
     pressing Enter cannot turn a lookup into a request. ("dark mode" matches
     nothing here — the command is called "Switch to light theme" — so offering
     it as an instruction there is right, not a bug.) */
  await box.fill("new chat");
  await page.waitForTimeout(400);
  const two = await page.locator('[role="listbox"]').innerText();
  check(!/Say what you want/i.test(two) && /New chat/i.test(two),
    "and two words that find something are not displaced by it", "new chat");
  await page.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
