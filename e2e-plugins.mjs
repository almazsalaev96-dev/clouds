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
await b.close();
console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
