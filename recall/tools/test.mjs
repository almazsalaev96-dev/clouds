/**
 * The tests, run in a browser, against the built file.
 *
 * The previous project's failure was not a missing test — it had fifty. It was
 * that the memory model was tested in Node and the interface in Chromium, while
 * the thing that broke was the browser refusing to parse the file at all. So
 * everything here runs in a real page: the model is called through the same
 * `window.Recall` the app uses, and the screens are driven by clicking them.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page_html = readFileSync(resolve(root, "dist/index.html"));

const failures = [];
let checks = 0;
function check(name, ok, detail = "") {
  checks += 1;
  if (ok) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures.push(name); }
}
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

// Served over HTTP, not file://, because that is how anyone will open it and
// because localStorage behaves differently from a file origin.
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page_html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;

/**
 * Use whatever Chromium this machine already has rather than a version Playwright
 * happens to want, so `npm test` works without anyone exporting anything.
 */
function findChromium() {
  if (process.env.RECALL_CHROMIUM) return process.env.RECALL_CHROMIUM;
  const shared = "/opt/pw-browsers";
  if (!existsSync(shared)) return null;
  const builds = readdirSync(shared)
    .filter((name) => name.indexOf("chromium-") === 0)
    .sort()
    .reverse();
  for (const build of builds) {
    const guess = `${shared}/${build}/chrome-linux/chrome`;
    if (existsSync(guess)) return guess;
  }
  return null;
}

const executablePath = findChromium();
const browser = await chromium.launch(executablePath
  ? { executablePath, args: ["--headless=new", "--no-sandbox"], ignoreDefaultArgs: ["--headless=old"] }
  : {});

async function open(size = { width: 430, height: 932 }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(origin);
  await page.waitForSelector("#app .wrap, #app .study");
  return { page, context, errors };
}

// --------------------------------------------------------------- the model

console.log("the memory model");
{
  const { page, context, errors } = await open();

  const model = await page.evaluate(() => {
    const R = window.Recall;
    const now = 1700000000000;
    const fresh = { s: 0, d: 5, due: now, last: null, reps: 0, lapses: 0 };

    const good = R.review(fresh, 3, now);
    const again = R.review(fresh, 1, now);
    const easy = R.review(fresh, 4, now);

    // A card remembered on schedule, three times over.
    let card = good;
    const ladder = [];
    let t = now;
    for (let i = 0; i < 4; i += 1) {
      t = card.due;
      card = R.review(card, 3, t);
      ladder.push(card.s);
    }

    // The same card, then forgotten.
    const forgotten = R.review(card, 1, card.due);

    return {
      goodDays: (good.due - now) / 86400000,
      againMinutes: (again.due - now) / 60000,
      easyDays: (easy.due - now) / 86400000,
      ladder,
      lapsedStability: forgotten.s,
      stabilityBefore: card.s,
      r0: R.recall(10, 0),
      rAtStability: R.recall(10, 10),
      rFar: R.recall(10, 200),
      difficultyAfterAgain: forgotten.d
    };
  });

  check("a new card answered well returns in a couple of days",
    near(model.goodDays, 2.6, 0.3), `${model.goodDays.toFixed(2)}d`);
  check("a new card answered easily waits longer",
    model.easyDays > model.goodDays * 2, `${model.easyDays.toFixed(2)}d`);
  check("a card you could not recall comes back inside the session",
    near(model.againMinutes, 6, 0.1), `${model.againMinutes} min`);
  check("intervals lengthen every time you remember",
    model.ladder.every((s, i) => i === 0 || s > model.ladder[i - 1]),
    model.ladder.map((s) => s.toFixed(1)).join(" -> "));
  check("and reach months, not days, after four successes",
    model.ladder[3] > 40, `${model.ladder[3].toFixed(0)} days`);
  check("forgetting collapses the interval rather than nudging it",
    model.lapsedStability < model.stabilityBefore * 0.6,
    `${model.stabilityBefore.toFixed(0)} -> ${model.lapsedStability.toFixed(1)}`);
  check("forgetting makes the card harder", model.difficultyAfterAgain > 5,
    String(model.difficultyAfterAgain.toFixed(2)));
  check("recall is certain at zero elapsed", model.r0 === 1);
  check("recall sits at the 90% target after one stability",
    near(model.rAtStability, 0.9, 0.01), model.rAtStability.toFixed(3));
  check("recall decays but never reaches zero",
    model.rFar > 0 && model.rFar < 0.4, model.rFar.toFixed(3));
  check("the model raised no errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await context.close();
}

// ----------------------------------------------------------- the extractor

console.log("making cards from notes");
{
  const { page, context } = await open();
  const found = await page.evaluate(() => window.Recall.extract([
    "Liquidity - how easily an asset can be turned into cash",
    "Working capital = current assets minus current liabilities",
    "Gearing: the proportion of capital that comes from long-term debt",
    "",
    "Sources of finance:",
    "- Retained profit",
    "- Share capital",
    "- Bank loan",
    "",
    "Q: What is the break-even point?",
    "A: Where total revenue equals total cost",
    "",
    "Inflation refers to a sustained rise in the general price level.",
    "The firm spent **1.3 billion** on research last year.",
    "Unemployment fell to 4.2% in the second quarter."
  ].join("\n")));

  const q = (needle) => found.find((c) => c.q.toLowerCase().includes(needle));
  check("a dash separates a term from its definition", Boolean(q("liquidity")));
  check("so does an equals sign", Boolean(q("working capital")));
  check("so does a colon", Boolean(q("gearing")));
  check("a heading with bullets becomes a name-them-all card",
    Boolean(found.find((c) => c.q.indexOf("Name the 3") === 0)));
  check("an explicit Q and A pair is taken as written", Boolean(q("break-even")));
  check("a defining sentence becomes a question", Boolean(q("what is inflation")));
  check("bold text becomes the gap in a cloze",
    Boolean(found.find((c) => c.a === "1.3 billion" && c.q.indexOf("[ ... ]") !== -1)));
  check("a figure in a sentence becomes the gap",
    Boolean(found.find((c) => c.a === "4.2%")));
  check("every card says which rule made it", found.every((c) => c.why && c.why.length > 4));
  check("nothing is duplicated",
    new Set(found.map((c) => c.q)).size === found.length, `${found.length} cards`);

  const empty = await page.evaluate(() => window.Recall.extract("just some ordinary prose with nothing to hold on to"));
  check("prose with no structure yields nothing rather than nonsense", empty.length === 0,
    JSON.stringify(empty).slice(0, 120));
  await context.close();
}

// ---------------------------------------------------------------- the app

console.log("using it");
{
  const { page, context, errors } = await open();

  check("it opens on an honest empty state",
    await page.getByText("Nothing to recall yet").isVisible());

  await page.getByRole("button", { name: /ready-made deck/ }).click();
  await page.getByRole("button", { name: /Business: key terms/ }).click();
  await page.waitForTimeout(200);
  check("a ready-made deck installs and opens",
    (await page.locator(".deck-row").count()) > 20);

  await page.locator(".tab").first().click();
  await page.waitForTimeout(150);
  const dueText = await page.locator(".due-figure b").textContent();
  check("everything new is due immediately", Number(dueText) === 26, dueText);
  check("the tab bar carries the count",
    (await page.locator(".tab .dot").textContent()) === "26");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForSelector(".study");
  check("a session shows one question at a time",
    (await page.locator(".prompt").count()) === 1);
  check("and hides the answer until asked",
    (await page.locator(".answer").count()) === 0);

  await page.getByRole("button", { name: "Show answer" }).click();
  await page.waitForSelector(".answer");
  check("revealing shows the answer", (await page.locator(".answer").count()) === 1);
  check("the four ratings say when the card would return",
    (await page.locator(".rate button span").allTextContents()).every((t) => t.length > 0));

  const firstPrompt = await page.locator(".prompt").textContent();
  await page.locator(".rate .r3").click();
  await page.waitForTimeout(120);
  check("rating advances to a different card",
    (await page.locator(".prompt").textContent()) !== firstPrompt);
  check("progress is counted", (await page.locator(".study-top .num").textContent()).indexOf("1 /") === 0);

  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(120);
  check("undo puts the card back, answer showing",
    (await page.locator(".prompt").textContent()) === firstPrompt
    && (await page.locator(".answer").count()) === 1);

  // Keyboard: space reveals, 1-4 rate.
  await page.locator(".rate .r1").click();
  await page.waitForTimeout(120);
  await page.keyboard.press(" ");
  await page.waitForTimeout(120);
  check("space reveals the answer", (await page.locator(".answer").count()) === 1);
  await page.keyboard.press("3");
  await page.waitForTimeout(120);
  check("number keys rate the card", (await page.locator(".answer").count()) === 0);

  const again = await page.evaluate(() => {
    const cards = window.Recall.state().cards.filter((c) => c.lapses > 0);
    return cards.length;
  });
  check("a card you could not recall is recorded as a lapse", again === 1, String(again));

  await page.getByRole("button", { name: "Stop" }).click();
  await page.waitForTimeout(150);
  check("stopping returns to today", await page.locator(".due-figure").isVisible());
  await context.close();
  check("no errors while studying", errors.length === 0, errors.slice(0, 2).join(" | "));
}

// -------------------------------------------------------- make, and persist

console.log("making your own");
{
  const { page, context, errors } = await open();
  await page.locator(".tab").nth(1).click();
  await page.waitForSelector("textarea");
  await page.getByRole("button", { name: /example/ }).click();
  await page.waitForTimeout(200);
  const previewed = await page.locator(".preview-card").count();
  check("the example produces cards to look at", previewed >= 4, String(previewed));

  await page.locator(".preview-card").first().click();
  await page.waitForTimeout(100);
  check("a card can be deselected before it is kept",
    (await page.locator(".preview-card.off").count()) === 1);

  await page.locator('input[placeholder="Deck name"]').fill("Test deck");
  await page.getByRole("button", { name: "Add to my decks" }).click();
  await page.waitForTimeout(200);
  check("saving lands in the new deck",
    (await page.locator("h1").textContent()) === "Test deck");
  check("only the ticked cards were kept",
    (await page.locator(".deck-row").count()) === previewed - 1);

  await page.reload();
  await page.waitForSelector("#app .wrap");
  const kept = await page.evaluate(() => window.Recall.state().cards.length);
  check("everything survives a reload", kept === previewed - 1, String(kept));

  await page.locator(".tab").nth(3).click();
  await page.waitForTimeout(200);
  check("progress says nothing until something has been recalled",
    await page.getByText("Nothing measured yet").isVisible());
  check("and points at the cards waiting",
    (await page.locator(".empty p").textContent()).indexOf("waiting") !== -1);
  await context.close();
  check("no errors while making cards", errors.length === 0, errors.slice(0, 2).join(" | "));
}

// ------------------------------------------------------------ how it looks

console.log("how it looks");
{
  for (const [label, size] of [
    ["iPhone", { width: 390, height: 844 }],
    ["iPad portrait", { width: 820, height: 1180 }],
    ["iPad landscape", { width: 1180, height: 820 }],
    ["desktop", { width: 1440, height: 900 }]
  ]) {
    const { page, context } = await open(size);
    await page.evaluate(() => { window.Recall.installStarter(window.Recall.starters[0]); });
    await page.waitForTimeout(200);
    await page.locator(".tab").first().click();
    await page.waitForTimeout(150);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${label}: no sideways scrolling`, overflow <= 1, `${overflow}px`);

    const small = await page.evaluate(() => {
      const bad = [];
      const nodes = document.querySelectorAll("button");
      for (let i = 0; i < nodes.length; i += 1) {
        const r = nodes[i].getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 43 || r.width < 43) bad.push(nodes[i].className + " " + Math.round(r.height));
      }
      return bad;
    });
    check(`${label}: every control is at least 44px`, small.length === 0, small.slice(0, 3).join(", "));

    const stray = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent.trim();
        if (t === "null" || t === "undefined" || t === "NaN" || t === "[object Object]") return t;
      }
      return null;
    });
    check(`${label}: no placeholder text leaked onto the page`, stray === null, String(stray));

    await page.screenshot({ path: resolve(root, `dist/shot-${label.replace(/\s/g, "-")}.png`) });
    await context.close();
  }

  const { page, context } = await open({ width: 430, height: 932 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(150);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("dark mode is a real palette, not an inversion", bg === "rgb(19, 19, 20)", bg);
  await page.evaluate(() => { window.Recall.installStarter(window.Recall.starters[1]); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(root, "dist/shot-dark.png") });
  await context.close();
}

await browser.close();
server.close();
console.log(failures.length
  ? `\n${failures.length} of ${checks} failing: ${failures.join(", ")}`
  : `\nall ${checks} checks passed`);
process.exit(failures.length ? 1 : 0);
