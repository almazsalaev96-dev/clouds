/**
 * When each turn was said, and where each day starts in a thread; and the
 * accent as the one colour the app is.
 *
 * The claims: every turn carries its time, as a clock reads it, shown with
 * the hover controls and never as a stamp under the text; a thread that
 * runs over days has a heading where each day starts and a one-sitting
 * thread has none; with a non-blue accent chosen, the voice button, the
 * phone's Chat button and the avatar take the accent — no fixed blue is
 * left on screen.
 *
 *   bash /tmp/claude-0/one.sh e2e-time
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true, accent: "rose" };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
/* A thread with two turns two days ago and two today. */
await p.evaluate(() => new Promise((ok, no) => {
  const r = indexedDB.open("clouds");
  r.onerror = () => no(r.error);
  r.onsuccess = () => {
    const db = r.result, now = Date.now(), then = now - 2 * 86_400_000;
    const tx = db.transaction(["conversations", "messages"], "readwrite");
    tx.objectStore("conversations").put({ id: "cv1", title: "Osmosis over two days", modelId: "one", createdAt: then, updatedAt: now, leafId: "m4" });
    const m = (id, parentId, role, text, at) => tx.objectStore("messages").put({ id, conversationId: "cv1", parentId, role, content: [{ type: "text", text }], createdAt: at, ...(role === "assistant" ? { presetId: "one" } : {}) });
    m("m1", null, "user", "what is osmosis", then);
    m("m2", "m1", "assistant", "Water moving down a water-potential gradient.", then + 5_000);
    m("m3", "m2", "user", "and turgor?", now - 60_000);
    m("m4", "m3", "assistant", "Pressure from water inside the cell against the wall.", now - 50_000);
    tx.oncomplete = () => { db.close(); ok(true); };
    tx.onerror = () => no(tx.error);
  };
}));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.getByRole("button", { name: /Osmosis over two days/ }).first().click();
await p.waitForTimeout(800);

console.log("\nEach turn carries its time; a day change is a heading");
{
  const times = p.locator("main time");
  check((await times.count()) === 4, "four turns, four times", `${await times.count()}`);
  const texts = await times.allInnerTexts();
  check(/^\d{1,2}:\d{2}/.test(texts[3]) && !/Today/.test(texts[3]), "today's is the clock alone", texts[3]);
  check(/^\d{1,2} \w+, \d{1,2}:\d{2}/.test(texts[0]) || /\w+ \d{1,2}, \d{1,2}:\d{2}/.test(texts[0]), "an older one carries its date", texts[0]);
  check((await times.first().getAttribute("datetime"))?.endsWith("Z"), "with a machine-readable datetime for a screen reader and a copy");
  const seps = p.locator("main [role=separator]");
  check((await seps.count()) === 1, "one heading, where the day changes", `${await seps.count()}`);
  check((await seps.first().getAttribute("aria-label")) === "Today", "and it says Today", await seps.first().getAttribute("aria-label"));
  /* Not printed under every turn: hidden until the row is hovered. */
  const op = await times.nth(1).evaluate((el) => getComputedStyle(el.closest(".reveal") ?? el).opacity);
  check(Number(op) < 0.5, "a time is not a stamp — it comes with the hover controls", `opacity ${op}`);
}

console.log("\nA one-sitting thread has no heading");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await fetch("http://127.0.0.1:8787/__reset");
  await p.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  check((await p.locator("main [role=separator]").count()) === 0, "nothing between turns of one sitting");
}

console.log("\nThe accent is the one colour");
{
  const fill = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-fill").trim());
  const rgb = await p.evaluate((h) => { const d = document.createElement("div"); d.style.color = h; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, fill);
  await p.getByRole("textbox", { name: "Message" }).fill("");
  await p.waitForTimeout(300);
  const talk = p.getByRole("button", { name: "Voice mode" }).first();
  const talkBg = await talk.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "");
  check(talkBg === rgb, "the voice button wears the accent", `${talkBg} vs ${rgb}`);
  const avatar = await p.locator("aside").getByText("A", { exact: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "");
  check(avatar === rgb, "so does the avatar", `${avatar}`);
  const blue = await p.evaluate(() => {
    const target = "rgb(10, 124, 255)";
    let n = 0;
    for (const el of document.querySelectorAll("button, span, div")) { const cs = getComputedStyle(el); if (cs.backgroundColor === target) n++; }
    return n;
  });
  check(blue === 0, "and no fixed blue is left on the page", `${blue} elements`);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
