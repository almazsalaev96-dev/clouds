/**
 * Two controls in the same pixels.
 *
 *   node overlap.mjs            # with the app running on :3100
 *
 * Everything measuring layout in this app measures one axis each. `widths.mjs`
 * asks whether anything is pushed past its clipping ancestor; `reach.mjs` asks
 * whether a run of text can be got to; `touch.mjs` asks whether a target is
 * 44pt. All three pass on a control sitting directly on top of another one,
 * because nothing overflows, nothing is unreachable and both are the right
 * size. Which is how the composer shipped with its Creative pill printed
 * through the model button at every phone width, in both pointer modes.
 *
 * Overlap is what happens when a row of controls wraps and a neighbouring row
 * does not: the wrapped line runs underneath the cluster that stayed put.
 * There is no single element to measure, which is why it needs its own pass —
 * the defect is a relation between two elements and every other gate here
 * measures elements.
 *
 * ## What counts
 *
 * Only pairs that are both hit targets, both painted, and neither an ancestor
 * of the other — a button inside a toolbar overlaps its toolbar by
 * construction and that is not a defect. Two pixels of tolerance, because a
 * rounded corner and a focus ring can legitimately graze.
 *
 * A hidden twin is not an overlap either: Send and Stop occupy one slot and
 * only one of them is ever on screen. The check is on painted geometry, so a
 * pair where either is `visibility: hidden`, `opacity: 0` or `display: none`
 * never arrives here — but a swap done by rendering both and hiding neither
 * would, correctly.
 */
import { chromium } from "playwright";

const WIDTHS = [320, 360, 390, 430, 520, 768, 1024, 1440];
const DENSITIES = ["compact", "comfortable", "spacious"];

let bad = 0;
const check = (p, l, d = "") => { if (!p) bad++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const FIND = `(() => {
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.visibility === "hidden" || ps.display === "none" || ps.opacity === "0") return false;
    }
    return true;
  };
  const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 22) || el.tagName.toLowerCase();
  const all = [...document.querySelectorAll("button, [role=button], [role=menuitem], [role=tab], [role=radio], select, input:not([type=hidden])")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      if (r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) return false;
      return vis(el);
    });
  const out = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], c = all[j];
      if (a.contains(c) || c.contains(a)) continue;
      const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
      const ox = Math.min(ar.right, cr.right) - Math.max(ar.left, cr.left);
      const oy = Math.min(ar.bottom, cr.bottom) - Math.max(ar.top, cr.top);
      if (ox > 2 && oy > 2) out.push(name(a) + " × " + name(c) + " (" + Math.round(ox) + "×" + Math.round(oy) + "px)");
    }
  }
  return [...new Set(out)];
})()`;

for (const coarse of [false, true]) {
  console.log(`\n${coarse ? "a finger" : "a mouse"}`);
  for (const density of DENSITIES) {
    const found = [];
    for (const width of WIDTHS) {
      const ctx = await b.newContext({
        viewport: { width, height: 860 },
        ...(coarse ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
      await page.evaluate(([d]) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: d, modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })), [density]);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(650);

      const empty = await page.evaluate(FIND);
      if (empty.length) found.push(`${width}px empty: ${empty.join(", ")}`);

      /* And with an answer on the page, because half the controls in this app
         do not exist until there is one — the same blind spot that kept the
         message action row unmeasured on a phone. */
      await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);
      const answered = await page.evaluate(FIND);
      if (answered.length) found.push(`${width}px answered: ${answered.join(", ")}`);

      await ctx.close();
    }
    check(found.length === 0, `${density}: nothing is printed through anything else`, found.slice(0, 3).join(" | "));
  }
}

await b.close();
console.log(bad ? `\n  ${bad} failed` : "\n  overlap PASS");
process.exit(bad ? 1 : 0);
