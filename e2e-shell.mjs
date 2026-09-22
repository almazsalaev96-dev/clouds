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



console.log("\nThe panel's switch is not drawn on the panel");
{
  /* It was in the sidebar's header: a control that hides a thing, drawn on
     the thing it hides, which then needed a second copy elsewhere for when
     it had worked. One control now, in the bar beside the model, saying
     show or hide in the same square of screen either way. */
  const bar = p.locator("header").first();
  const hide = bar.getByRole("button", { name: "Hide sidebar" });
  check(await hide.isVisible(), "the switch sits in the bar beside the model, not inside the panel");
  check((await p.locator("aside").getByRole("button", { name: /Hide sidebar/ }).count()) === 0,
    "and there is no second copy of it on the panel itself");
  await hide.click();
  await p.waitForTimeout(600);
  check(await bar.getByRole("button", { name: "Show sidebar" }).isVisible(),
    "closed, the same control is in the same place and says the other thing");
  await bar.getByRole("button", { name: "Show sidebar" }).click();
  await p.waitForTimeout(600);
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
