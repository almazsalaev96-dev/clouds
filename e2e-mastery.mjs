/**
 * What the cards cannot remember about themselves.
 *
 * A card carries its schedule and nothing else — ask it what went wrong and
 * the best it can say is "twice". The claim here is that the room now keeps
 * the wrong answers themselves, groups what is being learned by the thing
 * being learned rather than by the box it was filed in, and can be argued
 * with: an answer pressed by mistake goes back.
 *
 *   (start the mock and the server the way gate.sh does)
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-mastery.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const rows = (store) => p.evaluate(async (s) => {
  const req = indexedDB.open("clouds");
  const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
  return new Promise((ok, no) => {
    const r = db.transaction(s).objectStore(s).getAll();
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}, store);

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
await p.waitForTimeout(700);

console.log("\nCards made by the app arrive knowing what they are about");
{
  await p.getByRole("textbox", { name: /deck|subject|what/i }).first().fill("debouncing");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(6000);
  const cards = await rows("cards");
  check(cards.length >= 4, "a deck was written", `${cards.length} cards`);
  const topics = [...new Set(cards.map((c) => c.topic).filter(Boolean))];
  check(topics.length >= 2, "and every card carries the thing it is about, finer than the deck",
    topics.join(" · ") || "none");
  check(cards.every((c) => c.topic), "with none left unlabelled",
    `${cards.filter((c) => !c.topic).length} unlabelled`);
}

console.log("\nEvery answer is written down, not just the schedule it moved");
{
  /* Scoped to the room and matched exactly: an unanchored /Study/ also
     matches the sidebar's own Study button, and clicking that just
     re-opens the room while every key press afterwards goes nowhere. */
  await p.locator("main").getByRole("button", { name: "Start", exact: true }).click();
  await p.waitForTimeout(900);
  // Answer three cards: wrong, wrong, right.
  for (const key of ["1", "1", "3"]) {
    await p.keyboard.press("Space");
    await p.waitForTimeout(350);
    await p.keyboard.press(key);
    await p.waitForTimeout(700);
  }
  const log = await rows("attempts");
  check(log.length === 3, "one row per answer, right ones included — a log of only failures cannot give a rate",
    `${log.length} rows`);
  check(log.filter((a) => !a.right).length === 2, "and it knows which were wrong", JSON.stringify(log.map((a) => a.right)));
  /* Guarded: `every` over an empty array is true, and an assertion that
     passes when nothing was written is worse than no assertion. */
  check(log.length > 0 && log.every((a) => a.question && a.expected),
    "with what was asked and what was wanted, kept in full");
  check(log.length > 0 && log.every((a) => a.topic),
    "and the topic, so the log can be read by subject", [...new Set(log.map((a) => a.topic))].join(" · "));
}

console.log("\nAn answer pressed by mistake goes back");
{
  const before = (await rows("cards")).find((c) => c.reps > 0);
  check(Boolean(before), "a card has been answered");
  await p.keyboard.press("Space");
  await p.waitForTimeout(300);
  await p.keyboard.press("2");
  await p.waitForTimeout(700);
  const mid = await rows("cards");
  const target = mid.find((c) => c.id === (mid.find((x) => x.reps > 0) ?? {}).id);
  check(Boolean(target), "and answered again");
  const undoLink = p.getByRole("button", { name: /Undo that( last)? answer/ });
  check(await undoLink.isVisible().catch(() => false), "the way back is offered where the keys are explained");
  const wasDue = mid.map((c) => [c.id, c.due, c.reps]);
  await p.keyboard.press("u");
  await p.waitForTimeout(800);
  const after = await rows("cards");
  const moved = after.filter((c) => {
    const was = wasDue.find(([id]) => id === c.id);
    return was && (was[1] !== c.due || was[2] !== c.reps);
  });
  check(moved.length === 1, "and pressing it puts exactly one card back the way it was", `${moved.length} changed`);
  check(moved[0] && moved[0].reps === (wasDue.find(([id]) => id === moved[0].id) ?? [])[2] - 1,
    "with the answer count undone, not merely the date nudged");
  /* The streak is not a scoreboard to be corrected: you did answer it. */
  const days = await rows("studyDays");
  check(days.length === 1 && days[0].answered >= 4,
    "while the day's tally stands, because the answering did happen", JSON.stringify(days[0] ?? {}));
}

console.log("\nThe room reads by topic, not only by deck");
{
  await p.keyboard.press("Escape");
  await p.waitForTimeout(900);
  const room = await p.locator("main").innerText();
  check(/By topic/.test(room), "the topics are listed");
  const list = p.getByRole("region", { name: "Topics" }).or(p.locator('section[aria-label="Topics"]'));
  const txt = await list.first().innerText().catch(() => "");
  check(/debounce|throttle/.test(txt), "named by what they are about", txt.replace(/\s+/g, " ").slice(0, 70));
  check(/wrong/.test(txt), "with what has actually been got wrong beside the model's guess",
    txt.replace(/\s+/g, " ").slice(0, 90));
}

console.log("\nAnd the mistakes are a queue you can actually practise");
{
  const room = await p.locator("main").innerText();
  check(/getting wrong/.test(room), "the cards that keep going wrong are counted",
    (room.split("\n").find((l) => /getting wrong/.test(l)) ?? "").slice(0, 60));
  await p.getByRole("button", { name: "Practise these" }).click();
  await p.waitForTimeout(900);
  const header = await p.locator("header").last().innerText();
  check(/Mistakes/.test(header), "and pressing it opens a run of exactly those", header.replace(/\s+/g, " ").slice(0, 50));
  /* Three of the four were answered wrong or hard; the fourth was right and
     must not be in here. The claim is "only what was missed", not a number. */
  const left = Number((header.match(/(\d+) left/) ?? [])[1] ?? -1);
  const wrong = (await rows("attempts")).filter((a) => !a.right);
  const distinct = new Set(wrong.map((a) => a.cardId)).size;
  check(left === distinct && left < 4, "holding only what was missed, not the whole deck",
    `${left} in the run, ${distinct} distinct cards missed, deck of 4`);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
