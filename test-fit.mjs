/** Truncation and the automatic retry, in a real browser. */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const check = (p, l, d = "") => console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`);

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "gpt-4.1", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", lastConversationId: null }, version: 1 })));

// A thread far past a small window, seeded straight into the database.
await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(800);
const over = await page.evaluate(async () => {
  const d = await new Promise((r, j) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const now = Date.now();
  const filler = "lorem ipsum dolor sit amet ".repeat(900); // ~6k tokens per turn
  const msgs = []; let parent = null;
  for (let i = 0; i < 60; i++) {
    const u = { id: `u${i}`, conversationId: "big", parentId: parent, role: "user", content: [{ type: "text", text: `Turn ${i}. ${filler}` }], createdAt: now - (60 - i) * 2000 };
    const a = { id: `a${i}`, conversationId: "big", parentId: u.id, role: "assistant", content: [{ type: "text", text: `Reply ${i}. ${filler}` }], modelId: "claude-sonnet-4-5", createdAt: now - (60 - i) * 2000 + 500, stopReason: "stop" };
    msgs.push(u, a); parent = a.id;
  }
  await new Promise((res, rej) => {
    const tx = d.transaction(["conversations", "messages"], "readwrite");
    tx.objectStore("conversations").put({ id: "big", title: "A very long thread", createdAt: now, updatedAt: now, pinned: false, archived: false, modelId: "claude-sonnet-4-5", leafId: parent, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    msgs.forEach((m) => tx.objectStore("messages").put(m));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  d.close();
  return msgs.length;
});
console.log(`  · seeded ${over} messages (~360k tokens, window is 200k)`);

await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1200);
await page.getByRole("button", { name: /A very long thread/ }).first().click();
await page.waitForTimeout(1200);
const ta = page.locator("textarea").first();
await ta.click(); await ta.type("summarise", { delay: 4 });
await page.keyboard.press("Enter");
await page.waitForTimeout(3500);

const notice = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((s) => /earlier messages? not sent/.test(s.textContent || ""));
  return el?.textContent?.trim().replace(/\s+/g, " ") ?? null;
});
check(Boolean(notice), "the app says what it left out", notice || "silent");

const sent = await (await fetch("http://127.0.0.1:8787/__last")).json();
check(sent.turns > 0 && sent.turns < 121, "the request was trimmed to fit", `${sent.turns} of 121 turns sent`);

const answered = await page.evaluate(() => document.body.innerText.includes("waits for silence"));
check(answered, "and it answered instead of failing");
console.log(errs.length ? "  ✗ " + errs[0] : "  ✓ no runtime errors");
await b.close();
