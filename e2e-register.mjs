/**
 * The app reads how to answer, the way it reads which model to use.
 *
 * The style was a setting behind two menus almost nobody opened, so every
 * answer came out in the same register whether the person had typed four
 * words or four paragraphs, whether they were revising for an exam or
 * writing to a landlord. On Auto it is read per turn instead — from what
 * they said, from what they have done with the last few answers, and from
 * how they write — and the answer says which register it used and why,
 * because an app that quietly changes how it talks to you is one whose
 * answers you cannot account for.
 *
 * Read at the wire: a style that does not reach the request is a style
 * that does not exist.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-register.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
/* styleId absent on purpose: this is what a new install looks like. */
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

const box = p.locator(".composer-shell textarea").first();
const wire = async () => (await fetch(`${MOCK}/__last`).then((r) => r.json())).systemText ?? "";
const fresh = async () => { await p.getByRole("button", { name: "New chat" }).first().click(); await p.waitForTimeout(300); };
/* Polled rather than slept at. The request the app sends and the moment a
   fixed wait expires are two different events, and asserting on the second
   one reads whichever request happened to be last — which on a first
   message is a race with the little call that names the conversation. */
const ask = async (q) => {
  const before = await wire();
  await box.fill(q);
  await p.keyboard.press("Enter");
  let sent = "";
  for (let i = 0; i < 60 && !sent; i++) {
    await p.waitForTimeout(150);
    const now = await wire();
    if (now && now !== before) sent = now;
  }
  /* The request has gone out; the answer it produces has not arrived yet,
     and half of what is asserted here is drawn on the answer. */
  await p.waitForTimeout(2600);
  return sent || (await wire());
};

console.log("\nA new install is on Auto, and Auto reads the request");
{
  const short = await ask("quickly, what is a debounce");
  check(/Answer in as few words/.test(short), "asking for it short sends the concise style to the wire");
  check(await p.locator(".msg").last().innerText().then((t) => /Concise, because/.test(t)),
    "and the answer says which register it used and why");
}

console.log("\nAnd a different request gets a different one");
{
  await fresh();
  const why = await ask("why does a debounce need a timer at all?");
  check(/explain the reasoning that got there/i.test(why), "asking why sends the explanatory style");
  check(!/Answer in as few words/.test(why), "and not the one from the last conversation");
  await fresh();
  const letter = await ask("write me an email to my landlord about the broken boiler");
  check(/professional register/i.test(letter), "something going to somebody else is written properly");
}

console.log("\nAn ordinary question gets the ordinary voice");
{
  await fresh();
  const plain = await ask("what is the capital of Uzbekistan and roughly how many people live there");
  check(!/Answer in as few words/.test(plain) && !/professional register/i.test(plain),
    "no style is imposed where nothing asked for one");
  check(!/Concise, because|Formal, because/.test(await p.locator(".msg").last().innerText()),
    "and nothing is claimed on the answer either");
}

console.log("\nChoosing one yourself turns it off");
{
  await fresh();
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: /Search|Command|Type/ }).first().fill("Formal").catch(() => {});
  await p.waitForTimeout(500);
  const row = p.getByRole("option").filter({ hasText: /Formal/ }).first();
  if (await row.count()) { await row.click(); await p.waitForTimeout(400); } else { await p.keyboard.press("Escape"); }
  const chosen = await ask("quickly, what is a debounce");
  check(/professional register/i.test(chosen),
    "the style you picked answers, even when the request asks for something else");
  check(!/Concise, because/.test(await p.locator(".msg").last().innerText()),
    "and the app does not claim to have chosen it");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
