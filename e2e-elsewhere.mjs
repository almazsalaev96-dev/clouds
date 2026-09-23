/**
 * When a company will not answer, the turn goes somewhere else.
 *
 * Holding four keys is only worth something if the second one is tried. The
 * claim is that a provider-side refusal does not end the turn: the app waits
 * once, asks again, and then asks a different company — and says on the row
 * that it did, rather than leaving a coloured bar and a button.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=… OPENAI_BASE_URL=… npx next start -p 3100
 *   node e2e-elsewhere.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const arm = (status, body, times) =>
  fetch(`${MOCK}/__fail?status=${status}&body=${encodeURIComponent(body)}&times=${times}`).then((r) => r.json());
const calls = async () =>
  ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nOne company is having a bad minute");
{
  await fetch(`${MOCK}/__reset`);
  /* Two refusals: the first send and the automatic retry. The third attempt
     is the one that has to go somewhere else. */
  await arm(500, '{"error":{"type":"api_error","message":"Internal server error"}}', 2);
  await p.locator(".composer-shell textarea").first().fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(12000);

  const prose = await p.locator(".prose").allInnerTexts();
  check(prose.some((t) => /debounce/i.test(t)), "an answer arrives anyway", prose[0]?.slice(0, 40) ?? "(nothing)");

  /* The mock records answers, not refusals, so what is on the wire is the
     call that worked — which is the claim: it came from somewhere else. Two
     refusals were consumed getting there. */
  const seq = await calls();
  const answered = seq[seq.length - 1]?.model ?? "";
  check(Boolean(answered) && !/^claude/.test(answered),
    "and it came from a different company than the one that refused",
    `asked for claude-sonnet-5, answered by ${answered}`);

  const row = await p.locator(".msg").last().innerText();
  check(/trouble a moment ago|rate-limiting|out of credit/.test(row), "the row says why the answer came from there", row.split("\n").find((l) => /trouble|rate|credit/.test(l)) ?? row.slice(0, 60));
  check(!(await p.getByRole("button", { name: /^Switch model$/ }).isVisible().catch(() => false)), "and there is no error to clear");
}

console.log("\nAnd the next question does not walk into the same wall");
{
  /* Only where the app is doing the choosing. A model you picked by hand is
     still the model you picked — the app does not quietly answer as somebody
     else because the last turn went badly. So this switches to an Armi
     model, which rents its engines, and asks again. No reload: what the app
     knows about a bad minute is held in memory on purpose, and reloading
     would be testing that it forgets. */
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: /^Model:/ }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /^ARMI Mira 4.1 —/ }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await p.locator(".composer-shell textarea").first().fill("and what is a throttle");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(6000);
  const seq = await calls();
  check(seq.length >= 1 && !seq.some((r) => /^claude/.test(r.model)),
    "the company that just refused is stepped around for a couple of minutes",
    seq.map((r) => r.model).join(" → "));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
