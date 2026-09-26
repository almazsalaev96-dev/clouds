/**
 * Save as PDF: a page is typeset in a sandboxed frame of its own, titled
 * for the file, with the print dialog on the way and no pop-up window to
 * block. Checked from the Notebook.
 *
 *   bash /tmp/claude-0/one.sh e2e-pdf
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1194, height: 834 } });
const p = await ctx.newPage();
await p.addInitScript(() => { window.print = () => { window.__printed = true; }; });
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, section: "notebook" };
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async (s) => {
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 }));
  const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
  const tx = db.transaction(["notes"], "readwrite");
  const now = Date.now();
  tx.objectStore("notes").put({ id: "pdf1", title: "Osmosis, properly", content: "# Osmosis\n\nWater moves down a **water-potential** gradient.\n\n## The three words\n\n- Hypotonic\n- Isotonic\n- Hypertonic\n\n| Term | Meaning |\n|---|---|\n| Solute | The dissolved thing |\n\n> [!key] The membrane is selectively permeable.", createdAt: now, updatedAt: now, pinned: false });
  await new Promise((res) => { tx.oncomplete = res; });
}, S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA page, saved as PDF");
{
  await p.getByRole("listitem").filter({ hasText: "Osmosis, properly" }).first().click();
  await p.waitForTimeout(800);
  const popups = [];
  ctx.on("page", (w) => popups.push(w));
  await p.getByRole("button", { name: "Save as PDF" }).click();
  /* Headless Chromium's print() returns at once and the frame leaves
     soon after, so look for it rather than wait. */
  let got = null;
  for (let i = 0; i < 80 && !got; i += 1) {
    for (const f of p.frames()) {
      if (f === p.mainFrame()) continue;
      const r = await f.evaluate(() => ({ prints: [...document.scripts].some((x) => x.textContent.includes("armiPrint")), title: document.title, html: document.documentElement.outerHTML, origin: String(self.origin) })).catch(() => null);
      if (r?.prints) { got = r; break; }
    }
    if (!got) await p.waitForTimeout(25);
  }
  check(Boolean(got), "the page is typeset in a frame of the page");
  check(popups.length === 0, "and no window opens, so nothing for a pop-up blocker to stop", `${popups.length} opened`);
  if (got) {
    check(got.title === "Osmosis, properly", "titled for the file", got.title);
    const html = got.html;
    check(/<h1>Osmosis, properly<\/h1>/.test(html) && /<strong>water-potential<\/strong>/.test(html), "typeset: the title, the emphasis");
    check(/<li>Hypotonic<\/li>/.test(html) && /<th>Term<\/th>/.test(html), "the list and the table");
    check(/<blockquote>The membrane/.test(html), "the callout as a quote, its marker gone");
    check(!/<script src|localhost:3100\/_next/.test(html), "and none of the app on the page");
    check(got.origin === "null", "and the frame has an origin of its own, with nothing of the app's in reach", got.origin);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
