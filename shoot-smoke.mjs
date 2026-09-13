/**
 * Every room loads, undo works, and nothing throws.
 *
 * This file did not exist. `gate.sh` ran it, the README described what it
 * checked — "every section loads, undo works, no runtime errors" — and node
 * answered `MODULE_NOT_FOUND` on every run, which the gate printed as FAIL
 * beside twelve real checks. A phantom in the list is worse than a missing
 * check: it reads as a known red, everybody learns to skip past it, and the
 * two lines of documentation describing it are simply false.
 *
 * So it is the check the two of them already promised. Deliberately shallow —
 * the suites either side of it go deep on one thing each, and the gap they
 * leave is the boring one: that after a change to any of them, the five rooms
 * still open at all, in both themes, without a throw. Most regressions that
 * make an app unusable are that shape.
 *
 * The "shoot" half is opt-in. Pass a directory and it writes a PNG per room
 * per theme; without one it writes nothing, because a gate that litters the
 * repository on every run is a gate people stop running.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node shoot-smoke.mjs [output-directory]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = "http://localhost:3100";
const OUT = process.argv[2] ?? null;
if (OUT) mkdirSync(OUT, { recursive: true });

const ROOMS = ["Conversations", "Code", "Creative", "Projects", "Notebook"];

const SETTINGS = (theme) => ({
  theme, density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal",
  mode: "chat", section: "chat", sidebarOpen: true, sendOnEnter: true,
  showLineNumbers: false, wrapCode: false, memoryOn: true, keys: {}, params: {},
  favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true,
});

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

for (const theme of ["light", "dark"]) {
  console.log(`\n${theme}`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  /* Console errors too, not only throws. A component that swallows its own
     exception and renders an empty box is the failure this is here to catch,
     and it never reaches `pageerror`. */
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // A failed request to a provider with no key is the app working correctly.
    if (/favicon|ERR_|net::/i.test(t)) return;
    errs.push(t);
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS(theme));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  for (const room of ROOMS) {
    await page.locator("aside nav").getByRole("button", { name: room, exact: true }).first().click();
    await page.waitForTimeout(700);
    const main = (await page.locator("main").innerText()).trim();
    check(main.length > 0, `${room} renders something`, `${main.split("\n")[0]?.slice(0, 46) ?? ""}`);
    if (OUT) await page.screenshot({ path: `${OUT}/${theme}-${room.toLowerCase()}.png` });
  }

  console.log("\n  and the way back from a delete");
  {
    await page.locator("aside nav").getByRole("button", { name: "Conversations", exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("textbox", { name: "Message" }).fill("what is a spring tide");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2600);

    const count = () => page.evaluate(async () => {
      const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
      const n = await new Promise((r) => { const q = d.transaction(["conversations"]).objectStore("conversations").count(); q.onsuccess = () => r(q.result); });
      d.close();
      return n;
    });
    check((await count()) === 1, "a conversation exists to delete");

    /* The conversation rows are divs, not list items — projects are the ones
       in a <ul>. Hovering the control itself is enough: it is inside the row,
       so the row's hover state reveals it. */
    const del = page.locator('aside button[aria-label^="Delete"]').first();
    await del.hover();
    await del.click();
    await page.waitForTimeout(800);
    check((await count()) === 0, "it goes");

    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(900);
    check((await count()) === 1, "and comes back", "which is the whole of the delete guard in this app");
  }

  check(errs.length === 0, "nothing threw and nothing was logged as an error", errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await b.close();
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
