/**
 * Your rules: what it must and must not do, everywhere.
 *
 * The claims: the Rules panel offers presets as switches and a box for your
 * own; what is on rides at the start of every conversation's system prompt,
 * presets and your own lines both, as a list; the composer says how many are
 * in force and is a press from the panel; and the rules hold in the Study
 * room's document reader too, not only in chat.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-rules.mjs
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

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nNothing set, nothing shown");
{
  check((await p.getByRole("button", { name: /rules? in force/ }).count()) === 0, "with no rules the composer says nothing about them");
}

console.log("\nThe panel: presets as switches, and a box for your own");
{
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Rules", exact: true }).click();
  await p.waitForTimeout(300);
  const dlg = p.locator("[role=dialog]");
  check(/None set yet/.test(await dlg.innerText()), "it says none are set");
  const hint = dlg.getByRole("switch", { name: "Hints before answers" });
  check(await hint.isVisible(), "a preset is a switch with the rule as its name");
  check((await hint.getAttribute("aria-checked")) === "false", "off to begin with");
  await hint.click();
  await p.waitForTimeout(200);
  check((await hint.getAttribute("aria-checked")) === "true", "and on when pressed");
  await dlg.getByRole("switch", { name: "British English" }).click();
  await dlg.getByLabel("Your own rules").fill("Always show the units.\nName the exam board as AQA.");
  await p.waitForTimeout(300);
  check(/4 rules are in force/.test(await dlg.innerText()), "the count adds the presets and your own lines", (await dlg.innerText().then((t) => t.match(/\d+ rules? (are|is) in force|One rule is in force/)?.[0])) ?? "no count");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
}

console.log("\nThey ride at the start of every conversation");
{
  const chip = p.getByRole("button", { name: /4 rules in force/ });
  check(await chip.isVisible(), "the composer says how many are in force", (await chip.innerText().catch(() => "")).trim());
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What is a debounce");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(3500);
  /* `__recent` keeps each call's system text; `__last` only says its shape. */
  const recent = (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];
  const sys = [...recent].reverse().find((r) => r.kind === "answer")?.system ?? "";
  check(/## Your rules/.test(sys), "the system prompt carries a rules section", sys.slice(0, 40).replace(/\s+/g, " "));
  check(/- When I am working something out, give a hint before an answer/.test(sys), "with the preset's sentence as a bullet");
  check(/- Use British English spelling/.test(sys), "and the second preset's");
  check(/- Always show the units\./.test(sys) && /- Name the exam board as AQA\./.test(sys), "and each of your own lines as its own bullet");
  const at = sys.indexOf("## Your rules");
  const project = sys.indexOf("## Project");
  check(at > 0 && (project === -1 || at < project), "placed after the house rules and before anything narrower", `at ${at}`);
  /* The chip is a press from the panel. */
  await chip.click();
  await p.waitForTimeout(600);
  check(await p.locator("[role=dialog]").getByRole("switch", { name: "Hints before answers" }).isVisible(), "pressing it opens the Rules panel");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nAnd they hold in the document reader too");
{
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(600);
  await p.getByLabel("A document to work through").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Osmosis moves water across a membrane.") });
  await p.waitForTimeout(1500);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("group", { name: "Ask about this" }).getByRole("button", { name: "Explain this page" }).click();
  await p.waitForTimeout(3500);
  const rec = (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];
  const tsys = [...rec].reverse().find((r) => r.kind === "answer")?.system ?? "";
  check(/## Your rules/.test(tsys) && /Always show the units/.test(tsys), "the tutor's request carries the same rules", tsys.slice(0, 60).replace(/\s+/g, " "));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
