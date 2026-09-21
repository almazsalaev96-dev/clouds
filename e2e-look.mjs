/**
 * The front door, the keys, and the page that says what leaves.
 *
 * Three claims worth a browser: a blank page is a greeting and a box with
 * nothing to get past, and still knows what is waiting in the other rooms; a
 * key you have saved is never drawn in full again; and the privacy page says
 * the uncomfortable half out loud.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-look.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA blank page is a greeting and a box, and nothing to get past");
{
  /* The four boxed openers are deleted. Half of them were sentences you
     were meant to finish, and a cut-off half-sentence inside a hard chip
     reads as a label that got clipped rather than as an invitation; four of
     them turned the blank page into a form. What they were for is in two
     better places now — the line below says what is genuinely waiting in
     the other rooms, and a slash lists the commands in the box, while you
     are already typing. */
  check((await p.getByRole("group", { name: "Ways to start" }).count()) === 0, "no chips to get past before you may type");
  const box = p.locator(".composer-shell textarea").first();
  check(await box.evaluate((el) => el === document.activeElement), "the caret is already in the box");
  check(/Type \/ to see what it can be asked to do/.test(await p.locator("main").innerText()), "and one line says what a slash is for");
  await box.fill("/stu");
  await p.waitForTimeout(300);
  const list = p.getByRole("listbox", { name: "Commands" });
  check(await list.isVisible(), "which it is: typing one lists them, in the box");
  await box.fill("");
}

console.log("\nAnd it still knows what is waiting in the other rooms");
{
  const now = Date.now(), DAY = 86_400_000;
  await p.evaluate(({ now, DAY }) => new Promise((ok, no) => {
    const r = indexedDB.open("clouds");
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(["decks", "cards"], "readwrite");
      tx.objectStore("decks").put({ id: "d-weak", name: "Cell biology", createdAt: now - 40 * DAY, updatedAt: now - 3 * DAY });
      for (let i = 0; i < 6; i++) {
        tx.objectStore("cards").put({ id: `wk${i}`, deckId: "d-weak", front: `q${i}`, back: "a", state: "review", due: now - 20 * DAY + DAY, interval: 1, ease: 2.5, reps: 3, lapses: 0, step: 0, createdAt: now - 40 * DAY, stability: 1, difficulty: 5 });
      }
      tx.oncomplete = () => { db.close(); ok(true); };
      tx.onerror = () => no(tx.error);
    };
  }), { now, DAY });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  /* The four openers are gone; what they were for is not. The one line
     under the box is about the person's own material rather than about what
     an assistant can do in general, and it is a press away from the room it
     names. */
  const waiting = p.getByLabel("Waiting in the other rooms");
  check(await waiting.isVisible(), "a line under the box says what is due");
  const said = await waiting.innerText();
  check(/6 cards due/.test(said), "with the real number, not a suggestion", said.replace(/\s+/g, " ").slice(0, 60));
  check((await p.locator("main").innerText()).includes("Type /") === false, "and the slash line stands down, because something real outranks it");
  await waiting.getByRole("button").first().click();
  await p.waitForTimeout(700);
  check(/Study/.test(await p.locator("main").innerText()), "pressing it goes to the room it named");
  await p.getByRole("button", { name: "Conversations" }).first().click();
  await p.waitForTimeout(500);
}

console.log("\nA key you have saved is not shown again");
{
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "API keys", exact: true }).click();
  await p.waitForTimeout(300);
  /* A password input has no textbox role, so it is found by its label. And
     not Anthropic: the probe's own server has that key set, so its row
     rightly says there is nothing to do here. */
  const field = p.getByLabel(/OpenAI API key/i);
  await field.fill("sk-proj-SECRETSECRETSECRET-9f4c");
  await p.waitForTimeout(400);
  /* One per unconfigured provider, so this names the row rather than the app. */
  check(await p.getByRole("button", { name: "Show key" }).first().isVisible().catch(() => false), "while it is being typed it can be read back, which is when that matters");
  await p.getByRole("button", { name: "Done" }).first().click();
  await p.waitForTimeout(400);
  const shown = await p.locator("[role=dialog]").innerText();
  check(!/SECRETSECRETSECRET/.test(shown), "once saved the middle of it is gone from the screen", shown.match(/sk-pro\S*/)?.[0] ?? "");
  check(/sk-pro[•●\u2022]{10}9f4c/.test(shown.replace(/\s/g, "")), "and what is left tells you which key it is", shown.match(/sk-pro\S*/)?.[0] ?? "");
  check(await p.getByRole("button", { name: "Replace" }).isVisible().catch(() => false), "with a way to put a different one in");
  check(await p.getByRole("button", { name: "Remove" }).isVisible().catch(() => false), "and a way to take it out");
}

console.log("\nThe privacy page says the half nobody likes saying");
{
  await p.getByRole("button", { name: "Privacy", exact: true }).click();
  await p.waitForTimeout(300);
  const text = await p.locator("[role=dialog]").innerText();
  check(/Stored in this browser/.test(text), "what is kept here");
  check(/What leaves/.test(text) && /provider whose key you added/.test(text), "what leaves, and to whom");
  check(/never shown in full again/.test(text), "what happens to a key");
  check(/No analytics/.test(text), "and what the app never does");
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
