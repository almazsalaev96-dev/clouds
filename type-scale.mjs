/**
 * The typography, measured rather than specified.
 *
 * A type scale written in a file is a claim; what a reader gets is the
 * computed style of the elements actually on screen, after Tailwind, after
 * cascade, after whatever the browser's own font setting does to it. So this
 * renders the app and reads that, in two root sizes.
 *
 * The assertion that matters most is **characters per line**, not pixels.
 * Every published spec for this states the measure in pixels — 720, 760, 780 —
 * and a pixel measure is only correct at one font size. Measured here: at a
 * 16px root the column holds 72 characters; at a 20px root, which is what a
 * browser's large-text setting does, the same rule gives a 25% wider box and
 * still 72 characters. The pixel number moved and the thing that governs
 * reading did not. Sixty to eighty has been the answer since metal type, and
 * it is the answer the app is held to here.
 *
 *   node type-scale.mjs      (needs the app running on :3100)
 */
import { chromium } from "playwright";

const SETTINGS = (over = {}) => JSON.stringify({ state: { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "", nameAsked: true, ...over }, version: 1 });

let failed = 0;
const check = (pass, label, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "  ✓" : "  ✗"} ${label}${detail ? " — " + detail : ""}`);
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

/** Everything about how a run of text reads, read off the element itself. */
const READER = `(el) => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const c = document.createElement("canvas").getContext("2d");
  c.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
  const alpha = "abcdefghijklmnopqrstuvwxyz ";
  const avg = c.measureText(alpha).width / alpha.length;
  const size = parseFloat(cs.fontSize);
  return {
    size,
    leading: parseFloat(cs.lineHeight) / size,
    weight: Number(cs.fontWeight),
    colour: cs.color,
    width: el.getBoundingClientRect().width,
    chars: Math.round(el.getBoundingClientRect().width / avg),
  };
}`;

async function openChat(rootPx) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS());
  await p.reload({ waitUntil: "networkidle" });
  await p.addStyleTag({ content: `html { font-size: ${rootPx}px }` });
  await p.waitForTimeout(600);
  await p.getByRole("textbox", { name: "Message" }).fill("explain debounce with a table and a heading");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3200);
  return { ctx, p };
}

console.log("\nA line is the right length, in characters, at any text size");
for (const rootPx of [16, 20]) {
  const { ctx, p } = await openChat(rootPx);
  const m = await p.evaluate(`(${READER})(document.querySelector(".prose p") || document.querySelector(".prose"))`);
  check(m.chars >= 60 && m.chars <= 80,
    `root ${rootPx}px: an answer runs ${m.chars} characters`,
    `${Math.round(m.width)}px at ${m.size}px`);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!over, `root ${rootPx}px: and the page does not spill sideways`);
  await ctx.close();
}

console.log("\nThe reader's own text size is respected, not overridden");
{
  const sizes = [];
  for (const rootPx of [16, 20]) {
    const { ctx, p } = await openChat(rootPx);
    const m = await p.evaluate(`(${READER})(document.querySelector(".prose p") || document.querySelector(".prose"))`);
    sizes.push(m);
    await ctx.close();
  }
  check(sizes[1].size > sizes[0].size * 1.2,
    "turning the browser's text up turns the app's text up",
    `${sizes[0].size}px → ${sizes[1].size}px`);
  check(Math.abs(sizes[0].chars - sizes[1].chars) <= 4,
    "and the line still holds the same number of characters, because the column grew with it",
    `${sizes[0].chars} → ${sizes[1].chars} characters`);
}

console.log("\nA conversation and a document are set differently");
{
  const { ctx, p } = await openChat(16);
  const chat = await p.evaluate(`(${READER})(document.querySelector(".prose p") || document.querySelector(".prose"))`);
  const gap = await p.evaluate(() => {
    const el = document.querySelector(".prose > * + *");
    return el ? parseFloat(getComputedStyle(el).marginTop) : null;
  });
  check(gap !== null && gap >= 12 && gap <= 18, "a conversation breathes between paragraphs", `${gap}px`);

  // The notebook, which is set as a document.
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
  await p.waitForTimeout(700);
  const made = await p.getByRole("button", { name: /New page|Write/ }).first().click().then(() => true).catch(() => false);
  await p.waitForTimeout(900);
  const doc = await p.evaluate(`(() => {
    const el = document.querySelector('[data-read="doc"]');
    if (!el) return null;
    return { mode: el.getAttribute("data-read"),
             size: parseFloat(getComputedStyle(el).getPropertyValue("--read-size")) || null,
             raw: getComputedStyle(el).getPropertyValue("--read-size").trim(),
             leading: getComputedStyle(el).getPropertyValue("--read-leading").trim(),
             measure: getComputedStyle(el).getPropertyValue("--measure").trim() };
  })()`);
  check(doc !== null, "the notebook declares itself a document", doc ? JSON.stringify(doc) : "no [data-read=doc] found");
  if (doc) {
    check(doc.raw === "1.0625rem", "set a step larger than a conversation", `${doc.raw} vs 1rem`);
    check(parseFloat(doc.leading) > 1.65, "with more air between its lines", `${doc.leading} vs 1.65`);
    check(doc.measure === "42rem", "and a slightly wider column", `${doc.measure} vs 40rem`);
  }
  check(chat.size === 16, "while the conversation stays at 16", `${chat.size}px`);
  await ctx.close();
}

console.log("\nHierarchy comes from size and brightness, not from weight");
{
  const { ctx, p } = await openChat(16);
  const weights = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".prose, .prose *")) {
      const w = Number(getComputedStyle(el).fontWeight);
      if (w > 600) out.push(el.tagName + "." + (el.className || "") + " = " + w);
    }
    return [...new Set(out)];
  });
  check(weights.length === 0, "nothing in an answer is heavier than 600", weights.slice(0, 3).join(", "));

  const ladder = await p.evaluate(`(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => parseFloat(cs.getPropertyValue(n));
    return { meta: v("--text-meta"), sm: v("--text-sm"), md: v("--text-md"), base: v("--text-base"),
             lg: v("--text-lg"), section: v("--text-section"), xl: v("--text-xl"), xxl: v("--text-2xl") };
  })()`);
  const order = ["meta", "sm", "md", "base", "lg", "section", "xl", "xxl"];
  let rising = true;
  for (let i = 1; i < order.length; i++) if (!(ladder[order[i]] > ladder[order[i - 1]])) rising = false;
  check(rising, "the scale climbs without a repeat or a gap in it",
    order.map((k) => `${k} ${(ladder[k] * 16).toFixed(0)}`).join(" · "));

  const user = await p.evaluate(`(${READER})([...document.querySelectorAll(".rounded-\\\\[20px\\\\]")].pop())`);
  check(user && user.size === 15, "what you typed is 15 against the answer's 16", user ? `${user.size}px` : "not found");
  check(user && user.size > 13, "and not so small that it reads as a caption of itself", user ? `${user.size}px` : "");
  await ctx.close();
}

console.log("\nNothing is nailed to a pixel size while the reader's text grows");
{
  /* The gate that would have caught this class rather than my noticing it.
     Twenty-six labels were written `text-[11px]` and three more in 12, 13 and
     16 — pixels, so they did not move when a reader turned their browser text
     up. The body scaled around them and every label in the app stayed frozen:
     at a 24px root that is an 11px chip against 24px prose, a ratio of more
     than two to one where the design says 1.45.

     Measured by rendering twice and comparing every run of text by its own
     content. The wordmark is the one thing allowed to stand still: it is a
     graphic with a cap height, not a sentence. */
  const seen = {};
  for (const rootPx of [16, 24]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    const p = await ctx.newPage();
    await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
    await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS());
    await p.reload({ waitUntil: "networkidle" });
    await p.addStyleTag({ content: `html { font-size: ${rootPx}px }` });
    await p.waitForTimeout(700);
    seen[rootPx] = await p.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll("body *")) {
        const t = el.textContent?.trim();
        if (!t) continue;
        if (el.children.length && !/^(SPAN|P|KBD|BUTTON|LABEL|H1|H2|H3)$/.test(el.tagName)) continue;
        /* The wordmark only. Sized by a cap height in px because it is a
           drawing of a letter rather than a letter — excluded by its own class
           rather than by `aria-hidden`, which decorates half the app and would
           hide real text behind the exemption. */
        if (el.closest(".signature")) continue;
        out[t.slice(0, 30)] = parseFloat(getComputedStyle(el).fontSize);
      }
      return out;
    });
    await ctx.close();
  }
  const stuck = [];
  for (const [text, small] of Object.entries(seen[16])) {
    const large = seen[24][text];
    if (large !== undefined && Math.abs(large - small) < 0.5) stuck.push(`${JSON.stringify(text)} at ${small}px`);
  }
  check(stuck.length === 0,
    `${Object.keys(seen[16]).length} runs of text, every one of them grows with the reader`,
    stuck.slice(0, 4).join(" · "));
}

console.log("\nHierarchy is carried by brightness, in both themes alike");
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS());
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);

  const ladders = {};
  for (const theme of ["dark", "light"]) {
    await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await p.waitForTimeout(150);
    ladders[theme] = await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const rgb = (v) => { const d = document.createElement("div"); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return c; };
      const lum = (v) => { const [r, g, bl] = rgb(v).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
      const bg = lum(cs.getPropertyValue("--bg-canvas"));
      const ratio = (v) => { const l = lum(v); const [a, c] = l > bg ? [l, bg] : [bg, l]; return (a + 0.05) / (c + 0.05); };
      return ["--text-primary", "--text-secondary", "--text-tertiary", "--text-faint"]
        .map((n) => +ratio(cs.getPropertyValue(n)).toFixed(2));
    });
  }
  for (const theme of ["dark", "light"]) {
    const l = ladders[theme];
    check(l.every((r, i) => i === 0 || r < l[i - 1]),
      `${theme}: the four text levels descend without a tie`, l.join(" → "));
  }
  /* The same ladder in both, rung for rung. A reader who switches theme should
     find the structure of the page unchanged, not re-learn what "secondary"
     looks like. */
  const drift = ladders.dark.map((d, i) => Math.abs(d - ladders.light[i]));
  check(Math.max(...drift) < 1.2,
    "and the two themes climb it by the same steps",
    drift.map((d) => d.toFixed(2)).join(", "));
  await ctx.close();
}

console.log("\nA column that cannot get wider gets smaller text instead");
{
  /* Driven rather than asserted about: a reading mode that nothing renders is
     a token naming something it does not control, which is the fault this
     whole pass exists to avoid. So the comparison is actually started. */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", s), SETTINGS());
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);

  /* Two models answering, asked for from the palette. It used to be a
     checklist inside the composer's Tools popover, which meant deciding
     whether you wanted two answers before you had seen one; the popover is
     gone and the decision is a command. */
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: "Command palette" }).fill("alongside");
  await p.waitForTimeout(400);
  await p.getByRole("option", { name: /alongside/i }).first().click();
  await p.waitForTimeout(400);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.getByRole("textbox", { name: "Message" }).fill("explain debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3200);

  /* Both settings measured in the column the app actually renders, rather than
     against a width worked out on paper — the first version of this assertion
     was written against an estimate of 372px and the real column is 274px. */
  const dense = await p.evaluate(`(() => {
    const el = document.querySelector('[data-read="dense"] .prose p') || document.querySelector('[data-read="dense"] .prose');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const w = el.getBoundingClientRect().width;
    const c = document.createElement("canvas").getContext("2d");
    const alpha = "abcdefghijklmnopqrstuvwxyz ";
    const at = (px) => {
      c.font = cs.fontWeight + " " + px + "px " + cs.fontFamily;
      return Math.round(w / (c.measureText(alpha).width / alpha.length));
    };
    return { size: parseFloat(cs.fontSize), width: Math.round(w), chars: at(parseFloat(cs.fontSize)), asBody: at(16) };
  })()`);
  check(dense !== null, "a comparison column renders as dense",
    dense ? `${dense.width}px wide` : "no [data-read=dense] on screen — the mode names nothing");
  if (dense) {
    check(dense.size === 14, "at 14px rather than 16", `${dense.size}px`);
    check(dense.chars > dense.asBody,
      "which buys back characters the column cannot get any other way",
      `${dense.chars} characters, against ${dense.asBody} at body size`);
    /* Said plainly rather than asserted away: three answers abreast is a narrow
       column whatever is done to it, and this makes it better, not good. The
       fix for reading one properly is to keep it, which is what Keep is for. */
    console.log(`    (still only ${dense.chars} characters — a column this narrow cannot reach sixty at any size a person would read)`);
  }
  await p.screenshot({ path: "/tmp/compare-dense.png" });
  await ctx.close();
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
