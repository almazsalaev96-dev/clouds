/**
 * A routine runs when the app is next open after its time, once per time.
 *
 * The claims: Settings has a Routines panel that makes one; a routine owed
 * a run runs on open as a new conversation with its prompt; it is not run
 * twice for the same time; the thread's menu offers Share.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nA routine is made in Settings");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Routines" }).click();
  await p.waitForTimeout(300);
  await p.getByLabel("What to send").fill("Quiz me on what is due today");
  await p.getByLabel("At what time").fill("07:30");
  await p.getByRole("button", { name: "Add", exact: true }).click();
  await p.waitForTimeout(400);
  const list = p.getByRole("list", { name: "Routines" });
  check(/Quiz me on what is due today/.test(await list.innerText()), "and listed with its schedule", (await list.innerText()).replace(/\s+/g, " ").slice(0, 80));
  check(/Weekdays at 07:30/.test(await list.innerText()), "which reads as words, not a cron line");
  check(/runs the next time Armi is open/.test(await p.getByRole("dialog").innerText()), "the panel says the honest limit: it runs when Armi is open");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nOne owed a run runs on open, once");
{
  /* Made yesterday, for a minute ago, every day: owed exactly one run. */
  await p.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    const now = Date.now();
    const d = new Date(now - 60_000);
    const tx = db.transaction(["routines"], "readwrite");
    tx.objectStore("routines").put({ id: "rt-test", prompt: "Give me one card to try, then wait for my answer", hour: d.getHours(), minute: d.getMinutes(), days: [], enabled: true, createdAt: now - 86_400_000 });
    await new Promise((res) => { tx.oncomplete = res; });
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const first = await p.locator(".msg").first().innerText().catch(() => "");
  check(/Give me one card to try/.test(first), "the prompt was sent as a new conversation", first.replace(/\s+/g, " ").slice(0, 60));
  const convs = await p.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    return new Promise((res) => { const q = db.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => res(q.result.length); });
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const after = await p.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    return new Promise((res) => { const q = db.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => res(q.result.length); });
  });
  check(after === convs, "and opening again does not run it a second time for the same minute", `${convs} → ${after}`);
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Routines" }).click();
  await p.waitForTimeout(300);
  check(/last ran/.test(await p.getByRole("list", { name: "Routines" }).innerText()), "the panel says when it last ran");
  await p.keyboard.press("Escape");
}

console.log("\nA thread can be shared");
{
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Conversation options|More/ }).first().click().catch(async () => {
    await p.locator("header").getByRole("button").last().click();
  });
  await p.waitForTimeout(300);
  check(await p.getByRole("menuitem", { name: "Share" }).isVisible().catch(() => false), "the thread's menu offers Share");
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
