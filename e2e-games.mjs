/**
 * Games from a deck: Match, Quick-fire and Gravity.
 *
 * The claims, on the screen and in the database: a deck offers three games;
 * Match is a table of terms and answers joined in pairs against a clock
 * that starts on the first tap, a wrong pair costs a second, and the time
 * is kept as the deck's best; Quick-fire asks with four answers, takes the
 * number keys, and pays a combo for three in a row; in Gravity a question
 * falls, a typed answer clears it, one that lands costs a life and has to
 * be typed out to go on, and with less motion asked for it does not move;
 * every game ends on a result with points, a level, and the cards it
 * missed offered as a study session; the points show on the Study page
 * and the day counts toward the streak; and it fits a phone.
 *
 *   bash /tmp/claude-0/one.sh e2e-games
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, section: "chat" };
const CARDS = {
  Osmosis: "Water moving across a membrane",
  Diffusion: "Particles spreading out",
  Enzyme: "A biological catalyst",
  Mitochondria: "Where respiration happens",
  Ribosome: "Where proteins are made",
  Nucleus: "Holds the DNA",
  Chloroplast: "Where photosynthesis happens",
  Vacuole: "Stores cell sap",
};
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);
const settings = () => p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state);
const today = () => p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async ({ S, CARDS }) => {
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: S, version: 1 }));
  const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
  const now = Date.now(), DAY = 86_400_000;
  const tx = db.transaction(["decks", "cards"], "readwrite");
  tx.objectStore("decks").put({ id: "g1", name: "Cell biology", createdAt: now - 3 * DAY, updatedAt: now - DAY });
  Object.entries(CARDS).forEach(([front, back], i) => tx.objectStore("cards").put({ id: `g1-${i}`, deckId: "g1", front, back, state: "review", due: now + 3 * DAY, interval: 4, ease: 2.5, reps: 3, lapses: 0, step: 0, createdAt: now - 3 * DAY, stability: 4, difficulty: 5 }));
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}, { S, CARDS });
await p.reload({ waitUntil: "networkidle" });
await p.keyboard.press("Meta+5");
await p.waitForTimeout(600);
await p.getByRole("button", { name: /^Cell biology/ }).first().click();
await p.waitForTimeout(400);

console.log("\nA deck offers three games");
{
  await p.getByRole("button", { name: "Play a game" }).click();
  const games = p.getByRole("region", { name: "Games" });
  check(await games.isVisible(), "the games are there");
  for (const g of ["Match", "Quick-fire", "Gravity"]) check(await games.getByRole("button", { name: `Play ${g}` }).isEnabled(), `${g} can be played`);
  check(await games.getByText("Not played yet").count() === 3, "none played yet");
  check(/Today 0 of 50 XP/.test(await games.innerText()), "today's goal is shown");
  const sound = games.getByRole("button", { name: "Sound" });
  check(await sound.getAttribute("aria-pressed") === "true", "sound is on to start");
  await sound.click();
  check(await sound.getAttribute("aria-pressed") === "false" && (await settings()).gameSound === false, "and can be turned off, and stays off");
  await sound.click();
}

console.log("\nMatch");
{
  await p.getByRole("button", { name: "Play Match" }).click();
  const table = p.getByRole("group", { name: "Tiles" });
  check(await table.getByRole("button").count() === 12, "six pairs, twelve tiles");
  check(await p.getByLabel("Time").innerText() === "0.0s", "the clock waits for the first tap");
  const on = [];
  for (const [q, a] of Object.entries(CARDS)) if (await table.getByRole("button", { name: q, exact: true }).count()) on.push([q, a]);
  /* One wrong pair first: a term against another term's answer. */
  await table.getByRole("button", { name: on[0][0], exact: true }).click();
  check(await table.getByRole("button", { name: on[0][0], exact: true }).getAttribute("aria-pressed") === "true", "a tapped tile is picked");
  await table.getByRole("button", { name: on[1][1], exact: true }).click();
  await p.waitForTimeout(120);
  check(await p.getByText("+1s").isVisible(), "a wrong pair adds a second");
  await p.waitForTimeout(500);
  check(await table.getByRole("button", { name: on[0][0], exact: true }).getAttribute("aria-pressed") === "false", "and lets go of both");
  for (const [q, a] of on) {
    await table.getByRole("button", { name: q, exact: true }).click();
    await table.getByRole("button", { name: a, exact: true }).click();
  }
  const result = p.getByRole("region", { name: "Game result" });
  check(await result.waitFor({ timeout: 3000 }).then(() => true, () => false), "the table cleared, a result");
  const txt = await result.innerText();
  check(/^\d+\.\ds/.test(txt.trim()) && /1 s added for wrong pairs/.test(txt), "the time, with the second added", txt.split("\n").filter(Boolean).slice(0, 2).join(" · "));
  check(/New best/.test(txt) && /\+\d+ XP/.test(txt), "a new best, and points");
  check(await result.getByRole("button", { name: "Study the 2 I missed" }).isVisible(), "the two cards confused are offered to study");
  const deck = (await rows("decks")).find((d) => d.id === "g1");
  check(typeof deck?.best?.match === "number" && deck.best.match > 1000, "the time is kept as the deck's best", String(deck?.best?.match));
}

console.log("\nQuick-fire");
{
  await p.getByRole("button", { name: "Other games" }).click();
  check(/Best \d+\.\ds/.test(await p.getByRole("region", { name: "Games" }).innerText()), "Match shows its best time");
  await p.getByRole("button", { name: "Play Match" }).click();
  const beat = p.getByLabel("Time to beat");
  check(await beat.isVisible() && /\d+\.\ds/.test(await beat.innerText()), "and the next Match shows the time to beat", await beat.innerText().catch(() => ""));
  await p.getByRole("button", { name: "Quit" }).click();
  await p.getByRole("button", { name: "Play Quick-fire" }).click();
  const game = p.getByRole("region", { name: "Quick-fire" });
  const answers = game.getByRole("group", { name: "Answers" });
  check(await answers.getByRole("button").count() === 4, "four answers");
  const right = async () => {
    const q = (await game.locator("p[aria-live]").innerText()).trim();
    return CARDS[q];
  };
  for (let i = 0; i < 3; i++) {
    await answers.getByRole("button", { name: await right(), exact: true }).click();
    await p.waitForTimeout(400);
  }
  check(await game.getByText("×2").isVisible(), "three in a row doubles the points");
  check(/^30 points/.test(await game.getByLabel("Score").innerText()), "10 a question until then", await game.getByLabel("Score").innerText());
  const labels = await answers.getByRole("button").allInnerTexts();
  const want = await right();
  const at = labels.findIndex((l) => l.includes(want));
  await p.keyboard.press(String(at + 1));
  await p.waitForTimeout(400);
  check(/^50 points/.test(await game.getByLabel("Score").innerText()), "the number keys answer, and the next is worth 20", await game.getByLabel("Score").innerText());
  const now = await answers.getByRole("button").allInnerTexts();
  const w = await right();
  const miss = now.map((l) => l.replace(/^\d\s*/, "").trim()).find((l) => l !== w);
  await answers.getByRole("button", { name: miss, exact: true }).click();
  await p.waitForTimeout(150);
  const shown = await answers.getByRole("button", { name: w, exact: true }).getAttribute("class");
  check(/--success/.test(shown ?? ""), "a wrong answer shows the right one");
  await p.waitForTimeout(1100);
  check(!(await game.getByText(/^×\d$/).count()), "and breaks the run");
  await game.getByRole("button", { name: "End the round" }).click();
  const result = p.getByRole("region", { name: "Game result" });
  const txt = await result.innerText();
  check(/50 points/.test(txt) && /4 of 5 right/.test(txt) && /longest run 4/.test(txt), "a result: points, right of asked, the longest run", txt.split("\n").filter(Boolean).slice(0, 2).join(" · "));
  check(await result.getByRole("button", { name: "Study the one I missed" }).isVisible(), "the one missed is offered");
}

console.log("\nGravity");
{
  await p.getByRole("button", { name: "Other games" }).click();
  await p.getByRole("button", { name: "Play Gravity" }).click();
  const game = p.getByRole("region", { name: "Gravity" });
  const rock = game.locator(".gravity-fall");
  check(await rock.evaluate((e) => getComputedStyle(e).animationName) === "gravity-fall", "the question falls");
  await p.emulateMedia({ reducedMotion: "reduce" });
  check(await rock.evaluate((e) => getComputedStyle(e).animationName) === "none", "with less motion asked for, it stays still");
  check(/\d+s/.test(await game.getByLabel("Seconds before it lands").innerText()), "and the seconds left say how long there is");
  await p.emulateMedia({ reducedMotion: "no-preference" });
  const ask = async () => (await rock.innerText()).trim();
  const box = game.getByRole("textbox", { name: "Your answer" });
  check(await box.evaluate((e) => e === document.activeElement), "the answer box has the caret");
  await box.fill(CARDS[await ask()].toLowerCase());
  await p.keyboard.press("Enter");
  await p.waitForTimeout(200);
  check(/10 points/.test(await game.getByLabel("Score").innerText()), "a typed answer clears it, near enough counts");
  const q2 = await ask();
  await game.getByRole("textbox", { name: "Your answer" }).fill("something else entirely");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(200);
  check((await ask()) === q2 && /10 points/.test(await game.getByLabel("Score").innerText()), "a wrong one does not, and it keeps falling");
  const hint = game.getByLabel("Hint");
  const first = CARDS[q2][0].toUpperCase();
  check(await hint.isVisible() && (await hint.innerText()).includes(`Starts with “${first}”`) && /half points/.test(await hint.innerText()), "a wrong try brings a hint, for half the points", await hint.innerText().catch(() => ""));
  await p.waitForTimeout(12_500);
  const status = game.getByRole("status");
  check(await status.isVisible() && (await status.innerText()).includes(CARDS[q2]), "it landed: the answer is shown", (await status.innerText().catch(() => "")).slice(0, 80));
  check(await game.getByLabel("2 lives left").isVisible(), "and a life is gone");
  await game.getByRole("textbox", { name: "Your answer" }).fill("no");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(150);
  check(await status.isVisible(), "it has to be typed out to go on");
  await game.getByRole("textbox", { name: "Your answer" }).fill(CARDS[q2]);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(200);
  check(await rock.count() === 1 && (await ask()) !== q2, "typed out, the next one falls");
  check(!(await game.getByLabel("Hint").count()), "without the last one's hint");
  await game.getByRole("button", { name: "End the game" }).click();
  const result = p.getByRole("region", { name: "Game result" });
  const txt = await result.innerText();
  check(/10 points/.test(txt) && /1 cleared · 1 missed/.test(txt), "a result", txt.split("\n").filter(Boolean).slice(0, 2).join(" · "));
  await result.getByRole("button", { name: "Study the one I missed" }).click();
  await p.waitForTimeout(600);
  check(!(await p.getByRole("region", { name: "Game result" }).count()) && await p.getByText(q2, { exact: true }).first().isVisible(), "and studying it opens a session of just that card");
}

console.log("\nPoints, a level, and the day");
{
  const all = await rows("studyDays");
  const t = await today();
  const row = all.find((d) => d.day === t);
  check(row && row.xp > 0 && row.answered >= 11, "the day has the answers and the points", JSON.stringify(row));
  await p.reload({ waitUntil: "networkidle" });
  await p.keyboard.press("Meta+5");
  await p.waitForTimeout(700);
  const level = p.getByLabel(/^Level \d+, \d+ points$/);
  check(await level.first().isVisible(), "the Study page shows the level", await level.first().getAttribute("aria-label").catch(() => ""));
  check(await p.getByRole("progressbar", { name: "Progress to the next level" }).first().isVisible(), "and how far to the next");
  const goal = p.getByRole("region", { name: "Daily goal" });
  const ring = goal.getByRole("img", { name: /of 50 points so far$/ });
  check(await ring.isVisible(), "a ring fills with today's points", await ring.getAttribute("aria-label").catch(() => ""));
  check(/Goal reached today/.test(await goal.innerText()), "and says when the goal is met");
  await goal.getByRole("button", { name: "Change the goal" }).click();
  await goal.getByRole("radio", { name: /^Serious/ }).click();
  check((await settings()).xpGoal === 100 && /of 100 XP/.test(await goal.innerText()), "the goal can be changed", (await goal.innerText()).split("\n").slice(0, 3).join(" · "));
}

console.log("\nGames with every card, from the Study page");
{
  await p.getByRole("region", { name: "Daily goal" }).getByRole("button", { name: "Play a game with all your cards" }).click();
  await p.waitForTimeout(300);
  check(await p.getByRole("heading", { name: "Games", exact: true }).isVisible() && /8 cards from every deck/.test(await p.locator("main").innerText()), "a page of games with every card");
  await p.getByRole("button", { name: "Play Quick-fire" }).click();
  const game = p.getByRole("region", { name: "Quick-fire" });
  const q = (await game.locator("p[aria-live]").innerText()).trim();
  await game.getByRole("group", { name: "Answers" }).getByRole("button", { name: CARDS[q], exact: true }).click();
  await p.waitForTimeout(350);
  await game.getByRole("button", { name: "End the round" }).click();
  const result = p.getByRole("region", { name: "Game result" });
  check(/10 points/.test(await result.innerText()) && !/New best/.test(await result.innerText()), "played and scored, with no deck to keep a best on");
  await result.getByRole("button", { name: "Back to Study" }).click();
  await p.waitForTimeout(300);
  check(await p.getByRole("region", { name: "Daily goal" }).isVisible(), "and back to Study");
}

console.log("\nOn a phone");
{
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole("button", { name: /^Cell biology/ }).first().click().catch(async () => {
    await p.keyboard.press("Meta+5");
    await p.getByRole("button", { name: /^Cell biology/ }).first().click();
  });
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Play a game" }).click();
  await p.getByRole("button", { name: "Play Match" }).click();
  await p.waitForTimeout(300);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, "Match fits the width, nothing to scroll sideways", `${over}px over`);
  const small = await p.getByRole("group", { name: "Tiles" }).getByRole("button").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  check(small === 0, "every tile is a finger's size");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
