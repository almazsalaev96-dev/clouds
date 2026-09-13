/**
 * What is kept, and what is not.
 *
 * Memory: "remember that …" in a chat saves the fact, the next turn's prompt
 * carries it, Settings shows it in full, and deleting it there takes it out
 * of the next prompt. Temporary: a chat marked temporary before its first
 * message is not in the sidebar, sends no memory, and is gone from the
 * database the moment another thread is opened.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-keep.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, memoryOn: true };
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

const box = p.locator(".composer-shell textarea").first();
const lastSystem = async () => (await fetch("http://127.0.0.1:8787/__last").then((r) => r.json())).systemText ?? "";
const say = async (t) => { await box.fill(t); await p.keyboard.press("Enter"); await p.waitForTimeout(2600); };
const rows = async () => p.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open("clouds"); r.onsuccess = () => {
    const tx = r.result.transaction("conversations"); const q = tx.objectStore("conversations").getAll();
    q.onsuccess = () => { r.result.close(); ok(q.result.map((c) => ({ id: c.id, temporary: !!c.temporary }))); };
  };
}));

console.log("\nRemember that");
{
  await say("remember that I teach year 9 maths");
  await p.waitForTimeout(400);
  check(await p.getByText(/^Remembered/).count() === 1, "saying it is enough: a bar says it was remembered, with a way back");
  const sys = await lastSystem();
  check(/About this person/.test(sys) && /teach year 9 maths/.test(sys), "and the prompt for the very same turn already carries it", sys.slice(0, 0));
  await say("what is a debounce");
  check(/teach year 9 maths/.test(await lastSystem()), "as does the next");
}

console.log("\nShown in full, and deletable");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Memory" }).click();
  await p.waitForTimeout(300);
  const list = p.getByRole("list", { name: "Memories" });
  check(await list.getByText("I teach year 9 maths").count() === 1, "the line is in Settings, as said");
  await p.getByRole("textbox", { name: "Something to remember" }).fill("I prefer metric units");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  check(await list.locator("li").count() === 2, "one can be added by hand");
  await list.getByRole("button", { name: /^Forget "I teach/ }).click();
  await p.waitForTimeout(300);
  check(await list.locator("li").count() === 1, "and forgotten");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await say("and a throttle?");
  const sys = await lastSystem();
  check(!/teach year 9 maths/.test(sys) && /metric units/.test(sys), "the next prompt has the one and not the other");
}

console.log("\nSwitched off, the list stays and the prompt loses it");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Memory" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("switch", { name: "Use memory" }).click();
  check(await p.getByRole("list", { name: "Memories" }).locator("li").count() === 1, "the list is still there");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await say("and a queue?");
  check(!/About this person/.test(await lastSystem()), "and the prompt says nothing about the person");
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Memory" }).click();
  await p.getByRole("switch", { name: "Use memory" }).click();
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nA temporary chat");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  const listed = await p.locator("aside button[title]").count();
  const toggle = p.getByRole("button", { name: "Temporary chat" });
  check(await toggle.count() === 1, "is offered before the first message, top right");
  await toggle.click();
  check(await p.getByText("Temporary", { exact: true }).count() === 1, "and says so where the title would be");
  await say("remember that I live in Tashkent");
  const sys = await lastSystem();
  check(!/About this person/.test(sys), "sends no memory");
  check(await p.getByText(/^Remembered/).count() === 0, "and keeps none");
  const before = await rows();
  const temp = before.filter((c) => c.temporary);
  check(temp.length === 1, "it exists while you are in it", `${temp.length} temporary rows`);
  check(await p.locator("aside button[title]").count() === listed, "but is not in the sidebar", `${listed} rows before, ${await p.locator("aside button[title]").count()} after`);
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(600);
  const after = await rows();
  check(!after.some((c) => c.temporary), "and is gone the moment you leave it", `${after.filter((c) => c.temporary).length} left`);
  check(after.length === before.length - 1, "deleted, not hidden", `${before.length} → ${after.length} rows`);
  check(await p.getByRole("button", { name: "Temporary chat" }).count() === 1, "the next chat starts as a kept one again");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
