/**
 * Armi Plus as a balance: a dollar paid is a dollar of use.
 *
 * The claims: a member sees what they have left of what they paid —
 * counted from the payments Dodo has for this product only, never another
 * product's or a failed one; each answer's cost is written to the ledger;
 * once what was paid is spent, the next question is refused in words and
 * nothing is bought on the server's key; a top-up (a new payment) is
 * counted at once and answers resume; and the pass does not run out by
 * date for a one-time payment.
 *
 *   gate: serve ARMI_LEDGER_URL=http://127.0.0.1:8787/__ledger with Plus on and no credit entitlement
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, plus: null };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const spent = async () => { const r = await fetch(`${MOCK}/__ledger/cus_mock`); return r.ok ? (await r.json()).usd : 0; };
const setSpent = (usd) => fetch(`${MOCK}/__ledger/cus_mock`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ usd, at: Date.now() }) });
const pass = () => p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.plus?.key ?? "");
const offer = async () => p.evaluate((k) => fetch(`/api/models?plus=${encodeURIComponent(k)}`).then((r) => r.json()).then((j) => j.plus), await pass());
const ask = async (q, settle = 4500) => {
  await p.getByRole("button", { name: "New chat" }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(settle);
};
const openPlus = async () => {
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Armi Plus$/ }).first().click();
  await p.waitForTimeout(500);
  return p.locator("[role=dialog]").first();
};

await fetch(`${MOCK}/__plus/reset`);
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe offer is a balance, not a month");
{
  const panel = await openPlus();
  const text = await panel.innerText();
  check(/Pay \$1/.test(text) && /until the \$1 is spent/.test(text), "it says what a dollar buys, in those words", (text.split("\n").find((l) => /Pay \$1/.test(l)) ?? "").slice(0, 100));
  check(!/a month|monthly/i.test(text), "and nothing about a month");
  check(await panel.getByRole("button", { name: /Get Plus — \$1/ }).isVisible(), "one button to pay");
}

console.log("\nPaid: what is left is what was paid for this product");
{
  const panel = p.locator("[role=dialog]").first();
  await p.getByLabel("Email or payment id").fill("almaz@example.com");
  await p.getByRole("button", { name: "Switch on" }).click();
  await p.waitForTimeout(1500);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.plus);
  check(/^v1\./.test(kept?.key ?? ""), "the pass is kept");
  const o = await offer();
  check(o.valid === true && o.paid === 1 && o.left === 1, "one dollar paid, one dollar left — the other product's $50 and the failed payment not counted", JSON.stringify(o));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const again = await openPlus();
  const text = await again.innerText();
  check(/\$1\.00 left/.test(text) && /of \$1\.00/.test(text), "the panel shows the balance", (text.split("\n").find((l) => /left/.test(l)) ?? "").slice(0, 60));
  check(await again.getByRole("progressbar", { name: "Balance left" }).isVisible(), "with a bar for it");
  check(await again.getByRole("button", { name: /Top up/ }).isVisible(), "and a way to top up");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nEach answer's cost is taken off");
{
  const before = await spent();
  await ask("why would you choose an event-sourced architecture over a CRUD one here", 6000);
  const answered = (await recent()).some((r) => r.kind === "answer");
  check(answered, "the question is answered on the server's key");
  await p.waitForTimeout(800);
  const after = await spent();
  check(after > before, "and what it cost is in the ledger", `${before} → ${after}`);
  const o = await offer();
  check(o.left < 1 && Math.abs(o.left - (1 - after)) < 0.001, "the balance is what was paid less what was spent", JSON.stringify(o));
}

console.log("\nSpent: the next question is refused in words, and nothing is bought");
{
  await setSpent(1);
  await ask("what is a debounce", 3500);
  const calls = await recent();
  check(!calls.some((r) => r.kind === "answer"), "nothing was sent on the server's key", calls.map((r) => r.kind).join(","));
  check(/balance is used up/i.test(await p.locator("main").innerText()), "and the screen says the balance is used up", ((await p.locator("main").innerText()).split("\n").find((l) => /used up/i.test(l)) ?? "").slice(0, 100));
  const panel = await openPlus();
  check(/used up/.test(await panel.innerText()) && /\$0\.00 left/.test(await panel.innerText()), "the panel says so too");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nA top-up is counted at once");
{
  await fetch(`${MOCK}/__plus/topup`);
  await ask("what is a debounce", 5000);
  check((await recent()).some((r) => r.kind === "answer"), "a new payment and the next question is answered");
  const o = await offer();
  check(o.paid === 2 && o.left > 0.9 && o.left < 1, "two dollars paid, a little under one left", JSON.stringify(o));
}

console.log("\nA claim says what is left");
{
  const out = await fetch("http://localhost:3100/api/plus/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentId: "pay_mock", subscriptionId: "" }) }).then((r) => r.json());
  check(Boolean(out.pass) && out.allowance && typeof out.allowance.left === "number", "a claim answers with the balance too", JSON.stringify(out.allowance));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
