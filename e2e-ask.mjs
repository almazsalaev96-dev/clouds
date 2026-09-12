/**
 * A question you have to answer before you are shown the answer.
 *
 * The clearest result in the literature on explaining things is also the least
 * convenient: exhibiting something teaches nobody. Learning shows up when the
 * reader had to produce something first — predict, commit, guess — and the
 * effect tracks how much they produced rather than how good the explanation
 * was. A perfectly clear, entirely receptive explanation underperforms a
 * mediocre one that made you guess.
 *
 * A stream physically cannot do that. The model asks "what do you think
 * happens here?" and four lines later, without waiting, tells you — so the
 * answer is on screen before the reader has had a thought about it. The two
 * teaching stances that avoid it do so by withholding across turns, which
 * costs a round trip and a model call per question.
 *
 * This is the in-message version, and the thing worth asserting is that the
 * gate is a real gate. Not hidden by a class — *absent* — so a screen reader
 * cannot read past it either, because a gate that only stops the sighted is
 * theatre.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-ask.mjs
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const ask = async (q, ms = 3200) => {
  await page.getByRole("textbox", { name: "Message" }).fill(q);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(ms);
};

console.log("\nThe answer is not on the page until you have committed to one");
await ask("what does reduce do on an empty list");
{
  const gate = page.locator("[data-predict]");
  check(await gate.count() === 1, "there is a gate in the answer", `${await gate.count()}`);
  check(/empty list/i.test(await gate.innerText()), "with the question in it", (await gate.innerText()).slice(0, 50));

  const opts = gate.locator("button");
  check(await opts.count() === 3, "and the options to choose between", `${await opts.count()}`);

  /* The load-bearing assertion. `hidden`, not a class — the explanation is not
     merely invisible, it is out of the accessibility tree, so nothing can read
     ahead of the commitment. */
  const sealed = await page.evaluate(() => {
    const r = document.querySelector("[data-predict] [role=status]");
    return { hidden: r?.hasAttribute("hidden"), text: (r?.textContent ?? "").trim() };
  });
  check(sealed.hidden === true, "the explanation is absent rather than merely invisible");
  const visible = await gate.innerText();
  check(!/nothing to return|no first element/i.test(visible), "so the reason is nowhere on the page yet", visible.slice(-60));
}

console.log("\nChoosing wrong tells you so, and says which it was");
{
  await page.locator("[data-predict] button").first().click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const r = document.querySelector("[data-predict] [role=status]");
    return { hidden: r?.hasAttribute("hidden"), text: (r?.textContent ?? "").trim(), live: r?.getAttribute("aria-live") };
  });
  check(after.hidden === false, "the reason is there now");
  check(/Not quite/i.test(after.text), "and says plainly that this was wrong", after.text.slice(0, 40));
  check(/throws/i.test(after.text), "naming the one it was", after.text.slice(0, 70));
  check(/no first element|nothing to return/i.test(after.text), "and why", after.text.slice(-60));
  check(after.live === "polite", "announced rather than only drawn", String(after.live));
}

console.log("\nRight and wrong are said with a mark, not only with a colour");
{
  const marked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("[data-predict] button")];
    return btns.map((b) => ({ svg: b.querySelectorAll("svg").length, text: b.textContent.trim() }));
  });
  check(marked.filter((m) => m.svg > 0).length === 2, "the chosen one and the right one both carry a glyph", JSON.stringify(marked.map((m) => m.svg)));
}

console.log("\nAnd it cannot be answered twice");
{
  const before = await page.evaluate(() => document.querySelector("[data-predict] [role=status]")?.textContent?.trim());
  await page.locator("[data-predict] button").nth(2).click({ force: true });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector("[data-predict] [role=status]")?.textContent?.trim());
  check(before === after, "a second press changes nothing", "");
  const disabled = await page.evaluate(() => [...document.querySelectorAll("[data-predict] button")].every((b) => b.disabled));
  check(disabled, "because every option is spent");
}

console.log("\nOn paper it opens: a worksheet that withholds its answer cannot be marked");
{
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const printed = await page.evaluate(() => {
    const r = document.querySelector("[data-predict] [role=status]");
    const btn = document.querySelector("[data-predict] button");
    return { reason: r ? getComputedStyle(r).display : "", buttons: btn ? getComputedStyle(btn).display : "" };
  });
  check(printed.reason === "block", "the reason prints", printed.reason);
  check(printed.buttons === "none", "and the buttons do not — they are application, not document", printed.buttons);
  await page.emulateMedia({ media: "screen" });
}

console.log("\nA malformed gate never eats the answer around it");
{
  /* The parser's refusals are checked properly in `test-predict.ts`, where all
     of them can be. What only a browser can show is the consequence: a gate the
     parser declines has to leave the message it was inside of intact. A throw
     in a renderer does not lose a feature, it loses the answer. */
  await fetch(`${MOCK}/__reset`);
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(700);
  await ask("what does fold do", 2600);

  const msg = page.locator(".msg").last();
  const body = await msg.innerText();
  check(await page.locator("[data-predict]").count() === 0, "the broken gate is not rendered as a gate");
  check(/takes the first element as the seed/.test(body), "the paragraph before it is still there");
  check(/becomes that value instead/.test(body), "and the paragraph after it", body.slice(-50));
  check((await msg.locator("pre").count()) === 1, "it fell through to a code block, which is what an unreadable fence is");
  check(errs.length === 0, "and nothing threw on the way", errs.join(" | "));
}

console.log("\nAnd it is only offered where someone is trying to understand");
{
  await fetch(`${MOCK}/__reset`);
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(700);
  await ask("teach me how a closure captures a variable", 2600);
  const learning = (await fetch(`${MOCK}/__last`).then((r) => r.json())).systemText ?? "";
  check(/## Asking before telling/.test(learning), "a learning request is told the gate exists");
  check(/mistakes people actually make/.test(learning), "and that a decoy nobody would pick teaches nothing");
  check(/Never gate the thing they came to find out/.test(learning), "and not to gate the answer itself");

  await fetch(`${MOCK}/__reset`);
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(700);
  await ask("rewrite this paragraph to be shorter", 2600);
  const writing = (await fetch(`${MOCK}/__last`).then((r) => r.json())).systemText ?? "";
  check(!/## Asking before telling/.test(writing), "and a request to write something is not quizzed");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-ask PASS");
process.exit(failed ? 1 : 0);
