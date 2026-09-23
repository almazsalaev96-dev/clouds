/**
 * Armi's own models, which are tactics rather than weights.
 *
 * The picker used to be a shelf of other companies' products, and the
 * question it asked — "which vendor?" — is a question about the industry
 * rather than about the work. Now it asks which *kind of answer* you want,
 * and each name is a tactic: an engine to run on, how hard to think, how to
 * write, and whether a second company checks the result.
 *
 * A rename is the easiest thing in software to fake, so this is read at the
 * wire. Nova and Orion have to reach different endpoints with different
 * thinking budgets, Nova's instruction has to actually be in the request,
 * and a tactic that could not have the cast it wanted has to say so on the
 * row and over the answer — an app that renamed other companies' models and
 * then ran one of them on its own would be claiming a laboratory it does not
 * have. What it does not do any more is print their product names: that a
 * cast is two companies is the claim, and which two is a fact about the keys
 * in this browser.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *
 * One provider on purpose: the interesting case is a tactic that cannot have
 * the engine it prefers, which is what most people's keys look like.
 *   node e2e-presets.mjs
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

/* The registry, read by the probe for the claims that are about a model's
   capabilities rather than about its name. */
const { MODELS: ENGINES } = await import("./lib/models.ts");
const wire = async () => await fetch(`${MOCK}/__last`).then((r) => r.json());
const calls = async () =>
  ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const bar = p.getByRole("button", { name: /^Model:/ }).first();
const openPicker = async () => { await bar.click(); await p.waitForTimeout(450); };

/* Polled rather than slept at: the request going out and a fixed wait
   expiring are different events, and on a first message the last thing on
   the wire is the little call that names the conversation. */
/**
 * Ask, and hand back the call that *answered* it.
 *
 * Not the last call on the wire: an Armi model is two or three, so by the
 * time an answer has landed the most recent request is usually a brief for
 * the next thing or a verdict on this one. Every claim below is about the
 * request that carried the question.
 */
const ask = async (q) => {
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await fetch(`${MOCK}/__reset`);
  await p.locator(".composer-shell textarea").first().fill(q);
  await p.keyboard.press("Enter");
  let answer = null;
  for (let i = 0; i < 70 && !answer; i++) {
    await p.waitForTimeout(150);
    answer = (await calls()).filter((r) => r.kind === "answer").pop() ?? null;
  }
  /* The request has gone out; the answer it produces has not arrived yet,
     and half of what is asserted here is drawn on the answer. */
  await p.waitForTimeout(2600);
  return answer ?? {};
};

const pick = async (name) => {
  await openPicker();
  await p.getByRole("button", { name: new RegExp(`^${name} —`) }).first().click();
  await p.waitForTimeout(500);
};

console.log("\nThe menu offers Armi's own models, and nobody else's");
{
  await openPicker();
  const armi = p.getByText("Armi models", { exact: true }).first();
  const job = p.getByText("For a particular job", { exact: true }).first();
  const a = await armi.boundingBox();
  const j = await job.boundingBox();
  check(Boolean(a) && Boolean(j) && a.y < j.y, "the five for anything above the six for one thing",
    a && j ? `${Math.round(a.y)} above ${Math.round(j.y)}` : "not found");
  check(await p.getByRole("button", { name: /^ARMI Polaris —/ }).isVisible(), "ARMI Polaris is the flagship, and it is first");
  /* The heading this replaces was "Or an engine directly", and under it was
     every model this app can call, by its maker's name — which made Armi's
     own models read as a skin over somebody else's catalogue. */
  check((await p.getByText("Or an engine directly", { exact: true }).count()) === 0,
    "and there is no shelf of other companies' products under them");
  const menu = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(!/Claude|GPT|Kimi|DeepSeek|Sonnet|Haiku|Opus|Gemini/.test(menu),
    "nor one of their names anywhere in the menu", menu.replace(/\n/g, " · ").slice(0, 90));
  /* One key, every model. The menu lists an Armi model only when this
     browser's keys can run it — so the claim worth measuring, with one
     company's key in, is that the filter takes nothing away. A short cast
     is not a missing one: it substitutes within the company and says so on
     the row. Only a hard requirement hides a row, and all four companies
     carry a model that can see. */
  const rows = await p.locator("[data-radix-popper-content-wrapper]").first().getByRole("button", { name: / — / }).count();
  check(rows === 11, "all eleven are offered on one company's key", `${rows} rows`);
  check(!/more appear/.test(menu), "so nothing says any are waiting on a second key");
  await p.screenshot({ path: `${OUT}/presets-menu.png` });
}

console.log("\nEvery row says what it is for, not which company it rents");
{
  const one = await p.getByRole("button", { name: /^ARMI Polaris —/ }).first().innerText();
  check(/two models deep/i.test(one), "the flagship says what it is", one.replace(/\n/g, " · "));
  check(!/Claude|GPT|Kimi|DeepSeek|Sonnet|Haiku|Opus/.test(one),
    "and does not put another company's name in the row", one.replace(/\n/g, " · "));
  const flash = await p.getByRole("button", { name: /^ARMI Pulsar —/ }).first().innerText();
  check(/checked after/i.test(flash), "the quick one says what it does differently", flash.replace(/\n/g, " · "));
  /* Every one of these is two models or three, and on one company's key not
     one of them is the independent pair it would otherwise be. Said on the
     row, because that is the part a person is choosing between. */
  const duet = await p.getByRole("button", { name: /^ARMI Binary —/ }).first().innerText();
  check(/one company/i.test(duet), "and with one key it says both models come from one company", duet.replace(/\n/g, " · "));
  const panel = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(/One model writes/.test(panel), "the menu says what the cast does", (panel.split("\n").find((l) => /One model writes/.test(l)) ?? "").slice(0, 90));
  check(/sibling/i.test(panel) && /second key/i.test(panel),
    "and that the second model here is a sibling, with what would fix it",
    (panel.split("\n").find((l) => /sibling/i.test(l)) ?? "").slice(0, 90));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nThe bar says the name you picked");
{
  const label = await bar.getAttribute("aria-label");
  check(/ARMI Polaris/.test(label ?? ""), "which is the name the person chose", label);
  check(!/Claude|Sonnet/.test(label ?? ""), "and not the engine it happens to rent today", label);
  check(/Polaris/.test(await bar.innerText()), "and the same at a glance", (await bar.innerText()).replace(/\n/g, " "));
}

console.log("\nWith one company's key it is still two models, and it says which kind");
{
  /* Minimum two models in one Armi model — that is the rule, and it holds on
     one key. What changes is what can be claimed: a sibling reading the
     question first is still a second reading, and it is not the independent
     opinion two companies would give, so the menu and the answer both say
     "sibling" rather than quietly selling one as the other. */
  await pick("ARMI Polaris");
  await fetch(`${MOCK}/__reset`);
  await ask("why would you choose an event-sourced architecture over a CRUD one here");
  const seq = await calls();
  const brief = seq.find((r) => r.kind === "brief");
  const answer = seq.find((r) => r.kind === "answer");
  check(Boolean(brief), "a second model is still asked what the answer must cover",
    seq.map((r) => `${r.kind}:${r.model}`).join(", "));
  check(brief && brief.model !== answer?.model,
    "a different model from the one writing — never the same weights twice",
    `${brief?.model} → ${answer?.model}`);
  const shown = await p.locator(".msg").last().innerText();
  check(/ARMI Polaris/.test(shown), "the answer is credited to the model that was picked",
    (shown.split("\n").find((l) => /ARMI Polaris/.test(l)) ?? "").slice(0, 60));
  check(/briefed first by another model/i.test(shown),
    "and says a second model read the question first — which on one key is a sibling",
    (shown.split("\n").find((l) => /briefed first/i.test(l)) ?? "").slice(0, 90));
}

console.log("\nA name is not a costume: they reach different endpoints");
{
  await pick("ARMI Pulsar");
  const quick = await ask("what is a debounce");
  check(/haiku/i.test(quick.model ?? ""), "the quick one goes to the quick engine", quick.model);
  check(!quick.thinking && quick.effort !== "high" && quick.effort !== "medium",
    "and does not buy a think for a one-line question", `budget=${quick.thinking} effort=${quick.effort}`);

  await pick("ARMI Parallax");
  const hard = await ask("what is a debounce");
  check(/opus/i.test(hard.model ?? ""), "the careful one goes somewhere that thinks", hard.model);
  /* A budget at all, on a question the quick one answered without one. The
     number itself is capped at half the reply's room rather than by the
     tactic, so asserting a particular ceiling here would be asserting
     `max_tokens`, which is a different setting. */
  /* Either shape counts. Anthropic asks for thinking with a token budget on
     the models that take one and with a word on the models that replaced
     them, and this claim is about the tactic buying a think rather than about
     which of the two wire shapes the engine it landed on happens to speak. */
  check(hard.thinking > 0 || hard.effort === "high",
    "and buys one on the same question the quick one did not",
    `budget=${hard.thinking} effort=${hard.effort}`);
}

console.log("\nAnd the name over an answer being written is the model writing it");
{
  /* The header over a streaming answer was drawn from whatever the picker
     held, and `getModel` answers the app default for an id it does not know —
     so every Armi model, and Auto, said "Claude Sonnet 4.5" for the whole of
     an answer somebody else was writing, and the finished message then
     replaced it with the truth. Read *during* the stream, which is the only
     moment the claim exists. */
  await pick("ARMI Pulsar");
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await p.locator(".composer-shell textarea").first().fill("what is a debounce");
  await p.keyboard.press("Enter");
  let live = "";
  for (let i = 0; i < 40 && !live; i++) {
    await p.waitForTimeout(50);
    const t = await p.locator(".live-ring").first().innerText().catch(() => "");
    if (t.trim()) live = t;
  }
  check(/ARMI Pulsar/.test(live), "the model you picked is named while it is writing", live.split("\n")[0] ?? "nothing");
  check(!/Claude|Sonnet|Haiku/.test(live),
    "and the same name it will carry once written — not a different author halfway through",
    live.split("\n")[0] ?? "");
  await p.waitForTimeout(2500);
}

console.log("\nWhat the tactic is for is said to the model, not only to you");
{
  await pick("ARMI Nova");
  const built = await ask("a stopwatch with lap times");
  check(/build the thing rather than describing it/i.test(built.system ?? ""),
    "the one that builds is told to build");

  await pick("ARMI Orrery");
  const taught = await ask("what is a debounce");
  check(/explain/i.test(taught.system ?? ""), "and the teaching one is told to explain");
  const shown = await p.locator(".msg").last().innerText();
  check(/Orrery/.test(shown) && /Explanatory/i.test(shown),
    "with the answer saying which one wrote it and how", (shown.split("\n").find((l) => /Orrery/.test(l)) ?? "").slice(0, 80));
}

console.log("\nAnd a substitution is never silent");
{
  await pick("ARMI Aperture");
  const long = await ask("summarise the argument for event sourcing");
  /* Asserted as a property, not as a name. This read `/opus/` from when the
     widest Anthropic window belonged to one model; every current one holds a
     million now, so the tactic takes the cheapest of the models that are
     equally wide — which is the right answer and was not the expected one. */
  const room = Math.max(...ENGINES.filter((m) => m.provider === "anthropic").map((m) => m.contextWindow));
  const got = ENGINES.find((m) => m.id === long.model);
  check(got?.contextWindow === room, "it answers on the biggest window there is a key for",
    `${long.model} holds ${got?.contextWindow}, the widest here is ${room}`);
  const shown = await p.locator(".msg").last().innerText();
  check(/Aperture/.test(shown) && /no key for/i.test(shown),
    "and the answer says it could not have the engine it wanted",
    (shown.split("\n").find((l) => /Aperture/.test(l)) ?? "").slice(0, 90));
  await p.screenshot({ path: `${OUT}/presets-answer.png` });
}

console.log("\nAnd what it is doing is said where a person goes to look");
{
  /* The whole rebrand rests on this. The names on screen are Armi's, and an
     app whose names were all it said would be claiming a laboratory it does
     not have — so the one place people go to read about the models says, in
     its own words, that it trained none of them, that each one is a cast of
     two or three from different companies, and that which companies those
     are is decided by the keys on the next tab. Everything a person needs to
     know is there. Their product names are not, and are not the disclosure:
     a name means nothing to somebody who has not heard it, and to somebody
     who has it reads as an endorsement nobody gave. */
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Settings/ }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Model$/ }).first().click();
  await p.waitForTimeout(500);
  const panel = await p.locator("[role=dialog]").first().innerText();
  check(/trains no models of its own/i.test(panel),
    "it says plainly that it trained none of them",
    (panel.split("\n").find((l) => /trains no models/i.test(l)) ?? "").slice(0, 90));
  check(/ARMI Polaris/.test(panel) && /ARMI Nova/.test(panel), "and lists every one of them");
  check(/different companies/.test(panel) && /Keys tab/.test(panel),
    "saying a cast is several companies and where that is decided",
    (panel.split("\n").find((l) => /Keys tab/.test(l)) ?? "").slice(0, 100));
  check(/writes/.test(panel) && /an answer/.test(panel),
    "with what each does and what a turn costs");
  check(!/Claude|GPT|Kimi|DeepSeek|Sonnet|Haiku|Opus|Gemini/.test(panel),
    "and nobody else's product name on the page");
  await p.screenshot({ path: `${OUT}/presets-settings.png` });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
}

console.log("\nA name somebody arrives with still finds the model that uses it");
{
  /* The one thing lost by taking the engines off the menu is the person who
     came here having read a model's name somewhere and types it in. They are
     not turned away with "No model matches that": the name is matched, at
     the bottom of the scale, and what comes back is the Armi model that runs
     on it — which is how somebody learns our name for it. Matching a word is
     not displaying it, and nothing on screen says the word back. */
  await openPicker();
  await p.getByRole("textbox", { name: "Search models" }).fill("haiku");
  await p.waitForTimeout(400);
  check(await p.getByRole("button", { name: /^ARMI Pulsar —/ }).first().isVisible(),
    "typing an engine's name lands on the Armi model that rents it");
  const results = await p.locator("[data-radix-popper-content-wrapper]").first().innerText();
  check(!/haiku/i.test(results), "and the name is not echoed back at them", results.replace(/\n/g, " · ").slice(0, 80));
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
