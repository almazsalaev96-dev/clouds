/**
 * Armi Plus: a dollar a month, and no keys to add.
 *
 * The server holds a provider key and Plus is switched on, so that key is
 * for members. A browser with no keys of its own is told it needs a key or
 * Plus; a key pasted in Settings is checked with Dodo and kept; the next
 * question is answered on the server's key, on an engine the plan covers,
 * and its cost comes off the allowance. Coming back from checkout finds
 * the key without the email.
 *
 *   bash /tmp/claude-0/plus.sh e2e-plus
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, plus: null };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const plusState = async () => fetch(`${MOCK}/__plus`).then((r) => r.json());
const ask = async (q, settle = 4000) => {
  await p.getByRole("button", { name: "New chat" }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(settle);
};

await fetch(`${MOCK}/__plus/reset`);
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nWithout a key of its own, the browser is told about the other door");
{
  const models = await p.evaluate(() => fetch("/api/models").then((r) => r.json()));
  check(models.plus?.on === true, "the server says Plus is on", JSON.stringify(models.plus));
  check(Object.values(models.configured ?? {}).every((v) => v === false), "and does not hand its keys to a browser that is not a member", JSON.stringify(models.configured));
  await ask("what is a debounce");
  const shown = await p.locator("main").innerText();
  check(/Armi Plus/.test(shown), "the answer to a question with no key names Armi Plus", (shown.split("\n").find((l) => /Plus/.test(l)) ?? "").slice(0, 100));
  check((await recent()).length === 0, "and nothing was sent on the server's key");
}

console.log("\nA key pasted in Settings is checked with Dodo and kept");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Armi Plus$/ }).first().click();
  await p.waitForTimeout(400);
  const panel = await p.locator("[role=dialog]").first().innerText();
  check(/\$1 a month/.test(panel) && /Subscribe/.test(panel), "the panel says the price and offers to subscribe", (panel.split("\n").find((l) => /\$1/.test(l)) ?? "").slice(0, 80));
  check(/Astro 5 .* still need/.test(panel.replace(/\n/g, " ")), "and says plainly what a dollar does not cover");
  await p.getByLabel("Armi Plus key").fill("WRONG-KEY-0000");
  await p.getByRole("button", { name: "Use this key" }).click();
  await p.waitForTimeout(800);
  check(/not active/i.test(await p.locator("[role=dialog]").first().innerText()), "a wrong key is refused, in words");
  await p.getByLabel("Armi Plus key").fill("ARMI-PLUS-MOCK-KEY");
  await p.getByRole("button", { name: "Use this key" }).click();
  await p.waitForTimeout(1200);
  const after = await p.locator("[role=dialog]").first().innerText();
  check(/Armi Plus is on/.test(after), "the right one turns Plus on", (after.split("\n").find((l) => /is on/.test(l)) ?? "").slice(0, 80));
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.plus);
  check(kept?.key === "ARMI-PLUS-MOCK-KEY" && kept?.customerId === "cus_mock", "and the browser keeps the key and who it belongs to", JSON.stringify(kept));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
}

console.log("\nA member is answered on the server's key, on an engine the plan covers, and pays from the allowance");
{
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const models = await p.evaluate(() => fetch("/api/models?plus=ARMI-PLUS-MOCK-KEY").then((r) => r.json()));
  check(models.configured?.anthropic === true && models.plus?.valid === true, "the server now reports its key as held, for this browser", JSON.stringify(models.configured));
  const before = await plusState();
  await ask("why would you choose an event-sourced architecture over a CRUD one here", 6000);
  const calls = await recent();
  const answer = calls.find((r) => r.kind === "answer");
  check(Boolean(answer), "the question is answered", calls.map((r) => `${r.kind}:${r.model}`).join(" → ") || (await p.locator("main").innerText()).replace(/\n/g, " · ").slice(-400));
  check(Boolean(answer) && /haiku|sonnet-5$/.test(answer.model ?? ""), "on an engine a dollar covers, not the dearest in the house", answer?.model);
  check(!calls.some((r) => /opus|fable/.test(r.model ?? "")), "and nothing above the plan was called", calls.map((r) => r.model).join(", "));
  const shown = await p.locator("main").innerText();
  check(/debounce|event|CRUD|architecture/i.test(shown) && !/No .* key yet/.test(shown), "and the answer is on the screen");
  await p.waitForTimeout(800);
  const after = await plusState();
  check(after.debits.length >= 1 && after.balance < before.balance, "and its cost came off the allowance", `${before.balance} → ${after.balance} (${after.debits.length} debit${after.debits.length === 1 ? "" : "s"})`);
}

console.log("\nComing back from checkout finds the key without the email");
{
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("store.settings.v1")); s.state.plus = null; localStorage.setItem("store.settings.v1", JSON.stringify(s)); });
  await p.goto("http://localhost:3100/?plus=done&status=success&session_id=cks_mock", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.plus);
  check(kept?.key === "ARMI-PLUS-MOCK-KEY", "the key from the session is verified and kept", JSON.stringify(kept));
  check(!/plus=done/.test(p.url()), "and the address is cleaned up", p.url());
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
