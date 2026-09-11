/**
 * The print stylesheet is the PDF renderer, and nothing had ever run it.
 *
 * A paper leaves this app through the browser's own print pipeline, which
 * means `@media print` is not a nicety on top of the app — it *is* the export.
 * It has a hard job: the app is a fixed-height flex shell full of independent
 * scrollers, and paper is one continuous column. Get that wrong and a printed
 * conversation is silently clipped to one screen while still looking like a
 * clean document, which is the worst way to be wrong, because the person only
 * finds out after they have handed it in.
 *
 * So: emulate print, and check the three things that break.
 *
 *   1. The application disappears — sidebar, top bar, composer, every control.
 *   2. The document unrolls. Every message is in the flow, not clipped to the
 *      height of a screen, and a long one really does make several pages.
 *   3. It is ink on paper — dark on white — whichever theme was on screen.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node print.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const settings = (theme) => ({ theme, density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true });

/** Is a colour close enough to white to be paper, or to black to be ink? */
const lum = (css) => {
  const [r, g, bl] = (css.match(/[\d.]+/g) ?? [0, 0, 0]).slice(0, 3).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
};

for (const theme of ["dark", "light"]) {
  console.log(`\nA conversation printed from the ${theme} theme`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGE: " + e.message));

  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), settings(theme));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  /* Long enough that a screen cannot hold it — the whole question is whether
     the thing that does not fit comes out anyway. */
  for (let i = 0; i < 6; i++) {
    await page.getByRole("textbox", { name: "Message" }).fill(`question number ${i + 1} about debouncing`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
  }
  const onScreen = await page.evaluate(() => document.querySelectorAll("[id^=m-]").length);
  check(onScreen >= 12, "twelve turns to print", `${onScreen} messages`);

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(500);

  const gone = await page.evaluate(() => {
    const visible = (sel) =>
      [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
      }).length;
    return {
      sidebar: visible("aside"),
      composer: visible(".composer-shell"),
      topbar: visible("header.no-print"),
      controls: visible("button:not([disabled])"),
    };
  });
  check(gone.sidebar === 0, "the sidebar is not on the paper", `${gone.sidebar}`);
  check(gone.composer === 0, "nor the box you type in", `${gone.composer}`);
  check(gone.topbar === 0, "nor the bar across the top", `${gone.topbar}`);
  check(gone.controls === 0, "and no button survives to be printed as furniture", `${gone.controls} left`);

  const flow = await page.evaluate(() => {
    const msgs = [...document.querySelectorAll("[id^=m-]")];
    const rects = msgs.map((m) => m.getBoundingClientRect());
    const laidOut = rects.filter((r) => r.height > 0).length;
    const bottom = Math.max(0, ...rects.map((r) => r.bottom + scrollY));
    /* Every scroller in the app has to have unrolled: one left holding its own
       overflow is one that prints only what happened to be inside it. */
    const stillScrolling = [...document.querySelectorAll("body *")].filter((el) => {
      const c = getComputedStyle(el);
      return (c.overflowY === "auto" || c.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2;
    }).map((el) => el.tagName.toLowerCase() + "." + (el.className?.baseVal ?? el.className ?? "").toString().split(" ")[0]);
    return { laidOut, total: msgs.length, docHeight: document.documentElement.scrollHeight, bottom, stillScrolling: stillScrolling.slice(0, 3) };
  });
  check(flow.laidOut === flow.total, "every message has a place on the page", `${flow.laidOut} of ${flow.total}`);
  check(flow.stillScrolling.length === 0, "nothing is left inside a scroller that paper cannot scroll", flow.stillScrolling.join(", "));
  check(flow.docHeight > 900, "and the document is taller than a screen rather than clipped to one", `${flow.docHeight}px`);

  /* The screen lets a long line of code scroll; paper cannot, so anything
     wider than the page ends in the margin and is gone. Measured against the
     sheet rather than the viewport, because the viewport is not the page. */
  const spill = await page.evaluate(() => {
    const page_ = document.documentElement.clientWidth;
    const over = [];
    for (const el of document.querySelectorAll("pre, table, img, figure, .prose *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1 || r.right > page_ + 1) {
        over.push(`${el.tagName.toLowerCase()} ${Math.round(Math.max(el.scrollWidth - el.clientWidth, r.right - page_))}px past`);
        if (over.length > 3) break;
      }
    }
    return over;
  });
  check(spill.length === 0, "nothing runs off the side of the page, where there is no scrolling it back", spill.join(", "));

  const ink = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const first = document.querySelector(".prose p");
    return { bg: body.backgroundColor, fg: first ? getComputedStyle(first).color : body.color };
  });
  check(lum(ink.bg) > 0.9, "the paper is white whichever theme was on screen", ink.bg);
  check(lum(ink.fg) < 0.3, "and the words are dark on it", ink.fg);

  const pdf = await page.pdf({ format: "A4", printBackground: false });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(pdf.length > 4000, "a PDF comes out of it", `${Math.round(pdf.length / 1024)}kB`);
  check(pages >= 2, "and twelve turns make more than one page of it", `${pages} pages`);

  check(errs.length === 0, "no page errors", errs.join(" | "));
  await ctx.close();
}

console.log("\nA note prints as a document rather than as an editor");
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), settings("dark"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Notebook$/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /New page/ }).first().click();
  await page.waitForTimeout(1200);

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  const paper = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none"; };
    const sheet = document.querySelector(".paper-sheet");
    const inputs = [...document.querySelectorAll(".paper-head input")].filter(vis);
    return {
      sheet: Boolean(sheet),
      textareas: [...document.querySelectorAll(".paper-sheet textarea")].filter(vis).length,
      borderedInputs: inputs.filter((i) => parseFloat(getComputedStyle(i).borderTopWidth) > 0).length,
      colour: sheet ? getComputedStyle(sheet).color : "",
    };
  });
  check(paper.sheet, "there is a sheet to print");
  check(paper.textareas === 0, "a paper caught mid-edit does not print as raw markdown", `${paper.textareas} textareas`);
  check(paper.borderedInputs === 0, "and the title loses the box you edit it in", `${paper.borderedInputs} bordered`);
  check(paper.colour === "" || lum(paper.colour) < 0.3, "the sheet is set in ink", paper.colour);
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nprint PASS");
process.exit(failed ? 1 : 0);
