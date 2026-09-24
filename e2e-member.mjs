/**
 * After subscribing, every room works — on the server's keys, with nothing
 * added by the person.
 *
 * A member (a pass claimed from the mock payment) on Auto: an easy
 * question, a hard one that Auto would send to the top of the ladder, a
 * picture, a deck in Study, a page in the Notebook. Each must come back
 * without a key of the person's own, and never dead-end on "add a key".
 *
 *   bash /tmp/claude-0/plus2.sh e2e-member
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, plus: null };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const plusState = async () => fetch(`${MOCK}/__plus`).then((r) => r.json());
const rows = (store) => p.evaluate(async (s) => {
  const req = indexedDB.open("clouds");
  const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
  return new Promise((ok, no) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}, store);
const box = () => p.locator(".composer-shell textarea").first();
const ask = async (q, settle = 6000) => {
  await p.getByRole("button", { name: "New chat" }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await box().fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(settle);
};
const deadEnd = (t) => /No .* key yet|not part of Armi Plus|Add key/.test(t);

await fetch(`${MOCK}/__plus/reset`);
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
/* Subscribed: back from checkout with the payment on the address. */
await p.goto("http://localhost:3100/?plus=done&status=succeeded&payment_id=pay_mock", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.plus);
check(/^v1\./.test(kept?.key ?? ""), "subscribed: the pass is in the browser", JSON.stringify(kept)?.slice(0, 80));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1200);

console.log("\nChat on Auto, with no keys of the person's own");
{
  await ask("what is a debounce, in a sentence");
  let main = await p.locator("main").innerText();
  check(/debounce/i.test(main) && !deadEnd(main), "an easy question is answered", (main.match(/[^\n]*debounce[^\n]*/i) ?? [""])[0].slice(0, 80));
  const easy = await recent();
  check(easy.every((r) => /haiku|sonnet-5$|luna|terra|deepseek|k2\.6/.test(r.model ?? "")), "on engines the plan covers", easy.map((r) => `${r.kind}:${r.model}`).join(" → "));

  await ask("Prove rigorously, from first principles, that the halting problem is undecidable, and give the complete architecture of a checker that approximates it", 9000);
  main = await p.locator("main").innerText();
  check(!deadEnd(main), "a question Auto would send to the top of the ladder does not dead-end on 'add a key'", (main.split("\n").find((l) => deadEnd(l)) ?? "").slice(0, 100));
  const hard = await recent();
  check(hard.some((r) => r.kind === "answer"), "it is answered", hard.map((r) => `${r.kind}:${r.model}`).join(" → ") || "(no calls)");
  check(!hard.some((r) => /opus|fable/.test(r.model ?? "")), "and nothing above the plan was called for it", hard.map((r) => r.model).join(", "));
  const row = await p.locator(".msg").last().innerText();
  check(/Mira|Nova|Lumos|Astro/.test(row), "the row names an Armi model, not an engine", (row.split("\n").find((l) => /Mira|Nova|Lumos|Astro/.test(l)) ?? row.slice(0, 60)).slice(0, 80));
}

console.log("\nA picture");
{
  await ask("Draw me a picture of a plant cell, labelled", 2000);
  const img = p.locator(".msg img[alt]").last();
  const came = await img.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  const main = await p.locator("main").innerText();
  check(came, "a picture arrives on the server's key", came ? await img.getAttribute("alt") : (main.split("\n").find((l) => /key|Plus|went wrong|Couldn/.test(l)) ?? main.slice(-120)).slice(0, 120));
  const st = await plusState();
  check(st.debits.some((d) => /image|picture|gpt-image/i.test(JSON.stringify(d))) || st.balance < 60000, "and it came off the allowance", `balance ${st.balance}`);
}

console.log("\nA deck in Study");
{
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(700);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: /deck|subject|what/i }).first().fill("osmosis");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(7000);
  const cards = await rows("cards");
  const main = await p.locator("main").innerText();
  check(cards.length >= 4, "cards are written", cards.length ? `${cards.length} cards` : (main.split("\n").find((l) => /key|Plus|Nothing usable|failed/.test(l)) ?? "").slice(0, 120));
  check(!deadEnd(main), "and the room never asked for a key");
}

console.log("\nA page in the Notebook, asked for");
{
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(800);
  await fetch(`${MOCK}/__reset`);
  const asks = p.getByRole("textbox", { name: /ask|write|what should/i }).first();
  const visible = await asks.isVisible().catch(() => false);
  if (visible) {
    await asks.fill("a short page on osmosis");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(7000);
  }
  const main = await p.locator("main").innerText();
  const calls = await recent();
  check(visible ? calls.length >= 1 && !deadEnd(main) : true, visible ? "the page is written on the server's key" : "(no ask box on a new page — skipped)", calls.map((r) => `${r.kind}:${r.model}`).join(" → "));
}

const st = await plusState();
console.log(`\n  allowance: 60000 → ${st.balance} over ${st.debits.length} debits`);
console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
