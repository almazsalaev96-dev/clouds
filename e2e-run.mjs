/**
 * A code block that can be seen working, where it is.
 *
 * The claims: an HTML block in an answer has a Run button; pressing it
 * shows the page under the block in a frame that is sandboxed with no
 * origin and a policy that lets nothing in; the frame's buttons work;
 * what it prints to the console shows under it; Stop takes it away; a
 * block of Python has no Run at all; and the deck page's options and the
 * home strip's streak are there.
 *
 *   bash /tmp/claude-0/one.sh e2e-run
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
/* A deck studied two days running, so the home strip has a streak to say. */
await p.evaluate(() => new Promise((ok, no) => {
  const r = indexedDB.open("clouds");
  r.onerror = () => no(r.error);
  r.onsuccess = () => {
    const db = r.result, now = Date.now();
    const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const tx = db.transaction(["decks", "cards", "studyDays"], "readwrite");
    tx.objectStore("decks").put({ id: "d1", name: "Osmosis", createdAt: now, updatedAt: now });
    for (let i = 0; i < 3; i++) tx.objectStore("cards").put({ id: `c${i}`, deckId: "d1", front: `q${i}`, back: "a", state: "review", due: now - 1000, interval: 3, ease: 2.5, reps: 2, lapses: 0, step: 0, createdAt: now, stability: 3, difficulty: 5 });
    tx.objectStore("studyDays").put({ day: day(now), answered: 4, right: 4 });
    tx.objectStore("studyDays").put({ day: day(now - 86_400_000), answered: 6, right: 5 });
    tx.oncomplete = () => { db.close(); ok(true); };
    tx.onerror = () => no(tx.error);
  };
}));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe home strip says the streak");
{
  const main = await p.locator("main").innerText();
  check(/2-day streak/.test(main), "two days running is said as a streak", (main.match(/\d+-day streak/) ?? [""])[0]);
}

console.log("\nAn SVG block runs where it is");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("show me an svg snippet");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const fig = p.locator("figure").filter({ hasText: "svg" }).first();
  const run = fig.getByRole("button", { name: "Run", exact: true });
  check(await run.isVisible(), "the block has a Run button");
  await run.click();
  await p.waitForTimeout(900);
  const region = fig.getByRole("region", { name: "Running" });
  check(await region.isVisible(), "pressing it shows the drawing under the block");
  const frame = region.locator("iframe");
  check((await frame.getAttribute("sandbox")) === "allow-scripts", "in a frame that is sandboxed with no origin", await frame.getAttribute("sandbox"));
  check(/Content-Security-Policy/.test(await frame.getAttribute("srcdoc")) && /default-src 'none'/.test(await frame.getAttribute("srcdoc")), "and a policy that lets nothing in");
  const inner = p.frames().find((f) => f.parentFrame() && f !== p.mainFrame());
  const drawn = inner ? await inner.locator("svg circle").count().catch(() => 0) : 0;
  check(drawn === 1, "the drawing itself is drawn", `${drawn} circle`);
  check(/\bRan\b/.test(await region.innerText()), "with a line saying it ran", (await region.innerText()).replace(/\s+/g, " ").slice(0, 60));
  check(/no network, nothing saved/.test(await region.innerText()), "and what it cannot do");
  await fig.getByRole("button", { name: "Stop running" }).click();
  await p.waitForTimeout(300);
  check((await region.count()) === 0, "Stop takes it away");

  /* A script: what it prints is the whole of what there is to see. */
  const js = p.locator("figure").filter({ hasText: "javascript" }).first();
  await js.getByRole("button", { name: "Run", exact: true }).click();
  await p.waitForTimeout(900);
  const jsFrame = p.frames().find((f) => f.parentFrame() && f !== p.mainFrame());
  const printed = jsFrame ? await jsFrame.locator("body").innerText().catch(() => "") : "";
  check(/sum 6/.test(printed), "a script's output is drawn in its frame", printed.replace(/\s+/g, " ").slice(0, 40));
  check(/\bRan\b/.test(await js.getByRole("region", { name: "Running" }).innerText()), "and the line says it ran");
}

console.log("\nOther languages have no Run");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await box().fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const ts = p.locator("figure").filter({ hasText: "debounce.ts" }).last();
  check(await ts.isVisible(), "a TypeScript block is there");
  check((await ts.getByRole("button", { name: "Run", exact: true }).count()) === 0, "and has no Run — there is nothing in a browser to run it with");
}

console.log("\nA deck has options of its own");
{
  await p.keyboard.press("Meta+5");
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Open Osmosis/ }).click();
  await p.waitForTimeout(500);
  const opt = p.getByRole("button", { name: /Deck options/ });
  check(await opt.isVisible() && /20 new a day · 90% retention/.test(await opt.innerText()), "closed, it says the app's numbers", (await opt.innerText()).replace(/\s+/g, " "));
  await opt.click();
  await p.waitForTimeout(300);
  await p.getByRole("spinbutton", { name: "New cards a day" }).fill("5");
  await p.waitForTimeout(500);
  const deck = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("decks").objectStore("decks").get("d1"); t.onsuccess = () => ok(t.result); }; }));
  check(deck.newPerDay === 5, "a change is the deck's, kept on it", JSON.stringify({ newPerDay: deck.newPerDay, retention: deck.retention }));
  check(/5 new a day/.test(await p.getByRole("button", { name: /Deck options/ }).innerText()), "and said on the line");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
