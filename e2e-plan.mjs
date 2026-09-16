/**
 * Teaching, in the row and on the wire; and the deck that needs practising.
 *
 * Three things a tutor does that a chat does not: offers a hint before the
 * answer, reads an exam question the way it will be marked, and knows which
 * deck you are about to forget.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-plan.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "socratic", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const box = p.locator(".composer-shell textarea").first();
const ask = async (q, ms = 3000) => {
  await box.fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(ms);
  return fetch(`${MOCK}/__last`).then((r) => r.json());
};

console.log("\nIn a teaching stance the row offers the ladder, not the shortcuts");
{
  await ask("How do I find the derivative of x squared?");
  const group = p.getByRole("group", { name: "Follow up" });
  check(await group.isVisible().catch(() => false), "there are follow-ups under the answer");
  const labels = await group.getByRole("button").allInnerTexts();
  check(labels.includes("A hint") && labels.includes("First step") && labels.includes("The method") && labels.includes("The answer"), "a hint, the first step, the method, and only then the answer", labels.join(" · "));
  check(!labels.includes("Harder"), "and not the ordinary set", labels.join(" · "));
  await group.getByRole("button", { name: "A hint" }).click();
  await p.waitForTimeout(2500);
  const mine = await p.evaluate(() => [...document.querySelectorAll("[id^=m-]")].map((n) => (n.textContent ?? "").trim()));
  check(mine.some((t) => /Give me one hint: only where to look/.test(t)), "pressing one sends it as your own message, so the transcript keeps the level you reached");
}

console.log("\nAn exam question is read the way it will be marked");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  const last = await ask("Explain why the rate of reaction increases with temperature. [3]");
  const sent = JSON.stringify(last);
  check(/command word is \\"explain\\"/.test(sent) || /command word is "explain"/.test(sent), "the model is told the command word and what it means", sent.slice(0, 0));
  check(/exactly 3 numbered mark points/.test(sent), "and how many mark points to account for");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  const plain = JSON.stringify(await ask("explain eigenvalues like I have forgotten the algebra"));
  check(!/command word is/.test(plain), "while an ordinary request to explain is left alone");
}

console.log("\nThe deck most likely to be forgotten is named, with a way to practise it");
{
  const now = Date.now();
  const DAY = 86_400_000;
  await p.evaluate(({ now, DAY }) => new Promise((ok, no) => {
    const r = indexedDB.open("clouds");
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(["decks", "cards"], "readwrite");
      const decks = tx.objectStore("decks"), cards = tx.objectStore("cards");
      const mk = (id, name) => ({ id, name, createdAt: now - 40 * DAY, updatedAt: now - 30 * DAY });
      decks.put(mk("d-solid", "Solid deck"));
      decks.put(mk("d-shaky", "Shaky deck"));
      const card = (id, deckId, stability, daysAgo) => ({ id, deckId, front: `q${id}`, back: "a", state: "review", due: now - daysAgo * DAY + 1 * DAY, interval: 1, ease: 2.5, reps: 3, lapses: 0, step: 0, createdAt: now - 40 * DAY, stability, difficulty: 5 });
      for (let i = 0; i < 6; i++) cards.put(card(`s${i}`, "d-solid", 80, 1));
      for (let i = 0; i < 6; i++) cards.put(card(`w${i}`, "d-shaky", 1, 20));
      tx.oncomplete = () => { db.close(); ok(true); };
      tx.onerror = () => no(tx.error);
    };
  }), { now, DAY });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(700);
  const line = p.getByLabel(/^Shakiest deck: /);
  check(await line.isVisible().catch(() => false), "the shakiest deck is named on the index", (await line.innerText().catch(() => "")).replace(/\n/g, " "));
  check(/Shaky deck/.test(await line.innerText().catch(() => "")) && /6 of 6 likely forgotten/.test(await line.innerText().catch(() => "")), "with how many of its cards are likely gone", (await line.innerText().catch(() => "")).replace(/\n/g, " "));
  await line.getByRole("button", { name: "Practise it" }).click();
  await p.waitForTimeout(600);
  check(/practice/.test((await p.locator("main").innerText().catch(() => "")).toLowerCase()) && /qw\d/.test(await p.locator("main").innerText().catch(() => "")), "and one press starts a practice run through it", (await p.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 80));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
