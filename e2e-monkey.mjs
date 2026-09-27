/**
 * A random walk through the whole app, looking for the crash nobody wrote
 * a test for.
 *
 * Seeded, so a failure can be replayed: the same seed presses the same
 * things in the same order. For ninety seconds it opens rooms, presses
 * visible buttons, types into boxes, hits the shortcuts, resizes the
 * window and goes back and forth, and after every step asks two things:
 * did the page throw, and did the crash boundary come up. Either fails
 * the run with the step that did it. Destructive presses are allowed —
 * every delete here has an undo — but a file chooser is not, since a
 * native dialog would hang the walk.
 *
 *   MONKEY_SEED=7 MONKEY_SECONDS=90 bash /tmp/claude-0/one.sh e2e-monkey
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const SEED = Number(process.env.MONKEY_SEED ?? 7);
const SECONDS = Number(process.env.MONKEY_SECONDS ?? 90);
let x = SEED >>> 0 || 1;
const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && /Armi crashed|Uncaught|Maximum update depth|Cannot read prop/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true, actionsOn: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async (s) => {
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 }));
  const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
  const now = Date.now();
  const tx = db.transaction(["assistants", "projects", "notes", "decks", "cards"], "readwrite");
  tx.objectStore("assistants").put({ id: "as1", name: "Chem coach", short: "chem-coach", icon: "⚗️", instructions: "Safety note first.", createdAt: now, updatedAt: now, uses: 0 });
  tx.objectStore("projects").put({ id: "pr1", name: "Timetable review", description: "", instructions: "Money in pounds.", createdAt: now, updatedAt: now });
  tx.objectStore("notes").put({ id: "n1", title: "Osmosis", content: "# Osmosis\n\nWater moves down a **gradient**.\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |", createdAt: now, updatedAt: now, pinned: false });
  await new Promise((res) => { tx.oncomplete = res; });
}, S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);
await fetch(`${MOCK}/__reset`);

/* The words it types: enough to reach the answer path, the slash menu, a
   build, a picture, a study turn, a sum, an empty send. */
const SAYINGS = ["what is a debounce", "/study explain osmosis", "make me a timer", "17 * 23", "/image a red fox", "", "/chem-coach what is a mole", "Compare debounce, throttle and polling", "thanks", "/slides the water cycle", "translate this into French: good morning", "a".repeat(600)];
const KEYS = ["Escape", "Meta+k", "Meta+n", "Meta+\\", "Meta+Shift+S", "Meta+1", "Meta+2", "Meta+3", "Meta+4", "Meta+5", "Meta+6", "Escape", "Meta+,", "?", "Tab", "Tab", "Enter", "Escape"];
const SKIP = /Choose photos|Files to open|Take a photo|Add photos|Delete everything|Forget everything|Restore|Import|Export|Download|Save as|Print|Open in|Share|Sign|Pay|Subscribe|Checkout|Buy|Dictate|Talk|Voice|Stop dictating|Listening/i;

const boundaryUp = async () => /stopped the app drawing|Armi crashed/.test(await p.locator("body").innerText().catch(() => ""));
const steps = [];
const started = Date.now();
let n = 0;
while (Date.now() - started < SECONDS * 1000) {
  n += 1;
  const roll = rnd();
  let did = "";
  try {
    if (roll < 0.45) {
      /* A visible, enabled button that will not open a native dialog. */
      const buttons = await p.locator("button:visible:not([disabled])").all();
      const named = [];
      for (const el of buttons.slice(0, 120)) {
        const name = ((await el.getAttribute("aria-label")) || (await el.innerText().catch(() => "")) || "").trim();
        if (name && !SKIP.test(name)) named.push({ el, name });
      }
      if (named.length) {
        const t = pick(named);
        did = `press "${t.name.slice(0, 40)}"`;
        await t.el.click({ timeout: 1500, force: false }).catch(() => {});
      }
    } else if (roll < 0.65) {
      const boxes = await p.locator("textarea:visible, input:visible[type=text], input:visible:not([type])").all();
      if (boxes.length) {
        const el = pick(boxes);
        const say = pick(SAYINGS);
        did = `type "${say.slice(0, 30)}"`;
        await el.click({ timeout: 1500 }).catch(() => {});
        await el.fill(say).catch(() => {});
        if (rnd() < 0.6) await p.keyboard.press("Enter").catch(() => {});
      }
    } else if (roll < 0.8) {
      const k = pick(KEYS);
      did = `key ${k}`;
      await p.keyboard.press(k).catch(() => {});
    } else if (roll < 0.9) {
      const w = pick([390, 768, 1024, 1280, 1440]);
      did = `resize ${w}`;
      await p.setViewportSize({ width: w, height: 860 });
    } else {
      did = pick(["back", "forward", "reload"]);
      if (did === "reload") await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      else if (did === "back") await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      else await p.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
      if (!/localhost:3100/.test(p.url())) await p.goto("http://localhost:3100", { waitUntil: "domcontentloaded" });
    }
  } catch (e) {
    did += ` (threw: ${String(e.message).slice(0, 60)})`;
  }
  steps.push(did);
  await p.waitForTimeout(120);
  if (errs.length || (await boundaryUp())) {
    console.log(`\n  step ${n}: ${did}`);
    console.log("  last steps: " + steps.slice(-8).join(" → "));
    break;
  }
}

console.log(`\nA ${SECONDS}-second walk, seed ${SEED}, ${n} steps`);
check(!(await boundaryUp()), "the crash boundary never came up", steps.slice(-3).join(" → "));
check(errs.length === 0, "and nothing was thrown on the page", errs.slice(0, 3).join(" | ").slice(0, 300));
await p.setViewportSize({ width: 1280, height: 860 });
await p.goto("http://localhost:3100", { waitUntil: "networkidle" }).catch(() => {});
await p.waitForTimeout(800);
await p.keyboard.press("Meta+1").catch(() => {});
await p.waitForTimeout(600);
check(await p.getByRole("textbox", { name: "Message" }).isVisible().catch(() => false), "and afterwards the app still opens on a box you can type in");
const heap = await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));
check(heap < 0 || heap < 220, "with a heap that is not a leak", heap < 0 ? "not measurable" : `${heap} MB`);

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
