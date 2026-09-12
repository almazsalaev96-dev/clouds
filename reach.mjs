/**
 * Nothing is written where it cannot be read.
 *
 * A line of code wider than the column, a table wider than the page, a filename
 * longer than its row — each of these is fine, and each of them has exactly one
 * honest ending: it wraps, it is ellipsised, or it scrolls. The dishonest
 * ending is the fourth one, where the text is simply painted past the edge of
 * something with `overflow: hidden` and the rest of the sentence stops
 * existing. You cannot read it, select it, or scroll to it, and nothing on
 * screen tells you it is there.
 *
 * So this walks the whole rendered app and, for every run of text that is wider
 * than the box holding it, finds the element that actually does the clipping
 * and asks whether that element can be scrolled. `auto` and `scroll` are
 * answers. `hidden` is only an answer when the text is ellipsised, which is a
 * deliberate, visible truncation and not a disappearance.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node reach.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

/* The probe itself. Runs in the page, over every element on it. */
const UNREACHED = () => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.clientWidth === 0) continue;
    /* The visually-hidden live regions are a 1px box on purpose: nobody is
       meant to read them with their eyes, and a screen reader is not clipped
       by a rectangle. */
    if (el.closest(".sr-only")) continue;

    /* Walk out to whoever actually does the clipping. `visible` paints past its
       own edge, so it is never the clipper — the question moves outward. */
    let clip = el;
    let ox = cs.overflowX;
    while (ox === "visible" && clip.parentElement) {
      clip = clip.parentElement;
      ox = getComputedStyle(clip).overflowX;
    }
    if (ox === "auto" || ox === "scroll") continue;                 // scrollable: reachable
    if (clip.scrollWidth - clip.clientWidth <= 1) continue;         // clipper is wide enough
    if (getComputedStyle(clip).textOverflow === "ellipsis") continue; // truncated on purpose
    if (cs.textOverflow === "ellipsis") continue;

    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 60),
      clipper: clip.tagName.toLowerCase() + "." + (clip.className?.baseVal ?? clip.className ?? "").toString().slice(0, 40),
      lost: clip.scrollWidth - clip.clientWidth,
      overflowX: ox,
      text: text.slice(0, 70),
    });
  }
  /* One report per clipper: a clipped <pre> and its <code> are one defect. */
  const seen = new Set();
  return out.filter((r) => !seen.has(r.clipper + r.lost) && seen.add(r.clipper + r.lost));
};

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

console.log("\nA line of code longer than the column");
await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
await page.keyboard.press("Enter");
await page.waitForTimeout(2600);

const codeReach = await page.evaluate(() => {
  const pre = document.querySelector(".prose pre");
  if (!pre) return { found: false };
  let clip = pre, ox = getComputedStyle(pre).overflowX;
  while (ox === "visible" && clip.parentElement) { clip = clip.parentElement; ox = getComputedStyle(clip).overflowX; }
  const before = clip.scrollLeft;
  clip.scrollLeft = 9999;
  const moved = clip.scrollLeft - before;
  clip.scrollLeft = before;
  return { found: true, wide: pre.scrollWidth > pre.clientWidth, overflowX: ox, hidden: clip.scrollWidth - clip.clientWidth, moved };
});
check(codeReach.found, "a code block came back to measure");
check(codeReach.wide, "the line is wider than the column, so this is the case worth checking", `${codeReach.hidden}px past the edge`);
check(codeReach.overflowX === "auto" || codeReach.overflowX === "scroll", "the end of the line can be scrolled to", `overflow-x: ${codeReach.overflowX}`);
check(codeReach.moved > 0, "and scrolling it actually moves", `${codeReach.moved}px`);

console.log("\nNothing anywhere in a conversation is painted past a wall");
const chat = await page.evaluate(UNREACHED);
check(chat.length === 0, "every run of text in the chat can be reached", chat.map((r) => `${r.clipper} hides ${r.lost}px of "${r.text}"`).join(" | "));

console.log("\nThe same, in the other places the app puts text");

await page.locator("aside nav").getByRole("button", { name: "Code" }).click();
await page.waitForTimeout(500);
const newFile = page.getByRole("button", { name: /Code file/ }).first();
if (await newFile.count()) {
  await newFile.click();
  await page.waitForTimeout(900);
  const area = page.getByLabel("Canvas content");
  if (await area.count()) {
    await area.click();
    await area.fill("const aVeryLongIdentifierIndeed = someFunctionWithALongName(firstArgument, secondArgument, thirdArgument);\n");
    await page.waitForTimeout(700);
  }
}
const code = await page.evaluate(UNREACHED);
check(code.length === 0, "the code surface keeps every run of text reachable", code.map((r) => `${r.clipper} hides ${r.lost}px of "${r.text}"`).join(" | "));

await page.locator("aside nav").getByRole("button", { name: "Conversations" }).click();
await page.waitForTimeout(500);
const gear = page.getByRole("button", { name: /Settings/ }).first();
if (await gear.count()) {
  await gear.click();
  await page.waitForTimeout(700);
  const set = await page.evaluate(UNREACHED);
  check(set.length === 0, "settings keeps every run of text reachable", set.map((r) => `${r.clipper} hides ${r.lost}px of "${r.text}"`).join(" | "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

console.log("\nAnd at the narrow width a phone actually has");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
const narrow = await page.evaluate(UNREACHED);
check(narrow.length === 0, "390px wide, nothing is clipped out of reach", narrow.map((r) => `${r.clipper} hides ${r.lost}px of "${r.text}"`).join(" | "));

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nreach PASS");
process.exit(failed ? 1 : 0);
