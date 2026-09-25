/**
 * Slides are a thing that runs, and reading can be made easier.
 *
 *   node mock-provider.mjs &  ANTHROPIC_BASE_URL=… npx next start -p 3100
 *   node e2e-slides.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\n“/slides” asks for a deck that runs");
{
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("/slides the water cycle");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(5000);
  const { recent } = await fetch(`${MOCK}/__recent`).then((r) => r.json());
  const answer = recent.find((r) => r.kind === "answer");
  check(Boolean(answer), "the question is sent", recent.map((r) => r.kind).join(" → "));
  check(/slide deck as one HTML document/i.test(answer?.system ?? ""), "and the model is told how a deck is built: one section a slide, arrow keys, print to PDF");
  check(/section class=\\?"slide\\?"/.test(answer?.system ?? "") && /page-break-after/.test(answer?.system ?? ""), "with the slide element and the print rule named");
  const user = await p.locator(".msg").first().innerText();
  check(/Make a slide deck on: the water cycle/.test(user), "the message kept says what was asked for", user.replace(/\s+/g, " ").slice(0, 60));
  await p.locator(".composer-shell textarea").first().fill("/");
  await p.waitForTimeout(250);
  const all = await p.getByRole("listbox", { name: "Commands" }).getByRole("option").allInnerTexts();
  check(all.some((t) => /^\/slides/.test(t)), "and the command is listed with the others", all.map((t) => t.split("\n")[0]).filter((t) => /slides|image/.test(t)).join(" · "));
  await p.locator(".composer-shell textarea").first().fill("");
}

console.log("\nEasier reading is a switch in Appearance, and it reaches the root");
{
  await p.keyboard.press("Control+,");
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Appearance$/ }).first().click();
  await p.waitForTimeout(400);
  const panel = await p.locator("[role=dialog]").first().innerText();
  check(/Easier reading/.test(panel) && /dyslexia/i.test(panel), "the panel offers it and says who it is for");
  const before = await p.evaluate(() => document.documentElement.dataset.ease ?? "");
  await p.locator("[role=dialog]").getByRole("radio", { name: "On" }).first().click().catch(async () => { await p.locator("[role=dialog]").getByRole("button", { name: "On" }).first().click(); });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ ease: document.documentElement.dataset.ease ?? "", spacing: getComputedStyle(document.documentElement).letterSpacing, font: getComputedStyle(document.body).fontFamily }));
  check(before === "" && after.ease === "on", "switching it on marks the root", `${before || "off"} → ${after.ease}`);
  check(after.spacing !== "normal" && /Verdana|Atkinson/.test(after.font), "and the letters spread in a plain face", `${after.spacing} · ${after.font.slice(0, 40)}`);
  await p.reload({ waitUntil: "networkidle" });
  check((await p.evaluate(() => document.documentElement.dataset.ease ?? "")) === "on", "and it is on again before the first paint after a reload");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
