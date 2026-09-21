/**
 * A phone is not a small desk.
 *
 * Four claims at 430px wide with a finger for a pointer: Settings is the
 * whole screen with every field inside it, not a 44rem window cut off at
 * the edge; opening a page to read it does not raise the keyboard; the
 * composer's paperclip shares its row with send instead of taking one of
 * its own; and the study session's hint names what a finger can do.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, section: "notebook" };
/* Opens the drawer only if it is shut — closing Settings leaves it as it was. */
const drawer = async (label) => {
  const room = p.getByRole("button", { name: label }).first();
  if (!(await room.isVisible().catch(() => false))) { await p.getByRole("button", { name: /sidebar/i }).first().click(); await p.waitForTimeout(500); }
  await room.click();
  await p.waitForTimeout(900);
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.evaluate(() => new Promise((ok, no) => {
  const r = indexedDB.open("clouds");
  r.onerror = () => no(r.error);
  r.onsuccess = () => {
    const db = r.result, now = Date.now();
    const tx = db.transaction(["notes", "decks", "cards"], "readwrite");
    tx.objectStore("notes").put({ id: "n1", title: "Osmosis", content: "# Osmosis\n\nWater moves down a water-potential gradient.", createdAt: now, updatedAt: now });
    tx.objectStore("decks").put({ id: "d1", name: "Osmosis", createdAt: now, updatedAt: now });
    for (let i = 0; i < 4; i++) tx.objectStore("cards").put({ id: `c${i}`, deckId: "d1", front: `q${i}`, back: "a", state: "review", due: now - 1000, interval: 3, ease: 2.5, reps: 2, lapses: 0, step: 0, createdAt: now, stability: 3, difficulty: 5 });
    tx.oncomplete = () => { db.close(); ok(true); };
    tx.onerror = () => no(tx.error);
  };
}));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nOpening a page to read it does not raise the keyboard");
{
  await p.locator("main").getByText("Osmosis").first().click();
  await p.waitForTimeout(900);
  check(await p.getByLabel("Page content").isVisible(), "the page is open");
  check(await p.evaluate(() => document.activeElement?.tagName !== "TEXTAREA"), "and the caret is not in it — a keyboard over a page you came to read");
  const halo = await p.getByLabel("Page content").evaluate((el) => { el.focus(); return getComputedStyle(el).boxShadow; });
  check(halo === "none", "and when you do tap into it there is no box drawn around the page", halo);
}

console.log("\nThe composer spends no row on a paperclip alone");
{
  const bar = p.locator(".composer-shell").first();
  const clip = await bar.getByRole("button", { name: "Read something" }).first().boundingBox();
  const send = await bar.getByRole("button", { name: "Send message" }).first().boundingBox();
  check(clip && send && Math.abs((clip.y + clip.height / 2) - (send.y + send.height / 2)) < 8, "the paperclip and send sit on the same row", clip && send ? `clip y=${Math.round(clip.y)} send y=${Math.round(send.y)}` : "missing");
}

console.log("\nSettings is the whole screen, with everything inside it");
{
  await p.getByRole("button", { name: /sidebar/i }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(800);
  const dlg = p.locator("[role=dialog]").last();
  const box = await dlg.boundingBox();
  check(box && box.width >= 428 && box.x <= 1, "the dialog is as wide as the screen", box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : "none");
  const nav = dlg.getByRole("navigation", { name: "Settings pages" });
  check(await nav.isVisible(), "the pages are a strip across the top");
  const heading = await dlg.getByRole("heading", { name: "API keys" }).boundingBox();
  check(heading && heading.x >= 0 && heading.x + heading.width <= 430, "the heading is on the screen", heading ? `x=${Math.round(heading.x)}..${Math.round(heading.x + heading.width)}` : "none");
  const fields = await dlg.locator("input").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.right); }));
  check(fields.length > 0 && fields.every((r) => r <= 430), "and every key field ends inside it", fields.join(", "));
  await nav.getByRole("button", { name: "Privacy" }).click();
  await p.waitForTimeout(300);
  check(/What leaves/.test(await dlg.innerText()), "the strip changes the page");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
}

console.log("\nThe study session's hint names what a finger can do");
{
  await drawer("Study");
  await p.getByRole("button", { name: "Start", exact: true }).first().click();
  await p.waitForTimeout(900);
  const hint = await p.locator("#suggested").innerText();
  check(/Tap to show the answer/.test(hint), "tap, not Space", hint.trim());
  await p.getByRole("button", { name: "Show answer" }).click();
  await p.waitForTimeout(500);
  const after = await p.locator("#suggested").innerText();
  check(!/Esc|1 – 4/.test(after), "and nothing about keys it does not have", after.trim());
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
