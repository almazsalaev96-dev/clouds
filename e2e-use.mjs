/**
 * Making a thing, and then using it.
 *
 * Three claims, each tested where it would break:
 *
 *  - a made thing can take the whole window, and taking it must not restart
 *    it — a deck that shuffles itself every time you go full-screen is worse
 *    than no full-screen, and the way that happens is moving the iframe in the
 *    DOM, which reloads it;
 *  - Creative can build anything, which is only true if a whole page from a
 *    chat lands as something that *runs* rather than as its own source;
 *  - a notebook page can be made out of a book, with the book reaching the
 *    model rather than being described to it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-use.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const canvases = () =>
  page.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["canvases"]).objectStore("canvases").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows.map((c) => ({ id: c.id, kind: c.kind, lang: c.lang, title: c.title }));
  });

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "creative", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

console.log("\nUsing it");
{
  /* The starters live in the Creative room now, as cards with their blurb
     under the name, so neither the place nor the exact name holds. */
  await page.getByRole("button", { name: "Creative" }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Flashcards/ }).first().click();
  await page.waitForTimeout(1500);
  const f = page.frameLocator("iframe");
  // Get the deck into a state that a reload would destroy.
  await f.locator("#card").click();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const before = { at: await f.locator("#pos").innerText(), card: await f.locator("#front").innerText() };
  check(before.at === "2", "a deck, two cards in", `card ${before.at}: ${before.card}`);

  await page.getByRole("button", { name: /Use it/ }).click();
  await page.waitForTimeout(700);

  const after = { at: await f.locator("#pos").innerText(), card: await f.locator("#front").innerText() };
  check(after.at === before.at && after.card === before.card,
    "taking the window did not restart it — the same card is still up", `card ${after.at}: ${after.card}`);

  /* Visible, not present. The chrome is hidden in place rather than unmounted
     — that is the whole trick, because unmounting it would take the iframe
     with it — so asking whether the nodes exist would always say yes. */
  const seen = await page.evaluate(() => {
    const shows = (sel) => {
      const n = document.querySelector(sel);
      return Boolean(n && n.getClientRects().length);
    };
    return {
      sidebar: shows("aside"),
      tabs: shows("[aria-label='Shortcuts']"),
      bar: shows(".composer-shell"),
      title: shows("[aria-label='Canvas title']"),
    };
  });
  check(!seen.sidebar && !seen.tabs && !seen.bar && !seen.title,
    "and everything that helps you build one has stood down", JSON.stringify(seen));

  const box = await page.locator("iframe").boundingBox();
  const vp = page.viewportSize();
  check(box.width >= vp.width - 2 && box.height >= vp.height - 2,
    "the thing has the window", `${Math.round(box.width)}×${Math.round(box.height)} of ${vp.width}×${vp.height}`);
  await page.screenshot({ path: `${OUT}/use-focus.png` });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  check(await page.locator(".composer-shell").first().isVisible(), "Escape gives it back");
  const still = await f.locator("#pos").innerText();
  check(still === before.at, "and coming back has not restarted it either", `card ${still}`);
}

console.log("\nAnything else");
{
  /* "Anything else" is in Creative with the five it is an alternative to,
     rather than on a blank chat page it used to share with them. */
  await page.getByRole("button", { name: "Creative" }).first().click();
  await page.waitForTimeout(700);
  check(await page.getByRole("button", { name: /Anything else/ }).isVisible(),
    "the five starters are not the offer — there is a way to ask for anything");
  await page.getByRole("button", { name: /Anything else/ }).click();
  await page.waitForTimeout(400);
  const draft = await page.getByRole("textbox", { name: "Message" }).inputValue();
  check(draft.startsWith("Make me a"), "and it starts the sentence for you", `“${draft}”`);
}

console.log("\nAsking for a thing gets you the thing, running");
{
  /* This used to assert that the answer arrived as `<!doctype html` in the
     transcript and that a menu item would then lift it into a canvas. Both
     halves are gone on purpose. Nobody who asked for a timer wanted nine
     hundred lines of markup in the conversation and a second decision to make
     afterwards — and `toCanvas`, the function that does the lifting, sat in
     this repository uncalled the whole time. An answer that is one complete
     document now opens where documents run, and opens running. */
  const before = await canvases();
  await page.getByRole("textbox", { name: "Message" }).fill("make me a timer");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(4500);

  const made = (await canvases()).find((c) => !before.some((b) => b.id === c.id));
  check(Boolean(made), "the answer became something that runs rather than something to read", made?.title ?? "none");
  check(made?.kind === "code" && made?.lang === "html",
    "one self-contained document, kept as one file rather than split into a folder",
    `${made?.kind}/${made?.lang}`);
  check(made?.title === "Two minutes", "named from the page's own title", made?.title ?? "");
  check(!(await page.locator("main").innerText()).includes("<!doctype html"),
    "and the markup is not also sitting in the transcript");

  const frame = page.frameLocator("iframe");
  await frame.locator("#t").waitFor({ timeout: 8000 });
  check((await frame.locator("#t").innerText()) === "02:00", "and it opens running", await frame.locator("#t").innerText());
  check(await page.getByRole("button", { name: /Use it/ }).isVisible(),
    "and can take the window like anything else made here");
  await page.screenshot({ path: `${OUT}/use-made.png` });
}

console.log("\nA book becomes lessons");
{
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /New page/ }).first().click();
  await page.waitForTimeout(800);

  check(await page.getByRole("button", { name: /Read something/ }).isVisible(),
    "a page can be handed something to read");

  const BOOK = "Chapter one. The tides.\n\n" + "The moon pulls the near water toward it and the far water away. ".repeat(200);
  await page.setInputFiles('input[aria-label="Choose something to read"]', {
    name: "tides.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK),
  });
  await page.waitForTimeout(900);
  check((await page.locator(".composer-shell").innerText()).includes("tides.txt"),
    "and it says what it is holding", "tides.txt");
  check(await page.getByRole("button", { name: /Make lessons/ }).isVisible(),
    "what you can do with it changed — the offer is lessons, not proofreading");

  await page.getByRole("button", { name: /Make lessons/ }).click();
  await page.waitForTimeout(3000);

  const sent = await (await fetch("http://127.0.0.1:8787/__last")).json().catch(() => null);
  const prompt = JSON.stringify(sent ?? {});
  check(prompt.includes("course of lessons"), "the ask reaches the model as a course, not a summary");
  check(prompt.includes("The moon pulls the near water"), "and the book goes with it, rather than being described to it");
  check(prompt.includes("tides.txt"), "named, so the model knows what it is reading", "tides.txt");
  const kept = (prompt.match(/The moon pulls the near water/g) ?? []).length;
  check(kept > 20, "and not cut to three pages — the whole of it went", `${kept} passages`);

  const diff = await page.getByRole("button", { name: /^Keep/ }).count();
  check(diff === 1, "the lessons arrive as the page, with a diff, like anything else");
  await page.screenshot({ path: `${OUT}/use-lessons.png` });
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
