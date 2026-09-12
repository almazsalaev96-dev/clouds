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

console.log("\nTwo tabs of it are one app, not two");
{
  /* The classic way a local-first app goes wrong: one tab deletes a thing and
     the other keeps showing it, so clicking a row opens nothing and the person
     concludes their work is corrupted. Both tabs read the same database
     through live queries, and this is the assertion that keeps it that way —
     a one-shot read swapped in for a live one would pass every other test in
     this repository. */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const A = await ctx.newPage();
  await A.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await A.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
  await A.reload({ waitUntil: "networkidle" });
  await A.waitForTimeout(900);

  const B = await ctx.newPage();
  await B.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await B.waitForTimeout(1200);

  const rows = (p) => p.evaluate(() => [...document.querySelectorAll("aside button[title]")].map((x) => x.getAttribute("title")));
  check((await rows(B)).length === 0, "the second tab starts where the first one did", JSON.stringify(await rows(B)));

  await A.bringToFront();
  await A.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await A.keyboard.press("Enter");
  await A.waitForTimeout(3200);
  await B.waitForTimeout(1500);
  const inB = await rows(B);
  check(inB.length === 1, "a conversation started in one tab appears in the other, unasked", JSON.stringify(inB));

  await B.bringToFront();
  const del = B.getByRole("button", { name: /^Delete / }).first();
  check(await del.count() > 0, "and can be acted on from there", "");
  await del.click();
  await B.waitForTimeout(1600);
  await A.waitForTimeout(1600);
  const leftInA = await rows(A);
  check(leftInA.length === 0, "deleting it in one tab removes it from the other", JSON.stringify(leftInA));
  await ctx.close();
}

console.log("\n\"Delete everything\" has to mean everything, keys included");
{
  /* The database is enumerated from its own live schema, precisely so a table
     added later cannot be forgotten. None of that reached localStorage, which
     is where the settings live — and the settings hold the API keys. The
     button's own text promised that nothing is kept anywhere else, and the
     scenario in the README is somebody wiping the app before handing over a
     laptop. They handed it over with the key still on it. */
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => {
    localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, keys: { anthropic: "sk-ant-SECRET" } }, version: 1 }));
    localStorage.setItem("store.drafts.v1", JSON.stringify({ state: { drafts: { x: "an unsent draft" } }, version: 1 }));
    // The copies a rename left behind, which nothing read and nothing cleared.
    localStorage.setItem("armi.settings", JSON.stringify({ state: { keys: { anthropic: "sk-ant-OLD" } } }));
    localStorage.setItem("astra.settings", JSON.stringify({ state: { keys: { openai: "sk-OLDER" } } }));
  }, SETTINGS);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const adopted = await page.evaluate(() => ({
    armi: localStorage.getItem("armi.settings"),
    astra: localStorage.getItem("astra.settings"),
  }));
  check(adopted.armi === null && adopted.astra === null,
    "a rename moves the old key rather than copying it — a spare copy of a secret is the thing you were avoiding",
    `armi:${adopted.armi ? "still there" : "gone"} astra:${adopted.astra ? "still there" : "gone"}`);

  await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  await page.keyboard.press("Control+,");
  await page.waitForTimeout(700);
  const dataTab = page.getByRole("tab", { name: /^Data$/ }).or(page.getByRole("button", { name: /^Data$/ })).first();
  await dataTab.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Delete all data/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^(Delete|Yes|Confirm)/i }).last().click();
  await page.waitForTimeout(1400);

  const left = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
  const all = JSON.stringify(left);
  check(!/sk-ant-SECRET/.test(all), "the API key is gone from the browser", all.slice(0, 90));
  check(!/sk-ant-OLD|sk-OLDER/.test(all), "and so is every older copy of one");
  check(!/an unsent draft/.test(all), "and the drafts with them");
  /* The settings key comes back, and that is correct: the app reloads, finds
     nothing, and persists its defaults so it has a theme to draw with. What
     has to be true is that what comes back is the default and not the old
     state with the secrets still in it — which is why the store is reset in
     memory as well as on disk. `persist` writes the whole state on the next
     change, so clearing the key while the store still held the key would put
     it straight back, and the reload would make that look like success. */
  const back = JSON.parse(left["store.settings.v1"] ?? "{}").state ?? {};
  check(Object.keys(back.keys ?? {}).length === 0, "what the app writes back is a default with no keys in it", JSON.stringify(back.keys));
  check(!back.name && !back.systemPrompt, "and nothing else the person had typed", `${back.name ?? ""}|${back.systemPrompt ?? ""}`);
  await page.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-storage PASS");
process.exit(failed ? 1 : 0);
