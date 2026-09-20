/**
 * Finding a thing by a phrase from inside it.
 *
 * The leading assistants search conversation titles. That is fine when the
 * store holds one kind of thing and poor here, because the way anybody
 * actually looks for something is by a line they remember reading — not by a
 * heading they never chose. The claim is that the palette now looks inside
 * the messages and the cards, and that every row it returns contains the
 * words that were typed. A result that does not reads as a bug, every time.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

/* Something to find: a phrase that exists only in a message body, and never
   in any title — which is exactly the case title search cannot answer. */
const PHRASE = "quokka telemetry";
await p.getByRole("textbox", { name: "Message" }).fill(`Explain ${PHRASE} to me`);
await p.keyboard.press("Meta+Enter");
await p.waitForTimeout(4500);

/* And a deck, so there are cards to look inside. */
await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
await p.waitForTimeout(600);
await p.getByRole("textbox", { name: /What to study/ }).fill("debouncing");
await p.keyboard.press("Enter");
await p.waitForTimeout(6500);

const open = async (q) => {
  /* ⌘K toggles. When the palette is still open from the last section, an
     Escape only clears its query, and the toggle then *closes* it — so the
     fill waits on a dialog that has just gone. Open it only when it is shut. */
  if (!(await p.getByRole("dialog").isVisible().catch(() => false))) {
    await p.keyboard.press("Meta+k");
    await p.waitForTimeout(400);
  }
  /* The palette's own box, by its label. A /Search/ placeholder regex also
     matches the sidebar's "Search conversations" and `.first()` picked that,
     so every query went into a box the palette never reads. */
  await p.getByRole("dialog").getByLabel("Command palette").fill(q);
  await p.waitForTimeout(700);
};

console.log("\nA phrase from inside a conversation finds the conversation");
{
  await open(PHRASE);
  const list = await p.getByRole("dialog").innerText();
  check(/In conversations/.test(list), "the group is there", list.replace(/\s+/g, " ").slice(0, 80));
  const row = p.getByRole("option").filter({ hasText: new RegExp(PHRASE, "i") }).first();
  check(await row.isVisible().catch(() => false), "and a row for it");
  const text = await row.innerText().catch(() => "");
  check(new RegExp(PHRASE, "i").test(text),
    "whose line contains what was typed — a result that does not reads as a bug",
    text.replace(/\s+/g, " ").slice(0, 80));
  const marked = await row.locator("mark").innerText().catch(() => "");
  check(marked.toLowerCase() === PHRASE.toLowerCase(), "with the match itself marked", JSON.stringify(marked));
}

console.log("\nAnd it opens the thing, not merely names it");
{
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1200);
  const room = await p.locator("main").innerText();
  check(new RegExp(PHRASE, "i").test(room), "pressing it lands in the conversation",
    room.replace(/\s+/g, " ").slice(0, 70));
}

console.log("\nA phrase from inside a card finds the card");
{
  await open("continuous burst");
  const list = await p.getByRole("dialog").innerText();
  check(/In cards/.test(list), "the cards are searched too", list.replace(/\s+/g, " ").slice(0, 90));
  const row = p.getByRole("option").filter({ hasText: /continuous burst/i }).first();
  const text = await row.innerText().catch(() => "");
  check(/continuous burst/i.test(text), "and the row shows the side it matched on",
    text.replace(/\s+/g, " ").slice(0, 80));
  check(/debouncing/i.test(text), "labelled by the deck it is in", text.replace(/\s+/g, " ").slice(0, 60));
}

console.log("\nOne row per conversation, however many times it is mentioned");
{
  await open("debounce");
  const rows = await p.getByRole("option").allInnerTexts();
  /* Only the rows that are *this thread*: the cards group labels every row
     with its deck's name, so counting everything that says "debounce" counts
     five cards as five duplicate conversations. */
  const thread = rows.filter((r) => /^Debouncing a search input/.test(r));
  check(thread.length >= 1, "the thread is found");
  /* Twelve hits in one thread is one thing to open. Twelve rows of it is a
     group that drowns out every other room. At most two rows may carry the
     title: its own entry under Chats, and one under In conversations. */
  check(thread.length <= 2, "a thread mentioned many times is still one row, not many",
    `${thread.length} row(s) carry the title`);
}

console.log("\nAnd a single letter is not a search");
{
  await open("q");
  const list = await p.getByRole("dialog").innerText();
  check(!/In conversations|In cards/.test(list),
    "one letter is in every document, so it ranks by nothing and is refused",
    list.replace(/\s+/g, " ").slice(0, 60));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
