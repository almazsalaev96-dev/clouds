/**
 * The model uses the rooms.
 *
 * The claims: a request carries the app's tools; when the model asks for
 * one, the app runs it here, the wait says what is being done, the answer
 * that follows is written from the result, the thing made is really in its
 * room, the chip under the answer opens it, and Undo takes it back — and
 * with the setting off, no tool goes out at all.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true };
const box = () => p.getByRole("textbox", { name: "Message" });
const say = async (text) => { await box().fill(text); await p.keyboard.press("Meta+Enter"); };
const lastRow = () => p.locator(".msg").last();

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nAsked for cards, the model saves them into Study");
{
  await fetch(`${MOCK}/__reset`);
  await say("make me flashcards about debounce");
  const doing = p.getByText("Saving cards", { exact: true });
  await doing.waitFor({ timeout: 6000 }).catch(() => {});
  check(await doing.isVisible().catch(() => false), "the wait says what is being done");
  await p.waitForTimeout(4500);
  const { recent } = await fetch(`${MOCK}/__recent`).then((r) => r.json());
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check((last.tools ?? []).includes("save_cards") && (last.tools ?? []).includes("search_notes"), "the request carried the app's tools", (last.tools ?? []).join(","));
  check(recent.filter((r) => r.kind === "answer").length >= 2, "the turn went out twice: the ask, then the result", recent.map((r) => r.kind).join(" → "));
  const row = await lastRow().innerText();
  check(/Done — Saved 3 cards to “Debounce”/.test(row), "the answer is written from what was actually done", row.split("\n").find((l) => /Done/.test(l))?.slice(0, 60));
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(await chip.isVisible(), "and the chip under it says so");
  check(/Saved 3 cards to “Debounce”/.test(await chip.innerText()), "with the count and the deck", (await chip.innerText()).replace(/\s+/g, " "));
  const system = recent.find((r) => r.kind === "answer")?.system ?? "";
  check(/What you can do in this app/.test(system), "and the model was told the manners");
}

console.log("\nOpen goes to the deck; it really has the cards");
{
  await lastRow().getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(900);
  const main = await p.locator("main").innerText();
  check(/Debounce/.test(main) && /3 cards|3 new/.test(main), "the Study room shows the deck with three cards", main.replace(/\s+/g, " ").slice(0, 120));
  await p.getByRole("button", { name: "Conversations" }).click().catch(async () => { await p.getByRole("link", { name: "Conversations" }).click(); });
  await p.waitForTimeout(600);
}

console.log("\nA page, written and then taken back");
{
  await fetch(`${MOCK}/__reset`);
  await say("save that as a note");
  await p.waitForTimeout(5000);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Wrote the page “Debounce, explained”/.test(await chip.innerText().catch(() => "")), "the chip names the page");
  const notes = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("notes").objectStore("notes").getAll(); t.onsuccess = () => res(t.result.map((n) => n.title)); }; }));
  check(notes.includes("Debounce, explained"), "and the Notebook has it", notes.join(" | "));
  await chip.getByRole("button", { name: "Undo" }).click();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("notes").objectStore("notes").getAll(); t.onsuccess = () => res(t.result.map((n) => n.title)); }; }));
  check(!after.includes("Debounce, explained"), "Undo removes it");
  check((await chip.getByRole("button", { name: "Undo" }).count()) === 0, "and the chip no longer offers to");
  check(await p.getByText(/Undone: Wrote the page/).isVisible().catch(() => false), "with a notice saying so");
}

console.log("\nA page is read back, and added to");
{
  await fetch(`${MOCK}/__reset`);
  await say("save that as a note");
  await p.waitForTimeout(5000);
  await say("read me my debounce page");
  await p.waitForTimeout(5000);
  const read = await lastRow().innerText();
  check(/Done — # Debounce, explained/.test(read), "the whole page came back, by its closest title", read.split("\n").find((l) => /Done/.test(l))?.slice(0, 60));
  await say("add a line to my debounce page");
  await p.waitForTimeout(5000);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Added to the page “Debounce, explained”/.test(await chip.innerText().catch(() => "")), "the chip says it was added to");
  const content = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("notes").objectStore("notes").getAll(); t.onsuccess = () => res(t.result.find((n) => n.title === "Debounce, explained")?.content ?? ""); }; }));
  check(/Added by the model/.test(content) && /^# Debounce, explained/.test(content), "the page has the line at the end and its start intact");
  await chip.getByRole("button", { name: "Undo" }).click();
  await p.waitForTimeout(700);
  const restored = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("notes").objectStore("notes").getAll(); t.onsuccess = () => res(t.result.find((n) => n.title === "Debounce, explained")?.content ?? ""); }; }));
  check(!/Added by the model/.test(restored) && restored.length > 0, "and Undo puts the page back as it was");
}

console.log("\nReading tools: the study room and the clock");
{
  await fetch(`${MOCK}/__reset`);
  await say("what's due?");
  await p.waitForTimeout(5000);
  const row = await lastRow().innerText();
  check(/3 cards in 1 deck/.test(row) && /due now/.test(row), "the model was told the real numbers", row.split("\n").find((l) => /Done/.test(l))?.slice(0, 80));
  await say("what time is it?");
  await p.waitForTimeout(5000);
  const clock = await lastRow().innerText();
  check(/Done — \w+day, /.test(clock), "and the clock answers with the day", clock.split("\n").find((l) => /Done/.test(l))?.slice(0, 60));
  await say("calculate 948392 * 73");
  await p.waitForTimeout(5000);
  const sum = await lastRow().innerText();
  check(/69,232,616/.test(sum), "a sum comes back exact", sum.split("\n").find((l) => /Done/.test(l))?.slice(0, 60));
}

console.log("\nWith the setting off, nothing is offered");
{
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, actionsOn: false }, version: 1 })), S);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await fetch(`${MOCK}/__reset`);
  await say("make me flashcards about throttling");
  await p.waitForTimeout(4000);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(!(last.tools ?? []).length, "the request carried no tools", (last.tools ?? []).join(","));
  check(!/Done —/.test(await lastRow().innerText()), "and the answer is an answer, not a doing");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
