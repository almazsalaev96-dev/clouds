/**
 * A typed prefix sets the room; a menu entry asks the same model to think
 * harder.
 *
 * The claims: typing "/" opens a list that narrows as you type; "/study …"
 * answers as the tutor with the command stripped from what is kept; a bare
 * "/research" is a setting, not a message; and "With more effort" regenerates
 * on the same model with a higher effort in the request and says so on the
 * row.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nA slash opens the list, and typing narrows it");
{
  await box().fill("/");
  await p.waitForTimeout(250);
  const list = p.getByRole("listbox", { name: "Commands" });
  check(await list.isVisible(), "a lone slash shows what a slash can do");
  const all = await list.getByRole("option").allInnerTexts();
  check(all.some((t) => /^\/study/.test(t)) && all.some((t) => /^\/research/.test(t)), "with the verbs in it", all.slice(0, 4).map((t) => t.split("\n")[0]).join(" · "));
  await box().fill("/mi");
  await p.waitForTimeout(250);
  const narrowed = await list.getByRole("option").allInnerTexts();
  check(narrowed.length === 1 && /^\/mira/.test(narrowed[0]), "and “/mi” leaves only the everyday tier", narrowed.map((t) => t.split("\n")[0]).join(" · "));
  await box().fill("/zzz");
  await p.waitForTimeout(250);
  check(/No command called/.test(await list.innerText()), "while an unknown one says so rather than guessing");
  await list.getByRole("option").first().click().catch(() => {});
  await box().fill("/study ");
  await p.waitForTimeout(250);
  check((await list.count()) === 0, "and once there is a space the list goes — the command is complete");
}

console.log("\n“/study” answers as the tutor, and the command is not kept");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("/study what is a debounce");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4500);
  /* The answer, not the last call: the Orrery's cast has a second model
     read the answer back, so `__last` is the check, which is told the
     answer and nothing about how to teach. */
  const { recent } = await fetch(`${MOCK}/__recent`).then((r) => r.json());
  const stance = recent.find((r) => r.kind === "answer")?.system ?? "";
  check(/teach|learn|explain|understand/i.test(stance), "the request carried the tutor's stance", `${recent.map((r) => r.kind).join(" → ")}; ${stance.length} chars of instructions`);
  const user = await p.locator(".msg").first().innerText();
  check(/what is a debounce/.test(user) && !/\/study/.test(user), "the message kept is the question without its prefix", user.replace(/\s+/g, " ").slice(0, 40));
  const row = await p.locator(".msg").last().innerText();
  check(/Mira/.test(row) && /teaching/.test(row), "and the answer is credited to Mira, teaching", (row.split("\n").find((l) => /ARMI/.test(l)) ?? "").slice(0, 90));
}

console.log("\nA bare “/research” is a setting, not a message");
{
  const before = await p.locator(".msg").count();
  await box().fill("/research");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(800);
  check((await p.locator(".msg").count()) === before, "nothing is sent");
  check(await p.getByRole("button", { name: /Stop searching the web/ }).isVisible(), "and research is now on for this chat");
  check((await box().inputValue()) === "", "with the box cleared as for any send");
}

console.log("\n“/check” asks for a second reading; “/compare” is Binary for the turn");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("/check is a debounce the same as a throttle");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4500);
  /* On Mira 4.1 the reading that was asked for is a check, and a check that
     objects sends the answer up a rung: the row a reader ends on is the
     second pass, by a stronger model, which is the whole point of asking. */
  const row = await p.locator(".msg").last().innerText();
  check(/second reading asked for|answered again by a stronger model/.test(row), "the row says a second reading was asked for", (row.split("\n").find((l) => /second reading|answered again/.test(l)) ?? "").slice(0, 90));
  check(/answered again by a stronger model after a second model objected/.test(row), "and when the reading objected, a stronger model answered again", (row.split("\n").find((l) => /answered again/.test(l)) ?? "").slice(0, 90));
  await box().fill("/compare which of these two names is better, Nova or Lens");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4500);
  /* Binary's tactic is two columns, not one row: the same side-by-side the
     Compare button makes, headed by the answers rather than by companies. */
  const keeps = p.getByRole("button", { name: /^Keep .*answer$/ });
  check(/Comparing 2 models/.test(await p.locator("main").innerText()) && (await keeps.count()) === 2, "and “/compare” puts two answers side by side — Binary's tactic", `${await keeps.count()} columns to keep from`);
  check(!/\/compare|\/check/.test(await p.locator("main").innerText()), "with neither command kept in the messages");
  await keeps.first().click();
  await p.waitForTimeout(800);
  check((await keeps.count()) === 0 && /debounce|Nova|Lens/i.test(await p.locator(".msg").last().innerText()), "keeping one leaves it as the answer in the thread");
}

console.log("\n“With more effort” asks the same model to think harder");
{
  await fetch(`${MOCK}/__reset`);
  const last = p.locator(".msg").last();
  await last.hover();
  await last.getByRole("button", { name: "Regenerate with another model" }).click();
  await p.waitForTimeout(300);
  const item = p.getByRole("menuitem", { name: /With more effort/ });
  check(await item.isVisible(), "it is the first thing the regenerate menu offers");
  await item.click();
  await p.waitForTimeout(4500);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(sent.effort === "high", "the request went out at high effort", `effort: ${sent.effort}`);
  const row = await p.locator(".msg").last().innerText();
  check(/asked to think harder/.test(row), "and the row says so", (row.split("\n").find((l) => /think harder/.test(l)) ?? "").slice(0, 60));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
