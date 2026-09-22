/**
 * Plugins: the way in, and the door it will not open.
 *
 * The complaint that started this was not that connectors were missing, it
 * was that they could not be found — so the first claim here is simply that
 * there is a row called Plugins and it opens on something that explains
 * itself. The second is the guard: the proxy that carries a connector's
 * calls must never be pointed at a private address, because an open one is
 * a way to reach whatever the server can reach, including the place a cloud
 * machine keeps its own credentials.
 *
 * The wire itself is driven in test-plugins.ts, against a stubbed fetch,
 * because proving the happy path here would need a public https MCP server.
 *
 *   npx next start -p 3100
 *   node e2e-plugins.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], connectors: [], name: "Almaz", nameAsked: true };
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nPlugins can be found");
const row = p.locator("aside").getByRole("button", { name: /^Plugins/ });
check(await row.isVisible(), "there is a row in the sidebar called Plugins");
await row.click();
await p.waitForTimeout(700);
const dlg = p.locator("[role=dialog]");
check(/one part of the app that reaches outside/i.test(await dlg.innerText()), "and it opens on a panel that says what it costs before the field");
check(await dlg.getByLabel("Connector address").isVisible(), "with somewhere to put an address");

console.log("\nA service can be connected, and says what it can do");
await dlg.getByLabel("Connector address").fill("https://localhost:8899/mcp");
await dlg.getByRole("button", { name: "Connect", exact: true }).click();
await p.waitForTimeout(1500);
check(/private network/i.test(await dlg.innerText()), "a private address is refused, and says why", (await dlg.innerText()).split("\n").find((l) => /private/i.test(l)) ?? "");

/* Back to the app itself. */
await p.keyboard.press("Escape");
await p.waitForTimeout(500);


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
