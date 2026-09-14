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
 * thinking budgets, Forge's instruction has to actually be in the request,
 * and every one of them has to say out loud whose model it is running on —
 * an app that renamed Anthropic's and Google's models and hid whose they
 * were would be claiming a laboratory it does not have.
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

const wire = async () => await fetch(`${MOCK}/__last`).then((r) => r.json());
const calls = async () =>
  ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const bar = p.getByRole("button", { name: /^Model:/ }).first();
const openPicker = async () => { await bar.click(); await p.waitForTimeout(450); };

/* Polled rather than slept at: the request going out and a fixed wait
   expiring are different events, and on a first message the last thing on
   the wire is the little call that names the conversation. */
const ask = async (q) => {
  const before = (await wire()).userText ?? "";
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(350);
  await p.locator(".composer-shell textarea").first().fill(q);
  await p.keyboard.press("Enter");
  let sent = null;
  for (let i = 0; i < 60 && !sent; i++) {
    await p.waitForTimeout(150);
    const now = await wire();
    if ((now.userText ?? "") !== before) sent = now;
  }
  await p.waitForTimeout(2400);
  return sent ?? (await wire());
};

const pick = async (name) => {
  await openPicker();
  await p.getByRole("button", { name: new RegExp(`^${name} —`) }).first().click();
  await p.waitForTimeout(500);
};

console.log("\nThe menu offers Armi's own models first, and the engines after");
{
  await openPicker();
  const armi = p.getByText("Armi models", { exact: true }).first();
  const engines = p.getByText("Or an engine directly", { exact: true }).first();
  const a = await armi.boundingBox();
  const e = await engines.boundingBox();
  check(Boolean(a) && Boolean(e) && a.y < e.y, "named tactics above, other people's models below",
    a && e ? `${Math.round(a.y)} above ${Math.round(e.y)}` : "not found");
  check(await p.getByRole("button", { name: /^ARMI One —/ }).isVisible(), "ARMI One is the flagship, and it is first");
  await p.screenshot({ path: `${OUT}/presets-menu.png` });
}

console.log("\nAnd every one of them says whose model it is running on");
{
  const one = await p.getByRole("button", { name: /^ARMI One —/ }).first().innerText();
  check(/Sonnet 4.5/.test(one), "the flagship is Armi's name for a tactic, and the row names the engine", one.replace(/\n/g, " · "));
  const flash = await p.getByRole("button", { name: /^ARMI Flash —/ }).first().innerText();
  check(/Haiku 4.5/.test(flash), "and the quick one runs on a different engine from the everyday one", flash.replace(/\n/g, " · "));
  /* Atlas wants Gemini's million-token window and there is no Google key
     here. It takes the biggest thing it can reach and says so rather than
     quietly becoming an ordinary model under a long-context name. */
  const orbit = await p.getByRole("button", { name: /^ARMI Orbit —/ }).first().innerText();
  check(/Opus 4.5/.test(orbit), "one that cannot have its first choice names its second", orbit.replace(/\n/g, " · "));
  /* Every one of these is two models or three, and on one company's key not
     one of them can be what it says it is. Said on the row rather than
     discovered from a bill. */
  const duet = await p.getByRole("button", { name: /^ARMI Duet —/ }).first().innerText();
  check(/needs a second key/i.test(duet), "and with one key it says it cannot be itself", duet.replace(/\n/g, " · "));
  const footer = await p.locator("text=/writes/").first().innerText();
  check(/Claude/.test(footer), "the menu names who writes", footer.replace(/\n/g, " · "));
  check(/second company/i.test(await p.locator("[role=dialog], [data-radix-popper-content-wrapper]").first().innerText()),
    "and spells out what the missing key would buy");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nThe bar names both: the tactic you chose and the model answering");
{
  const label = await bar.getAttribute("aria-label");
  check(/One/.test(label ?? "") && /Claude Sonnet 4\.5/.test(label ?? ""),
    "which is the one place a rename could mislead somebody", label);
  check(/One/.test(await bar.innerText()), "and the name is what you read at a glance", (await bar.innerText()).replace(/\n/g, " "));
}

console.log("\nWith one company's key, the second model is dropped rather than faked");
{
  /* The whole value of a second model is that it is not the first one. Two
     models from one lab share training data and usually the same blind spot,
     so a brief or a check bought from a sibling is an echo with an invoice.
     Nothing extra goes out here, and nothing claims to have. */
  await pick("ARMI One");
  await fetch(`${MOCK}/__reset`);
  await ask("why would you choose an event-sourced architecture over a CRUD one here");
  const seq = await calls();
  check(!seq.some((r) => r.kind === "brief"),
    "no second call is made to a sibling of the model that is answering",
    seq.map((r) => `${r.kind}:${r.model}`).join(", "));
  const shown = await p.locator(".msg").last().innerText();
  check(/ARMI One|One —|One,/.test(shown) && !/briefed by/i.test(shown),
    "and the answer does not say it was briefed when it was not",
    (shown.split("\n").find((l) => /One/.test(l)) ?? "").slice(0, 80));
}

console.log("\nA name is not a costume: they reach different endpoints");
{
  await pick("ARMI Flash");
  const quick = await ask("what is a debounce");
  check(/haiku/i.test(quick.model ?? ""), "the quick one goes to the quick engine", quick.model);
  check(!quick.thinking, "and does not pay a thinking budget for a one-line question", String(quick.thinking));

  await pick("ARMI Quant");
  const hard = await ask("what is a debounce");
  check(/opus/i.test(hard.model ?? ""), "the careful one goes somewhere that thinks", hard.model);
  /* A budget at all, on a question the quick one answered without one. The
     number itself is capped at half the reply's room rather than by the
     tactic, so asserting a particular ceiling here would be asserting
     `max_tokens`, which is a different setting. */
  check(hard.thinking > 0, "and pays for thinking on the same question the quick one did not", String(hard.thinking));
}

console.log("\nWhat the tactic is for is said to the model, not only to you");
{
  await pick("ARMI Forge");
  const built = await ask("a stopwatch with lap times");
  check(/build the thing rather than describing it/i.test(built.systemText ?? ""),
    "the one that builds is told to build");

  await pick("ARMI Tutor");
  const taught = await ask("what is a debounce");
  check(/explain/i.test(taught.systemText ?? ""), "and the teaching one is told to explain");
  const shown = await p.locator(".msg").last().innerText();
  check(/Tutor/.test(shown) && /Explanatory/i.test(shown),
    "with the answer saying which one wrote it and how", (shown.split("\n").find((l) => /Tutor/.test(l)) ?? "").slice(0, 80));
}

console.log("\nAnd a substitution is never silent");
{
  await pick("ARMI Orbit");
  const long = await ask("summarise the argument for event sourcing");
  check(/opus/i.test(long.model ?? ""), "it answers on the biggest window there is a key for", long.model);
  const shown = await p.locator(".msg").last().innerText();
  check(/Orbit/.test(shown) && /no key for/i.test(shown),
    "and the answer says it could not have the engine it wanted",
    (shown.split("\n").find((l) => /Orbit/.test(l)) ?? "").slice(0, 90));
  await p.screenshot({ path: `${OUT}/presets-answer.png` });
}

console.log("\nThe engines are still there for anyone who wants one");
{
  await openPicker();
  await p.getByRole("textbox", { name: "Search models" }).fill("haiku");
  await p.waitForTimeout(400);
  check(await p.getByText("Claude Haiku 4.5", { exact: true }).first().isVisible(),
    "searching for a model by its own name still finds it");
  /* And searching for an engine finds the tactic that runs on it, which is
     how somebody learns what these names mean without reading anything. */
  check(await p.getByRole("button", { name: /^ARMI Flash —/ }).first().isVisible(),
    "and offers the Armi model that runs on it beside it");
  await p.keyboard.press("Escape");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
