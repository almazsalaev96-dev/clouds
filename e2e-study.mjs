/**
 * The room where you are asked again.
 *
 * Every assistant will write you flashcards in twenty seconds. None of them
 * will ask you for them next Tuesday, because a conversation has nowhere to
 * keep the one you got wrong — the cards scroll away and that is the end of
 * them. This app has a database, so this is the one room here that a chat
 * window structurally cannot be.
 *
 * Driven the way somebody uses it: name a subject, get a deck, answer the
 * cards, and watch the ones you got wrong come back while the ones you knew
 * go away for days.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-study.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const cards = () => p.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => {
    const q = r.result.transaction("cards").objectStore("cards").getAll();
    q.onsuccess = () => { r.result.close(); ok(q.result); };
  };
}));

console.log("\nA subject becomes a deck");
{
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  /* Waited for rather than slept at: the room is its own chunk and arrives
     when it arrives. */
  await p.getByText("Nothing to study yet.").waitFor({ timeout: 10_000 }).catch(() => {});
  check(await p.getByText("Nothing to study yet.").isVisible(), "the empty room says what it is for");
  await p.getByRole("textbox", { name: "What to study" }).fill("debouncing and throttling");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const made = await cards();
  check(made.length === 4, "the cards are written and kept", `${made.length} cards`);
  check(made.every((c) => c.state === "new" && c.due <= Date.now()),
    "and every one of them is waiting now — a deck you cannot study today is one you will not come back for");
  const row = p.getByRole("list", { name: "Study" }).locator("li").first();
  check(/debouncing and throttling/i.test(await row.innerText()), "the deck is named after the subject");
  check(/4 due/.test(await row.innerText()), "and says how many are waiting", (await row.innerText()).replace(/\n/g, " · "));
}

console.log("\nBeing asked");
{
  /* Everything waiting, across every deck, which is what somebody sitting
     down for ten minutes actually presses. */
  await p.getByRole("button", { name: /^Start$/ }).click();
  await p.waitForTimeout(500);
  const front = await p.locator("main p").first().innerText();
  check(/\?$/.test(front.trim()), "a question, on its own", front.slice(0, 50));
  check(!(await p.locator("main").innerText()).includes("Silence —"),
    "and the answer is not on screen — a card you read the answer to is not a card you were tested on");
  await p.keyboard.press(" ");
  await p.waitForTimeout(300);
  const buttons = p.getByRole("group", { name: "How did it go" });
  check(await buttons.count() === 1, "space shows it, and with it the four ways it went");
  check(/in 1 minute/.test(await buttons.innerText()), "each saying when the card would come back", (await buttons.innerText()).replace(/\n/g, " "));
}

console.log("\nWhat you knew goes away, what you did not comes back");
{
  await p.keyboard.press("4");      // easy
  await p.waitForTimeout(400);
  await p.keyboard.press(" ");
  await p.waitForTimeout(250);
  await p.keyboard.press("1");      // again
  await p.waitForTimeout(400);
  const after = await cards();
  const easy = after.filter((c) => c.state === "review");
  const again = after.filter((c) => c.state === "learning");
  check(easy.length === 1 && easy[0].interval === 4, "the one you knew is gone for four days", `${easy[0]?.interval}d`);
  check(again.length === 1 && again[0].due - Date.now() < 90_000, "the one you did not is back within the minute");
  check(again[0].reps === 1, "and it remembers having been asked");
}

console.log("\nAnd the session ends when nothing is left");
{
  await p.keyboard.press(" ");
  await p.waitForTimeout(250);
  await p.keyboard.press("3");
  await p.waitForTimeout(400);
  await p.keyboard.press(" ");
  await p.waitForTimeout(250);
  await p.keyboard.press("3");
  await p.waitForTimeout(600);
  const screen = await p.locator("main").innerText();
  check(/Nothing left for now/.test(screen), "it says so plainly", screen.split("\n")[0]);
  check(/come back within the hour/.test(screen), "and what happens to the ones you found hard");
  await p.getByRole("button", { name: "Back to Study" }).click();
  await p.waitForTimeout(500);
}

console.log("\nAn answer in a chat can become a deck too");
{
  await p.locator("aside nav").getByRole("button", { name: "Conversations" }).first().click();
  await p.waitForTimeout(500);
  await p.locator(".composer-shell textarea").first().fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3200);
  const before = (await cards()).length;
  await p.locator(".msg").last().getByRole("button", { name: /^More$|options|⋯/ }).first().click().catch(async () => {
    await p.locator(".msg").last().locator("button").last().click();
  });
  await p.waitForTimeout(400);
  const item = p.getByRole("menuitem", { name: /Make cards from this/ });
  check(await item.count() === 1, "the answer offers it");
  await item.click();
  await p.waitForTimeout(4500);
  const after = (await cards()).length;
  check(after > before, "and pressing it makes a deck from the answer", `${before} → ${after} cards`);
  check(/Study/.test(await p.locator("aside nav").innerText()), "which lands you in the room where it is kept");
  check((await p.getByRole("list", { name: "Study" }).locator("li").count()) === 2, "as a second deck, named after the conversation");
}

console.log("\nA deck can be looked at, and fixed");
{
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Open debouncing/ }).click();
  await p.waitForTimeout(500);
  const list = p.getByRole("list", { name: "Cards" });
  check(await list.locator("li").count() === 4, "every card in the deck is there to read", `${await list.locator("li").count()} cards`);
  check(/in 4 days|new|in \d+ minutes?/.test(await list.innerText()), "each saying when it is next due");

  /* The model wrote these and some of them are wrong. A deck you cannot
     correct is one you stop trusting after the third bad card. */
  await list.getByRole("button", { name: /^Edit/ }).first().click();
  await p.waitForTimeout(300);
  const front = p.getByRole("textbox", { name: "Question" });
  check(await front.count() === 1, "a card can be opened and corrected");
  await front.fill("What does a debounce actually wait for?");
  await p.getByRole("button", { name: "Save" }).click();
  await p.waitForTimeout(400);
  check(/actually wait for/.test(await list.innerText()), "and the correction sticks");

  const before = await cards();
  await list.getByRole("button", { name: /^Delete/ }).first().click();
  await p.waitForTimeout(400);
  check((await cards()).length === before.length - 1, "a bad card can be thrown away", `${before.length} → ${(await cards()).length}`);
  await p.getByRole("button", { name: "Undo" }).click().catch(() => {});
  await p.waitForTimeout(400);
  check((await cards()).length === before.length, "and thrown away by mistake is recoverable");
}

console.log("\nAnd a card you got wrong can be explained");
{
  await p.getByRole("button", { name: "Back to Study" }).first().click();
  await p.waitForTimeout(600);
  /* The deck made from the chat still has everything waiting. */
  await p.getByRole("button", { name: /^Start$/ }).click();
  await p.waitForTimeout(700);
  await p.keyboard.press(" ");
  await p.waitForTimeout(400);
  const explain = p.getByRole("button", { name: "Explain this" });
  check(await explain.count() === 1, "the session offers to explain the card you are looking at");
  await explain.click();
  await p.waitForTimeout(4000);
  const asked = await p.locator(".msg").first().innerText();
  check(/I am studying/.test(asked), "it opens a chat with the card in it", asked.replace(/\n/g, " ").slice(0, 60));
  check(await p.locator(".msg").count() >= 2, "and the answer arrives there", `${await p.locator(".msg").count()} messages`);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
