/**
 * A notebook that is a shape rather than a pile.
 *
 * Pages that name each other, and know who names them; somewhere to stand
 * on a long page; a passage that becomes a question or a card in one press;
 * a shape to start in. None of it asks a model anything, which is the
 * point: these are the things a notebook does for you between the times
 * you ask.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-notebook.mjs
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const rows = (table) => p.evaluate((t) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => {
    const q = r.result.transaction(t).objectStore(t).getAll();
    q.onsuccess = () => { r.result.close(); ok(q.result); };
  };
}), table);

const room = async () => {
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).first().click();
  await p.waitForTimeout(600);
};
const write = async (text) => {
  const box = p.getByRole("textbox", { name: "Page content" });
  await box.fill(text);
  await p.waitForTimeout(900);   // autosave
};
const newPage = async () => {
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(500);
};

console.log("\nA shape to start in");
{
  await room();
  await newPage();
  const shapes = p.getByRole("group", { name: "Start from a shape" });
  check(await shapes.isVisible(), "an empty page offers three shapes to start in");
  await shapes.getByRole("button", { name: "Cornell notes" }).click();
  await p.waitForTimeout(700);
  const text = await p.getByRole("textbox", { name: "Page content" }).inputValue();
  check(/## Cues[\s\S]*## Notes[\s\S]*## Summary/.test(text), "and pressing one lays the page out", text.split("\n").filter((l) => l.startsWith("##")).join(" · "));
  check(!(await shapes.isVisible().catch(() => false)), "then gets out of the way — a shape offered on a page with words on it is an invitation to lose them");
}

console.log("\nPages that name each other");
{
  await write("# Krebs cycle\n\nFeeds the [[Electron transport chain]] with NADH. It happens in the mitochondrial matrix.\n\nCompare [[Glycolysis]], which happens in the cytoplasm.");
  await p.getByRole("button", { name: /^All pages/ }).click();
  await p.waitForTimeout(500);
  await newPage();
  await write("# Electron transport chain\n\nTakes what the [[Krebs cycle]] hands it and makes most of the ATP.");
  await p.getByRole("button", { name: "Preview" }).click();
  await p.waitForTimeout(500);
  const link = p.locator("a[href^='#armi-note-']").first();
  check(await link.isVisible(), "a title in double brackets is drawn as a link to that page", await link.innerText());
  await link.click();
  await p.waitForTimeout(700);
  check((await p.getByRole("textbox", { name: "Page content" }).inputValue()).startsWith("# Krebs cycle"), "and pressing it opens the page it names");
  await p.getByRole("button", { name: "Preview" }).click();
  await p.waitForTimeout(500);
  const from = p.getByLabel("Linked from");
  check(await from.isVisible() && /Electron transport chain/.test(await from.innerText()),
    "which lists, at its foot, every page that names it", (await from.innerText()).replace(/\n/g, " "));
  await p.screenshot({ path: `${OUT}/notebook-links.png` });
}

console.log("\nA page that does not exist yet");
{
  const fresh = p.locator("a[href^='#armi-new-']").first();
  check(await fresh.isVisible() && (await fresh.innerText()) === "Glycolysis", "a link to a page nobody has written is still a link");
  const before = (await rows("notes")).length;
  await fresh.click();
  await p.waitForTimeout(800);
  const notes = await rows("notes");
  check(notes.length === before + 1 && notes.some((n) => n.title === "Glycolysis"),
    "and pressing it makes the page, named as the link named it — a link is never broken, it is a page or the start of one",
    `${notes.length} pages`);
  check((await p.getByRole("textbox", { name: "Page content" }).inputValue()).startsWith("# Glycolysis"), "and opens it");
}

console.log("\nSomewhere to stand on a long page");
{
  await write("# Cell respiration\n\n" + ["Glycolysis", "Link reaction", "Krebs cycle", "Electron transport chain", "Chemiosmosis"].map((h, i) => `## ${h}\n\n${"Some prose about it. ".repeat(12)}\n\n### Detail ${i}\n\nMore.`).join("\n\n"));
  const nav = p.getByRole("navigation", { name: "On this page" });
  check(await nav.isVisible(), "a page with headings gets an outline of them");
  check((await nav.getByRole("button").count()) === 11, "every heading, at its depth", String(await nav.getByRole("button").count()));
  await p.getByRole("button", { name: "Preview" }).click();
  await p.waitForTimeout(500);
  /* From the bottom, to a heading in the middle: the last heading on a page
     can never reach the top — there is not enough page under it — so it is
     the wrong one to prove a scroll with. */
  const scroller = p.locator(".paper-scroll");
  await scroller.evaluate((n) => { n.scrollTop = n.scrollHeight; });
  await p.waitForTimeout(200);
  const was = await scroller.evaluate((n) => n.scrollTop);
  await nav.getByRole("button", { name: "Link reaction" }).click();
  await p.waitForTimeout(900);
  const now = await scroller.evaluate((n) => n.scrollTop);
  const y = await p.locator("h2").filter({ hasText: "Link reaction" }).evaluate((n) => n.getBoundingClientRect().top);
  check(now !== was && y < 320, "and pressing one scrolls the page to it", `${Math.round(y)}px from the top, scrolled ${Math.round(was)} → ${Math.round(now)}`);
  const bar = await p.locator("header, [class*='DetailBar'], .glass").first().innerText().catch(() => "");
  check(/min read/.test(await p.locator("main").innerText()), "with how long it takes to read, said the way people say it");
}

console.log("\nWords you point at");
{
  /* Draw a line under a phrase in the preview and the offer appears over
     it: ask about it, or make it a card. The card is the sentence with the
     phrase taken out, and it asks nothing of a model. */
  const para = p.locator("p").filter({ hasText: "Some prose about it" }).first();
  await para.evaluate((n) => {
    const range = document.createRange();
    const text = n.firstChild;
    range.setStart(text, 5);
    range.setEnd(text, 10);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await p.mouse.move(600, 500);
  await p.mouse.up();
  await p.waitForTimeout(400);
  const bar = p.getByRole("toolbar", { name: "Do something with the selection" });
  check(await bar.isVisible(), "choosing words in the preview offers something to do with them");
  const before = (await rows("cards")).length;
  await bar.getByRole("button", { name: "Card" }).click();
  await p.waitForTimeout(800);
  const cards = await rows("cards");
  check(cards.length === before + 1, "one press makes a card from the sentence", `${cards.length} cards`);
  const made = cards[cards.length - 1];
  check(/\{\{prose\}\}/.test(made.front) && made.back === "prose", "with the words you chose as the hole in it", made.front);
  check(/Card made/.test(await p.locator("main").innerText()), "and says so");
  await p.screenshot({ path: `${OUT}/notebook-select.png` });
}

console.log("\nTags, wherever they were written");
{
  await p.getByRole("button", { name: /^All pages/ }).click();
  await p.waitForTimeout(500);
  await newPage();
  await write("# Exam plan\n\nRevise #biology first, then #chemistry. #biology again for the practical.");
  await p.getByRole("button", { name: /^All pages/ }).click();
  await p.waitForTimeout(500);
  await newPage();
  await write("# Chem notes\n\nMoles and #chemistry.");
  await p.getByRole("button", { name: /^All pages/ }).click();
  await p.waitForTimeout(600);
  const tags = p.getByRole("group", { name: "Tags" });
  check(await tags.isVisible(), "a hash-word on a page is a tag on the index");
  check(/#chemistry\s*2/.test((await tags.innerText()).replace(/\n/g, " ")) && /#biology\s*1/.test((await tags.innerText()).replace(/\n/g, " ")),
    "counted across pages, once a page", (await tags.innerText()).replace(/\n/g, " "));
  const all = await p.getByRole("list", { name: "Notebook" }).locator("li").count();
  await tags.getByRole("button", { name: /#chemistry/ }).click();
  await p.waitForTimeout(300);
  const some = await p.getByRole("list", { name: "Notebook" }).locator("li").count();
  check(some === 2 && some < all, "and pressing one narrows the list to the pages that carry it", `${all} → ${some}`);
  await tags.getByRole("button", { name: /#chemistry/ }).click();
  await p.waitForTimeout(200);
}

console.log("\nA question put to every page at once");
{
  /* The mock answers a grounded ask with two real quotations and one it
     made up; the interesting assertion is what happens to the third. */
  await p.getByRole("textbox", { name: "Ask your notebook" }).fill("what feeds the electron transport chain");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const box = p.getByLabel("The answer");
  check(await box.isVisible(), "an answer arrives on the index, not in a chat");
  check((await box.locator("a[href^='#armi-cite-']").count()) >= 2, "with each claim quoting the page it came from", `${await box.locator("a[href^='#armi-cite-']").count()} citations`);
  check(/could not be found/.test(await p.locator("main").innerText()), "and the one the model made up is called out, not passed off");
  const from = box.locator("button").filter({ hasText: /Krebs|Electron|Glycolysis|Cell/ });
  check((await from.count()) >= 1, "naming the pages it drew on, each a press away", await from.first().innerText());
  await box.locator("a[href^='#armi-cite-']").first().click();
  await p.waitForTimeout(400);
  check(await p.getByRole("button", { name: "Close the source" }).isVisible(), "pressing a citation opens the page at the quoted words");
  await p.getByRole("button", { name: "Close the source" }).click();
  await p.waitForTimeout(200);
  const before = (await rows("notes")).length;
  await p.getByRole("button", { name: "Keep as a page" }).click();
  await p.waitForTimeout(700);
  check((await rows("notes")).length === before + 1, "and an answer worth having becomes a page, citations and all");
  await p.screenshot({ path: `${OUT}/notebook-ask.png` });
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
