/**
 * The app under weight.
 *
 * Everything else here is tested at three messages, where nothing is slow and
 * nothing is heavy. This one asks the two questions that only have answers at
 * scale: what does it cost to open, and does it stay responsive once there is
 * something in it worth keeping.
 *
 * Both regressed silently while nobody was looking. The first bundle grew past
 * its own stated budget by a catalogue of templates most people never press.
 * And typing in the composer took 217ms a character in a four-hundred-turn
 * conversation, because a page that only ever *wrote* a draft had subscribed
 * itself to the store it wrote to, so every keystroke rebuilt the transcript.
 * Neither shows up in a screenshot and neither breaks a single assertion in
 * any other file.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-scale.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

console.log("\nWhat it costs to open");
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let js = 0;
  page.on("response", async (r) => {
    if (!/\.js(\?|$)/.test(r.url())) return;
    try { js += (await r.body()).length; } catch { /* redirects and aborts have none */ }
  });
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const kb = Math.round(js / 1024);
  /* The README's budget. Generous against the 245kB the build reports, because
     that number is uncompressed and this one is what actually crossed the
     wire — but tight enough that another catalogue landing in the first bundle
     shows up here rather than in a bug report from someone on a train. */
  check(kb < 400, "the first load stays under budget", `${kb} kB of JavaScript`);
  await ctx.close();
}

console.log("\nFour hundred turns");
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);

await page.evaluate(async () => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  const now = Date.now();
  const tx = d.transaction(["conversations", "messages"], "readwrite");
  tx.objectStore("conversations").put({
    id: "big", title: "A long one", createdAt: now, updatedAt: now,
    pinned: false, leafId: "m399", modelId: "claude-sonnet-4-5",
  });
  let parent = null;
  for (let i = 0; i < 400; i++) {
    const id = "m" + i;
    tx.objectStore("messages").put({
      id, conversationId: "big", parentId: parent, role: i % 2 ? "assistant" : "user",
      content: [{ type: "text", text: `Turn ${i}. ` + "The quick brown fox jumps over the lazy dog. ".repeat(12) }],
      createdAt: now + i, modelId: "claude-sonnet-4-5",
    });
    parent = id;
  }
  await new Promise((r) => { tx.oncomplete = r; });
  d.close();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);

const opened = Date.now();
await page.getByRole("button", { name: /A long one/ }).first().click();
await page.locator(".msg").last().waitFor({ timeout: 20000 });
const openMs = Date.now() - opened;
check((await page.locator(".msg").count()) === 400, "the whole thread is there", `${await page.locator(".msg").count()} turns`);
check(openMs < 6000, "and it opens without a stall", `${openMs}ms`);

/* Long tasks, not just a stopwatch. A wall-clock budget alone is a flake
   waiting for a slow machine; "did anything block the main thread for more
   than a tenth of a second" is the question a person actually feels. */
await page.evaluate(() => {
  window.__long = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); })
    .observe({ entryTypes: ["longtask"] });
});

const typed = Date.now();
await page.getByRole("textbox", { name: "Message" }).type("hello there", { delay: 12 });
const typeMs = Date.now() - typed;
const long = await page.evaluate(() => window.__long);
const worst = long.length ? Math.max(...long) : 0;

check(typeMs < 900, "typing stays responsive in it", `11 characters in ${typeMs}ms`);
check(worst < 150, "and no keystroke blocks the main thread", worst ? `worst task ${worst}ms` : "no long tasks at all");

await page.evaluate(() => { window.__long = []; });
const scrolled = Date.now();
await page.evaluate(() => document.querySelector("[aria-label='Conversation']")?.scrollTo({ top: 0 }));
await page.waitForTimeout(300);
await page.evaluate(() => { const e = document.querySelector("[aria-label='Conversation']"); if (e) e.scrollTo({ top: e.scrollHeight }); });
await page.waitForTimeout(300);
check(Date.now() - scrolled < 2500, "and so does scrolling the whole way", `${Date.now() - scrolled}ms`);

/* The reason this app skips paint for off-screen turns with
   `content-visibility: auto` rather than windowing them properly is that
   windowing takes the text out of the document, and text that is not in the
   document cannot be found, selected across, or scrolled back to. That is the
   whole of the trade, so it is worth an assertion: drag a selection from the
   first turn to the four-hundredth and see whether both ends come back. */
const spanning = await page.evaluate(() => {
  const msgs = [...document.querySelectorAll("[id^=m-]")];
  if (msgs.length < 3) return null;
  const r = document.createRange();
  r.setStart(msgs[0], 0);
  r.setEnd(msgs[msgs.length - 1], msgs[msgs.length - 1].childNodes.length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  const text = sel.toString();
  sel.removeAllRanges();
  return { chars: text.length, head: text.slice(0, 24).trim(), tail: text.slice(-24).trim(), turns: msgs.length };
});
check(Boolean(spanning) && spanning.chars > 10_000,
  "a selection reaches from the first turn to the last, off-screen ones included",
  spanning ? `${spanning.chars} characters across ${spanning.turns} turns` : "no messages");

console.log("\nAnd what a section costs to press, on a connection that is not yours");
{
  /* Projects and the notebook are fetched when you press them rather than
     shipped to everyone who only ever chats. That is free on a desk — 138ms —
     and on a slow connection it was 1.4 seconds of nothing at all: the sidebar
     row lit up and the middle of the screen stayed as it was. Pressing a
     button and watching nothing happen is the same as pressing a button that
     does not work, so the frame has to arrive before the contents do. */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((st) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: st, version: 1 })), SETTINGS);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);

  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 });

  for (const [label, title] of [["Projects", "Projects"], ["Notebook", "Notebook"]]) {
    await p.getByRole("button", { name: new RegExp(`^${label}$`) }).click();
    await p.waitForTimeout(600);
    const mid = await p.evaluate(() => ({
      text: (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").trim(),
      skeletons: document.querySelectorAll(".skeleton").length,
    }));
    check(mid.text.startsWith(title), `${label} names itself before its code has arrived`, JSON.stringify(mid.text.slice(0, 30)));
    check(mid.skeletons > 0, "and holds the shape of what is coming", `${mid.skeletons} placeholders`);
    await p.waitForTimeout(2500);
    const done = await p.evaluate(() => ({
      text: (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").trim(),
      skeletons: document.querySelectorAll(".skeleton").length,
    }));
    check(done.skeletons === 0 && done.text.length > mid.text.length, `then ${label.toLowerCase()} itself`, `${done.text.length} characters`);
    await p.locator("aside nav").getByRole("button", { name: "Conversations" }).click();
    await p.waitForTimeout(500);
  }
  await ctx.close();
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
