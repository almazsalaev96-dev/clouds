/**
 * The shell's two controls from the reference: the switch that hides the
 * panel lives beside the model rather than on the panel, and search is a
 * round button until it is wanted.
 *
 *   npx next start -p 3100
 *   node e2e-shell.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);



console.log("\nThe panel carries its own switch, and leaves a rail");
{
  /* As the reference draws it: the close control in the panel's header,
     the open control at the top of the rail the closed panel leaves, and
     no copy of either in the bar on a desk. */
  const aside = p.locator("aside").first();
  const close = aside.getByRole("button", { name: "Close sidebar" });
  check(await close.isVisible(), "the switch sits in the panel's header");
  check((await p.locator("header").first().getByRole("button", { name: /Hide sidebar|Show sidebar/ }).filter({ visible: true }).count()) === 0,
    "and the bar carries no copy of it on a desk");
  await close.click();
  await p.waitForTimeout(600);
  check(await aside.getByRole("button", { name: "Open sidebar" }).isVisible(),
    "closed, the rail's top square is the open control");
  await aside.getByRole("button", { name: "Open sidebar" }).click();
  await p.waitForTimeout(600);
  check(await close.isVisible(), "and it opens again from there");
}

console.log("\nAnd search is a button until it is wanted");
{
  const aside = p.locator("aside");
  check((await aside.getByLabel("Search conversations").count()) === 0,
    "at rest the panel carries no search box");
  const find = aside.getByRole("button", { name: "Find a conversation" });
  check(await find.isVisible(), "only a round control that opens one");
  check((await find.getAttribute("aria-expanded")) === "false", "which says it is closed");
  await find.click();
  await p.waitForTimeout(400);
  const box = aside.getByLabel("Search conversations");
  check(await box.isVisible(), "pressing it puts a box there");
  check(await box.evaluate((el) => el === document.activeElement), "with the caret already in it");
  await box.fill("zzzzz-nothing-matches");
  await p.waitForTimeout(500);
  check(/No conversations|nothing/i.test(await aside.innerText()), "and it filters the list under it",
    (await aside.innerText()).split("\n").filter(Boolean).slice(-2).join(" · "));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  check((await aside.getByLabel("Search conversations").count()) === 0, "escape puts it away");
  check(!/zzzzz/.test(await aside.innerText()), "and takes the filter with it, so no row is missing for a reason nobody can see");
}

await b.close();
console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
