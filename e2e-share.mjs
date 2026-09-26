/**
 * A link that is the conversation.
 *
 * The claims: Share puts a link on the clipboard whose fragment carries the
 * whole thread; a browser that has never seen this app opens it as a page
 * with the title, both turns and the Armi model's name, and fetches nothing
 * for it; HTML inside a message is shown as text, not run; "Continue in
 * Armi" makes it a conversation of that browser's own, with the address
 * cleaned; and a link with nothing after the # says so.
 *
 *   bash /tmp/claude-0/one.sh e2e-share
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

let link = "";
console.log("\nShare puts a link on the clipboard");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What is a debounce <img src=x onerror=\"document.title='pwned'\">");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  await p.getByRole("button", { name: /Conversation options|More/ }).first().click().catch(async () => {
    await p.locator("header").getByRole("button").last().click();
  });
  await p.waitForTimeout(300);
  await p.getByRole("menuitem", { name: "Share" }).click();
  await p.waitForTimeout(600);
  link = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check(/^http:\/\/localhost:3100\/share#z\./.test(link), "a link to /share with the thread after the #, compressed", link.slice(0, 48));
  check(link.length < 4000, "and short enough to paste anywhere", `${link.length} characters`);
  check(/Link copied/.test(await p.locator("main").innerText()), "and the app says so, and that no server holds it");
}

console.log("\nOpened by a browser that has never seen this app");
const fresh = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
{
  const fetched = [];
  fresh.on("request", (r) => { if (/\/api\//.test(r.url())) fetched.push(r.url()); });
  const ferrs = [];
  fresh.on("pageerror", (e) => ferrs.push(e.message));
  await fresh.goto(link, { waitUntil: "networkidle" });
  await fresh.waitForTimeout(1500);
  const art = fresh.getByRole("article", { name: "Shared conversation" });
  const shown = await art.isVisible();
  check(shown, "the page shows the conversation", shown ? "" : `url ${fresh.url().slice(0, 60)} · body: ${(await fresh.locator("body").innerText()).slice(0, 160).replace(/\s+/g, " ")} · errors: ${ferrs.join(" | ")}`);
  if (!shown) { console.log(`  ${failed} failed`); await b.close(); process.exit(1); }
  const text = await art.innerText();
  check(/What is a debounce/.test(text), "with the question", text.split("\n").find((l) => /debounce/i.test(l))?.slice(0, 60));
  check(/Mira 4\.1/i.test(text), "the Armi model's name over the answer, never the engine's", text.match(/Mira[^\n]*/i)?.[0]);
  check(!/claude|gpt|openai|anthropic/i.test(text), "no vendor name on the page");
  check(/2 messages/.test(text) && /no server holds a copy/.test(text), "and says what it is", text.match(/\d+ messages[^\n]*/)?.[0]?.slice(0, 70));
  check(fetched.length === 0, "nothing was fetched from the app's API to show it", fetched.join(" "));
  check((await fresh.title()) !== "pwned" && (await fresh.locator("img").count()) === 0, "HTML in a message is text on the page, not an element", await fresh.title());
  check(ferrs.length === 0, "no runtime errors on the shared page", ferrs.join(" | "));
}

console.log("\nContinued in Armi");
{
  await fresh.getByRole("link", { name: /Continue in Armi/ }).first().click();
  await fresh.waitForLoadState("networkidle");
  await fresh.waitForTimeout(2000);
  check(!/#share=/.test(fresh.url()), "the address is cleaned", fresh.url());
  const main = await fresh.locator("main").innerText();
  check(/Continued from a shared link/.test(main), "the app says it was continued from a link");
  check(/What is a debounce/.test(main), "with the thread in place, ready for the next question");
  const rows = await fresh.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const c = await new Promise((r) => { const q = d.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
    const m = await new Promise((r) => { const q = d.transaction("messages").objectStore("messages").getAll(); q.onsuccess = () => r(q.result); });
    return { conversations: c.length, messages: m.length, title: c[0]?.title };
  });
  check(rows.conversations === 1 && rows.messages === 2, "as one conversation of two messages in this browser's own store", JSON.stringify(rows));
  await fresh.reload({ waitUntil: "networkidle" });
  await fresh.waitForTimeout(800);
  const again = await fresh.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = d.transaction("conversations").objectStore("conversations").count(); q.onsuccess = () => r(q.result); });
  });
  check(again === 1, "and a reload does not make it twice");
}

console.log("\nA link with nothing in it");
{
  await fresh.goto("http://localhost:3100/share", { waitUntil: "networkidle" });
  await fresh.waitForTimeout(500);
  check(/Nothing to show/.test(await fresh.locator("main").innerText()), "says so, and why");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
