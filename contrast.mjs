/**
 * The palette's contrast gate.
 *
 *   node contrast.mjs           # with the app running on :3100
 *
 * Every text/background pair the app actually renders, measured against WCAG:
 * 4.5:1 for text, 3:1 for control boundaries. It reads the live computed
 * tokens rather than a copy of them, so it cannot drift from what ships.
 *
 * Run it after touching any colour token. A palette that looks right in a
 * screenshot and fails here is not right — it is right for whoever took the
 * screenshot.
 */
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const theme of ["dark", "light"]) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((t) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: t, density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 })), theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const hex = (c) => { const d=document.createElement("div"); d.style.color=c; document.body.appendChild(d); const r=getComputedStyle(d).color; d.remove(); const m=r.match(/\d+/g).map(Number); return m; };
    const lum = (c) => { const [r,g,b]=hex(c).slice(0,3).map((x)=>{x/=255; return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;}); return 0.2126*r+0.7152*g+0.0722*b; };
    const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)); };
    const canvas=v("--bg-canvas"), surface=v("--bg-surface"), subtle=v("--bg-subtle");
    const pairs = [
      ["text-primary / canvas", v("--text-primary"), canvas, 4.5],
      ["text-secondary / canvas", v("--text-secondary"), canvas, 4.5],
      ["text-tertiary / canvas", v("--text-tertiary"), canvas, 4.5],
      ["text-tertiary / surface", v("--text-tertiary"), surface, 4.5],
      ["text-faint / canvas", v("--text-faint"), canvas, 3],
      ["accent / canvas", v("--accent"), canvas, 4.5],
      ["accent / surface", v("--accent"), surface, 4.5],
      ["accent-fg / accent-fill", v("--accent-fg"), v("--accent-fill"), 4.5],
      ["border-strong / canvas", v("--border-strong"), canvas, 3],
      ["success / canvas", v("--success"), canvas, 4.5],
      ["warning / canvas", v("--warning"), canvas, 4.5],
      ["danger / canvas", v("--danger"), canvas, 4.5],
      ["on-fill / go-fill", v("--on-fill"), v("--go-fill"), 4.5],
      ["syn-comment / inset", v("--syn-comment"), v("--bg-inset"), 4.5],
      ["syn-keyword / inset", v("--syn-keyword"), v("--bg-inset"), 4.5],
      ["syn-string / inset", v("--syn-string"), v("--bg-inset"), 4.5],
      ["syn-function / inset", v("--syn-function"), v("--bg-inset"), 4.5],
      ["syn-number / inset", v("--syn-number"), v("--bg-inset"), 4.5],
      ["syn-type / inset", v("--syn-type"), v("--bg-inset"), 4.5],
      ["syn-punct / inset", v("--syn-punct"), v("--bg-inset"), 4.5],
      ["accent / accent-subtle", v("--accent"), v("--accent-subtle"), 4.5],
      ["accent-2 / canvas", v("--accent-2"), canvas, 3],
      ["cta / canvas", v("--cta"), canvas, 3],
      ["cta-fg / cta", v("--cta-fg"), v("--cta"), 4.5],
      ["text-secondary / subtle", v("--text-secondary"), subtle, 4.5],
    ];
    return pairs.map(([name, fg, bg, need]) => ({ name, r: +ratio(fg,bg).toFixed(2), need, pass: ratio(fg,bg) >= need }));
  });
  const fails = out.filter((o) => !o.pass);
  console.log(`\n${theme.toUpperCase()} — ${out.length - fails.length}/${out.length} pass`);
  fails.forEach((f) => console.log(`  FAIL ${f.name}: ${f.r} (need ${f.need})`));
  if (!fails.length) console.log("  all pass");
  await page.close();
}
await browser.close();
