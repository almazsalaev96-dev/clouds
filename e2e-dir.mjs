/**
 * The app had no concept of text direction.
 *
 * Zero occurrences of `dir`, `unicode-bidi` or `:dir()` anywhere in it, and
 * `<html lang="en">` hardcoded. Four providers, all fluent in Arabic, Hebrew,
 * Persian and Urdu — and an answer in any of them rendered as a left-aligned
 * block with its terminal punctuation at the wrong end, its list markers on the
 * wrong side, and its blockquote rule down the wrong edge. Read aloud
 * pronounced it with an English voice, which for a non-Latin script is not an
 * accent: it is the browser applying English letter-to-sound rules to
 * characters that have none.
 *
 * The fix is per block rather than per app, and that is the thing to assert.
 * A thread here is routinely mixed — an Arabic explanation with an English
 * identifier in it — so the chrome stays where it is and each run of text is
 * laid out from its own first strong character.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-dir.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
let failed = 0;
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const ARABIC = "مرحبا كيف يعمل هذا";

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

console.log("\nWhat you are typing is laid out the way you are typing it");
{
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill(ARABIC);
  await page.waitForTimeout(200);
  const dir = await box.evaluate((el) => getComputedStyle(el).direction);
  check(dir === "rtl", "the composer follows the script, not the app", dir);

  await box.fill("what is a debounce");
  await page.waitForTimeout(200);
  check(await box.evaluate((el) => getComputedStyle(el).direction) === "ltr",
    "and follows it back when the script changes");
}

console.log("\nAnd so is what you said");
{
  await page.getByRole("textbox", { name: "Message" }).fill(ARABIC);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3200);
  const said = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("[id^=m-] div")].find((d) => d.textContent.trim() === t);
    return el ? getComputedStyle(el).direction : "not found";
  }, ARABIC);
  check(said === "rtl", "your own message is right to left", said);

  const answer = await page.evaluate(() => {
    const p = document.querySelector(".prose");
    return p ? { dir: getComputedStyle(p).direction, attr: p.getAttribute("dir") } : null;
  });
  check(answer?.attr === "auto", "and the answer decides for itself rather than being told", String(answer?.attr));
  check(answer?.dir === "ltr", "so an English answer to an Arabic question is still left to right", String(answer?.dir));
}

console.log("\nThe chrome does not flip with it, because a mixed thread is the normal case");
{
  const shell = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
  check(shell === "ltr", "the page itself stays where it was", shell);
}

console.log("\nProse is laid out from the start of the line, not from the left of the screen");
{
  const logical = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "prose";
    probe.dir = "rtl";
    probe.style.cssText = "position:fixed;top:-500px;width:400px";
    probe.innerHTML = "<ul><li>one</li></ul><blockquote>two</blockquote><table><thead><tr><th>h</th></tr></thead></table>";
    document.body.appendChild(probe);
    const ul = getComputedStyle(probe.querySelector("ul"));
    const bq = getComputedStyle(probe.querySelector("blockquote"));
    const th = getComputedStyle(probe.querySelector("th"));
    const out = {
      listPadLeft: ul.paddingLeft, listPadRight: ul.paddingRight,
      quoteLeft: bq.borderLeftWidth, quoteRight: bq.borderRightWidth,
      headAlign: th.textAlign,
    };
    probe.remove();
    return out;
  });
  check(logical.listPadRight !== "0px" && logical.listPadLeft === "0px",
    "list markers sit at the start of the line", `${logical.listPadLeft} / ${logical.listPadRight}`);
  check(logical.quoteRight !== "0px" && logical.quoteLeft === "0px",
    "and a quotation rule runs down the side the text begins on", `${logical.quoteLeft} / ${logical.quoteRight}`);
  check(logical.headAlign === "start" || logical.headAlign === "right",
    "and a table heading is aligned to the start, not to the left", logical.headAlign);
}

/* Read aloud picking the right voice is `guessLang`, and it is tested in
   test-lang.ts against nine scripts and the English paragraph with one foreign
   word in it that must not switch. A browser adds nothing to that. */

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-dir PASS");
process.exit(failed ? 1 : 0);
