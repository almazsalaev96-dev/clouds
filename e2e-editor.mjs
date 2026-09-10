/**
 * The code editor: the caret and the colour have to agree.
 *
 * A highlighted textarea is two layers pretending to be one, and the failure
 * mode is silent — the caret drifts a fraction of a pixel per line until it
 * sits between two characters twenty lines down. So the test measures the two
 * layers against each other rather than looking at a screenshot.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-editor.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true }, version: 1 })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("radio", { name: "Code" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Web app/ }).click();
await page.waitForTimeout(1400);
await page.getByRole("button", { name: /^Stop$/ }).click();
await page.waitForTimeout(600);
// Work in app.js: it is the file the console will point back at, and a
// language with more than three kinds of token in it.
await page.locator('button[aria-current]').filter({ hasText: "app.js" }).click();
await page.waitForTimeout(700);

/* 1. It is actually highlighted, and the colours are the app's tokens rather
      than Shiki's own — so the theme switch does not need a re-highlight. */
const tokens = await page.evaluate(() => {
  const pre = document.querySelector("pre[aria-hidden]");
  const spans = pre ? [...pre.querySelectorAll("span[style*='color']")] : [];
  const colors = new Set(spans.map((s) => getComputedStyle(s).color));
  return { count: spans.length, distinct: colors.size, raw: (pre?.innerHTML ?? "").includes("var(--syn-") };
});
check(tokens.count > 20, "the file is tokenised", `${tokens.count} spans`);
check(tokens.distinct >= 4, "in several colours", `${tokens.distinct} distinct`);
check(tokens.raw, "and the colours are the app's own tokens, not Shiki's hexes");

/* 2. The two layers agree. Every line of the highlighted copy has to sit on
      the same baseline as the same line of the textarea, or the caret drifts. */
const drift = await page.evaluate(() => {
  const ta = document.querySelector('textarea[aria-label="Canvas content"]');
  const pre = document.querySelector("pre[aria-hidden]");
  const a = getComputedStyle(ta), p = getComputedStyle(pre);
  const same = ["fontFamily", "fontSize", "lineHeight", "letterSpacing", "tabSize", "paddingTop", "paddingLeft", "whiteSpace"];
  const differ = same.filter((k) => a[k] !== p[k]);
  const ra = ta.getBoundingClientRect(), rp = pre.getBoundingClientRect();
  return { differ, dx: Math.abs(ra.left - rp.left), dy: Math.abs(ra.top - rp.top) };
});
check(drift.differ.length === 0, "both layers are set identically", drift.differ.join(", ") || "family, size, leading, tracking, tabs, padding");
check(drift.dx < 0.5 && drift.dy < 0.5, "and sit exactly on top of each other", `${drift.dx.toFixed(2)}px / ${drift.dy.toFixed(2)}px`);

/* 3. The gutter counts what is there, and keeps counting as you type. */
const before = await page.evaluate(() => document.querySelectorAll("[aria-hidden] > div.tnum").length);
const ta = page.getByLabel("Canvas content");
await ta.click();
await page.keyboard.press("Control+End");
await page.keyboard.press("Enter");
await page.keyboard.type("const added = 1;");
await page.waitForTimeout(700);
const after = await page.evaluate(() => document.querySelectorAll("[aria-hidden] > div.tnum").length);
check(after === before + 1, "the gutter follows the file", `${before} → ${after}`);
check((await page.locator("main").innerText()).includes("Ln "), "and the status line says where the caret is");

/* 4. Tab indents rather than escaping the box, and Escape is the way out. */
await page.keyboard.press("Home");
await page.keyboard.press("Tab");
await page.waitForTimeout(400);
check((await ta.inputValue()).includes("  const added = 1;"), "Tab indents");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check(await page.evaluate(() => document.activeElement?.tagName !== "TEXTAREA"), "Escape hands the keyboard back");

await page.screenshot({ path: `${OUT}/editor-dark.png` });

/* 5. The console's location is somewhere to go, not something to read. */
await ta.click();
await page.keyboard.press("Control+a");
await page.keyboard.type('console.log("one");\nmissingThing();\n');
await page.waitForTimeout(600);
await page.getByRole("button", { name: /^Run$/ }).click();
await page.waitForTimeout(2000);
// Not clicked open: an error opens it. Chasing a silent failure is what the
// drawer exists to prevent, and a drawer you have to know to open does not.
check((await page.locator("main").innerText()).includes("one"), "an error opens the console by itself");
const link = page.getByTitle(/^Open app\.js at line/);
check(await link.isVisible().catch(() => false), "the error's location is a link", await link.innerText().catch(() => "none"));
await link.click();
await page.waitForTimeout(900);
const landed = await page.evaluate(() => {
  const el = document.querySelector('textarea[aria-label="Canvas content"]');
  if (!el) return null;
  const upto = el.value.slice(0, el.selectionStart);
  return { line: upto.split("\n").length, selected: el.value.slice(el.selectionStart, el.selectionEnd) };
});
check(landed?.line === 2, "clicking it puts the caret on that line", `line ${landed?.line}`);
check((landed?.selected ?? "").includes("missingThing"), "with the line selected", landed?.selected);

// The ReferenceError above is deliberate — it is the thing being tested.
const real = errs.filter((e) => !/missingThing/.test(e));
console.log(real.length ? "\n  ✗ " + real.join("; ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed || real.length ? 1 : 0);
