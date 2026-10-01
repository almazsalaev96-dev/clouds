/**
 * The Why page, and the doors from it into the app.
 *
 * The claims: /why opens without keys or a store, says why Armi exists, what
 * it does, how it compares and what it costs, with nothing invented and no
 * company's model named on it; its buttons land on the right Settings page
 * in the app (#plus, #keys, #local); a first visit with no key offers three
 * doors and a link to the page; a link to Armi carries a proper card; and a
 * conversation can be saved as a PDF under the Armi names, not engine ids.
 *
 *   bash /tmp/claude-0/one.sh e2e-why
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => { window.print = () => { window.__printed = true; }; });
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";

console.log("\nThe page, with nothing set up");
{
  await p.goto("http://localhost:3100/why", { waitUntil: "networkidle" });
  check(/Why Armi/.test(await p.title()), "titled for what it is", await p.title());
  const main = p.locator("main");
  const text = await main.innerText();
  for (const s of ["Why people need it", "Everything it does", "Compared with what you have", "What it costs", "Where your work goes", "Questions"])
    check(text.includes(s), `says: ${s}`);
  check(/Armi Plus/.test(text) && /\$1/.test(text), "names the price");
  check(/Free/.test(text) && /Ollama/.test(text), "and the free doors: your own keys, a model on your computer");
  const rows = await p.locator("#compare tbody tr").count();
  check(rows === 8, "compares on eight facts", `${rows}`);
  check(!/GPT|Gemini|Claude|Sonnet|Kimi|DeepSeek/.test(text), "and no company's model is named on it");
  check(/around \$20/.test(text), "the other side's price is hedged, not invented");
  const h1 = await p.locator("h1").innerText();
  check(/work your question together/.test(h1), "the one sentence is the first thing", h1.slice(0, 60));
  const og = await p.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
  check(Boolean(og) && /opengraph-image/.test(og), "a card for when the link is shared", og ?? "none");
  /* Fetched on the test server: the address in the tag is the site's own
     (the build's), and here the site is wherever this server listens. */
  const img = og ? await p.request.get(`http://localhost:3100${new URL(og).pathname}${new URL(og).search}`) : null;
  check(Boolean(img) && img.ok() && (img.headers()["content-type"] ?? "").includes("image/png") && (await img.body()).length > 10_000, "which is a real picture", img ? `${img.status()} ${(await img.body()).length} bytes` : "no address");
  await p.screenshot({ path: `${OUT}/why-light.png`, fullPage: true });
  await p.emulateMedia({ colorScheme: "dark" });
  await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/why-dark.png`, fullPage: true });
  await p.evaluate(() => { document.documentElement.dataset.theme = "light"; });
}

console.log("\nIts buttons land where they say");
{
  await p.getByRole("link", { name: /Get Armi Plus/ }).click();
  await p.waitForURL(/localhost:3100\/?$/, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const dlg = p.locator("[role=dialog]");
  check(await dlg.isVisible().catch(() => false) && /Armi Plus/.test(await dlg.innerText()), "Get Armi Plus opens the app on the Plus page");
  check(!/#plus/.test(p.url()), "and the address is cleaned", p.url());
  await p.keyboard.press("Escape");
  await p.goto("about:blank");
  await p.goto("http://localhost:3100/#local", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  check(/Free AI|On this computer|Ollama/.test(await p.locator("[role=dialog]").innerText().catch(() => "")), "#local opens the free-AI page");
  await p.keyboard.press("Escape");
  await p.goto("about:blank");
  await p.goto("http://localhost:3100/#keys", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  check(/API key/i.test(await p.locator("[role=dialog]").innerText().catch(() => "")), "#keys opens the keys page");
  await p.keyboard.press("Escape");
}

console.log("\nA first visit with no key offers three doors and the page");
{
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", modelId: "one", sidebarOpen: true, name: "Almaz", nameAsked: true, keys: {} }, version: 1 })));
  /* The probe's own server holds a key, so the app thinks it has one; the
     doors are drawn only with none. Said here by stubbing what the server
     reports, as a visitor to a public deployment with no keys would see. */
  await p.route("**/api/models*", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { ...json, configured: Object.fromEntries(Object.keys(json.configured ?? {}).map((k) => [k, false])) } });
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const main = await p.locator("main").innerText();
  check(/Add your API keys/.test(main), "the key button");
  check(/a free AI on this computer/.test(main), "the free local door");
  check(/Why Armi\?/.test(main), "and the link to the page");
  await p.getByRole("button", { name: /a free AI on this computer/ }).click();
  await p.waitForTimeout(700);
  check(/Ollama|LM Studio/.test(await p.locator("[role=dialog]").innerText().catch(() => "")), "pressing it opens the free-AI page");
  await p.keyboard.press("Escape");
  await p.unroute("**/api/models*");
}

console.log("\nA conversation saved as PDF, under the Armi names");
{
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", modelId: "one", sidebarOpen: true, name: "Almaz", nameAsked: true, keys: {} }, version: 1 })));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("Explain a debounce in two lines");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(3500);
  await p.getByRole("button", { name: "Conversation options" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("menuitem", { name: "Save as PDF" }).click();
  let got = null;
  for (let i = 0; i < 120 && !got; i += 1) {
    for (const f of p.frames()) {
      if (f === p.mainFrame()) continue;
      const r = await f.evaluate(() => ({ prints: [...document.scripts].some((x) => x.textContent.includes("armiPrint")), html: document.documentElement.outerHTML })).catch(() => null);
      if (r?.prints) { got = r; break; }
    }
    await p.waitForTimeout(25);
  }
  check(Boolean(got), "the conversation goes to the print dialog as a document");
  const html = got?.html ?? "";
  check(/<h2>You<\/h2>/.test(html) && /<h2>ARMI Mira 4\.1<\/h2>/.test(html), "each turn under who said it: You, and the Armi model", (html.match(/<h2>[^<]*<\/h2>/g) ?? []).join(" "));
  check(!/claude-|gpt-|deepseek|kimi/i.test(html.replace(/<style[\s\S]*?<\/style>/, "")), "and never an engine's id");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
