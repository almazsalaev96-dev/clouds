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

const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

const wire = async () => await fetch(`${MOCK}/__last`).then((r) => r.json());
/* Every call since the last reset, in order. `/__last` is only ever the most
   recent one, and the claim being made here is about a sequence. */
const calls = async () =>
  ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
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
  const seq = await calls();
  const brief = seq.find((r) => r.kind === "brief");
  const answer = seq.findIndex((r) => r.kind === "answer");
  check(Boolean(brief), "a model is asked what a good answer has to get right, before one exists",
    seq.map((r) => `${r.kind}:${r.model}`).join(" → "));
  check(brief && answer > seq.indexOf(brief), "and it is asked first, which is the whole point",
    seq.map((r) => r.kind).join(" → "));
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
  const said = await line(/ARMI One/);
  check(/ARMI One/.test(said) && /briefed by/i.test(said), "which two models made this one", said.slice(0, 100));
  await p.screenshot({ path: `${OUT}/cast-answer.png` });
}

console.log("\nThe quick one answers first and is checked after");
{
  await pick("ARMI Flash");
  await ask("what is a debounce", 6000);
  const seq = await calls();
  const i = seq.findIndex((r) => r.kind === "answer");
  const j = seq.findIndex((r) => r.kind === "verify");
  check(/haiku/i.test(seq[i]?.model ?? ""), "the fast engine writes it", seq[i]?.model);
  check(j > i, "and the check comes after the answer, not before it", seq.map((r) => r.kind).join(" → "));
  check(j >= 0 && !/claude/i.test(seq[j]?.model ?? ""),
    "from a company that did not write it", seq[j]?.model);
  const shown = await p.locator(".msg").last().innerText();
  check(/Second opinion/i.test(shown), "and the verdict lands under the answer it is about");
  check(/GPT|Kimi|DeepSeek/.test(shown), "named by the model that gave it",
    (shown.split("\n").find((l) => /mostly agrees|found nothing|disagrees/.test(l)) ?? "").slice(0, 80));
}

console.log("\nAnd where judgement decides, two answers beat one verdict");
{
  await pick("ARMI Duet");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("what should we call this feature");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  const shown = await p.locator("main").innerText();
  check(/Comparing 2 models/i.test(shown), "two companies answer the same question, side by side",
    (shown.split("\n").find((l) => /Comparing/i.test(l)) ?? "").slice(0, 80));
  const models = new Set((await calls()).filter((r) => r.kind === "answer").map((r) => r.model));
  check(models.size >= 2, "and both of them are really called", [...models].join(" vs "));
  check(/Keep this one|keep the one/i.test(shown), "with the choice left to the person reading them");
  await p.screenshot({ path: `${OUT}/cast-duel.png` });
}

console.log("\nThe council is three jobs and one answer, not three drafts");
{
  /* The most this app can bring to one question, and the one thing in it
     that four models can do and one cannot: three companies each take a
     different half — the strategy, the reasoning, what is actually known —
     and a fourth writes one answer out of the three. */
  await pick("ARMI Council");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("should we rebuild this service or refactor what is already there");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(6000);
  const seq = await calls();
  const seats = seq.filter((r) => r.kind === "council");
  check(seats.length === 3, "three seats are filled", seq.map((r) => `${r.kind}:${r.model}`).join(" → "));
  /* Two companies here, so one of them takes two seats — different models,
     different jobs. What must never happen is a seat going to the model that
     is about to write the answer. */
  const answer = seq.find((r) => r.kind === "answer");
  check(!seats.some((r) => r.model === answer?.model),
    "and none of them is the model that writes the answer", answer?.model);
  check(seq.indexOf(seats[seats.length - 1]) < seq.indexOf(answer),
    "the council sits before the answer is written", seq.map((r) => r.kind).join(" → "));

  /* The synthesis is the *first* answer: this tactic checks what it wrote and
     sends it round again, so the last request on the wire is a verdict and
     the one after that is a second draft. `/__last` cannot see any of it. */
  const synth = seq.find((r) => r.kind === "answer")?.system ?? "";
  check(/three other models/i.test(synth), "and its work reaches the model that writes");
  const halves = ["strategy", "logic", "knowledge"].filter((h) => new RegExp(`- ${h}:`).test(synth));
  check(halves.length === 3, "all three halves of it, each a different asking", halves.join(", "));
  check(/genuinely disagree/i.test(synth),
    "with the writer told to surface disagreement rather than average it away");
  check(/do not mention that any of this happened/i.test(synth),
    "and to write an answer rather than a report on its own making");
  /* What is on screen is the second draft, and its line is the truth about
     *it*: this tactic, answered again. The council is not claimed twice —
     the revision did not convene one, and the first draft, which did, is
     still there under ‹1/2›. */
  const shown = await p.locator("main").innerText();
  check(/ARMI Council/.test(shown) && /answered again/.test(shown),
    "and the answer says which tactic wrote it and that it went round twice",
    (shown.split("\n").find((l) => /ARMI Council/.test(l)) ?? "").slice(0, 110));
  check(!/3 models consulted/.test(shown),
    "without claiming a council the second draft did not hold");
  await p.screenshot({ path: `${OUT}/cast-council.png` });
}

console.log("\nAnd an objection is answered rather than printed under the answer");
{
  /* The difference between a critique and a correction. A verdict on its own
     is a report — "the second paragraph is wrong", sitting under an answer
     that is still wrong, leaving the reader to do the work. On the tactics
     where being wrong costs something the writer is handed the objection and
     answers again, which is what the second model was for. */
  await pick("ARMI Quant");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill("how does a debounce actually work, and when is it wrong");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(12000);

  const seq = await calls();
  const kinds = seq.map((r) => r.kind);
  const verify = kinds.indexOf("verify");
  check(verify > 0, "the answer is checked by a second company", kinds.join(" → "));
  check(kinds.slice(verify).includes("answer"),
    "and the objection sends it back to the model that wrote it", kinds.join(" → "));

  /* The claim is about the *second* answer, which by the time the dust
     settles is two requests old — `/__last` cannot see it. */
  const again = seq.filter((r) => r.kind === "answer").pop();
  check(/does not fully agree/i.test(again?.system ?? ""), "which is told what the objection was");
  check(/> But the second paragraph calls the trailing edge the default/.test(again?.system ?? ""),
    "quoted rather than paraphrased — the claim in conflict, exactly, and marked as somebody else's words");
  check(/Where the objection is wrong, keep what you had/.test(again?.system ?? ""),
    "and is not told to agree: a second model is not a truth machine");
  check(kinds.filter((k) => k === "brief").length === 1,
    "and the brief is not bought twice — it is a reading of the question, which has not changed",
    kinds.join(" → "));

  /* Two answers to one question, the older one still reachable. */
  const shown = await p.locator("main").innerText();
  check(/2\/2|1\/2/.test(shown), "the first answer is not thrown away", (shown.match(/\d\/\d/) ?? ["none"])[0]);
  await p.screenshot({ path: `${OUT}/cast-objection.png` });
}

console.log("\nThe menu says who is in the cast, not just who fronts it");
{
  await pick("ARMI Council");
  await bar.click();
  await p.waitForTimeout(450);
  const panel = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(/writes/.test(panel) && /on strategy/i.test(panel),
    "the selected one spells out which half of the question each model took",
    (panel.split("\n").find((l) => /writes/.test(l)) ?? "").slice(0, 110));
  /* The arithmetic nobody can do in their head: three models a turn is the
     fact that decides whether somebody wants this one, and it is not
     discoverable from a price per million tokens. */
  check(/models a turn/.test(panel) && /an answer/.test(panel),
    "and what a turn of it costs, counted in models and in money",
    (panel.split("\n").find((l) => /models a turn/.test(l)) ?? "").slice(0, 80));
  await p.getByRole("button", { name: /^ARMI Quant —/ }).first().click();
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
