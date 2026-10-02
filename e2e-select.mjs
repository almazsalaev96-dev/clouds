/**
 * Comfort: the few words you selected, the topic that is going worst, and
 * a way back to a conversation.
 *
 * The claims: selecting words in an answer shows a bar over them with
 * Explain, Quote and Card; Quote puts them in the box as a quote with the
 * caret after; Explain sends a question about exactly those words; the
 * bar does not show over the person's own turn; the blank page names the
 * weakest topic; the conversation menu copies a link that opens the same
 * chat here, and a link to a chat that is not here opens nothing.
 *
 *   bash /tmp/claude-0/one.sh e2e-select
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
/* Cards in two topics, and a log where one of them keeps going wrong. */
await p.evaluate(() => new Promise((ok, no) => {
  const r = indexedDB.open("clouds");
  r.onerror = () => no(r.error);
  r.onsuccess = () => {
    const db = r.result, now = Date.now();
    const tx = db.transaction(["decks", "cards", "attempts"], "readwrite");
    tx.objectStore("decks").put({ id: "d1", name: "Biology", createdAt: now, updatedAt: now });
    for (let i = 0; i < 4; i++) tx.objectStore("cards").put({ id: `o${i}`, deckId: "d1", topic: "Osmosis", front: `osmosis ${i}`, back: "a", state: "review", due: now + 86_400_000, interval: 3, ease: 2.5, reps: 2, lapses: 0, step: 0, createdAt: now, stability: 3, difficulty: 5 });
    for (let i = 0; i < 4; i++) tx.objectStore("cards").put({ id: `m${i}`, deckId: "d1", topic: "Mitosis", front: `mitosis ${i}`, back: "a", state: "review", due: now + 86_400_000, interval: 20, ease: 2.5, reps: 5, lapses: 0, step: 0, createdAt: now, stability: 40, difficulty: 3 });
    for (let i = 0; i < 6; i++) tx.objectStore("attempts").put({ id: `a${i}`, at: now - i * 3_600_000, cardId: `o${i % 4}`, deckId: "d1", topic: "Osmosis", question: `osmosis ${i % 4}`, given: "x", expected: "a", right: i === 0 });
    for (let i = 0; i < 6; i++) tx.objectStore("attempts").put({ id: `b${i}`, at: now - i * 3_600_000, cardId: `m${i % 4}`, deckId: "d1", topic: "Mitosis", question: `mitosis ${i % 4}`, given: "a", expected: "a", right: true });
    tx.oncomplete = () => { db.close(); ok(true); };
    tx.onerror = () => no(tx.error);
  };
}));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe blank page names the weakest topic");
{
  const main = await p.locator("main").innerText();
  check(/“Osmosis” is your weakest topic/.test(main), "the one going worst, by name", (main.match(/“[^”]+” is your weakest topic/) ?? [""])[0]);
  check(!/Mitosis/.test(main), "and not the one going well");
}

console.log("\nSelected words of an answer get a bar: Explain, Quote, Card");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const strong = p.locator(".msg[data-role=assistant] strong").filter({ hasText: "throttle" }).first();
  await strong.waitFor({ timeout: 5000 });
  /* Select the word by its text node, the way a drag would. */
  await strong.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await p.waitForTimeout(400);
  const bar = p.getByRole("toolbar", { name: "With the selected words" });
  check(await bar.isVisible(), "a bar appears over the selection");
  for (const n of ["Explain", "Quote", "Card"]) check(await bar.getByRole("button", { name: n }).isVisible(), `with ${n}`);
  await bar.getByRole("button", { name: "Quote" }).click();
  await p.waitForTimeout(300);
  const typed = await box().inputValue();
  check(/^> throttle\n\n$/.test(typed), "Quote puts the words in the box as a quote, the caret after", JSON.stringify(typed));
  check(await box().evaluate((el) => document.activeElement === el), "and the box has the caret");
  check((await bar.count()) === 0, "and the bar has gone with the selection");
  await box().fill("");

  await strong.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("toolbar", { name: "With the selected words" }).getByRole("button", { name: "Explain" }).click();
  await p.waitForTimeout(3500);
  check(/Explain this part in more detail: “throttle”/.test(await p.locator("main").innerText()), "Explain asks about exactly those words");

  /* The person's own words need no bar. */
  const mine = p.locator(".msg").filter({ hasText: "what is a debounce" }).first();
  await mine.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el.querySelector("p") ?? el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.waitForTimeout(400);
  check((await p.getByRole("toolbar", { name: "With the selected words" }).count()) === 0, "nothing over a selection in your own turn");
  await p.evaluate(() => window.getSelection()?.removeAllRanges());
}

console.log("\nA link back to this chat");
{
  const id = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("conversations").objectStore("conversations").getAll(); t.onsuccess = () => ok(t.result[0]?.id); }; }));
  await p.getByRole("button", { name: "Conversation options" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("menuitem", { name: "Copy link to this chat" }).click();
  await p.waitForTimeout(400);
  const copied = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check(copied === `http://localhost:3100/#chat=${id}`, "the menu copies the address with the chat's id", copied);
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await p.goto("about:blank");
  await p.goto(copied, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  check(/what is a debounce/.test(await p.locator("main").innerText()), "opening it lands on that chat");
  check(!/#chat=/.test(p.url()), "and the address is cleaned", p.url());
  await p.goto("about:blank");
  await p.goto("http://localhost:3100/#chat=not-here", { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  /* The app opens where it was last — that chat — and the bad link is
     simply not followed: no error, no empty room, the address cleaned. */
  check(!/#chat=/.test(p.url()) && (await p.locator("main").innerText()).length > 20, "a link to a chat that is not here is not followed, and nothing breaks", p.url());
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
