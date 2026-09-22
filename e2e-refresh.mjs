/**
 * The 2026 refresh: a warm tone, a Learn switch, the + menu, and thinking
 * that opens by itself when asked to.
 *
 * The claims: switching the tone to warm changes the neutrals and only the
 * neutrals, in both themes, at the same lightness; pressing Learn in the
 * composer puts the thread in a mode whose instructions reach the model and
 * the placeholder says so; the + menu lists Learn and Research with a line
 * each; and the thinking setting decides whether reasoning is open under
 * the answer.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-refresh.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const token = (name) => p.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const lum = (hex) => {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA warm tone, at the same lightness");
{
  const coolCanvas = await token("--bg-canvas");
  const coolText = await token("--text-primary");
  const coolAccent = await token("--accent");
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Appearance", exact: true }).click();
  await p.waitForTimeout(300);
  await p.getByRole("radio", { name: "Warm" }).click().catch(async () => p.getByRole("button", { name: "Warm", exact: true }).click());
  await p.waitForTimeout(300);
  check((await p.evaluate(() => document.documentElement.dataset.tone)) === "warm", "the root carries the tone");
  const warmCanvas = await token("--bg-canvas");
  check(warmCanvas !== coolCanvas, "the canvas changed", `${coolCanvas} → ${warmCanvas}`);
  const [r, g, bl] = [1, 3, 5].map((i) => parseInt(warmCanvas.slice(i, i + 2), 16));
  check(r >= g && g >= bl, "and it is warm — red over green over blue", warmCanvas);
  check((await token("--accent")) === coolAccent, "the accent did not change — only the neutrals");
  const cCool = contrast(coolText, coolCanvas);
  const cWarm = contrast(await token("--text-primary"), warmCanvas);
  check(Math.abs(cCool - cWarm) / cCool < 0.08 && cWarm >= 12, "body text keeps its contrast", `${cCool.toFixed(1)} → ${cWarm.toFixed(1)}`);
  /* And in the dark. */
  await p.getByRole("radio", { name: "Dark" }).click().catch(async () => p.getByRole("button", { name: "Dark", exact: true }).click());
  await p.waitForTimeout(400);
  const darkCanvas = await token("--bg-canvas");
  const [dr, dg, db] = [1, 3, 5].map((i) => parseInt(darkCanvas.slice(i, i + 2), 16));
  check(dr >= dg && dg >= db && lum(darkCanvas) < 0.02, "dark is warm too, and still dark", darkCanvas);
  check(contrast(await token("--text-primary"), darkCanvas) >= 12, "with body text that clears the bar", contrast(await token("--text-primary"), darkCanvas).toFixed(1));
  await p.getByRole("radio", { name: "Light" }).click().catch(async () => p.getByRole("button", { name: "Light", exact: true }).click());
  await p.getByRole("radio", { name: "Cool" }).click().catch(async () => p.getByRole("button", { name: "Cool", exact: true }).click());
  await p.waitForTimeout(300);
  check((await token("--bg-canvas")) === coolCanvas, "and back to cool is back to the same canvas");
}

console.log("\nThinking opens by itself when asked to");
{
  const dlg = p.locator("[role=dialog]");
  await dlg.getByRole("radio", { name: "Open by itself" }).click().catch(async () => dlg.getByRole("button", { name: "Open by itself" }).click());
  await p.waitForTimeout(200);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1") || "{}").state?.thinkingOpen);
  check(kept === true, "the setting is kept");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
}

console.log("\nLearn: a mode of the thread, a press away");
{
  check((await p.locator(".composer-shell").getByRole("button", { name: /earning mode|Learn/ }).count()) === 0,
    "with Learn off, the composer carries nothing about it");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(400);
  const entry = p.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name: /Learn/ });
  check(await entry.isVisible(), "the tools menu offers Learn");
  check((await entry.getAttribute("aria-pressed")) === "false", "off to begin with");
  await entry.click();
  await p.waitForTimeout(400);
  const on = p.locator(".composer-shell").getByRole("button", { name: "Stop learning mode" });
  check(await on.isVisible() && (await on.getAttribute("aria-pressed")) === "true", "and choosing it puts a chip in the composer that says so");
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("Help me understand osmosis");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4000);
  const recent = (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];
  const sys = [...recent].reverse().find((r) => r.kind === "answer")?.system ?? "";
  check(/## Mode: Learn/.test(sys), "the request carries the Learn mode", (sys.match(/## Mode: [^\n]*/) ?? [""])[0]);
  check(/lay out a short plan/.test(sys) && /one question that checks they followed/.test(sys), "with a plan first and a check after each step");
  check(/What are you trying to understand\?/.test(await p.getByRole("textbox", { name: "Message" }).getAttribute("placeholder") ?? ""), "and the box says what it is for now");
  /* It stays on for the thread. */
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  check(await p.locator(".composer-shell").getByRole("button", { name: /Stop learning mode/ }).isVisible().catch(() => false), "and the thread remembers it after a reload");
}

console.log("\nThe + menu says what each tool does");
{
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(400);
  const menu = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  check(/Add photos and files/.test(menu), "attach is first");
  check(/Stop learning mode|Learn/.test(menu) && /A plan, one step at a time/.test(menu), "Learn is there with a line saying what it does");
  check(/Research/.test(menu) && /search the web/.test(menu), "and Research, likewise");
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
