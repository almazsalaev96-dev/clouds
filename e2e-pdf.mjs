/**
 * Save as PDF: a page opens typeset in a window of its own, titled for
 * the file, with the print dialog on the way. Checked from the Notebook.
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
  const opened = ctx.waitForEvent("page", { timeout: 5000 });
  await p.getByRole("button", { name: "Save as PDF" }).click();
  const w = await opened.catch(() => null);
  check(Boolean(w), "a window of its own opens");
  if (w) {
    await w.waitForLoadState("load").catch(() => {});
    await w.waitForTimeout(500);
    check((await w.title()) === "Osmosis, properly", "titled for the file", await w.title());
    const html = await w.content();
    check(/<h1>Osmosis, properly<\/h1>/.test(html) && /<strong>water-potential<\/strong>/.test(html), "typeset: the title, the emphasis");
    check(/<li>Hypotonic<\/li>/.test(html) && /<th>Term<\/th>/.test(html), "the list and the table");
    check(/<blockquote>The membrane/.test(html), "the callout as a quote, its marker gone");
    check(!/<script src|localhost:3100\/_next/.test(html), "and none of the app on the page");
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
