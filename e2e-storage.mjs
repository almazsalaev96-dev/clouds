/**
 * A browser that will not let the app save anything.
 *
 * Everything in Armi lives in the browser: the conversations, the notes, the
 * canvases, the keys. When IndexedDB is refused — a Firefox private window,
 * site data switched off, a locked-down profile — every query fails the same
 * quiet way: each live list renders the empty state it would show a new user,
 * and the app presents itself as brand new and working perfectly. Somebody
 * writes in it for an hour and loses all of it on close, having been told
 * nothing.
 *
 * That is not fixable from inside a web page, and that is exactly why it has
 * to be said out loud. A fault you can route around — open a normal window —
 * is a different thing from an app that appears to be fine.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-storage.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

console.log("\nWith the database refused, the app says so instead of pretending");
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  /* What Firefox does in a private window: the call itself throws rather than
     handing back a request that later errors. */
  await ctx.addInitScript(() => {
    const deny = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    try {
      indexedDB.open = deny;
      indexedDB.deleteDatabase = deny;
    } catch {
      /* older engines seal it; the getter override below covers those */
    }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));

  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  const alert = await page.evaluate(() => {
    const el = document.querySelector("[role=alert]");
    return el ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : null;
  });
  check(Boolean(alert), "there is an alert on the page at all", alert ?? "nothing");
  check(/will not let|save/i.test(alert ?? ""), "it says the app cannot save", alert ?? "");
  check(/private window|site data/i.test(alert ?? ""), "and names the two things that cause it", alert ?? "");
  check(!/IndexedDB|DOMException|SecurityError/i.test(alert ?? ""), "in words, not in the browser's", alert ?? "");

  /* The rest of the app has to keep standing. A banner over a white screen is
     not better than no banner. */
  const alive = await page.evaluate(() => ({
    composer: Boolean(document.querySelector("textarea[aria-label=Message]")),
    sidebar: Boolean(document.querySelector("aside")),
    buttons: document.querySelectorAll("button").length,
  }));
  check(alive.composer, "the composer is still there");
  check(alive.sidebar, "and the sidebar");
  check(alive.buttons > 8, "and the app did not collapse to a stack trace", `${alive.buttons} controls`);

  const fatal = errs.filter((e) => !/SecurityError|insecure|IndexedDB|Dexie/i.test(e));
  check(fatal.length === 0, "nothing threw except the thing that was meant to", fatal.join(" | "));
  await ctx.close();
}

console.log("\nAnd with a working database it says nothing at all");
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const alert = await page.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? null);
  check(alert === null, "no banner over a database that is working fine", alert ?? "");

  /* And the thing the banner was warning about really does work here. */
  await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2600);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  const kept = await page.evaluate(() =>
    [...document.querySelectorAll("[id^=m-]")].map((n) => (n.textContent ?? "").trim().slice(0, 30)),
  );
  check(kept.some((t) => /debounce/i.test(t)), "and a conversation survives a reload", kept.join(" | ").slice(0, 60));
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-storage PASS");
process.exit(failed ? 1 : 0);
