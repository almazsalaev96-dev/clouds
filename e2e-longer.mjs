/**
 * A conversation that has outgrown the window moves itself.
 *
 * The claim: when a model says the thread is too long for it, the turn does
 * not stop at a coloured bar and a "Switch model" button. It goes to the
 * widest window that can be called — the same company is fine — the answer
 * arrives, and the row says why it came from there. Only when nothing
 * holds more is the old advice given: shorten it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=… npx next start -p 3100
 *   node e2e-longer.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
/* Haiku: the smallest window the Anthropic key opens (200k), with Sonnet's
   million beside it. Picked by hand, so the app's own choosing is out of
   the picture and the move is the only reason the answer could come from
   somewhere else. */
const S = { theme: "dark", density: "comfortable", modelId: "claude-haiku-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const arm = (status, body, times) =>
  fetch(`${MOCK}/__fail?status=${status}&body=${encodeURIComponent(body)}&times=${times}`).then((r) => r.json());
const calls = async () =>
  ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const TOO_LONG = '{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 214000 tokens > 200000 maximum context length"}}';

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe window is too small for the thread");
{
  await fetch(`${MOCK}/__reset`);
  await arm(400, TOO_LONG, 1);
  await p.locator(".composer-shell textarea").first().fill("so, given all of that, what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(9000);

  const prose = await p.locator(".prose").allInnerTexts();
  check(prose.some((t) => /debounce/i.test(t)), "the answer arrives anyway", prose[0]?.slice(0, 40) ?? "(nothing)");

  const seq = await calls();
  const answered = seq[seq.length - 1]?.model ?? "";
  check(answered === "claude-sonnet-5",
    "from the widest window the key opens, at the same company",
    `asked haiku (200k), answered by ${answered || "(nobody)"}`);

  const row = await p.locator(".msg").last().innerText();
  check(/larger window/.test(row), "and the row says it moved for room", row.split("\n").find((l) => /window/.test(l)) ?? row.slice(0, 80));
  check(!(await p.getByRole("button", { name: /^Switch model$/ }).isVisible().catch(() => false)), "no 'Switch model' to press");
  check(!(await p.getByRole("button", { name: /^Retry$/ }).isVisible().catch(() => false)), "and no error bar at all");
}

console.log("\nAnd when nothing holds more, it says so instead of pretending");
{
  /* Already on the million-token window: there is nowhere roomier at this
     key, so the honest thing is the error and the advice. */
  await fetch(`${MOCK}/__reset`);
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, modelId: "claude-sonnet-5" }, version: 1 })), S);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await arm(400, TOO_LONG, 3);
  await p.locator(".composer-shell textarea").first().fill("and a throttle");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(6000);
  const seq = await calls();
  check(seq.length === 0, "nothing is asked twice for the sake of it", seq.map((r) => r.model).join(" → ") || "no answered calls");
  check(await p.getByRole("button", { name: /^Switch model$/ }).isVisible().catch(() => false), "the old advice stands: switch or shorten");
  /* Two of the three armed refusals were never spent — nothing asked twice —
     so they are cleared here rather than left for the next probe to find. */
  await fetch(`${MOCK}/__fail`);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
