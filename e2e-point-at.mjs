/**
 * Pointing at a sentence and asking about that sentence.
 *
 * The thing a reader is worst at is describing what they did not understand.
 * "I don't follow the bit about the cache" costs a paragraph to write, arrives
 * ambiguous, and is answered by an assistant that has to guess which bit.
 * Dragging across it costs nothing and is exact — the selection *is* the
 * description. That is the whole feature, and the reason every frontier
 * product grew this gesture inside eighteen months.
 *
 * What is asserted is the part that is easy to get wrong: that the quote
 * reaches the model verbatim rather than a paraphrase of it, that the bar is
 * scoped to answers rather than to the whole page, that it does not fire on a
 * stray click, and that Ask hands the question back to the person instead of
 * sending one on their behalf.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-point-at.mjs
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
await page.keyboard.press("Enter");
await page.waitForTimeout(2800);

/** Select a run of words inside the answer, the way a drag would. */
const selectInAnswer = async () => {
  /* Bring it into view *first* and let the scroll settle. The component drops
     the bar on any scroll — a bar pinned to a viewport position while the text
     under it moves is a bar pointing at the wrong words — so scrolling after
     the selection would clear it a frame later. */
  await page.evaluate(() => {
    const p = [...document.querySelectorAll(".prose p")].filter((n) => (n.textContent ?? "").length > 40).pop();
    p?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const p = [...document.querySelectorAll(".prose p")].filter((n) => (n.textContent ?? "").length > 40).pop();
    if (!p) return null;
    const node = [...p.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? "").length > 30);
    if (!node) return null;
    const r = document.createRange();
    r.setStart(node, 2);
    r.setEnd(node, 30);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    return sel.toString();
  });
};

console.log("\nDrag across a sentence and the app offers to talk about it");
const quote = await selectInAnswer();
await page.waitForTimeout(400);
check(Boolean(quote), "there is an answer to point at", JSON.stringify(quote));
const bar = page.getByRole("toolbar", { name: /selected text/i });
check(await bar.count() > 0, "a toolbar appears over the selection");
const labels = await bar.locator("button").allInnerTexts();
check(labels.length >= 3, "with more than one thing to do about it", labels.join(", "));

console.log("\nAnd it paints the span it is talking about");
{
  const painted = await page.evaluate(() => Boolean(CSS.highlights?.get("armi-point")));
  check(painted, "the selection is registered as a browser highlight, not wrapped in a tag");
  const spans = await page.evaluate(() => document.querySelectorAll(".prose mark, .prose .armi-point").length);
  check(spans === 0, "so nothing was inserted into markdown the renderer owns", `${spans} inserted`);
}

console.log("\nExplain sends the sentence itself, not a description of it");
{
  await fetch(`${MOCK}/__reset`);
  await bar.getByRole("button", { name: /Explain this part/i }).click();
  await page.waitForTimeout(2800);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  const asked = last.userText ?? "";
  check(asked.includes(quote.slice(0, 24)), "the words they pointed at arrived verbatim", quote.slice(0, 40));
  check(/^>|\n> /m.test(asked), "quoted, so the model can tell the citation from the question");
  check(/Explain this part/i.test(asked), "with the question attached", (asked.match(/Explain this part[^.]*/) ?? [""])[0].slice(0, 60));
  check(/Assume I followed the rest/i.test(asked), "and told not to re-explain the surrounding argument");

  /* The mark outlives the selection. While the browser's own blue is on the
     words it paints over ours and ours does nothing; the moment the selection
     is released, it is the only thing left saying which sentence the answer
     coming back is about. */
  const stillLit = await page.evaluate(() => ({
    marked: Boolean(CSS.highlights?.get("armi-point")),
    selected: (getSelection()?.toString() ?? "").length,
  }));
  check(stillLit.marked, "the clause stays lit while the reply comes back");
  check(stillLit.selected === 0, "though the selection itself is released", `${stillLit.selected} chars`);
  check(await bar.count() === 0, "and the toolbar has gone");
}

console.log("\nAsk hands the question back rather than asking one for you");
{
  await selectInAnswer();
  await page.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  await page.getByRole("toolbar", { name: /selected text/i }).getByRole("button", { name: /Ask your own/i }).click();
  await page.waitForTimeout(1200);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(Object.keys(last).length === 0, "nothing was sent", JSON.stringify(last).slice(0, 50));
  const draft = await page.inputValue('textarea[aria-label="Message"]');
  check(draft.includes(quote.slice(0, 20)), "the quote is waiting in the composer", draft.slice(0, 50));
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  check(focused === "Message", "with the cursor in it", String(focused));
}

console.log("\nIt stays out of the way the rest of the time");
{
  await page.keyboard.press("Escape");
  await page.evaluate(() => getSelection()?.removeAllRanges());
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
  await page.waitForTimeout(400);
  check(await page.getByRole("toolbar", { name: /selected text/i }).count() === 0, "no selection, no toolbar");

  /* A stray click-drag catches one short word. A bar appearing over that reads
     as the interface twitching at you. */
  await page.evaluate(() => {
    const p = [...document.querySelectorAll(".prose p")].filter((n) => (n.textContent ?? "").length > 40).pop();
    const node = [...p.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? "").length > 10);
    const r = document.createRange();
    r.setStart(node, 0); r.setEnd(node, 3);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  check(await page.getByRole("toolbar", { name: /selected text/i }).count() === 0, "and three characters is not a question", "");

  /* Your own question is not something to ask about — that is a loop. */
  await page.evaluate(() => {
    const mine = [...document.querySelectorAll("[id^=m-]")].find((m) => !m.querySelector(".prose"));
    if (!mine) return;
    const r = document.createRange();
    r.selectNodeContents(mine);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  check(await page.getByRole("toolbar", { name: /selected text/i }).count() === 0, "and your own question is not a thing to ask about");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-point-at PASS");
process.exit(failed ? 1 : 0);
