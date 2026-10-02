/**
 * The modes: chosen in the box's menu, shown by the model, a press from off.
 *
 * The claims: choosing Slides from the + menu puts a "Slides" chip in the
 * bar beside the model, pressed, with no slash in the box; the box says
 * what it is for; the message sent is a request for a deck and the chip
 * goes with it; Learn and Research show there too and the chip turns each
 * off; a picture likewise; and Compare is no longer in the menu at all.
 *
 *   bash /tmp/claude-0/one.sh e2e-modes
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });
const bar = () => p.locator("header");
const pick = async (name) => {
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.locator("[data-radix-popper-content-wrapper]").last().waitFor({ timeout: 3000 });
  await p.waitForTimeout(150);
  await p.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name }).click();
  await p.waitForTimeout(300);
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nSlides: a press in the menu, a chip by the model, no slash");
{
  await pick(/^Slides/);
  const chip = bar().getByRole("button", { name: "Stop slides" });
  check(await chip.isVisible(), "a Slides chip appears in the bar beside the model");
  check((await chip.getAttribute("aria-pressed")) === "true", "pressed, so it reads as on");
  check(/Slides/.test(await chip.innerText()), "and says its name");
  check((await box().inputValue()) === "", "nothing was typed into the box for it", JSON.stringify(await box().inputValue()));
  check(!(await box().getAttribute("placeholder")), "and the box carries no prompt text — the chip says it");
  const chipX = await chip.boundingBox();
  const model = await bar().getByRole("button", { name: /^Model:/ }).boundingBox();
  check(chipX && model && Math.abs(chipX.y - model.y) < 12 && chipX.x > model.x, "it sits on the model's row, to its right", chipX && model ? `model x ${Math.round(model.x)} · chip x ${Math.round(chipX.x)}` : "");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(250);
  const menu = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  check(/Stop slides/.test(menu), "the menu shows it on");
  check(!/Compare two models/.test(menu), "and Compare is not in the menu any more");
  await p.keyboard.press("Escape");
  await fetch(`${MOCK}/__reset`);
  await box().fill("the water cycle");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const main = await p.locator("main").innerText();
  check(/Make a slide deck on: the water cycle/.test(main), "the message went as a request for a deck", (main.match(/Make a slide deck[^\n]*/) ?? [""])[0]);
  check(await bar().getByRole("button", { name: "Stop slides" }).isVisible(), "and the chip stays on for the chat, the way Learn does");
  const conv = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("conversations").objectStore("conversations").getAll(); t.onsuccess = () => res(t.result); }; }));
  check(conv.some((c) => c.make === "slides"), "kept on the conversation, so it is still on after a reload");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  check(await bar().getByRole("button", { name: "Stop slides" }).isVisible(), "and it is");
  await fetch(`${MOCK}/__reset`);
  await box().fill("add a slide on evaporation");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const main2 = await p.locator("main").innerText();
  const deckMade = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("conversations").objectStore("conversations").getAll(); t.onsuccess = () => res(t.result.some((c) => c.madeId)); }; }));
  check(deckMade ? /Change the slide deck[^\n]*add a slide on evaporation/.test(main2) : /Make a slide deck on: add a slide on evaporation/.test(main2), "the next message goes to the deck too — a change to it once one is made", (main2.match(/(Change the slide deck|Make a slide deck)[^\n]*/) ?? [""])[0].slice(0, 90));
  await bar().getByRole("button", { name: "Stop slides" }).click();
  await p.waitForTimeout(300);
  check((await bar().getByRole("button", { name: "Stop slides" }).count()) === 0, "pressing the chip turns it off");
}

console.log("\nLearn and Research: on in the bar, off with a press");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await pick(/^Study and learn/);
  const learn = bar().getByRole("button", { name: "Stop learning mode" });
  check(await learn.isVisible(), "Learn shows as a chip by the model");
  await pick(/^Web search/);
  const research = bar().getByRole("button", { name: "Stop searching the web" });
  check(await research.isVisible(), "so does Research, beside it");
  check((await bar().getByRole("group", { name: "On for this chat" }).getByRole("button").count()) === 2, "two chips, in one row");
  await research.click();
  await p.waitForTimeout(300);
  check((await bar().getByRole("button", { name: "Stop searching the web" }).count()) === 0, "pressing Research turns it off");
  check(await learn.isVisible(), "and Learn stays");
  await learn.click();
  await p.waitForTimeout(300);
  check((await bar().getByRole("group", { name: "On for this chat" }).count()) === 0, "pressing Learn clears the row");
  await pick(/^Deep research/);
  check(await bar().getByRole("button", { name: "Stop deep research" }).isVisible(), "Deep research shows as its own chip");
  check((await bar().getByRole("button", { name: "Stop searching the web" }).count()) === 0, "and not a second one for the web it implies");
  await bar().getByRole("button", { name: "Stop deep research" }).click();
  await p.waitForTimeout(300);
  check(await bar().getByRole("button", { name: "Stop searching the web" }).isVisible(), "off, the web it switched on is still on, and said");
  await bar().getByRole("button", { name: "Stop searching the web" }).click();
}

console.log("\nDocument and Spreadsheet: the two other engines, as modes beside Slides");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await pick(/^Document/);
  const chip = bar().getByRole("button", { name: "Stop making documents" });
  check(await chip.isVisible(), "Document shows as a chip by the model");
  check((await box().inputValue()) === "", "with nothing typed into the box for it");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(250);
  const menu = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  check(/Stop making documents/.test(menu) && /Spreadsheet/.test(menu), "the menu shows it on, with Spreadsheet beside it", menu.replace(/\s+/g, " ").slice(0, 120));
  await p.keyboard.press("Escape");
  await fetch(`${MOCK}/__reset`);
  await box().fill("a fractions worksheet for year 7");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const main = await p.locator("main").innerText();
  check(/Make a document, as a PDF, on: a fractions worksheet for year 7/.test(main), "the message went as a request for a document", (main.match(/Make a document[^\n]*/) ?? [""])[0]);
  check(/Made a worksheet: “Fractions practice”/.test(main), "and the document engine made one, kept in the Library", (main.match(/Made a [^\n]*/) ?? [""])[0]);
  const conv = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction("conversations").objectStore("conversations").getAll(); t.onsuccess = () => res(t.result); }; }));
  check(conv.some((c) => c.make === "document"), "kept on the conversation");
  await fetch(`${MOCK}/__reset`);
  await box().fill("add a part C on decimals");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const again = await p.locator("main").innerText();
  check(/Make the document again, as a PDF, whole, with this change: add a part C on decimals/.test(again), "the next message is a change to it, asked for whole", (again.match(/Make the document again[^\n]*/) ?? [""])[0]);
  await chip.click();
  await p.waitForTimeout(300);
  check((await bar().getByRole("button", { name: "Stop making documents" }).count()) === 0, "pressing the chip turns it off");

  /* The blank page's fourth row is the same switch. */
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Make a document to print" }).click();
  await p.waitForTimeout(300);
  check(await bar().getByRole("button", { name: "Stop making documents" }).isVisible(), "“Make a document to print” on the blank page switches Document on");
  check(await box().evaluate((el) => document.activeElement === el), "and puts the caret in the box");
  await bar().getByRole("button", { name: "Stop making documents" }).click();
  await p.waitForTimeout(300);

  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await pick(/^Spreadsheet/);
  check(await bar().getByRole("button", { name: "Stop making spreadsheets" }).isVisible(), "Spreadsheet shows as a chip too");
  await fetch(`${MOCK}/__reset`);
  await box().fill("a budget for the trip");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const main2 = await p.locator("main").innerText();
  check(/Make a spreadsheet on: a budget for the trip/.test(main2), "the message went as a request for a spreadsheet", (main2.match(/Make a spreadsheet[^\n]*/) ?? [""])[0]);
  check(/Made a spreadsheet: /.test(main2), "and the spreadsheet engine made one", (main2.match(/Made a [^\n]*/) ?? [""])[0]);
  await bar().getByRole("button", { name: "Stop making spreadsheets" }).click();
  await p.waitForTimeout(300);

  /* The same two by their commands, for a hand that types. */
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  await box().fill("/pdf a letter to the landlord");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const main3 = await p.locator("main").innerText();
  check(/Make a document, as a PDF, on: a letter to the landlord/.test(main3), "/pdf asks the document engine", (main3.match(/Make a document[^\n]*/) ?? [""])[0]);
  check((await bar().getByRole("button", { name: "Stop making documents" }).count()) === 0, "without switching the mode on");
}

console.log("\nA picture: the same, and a press again in the menu cancels");
{
  await pick(/^Create image/);
  const chip = bar().getByRole("button", { name: "Stop making a picture" });
  check(await chip.isVisible(), "Picture shows as a chip");
  check(!(await box().getAttribute("placeholder")), "the box carries no prompt text");
  check((await box().inputValue()) === "", "with no slash typed for it");
  await pick(/^Stop making a picture/);
  check((await chip.count()) === 0, "choosing it again in the menu takes the chip away");
}

console.log("\nOn a phone the chips do not push the menu off the bar");
{
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await phone.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, sidebarOpen: false }, version: 1 })), S);
  await phone.reload({ waitUntil: "networkidle" });
  await phone.waitForTimeout(800);
  await phone.getByRole("button", { name: "Add files and tools" }).click();
  await phone.waitForTimeout(300);
  await phone.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name: /^Study and learn/ }).click();
  await phone.waitForTimeout(300);
  await phone.getByRole("button", { name: "Add files and tools" }).click();
  await phone.waitForTimeout(300);
  check(/Take a photo/.test(await phone.locator("[data-radix-popper-content-wrapper]").last().innerText()), "the camera is in the phone's menu, where it is a camera");
  await phone.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name: /^Slides/ }).click();
  await phone.waitForTimeout(300);
  const wide = await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(wide, "the page does not scroll sideways");
  const chips = phone.locator("header").getByRole("group", { name: "On for this chat" });
  check(await chips.isVisible(), "the chips are there");
  const model = await phone.locator("header").getByRole("button", { name: /^Model:/ }).boundingBox();
  check(model && model.x >= 0 && model.width > 40, "and the model button is still whole", model ? `${Math.round(model.width)}px` : "");
  await phone.close();
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
