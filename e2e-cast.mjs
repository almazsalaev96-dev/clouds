/**
 * An Armi model is more than one AI, and this is where that is proved.
 *
 * Renaming other people's models would have been packaging. What makes Astro
 * a model rather than a label is that two companies work on the answer: one
 * reads the question and writes down what a good answer has to get right, and
 * the other writes it with that in hand. Nova has a second company check it
 * afterwards. Mizar puts two companies on the same question side by side.
 *
 * None of that can be taken on trust from the interface, so it is read at the
 * wire: which models were called, in which order, and whether what the first
 * one wrote actually turns up inside the second one's request.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock \
 *   OPENAI_BASE_URL=http://127.0.0.1:8787 OPENAI_API_KEY=sk-mock npx next start -p 3100
 *
 * Two providers on purpose: with one, every one of these tactics is supposed
 * to drop its second model rather than buy an echo from a sibling — which is
 * what `e2e-presets.mjs` checks, in the other environment.
 *   node e2e-cast.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const S = { theme: "dark", density: "comfortable", modelId: "astro", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

const wire = async () => await fetch(`${MOCK}/__last`).then((r) => r.json());
const bar = p.getByRole("button", { name: /^Model:/ }).first();
const pick = async (name) => {
  await bar.click();
  await p.waitForTimeout(450);
  await p.getByRole("button", { name: new RegExp(`^${name} —`) }).first().click();
  await p.waitForTimeout(500);
};
const ask = async (q, settle = 3000) => {
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill(q);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(settle);
  return await wire();
};
const line = async (re) => (await p.locator(".msg").last().innerText()).split("\n").find((l) => re.test(l)) ?? "";

const QUESTION = "why would you choose an event-sourced architecture over a CRUD one here";

console.log("\nOne turn, two companies: one says what the answer needs, the other writes it");
{
  const w = await ask(QUESTION);
  const calls = (w.recent ?? []).filter((r) => r.kind !== "title");
  const brief = calls.find((r) => r.kind === "brief");
  const answer = calls.findIndex((r) => r.kind === "answer");
  check(Boolean(brief), "a model is asked what a good answer has to get right, before one exists",
    calls.map((r) => `${r.kind}:${r.model}`).join(" → "));
  check(brief && answer > calls.indexOf(brief), "and it is asked first, which is the whole point",
    calls.map((r) => r.kind).join(" → "));
  check(/sonnet|claude/i.test(w.model ?? ""), "the answer is written by the other company", w.model);
  check(brief && !/claude/i.test(brief.model ?? ""),
    "by a model from a different company, not a sibling of the writer", brief?.model);
}

console.log("\nAnd what the first one wrote reaches the second one");
{
  const w = await wire();
  check(/the trailing edge is not the default/.test(w.systemText ?? ""),
    "the brief is in the request that carries the question");
  check(/a model from a different company read the question/i.test(w.systemText ?? ""),
    "said to be another model's reading of it, not a rule handed down");
  check(/may be wrong/i.test(w.systemText ?? ""),
    "offered as fallible material rather than as an instruction to obey");
  check(/do not mention it/i.test(w.systemText ?? ""),
    "and not as something to talk about — the answer is the answer, not a report on its own making");
}

console.log("\nThe answer says it, rather than leaving you to guess");
{
  const said = await line(/Astro/);
  check(/Astro/.test(said) && /briefed by/i.test(said), "which two models made this one", said.slice(0, 100));
  await p.screenshot({ path: `${OUT}/cast-answer.png` });
}

console.log("\nThe quick one answers first and is checked after");
{
  await pick("Nova");
  const w = await ask("what is a debounce", 6000);
  const calls = (w.recent ?? []).filter((r) => r.kind !== "title");
  const i = calls.findIndex((r) => r.kind === "answer");
  const j = calls.findIndex((r) => r.kind === "verify");
  check(/haiku/i.test(calls[i]?.model ?? ""), "the fast engine writes it", calls[i]?.model);
  check(j > i, "and the check comes after the answer, not before it",
    calls.map((r) => r.kind).join(" → "));
  check(j >= 0 && !/claude/i.test(calls[j]?.model ?? ""),
    "from a company that did not write it", calls[j]?.model);
  const shown = await p.locator(".msg").last().innerText();
  check(/Second opinion/i.test(shown), "and the verdict lands under the answer it is about");
  check(/GPT|Kimi|DeepSeek/.test(shown), "named by the model that gave it",
    (shown.split("\n").find((l) => /mostly agrees|found nothing|disagrees/.test(l)) ?? "").slice(0, 80));
}

console.log("\nAnd where judgement decides, two answers beat one verdict");
{
  await pick("Mizar");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("what should we call this feature");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const shown = await p.locator("main").innerText();
  check(/Comparing 2 models/i.test(shown), "two companies answer the same question, side by side",
    (shown.split("\n").find((l) => /Comparing/i.test(l)) ?? "").slice(0, 80));
  const models = new Set(((await wire()).recent ?? []).filter((r) => r.kind === "answer").map((r) => r.model));
  check(models.size >= 2, "and both of them are really called", [...models].join(" vs "));
  check(/Keep this one|keep the one/i.test(shown), "with the choice left to the person reading them");
  await p.screenshot({ path: `${OUT}/cast-duel.png` });
}

console.log("\nThe menu says who is in the cast, not just who fronts it");
{
  await bar.click();
  await p.waitForTimeout(450);
  const panel = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(/writes/.test(panel) && /duels|answers it as well/i.test(panel),
    "the selected one spells out what each model does", panel.split("\n").slice(-3).join(" · ").slice(0, 100));
  await p.getByRole("button", { name: /^Orion —/ }).first().click();
  await p.waitForTimeout(500);
  await bar.click();
  await p.waitForTimeout(450);
  const orion = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(/briefs it first/i.test(orion) && /checks it after/i.test(orion),
    "and the careful one is three models, each with a different job",
    (orion.split("\n").find((l) => /writes/.test(l)) ?? "").slice(0, 110));
  await p.screenshot({ path: `${OUT}/cast-menu.png` });
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
