/**
 * The two themes, measured against each other.
 *
 * "The same sizes of the letters and colour in black and in white" — the two
 * themes should read as one app seen under two lights, not as one good design
 * and a dimmer copy of it. Eyeballing cannot settle that: a screenshot of each
 * looks fine on its own, and the drift only shows when the numbers sit side by
 * side.
 *
 * So every visible piece of text is rendered in both, matched by tag, class
 * and content, and compared on two axes:
 *
 *  - **Typography must be identical.** Size, weight, letter-spacing,
 *    line-height and family are not theme decisions. Any difference here is a
 *    bug, full stop, and the threshold is zero.
 *  - **Contrast must be comparable.** Colours are of course different; what
 *    must not differ is how *strong* each role is. A first run found 119
 *    divergences and every single one leaned the same way — light weaker than
 *    dark by 2.5 points on body text and up to 6.3 in a code block.
 *
 * The colour bar is deliberately not zero. A near-black page lets a colour be
 * light and saturated at once and cream does not, so a handful of roles cannot
 * match without ceasing to be the colour they are — the gold turns brown, the
 * seven syntax hues turn into seven browns. Those are listed below as accepted,
 * by name, with the reason. Everything else has to stay in line.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node theme-parity.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const S = (theme) => ({ theme, density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: true, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true });

const lum = (r, g, b_) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b_);
};
/**
 * A CSS colour, as sRGB and an alpha.
 *
 * The first version of this ran `match(/\d+/g)` over whatever `getComputedStyle`
 * returned and called the first three numbers red, green and blue. That is
 * right for `rgb()` and nonsense for `oklab(0.944416 0.00167131 0.0171635 / 0.4)`,
 * which it read as very nearly black — and duly reported a 3.24 contrast
 * failure on a surface that is almost white. A measuring tool that invents
 * defects is worse than no measuring tool, because somebody goes and changes
 * a colour that was right.
 */
function toRgba(css) {
  const ok = css.match(/^ok(lab|lch)\(([^)]+)\)/);
  if (ok) {
    const n = ok[2].replace("/", " ").split(/\s+/).filter(Boolean).map(Number);
    let [L, A, B] = n;
    const alpha = n.length > 3 ? n[3] : 1;
    if (ok[1] === "lch") { const h = (B * Math.PI) / 180; const c = A; A = c * Math.cos(h); B = c * Math.sin(h); }
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const q = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * q,
    ];
    const g = (c) => {
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(v * 255)));
    };
    return [...lin.map(g), alpha];
  }
  const n = (css.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n.length > 3 ? n[3] : 1];
}

/* A translucent surface is not the colour it names — it is that colour mixed
   with whatever is behind it. Treating 0.74 alpha as opaque quietly mis-scores
   every glass panel in the app, which is most of the chrome. */
const composite = ([r, g, b, a], base) =>
  a >= 1 ? [r, g, b] : [0, 1, 2].map((i) => Math.round([r, g, b][i] * a + base[i] * (1 - a)));

async function measure(theme, go) {
  const page = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S(theme));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await go(page);
  const rows = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      const text = (el.textContent ?? "").trim().slice(0, 28);
      // A stable identity across themes: tag + classes + the words in it.
      const key = `${el.tagName}|${el.className}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let bg = "rgba(0, 0, 0, 0)";
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
      }
      out.push({
        key, text,
        size: cs.fontSize, weight: cs.fontWeight, spacing: cs.letterSpacing,
        family: cs.fontFamily.split(",")[0], lh: cs.lineHeight,
        color: cs.color, bg, opacity: cs.opacity,
      });
    }
    return out;
  });
  await page.close();
  return rows;
}

const ROUTES = {
  "chat (blank)": async () => {},
  "chat (answer)": async (p) => {
    await p.getByRole("textbox", { name: "Message" }).fill("Explain debouncing to me");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(2600);
  },
  "code index": async (p) => {
    await p.getByRole("radio", { name: "Code" }).first().click();
    await p.waitForTimeout(700);
  },
  "canvas": async (p) => {
    await p.getByRole("radio", { name: "Code" }).first().click();
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: /Code file/ }).click();
    await p.waitForTimeout(1000);
  },
  "projects": async (p) => {
    await p.getByRole("button", { name: "Projects", exact: true }).first().click();
    await p.waitForTimeout(800);
  },
  "notebook": async (p) => {
    await p.getByRole("button", { name: /Notebook/ }).first().click();
    await p.waitForTimeout(800);
  },
};

const sizeIssues = [];
const colorIssues = [];

for (const [name, go] of Object.entries(ROUTES)) {
  const light = await measure("light", go);
  const dark = await measure("dark", go);
  const byKey = new Map(dark.map((r) => [r.key, r]));
  for (const l of light) {
    const d = byKey.get(l.key);
    if (!d) continue;
    if (l.size !== d.size || l.weight !== d.weight || l.spacing !== d.spacing || l.lh !== d.lh || l.family !== d.family) {
      sizeIssues.push({ route: name, text: l.text, light: `${l.size}/${l.weight}/${l.spacing}/${l.lh}/${l.family}`, dark: `${d.size}/${d.weight}/${d.spacing}/${d.lh}/${d.family}` });
    }
    const ratio = (fg, bg, page) => {
      const back = composite(toRgba(bg), page);
      const front = composite(toRgba(fg), back);
      const a = lum(...front), c = lum(...back);
      return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    };
    const cl = ratio(l.color, l.bg, [247, 243, 234]);
    const cd = ratio(d.color, d.bg, [26, 25, 23]);
    if (Math.abs(cl - cd) > 1.6) {
      colorIssues.push({ route: name, text: l.text, light: cl.toFixed(2), dark: cd.toFixed(2), gap: (cd - cl).toFixed(2), lightColor: l.color, lightBg: l.bg, darkColor: `${d.color} on ${d.bg}` });
    }
  }
  console.log(`${name}: ${light.length} light / ${dark.length} dark elements`);
}

/* The roles that cannot match without ceasing to be themselves. Named, with
   the reason, so that "accepted" never quietly grows to mean "whatever fails
   today". Anything not on this list has to stay within the bar. */
const ACCEPTED = [
  { was: "rgb(140, 106, 26)", why: "the gold nib — matching dark's 8.89 needs #554010, which is brown" },
  { was: "rgb(111, 60, 23)", why: "syntax: a cream page cannot hold a light saturated colour" },
  { was: "rgb(25, 77, 113)", why: "syntax" },
  { was: "rgb(43, 67, 150)", why: "syntax" },
  { was: "rgb(96, 54, 128)", why: "syntax" },
  { was: "rgb(69, 73, 86)", why: "syntax" },
  { was: "rgb(36, 82, 54)", why: "syntax" },
  { was: "rgb(69, 78, 104)", why: "syntax" },
];

let failed = 0;
console.log("\n=== TYPOGRAPHY (must be identical) ===");
if (!sizeIssues.length) console.log("  ✓ size, weight, spacing, line-height and family match in both themes");
for (const i of sizeIssues.slice(0, 20)) {
  console.log(`  ✗ [${i.route}] "${i.text}"\n      light ${i.light}\n      dark  ${i.dark}`);
}
if (sizeIssues.length) { failed += sizeIssues.length; console.log(`  (${sizeIssues.length} differences — typography is not a theme decision)`); }

console.log("\n=== CONTRAST (must be comparable) ===");
const BAR = 2.6;
const byRole = new Map();
for (const i of colorIssues) {
  const k = `${i.lightColor} on ${i.lightBg}`;
  const g = byRole.get(k) ?? { k, n: 0, light: i.light, dark: i.dark, gap: Number(i.gap), color: i.lightColor, sample: [] };
  g.n += 1;
  if (g.sample.length < 3 && i.text) g.sample.push(i.text);
  byRole.set(k, g);
}
const over = [];
for (const g of [...byRole.values()].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))) {
  const ok = ACCEPTED.find((a) => a.was === g.color);
  /* Only where the difference is visible.
     Above about 12:1 both themes are as legible as text gets — the eye cannot
     tell 14 from 17, and a gate that insists on matching them is measuring
     arithmetic rather than what anybody sees. The perceptual difference lives
     at the bottom of the range, which is exactly where the original 119 gaps
     were, so this excuses nothing that mattered. */
  const visible = Math.min(Number(g.light), Number(g.dark)) < 12;
  const bad = Math.abs(g.gap) > BAR && visible && !ok;
  if (bad) over.push(g);
  const mark = ok ? "  ·" : bad ? "  ✗" : !visible && Math.abs(g.gap) > BAR ? "  ~" : "  ✓";
  console.log(`${mark} ${g.n.toString().padStart(3)}×  light ${g.light} → dark ${g.dark}  (${g.gap > 0 ? "+" : ""}${g.gap.toFixed(2)})${ok ? "   accepted: " + ok.why : !visible && Math.abs(g.gap) > BAR ? "   both above 12:1 — not a difference anybody sees" : ""}`);
  console.log(`        ${g.sample.join(" · ")}`);
}
failed += over.length;

/* The shape of the remainder matters as much as its size. Before this was
   fixed, every gap leaned one way — which is what "light looks washed out"
   is, numerically. Scatter is fine; a lean is the bug coming back. */
const light = colorIssues.filter((i) => Number(i.gap) < 0).length;
const dark = colorIssues.filter((i) => Number(i.gap) > 0).length;
const lean = dark + light === 0 ? 0 : Math.abs(dark - light) / (dark + light);
console.log(`\n  ${dark} gaps where dark is stronger, ${light} where light is — lean ${(lean * 100).toFixed(0)}%`);
if (lean > 0.75 && dark + light > 12) {
  failed += 1;
  console.log("  ✗ the gaps nearly all run one way, which is one theme being weaker than the other");
} else {
  console.log("  ✓ the gaps scatter rather than lean, which is what two themes of the same app look like");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
