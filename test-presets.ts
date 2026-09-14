/* Armi's own models, each of which is more than one AI.
 *
 * The interesting assertions here are the honest ones. A named model that
 * quietly ran on whatever was cheapest, or that claimed a second opinion it
 * never got, or that bought one from a sibling of the model it was meant to
 * be checking, would be a lie the picker tells on every turn. So each is
 * checked: the substitution is made *and* said, and a cast member always
 * comes from a different company or does not come at all.
 *
 *   npx jiti test-presets.ts */
import {
  PRESETS, DEFAULT_PRESET_ID, getPreset, isPreset, resolveCast, resolvePreset, engineOf,
  playerFor, playersFor, profileOf, shapePlan, worthBriefing, worthConvening, briefPrompt,
  briefNote, councilPrompt, councilNote, makers,
} from "./lib/presets";
import { planTurn } from "./lib/decide";
import { MODELS } from "./lib/models";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const all = { anthropic: true, openai: true, moonshot: true, deepseek: true };
const only = (p: string) => ({ anthropic: false, openai: false, moonshot: false, deepseek: false, [p]: true });
const spec = (id: string) => MODELS.find((m) => m.id === id)!;
const engine = (id: string, where: Parameters<typeof resolveCast>[1]) => resolveCast(id, where)!.answer.modelId;

console.log("\nEvery tactic names engines that exist");
{
  const known = new Set(MODELS.map((m) => m.id));
  const bad = PRESETS.flatMap((p) =>
    [...p.engines, ...p.cast.flatMap((c) => c.engines)].filter((e) => !known.has(e)).map((e) => `${p.id}:${e}`),
  );
  check(bad.length === 0, "a preset pointing at a model that is not in the registry is unpickable", bad.join(", "));
  const ids = PRESETS.map((p) => p.id);
  check(new Set(ids).size === ids.length, "and no two share an id");
  /* A preset id that collides with a model id would make `getModel` and
     `getPreset` disagree about what the picker is holding. */
  check(!ids.some((id) => known.has(id)), "and none of them is also a model id");
  check(isPreset(DEFAULT_PRESET_ID), "and a fresh install opens on one that is there", DEFAULT_PRESET_ID);
  check(PRESETS.filter((x) => x.group === "everyday").length === 5 && PRESETS.length === 11,
    "five for anything and six for one thing", `${PRESETS.length} in all`);
  check(PRESETS.every((x) => x.name.startsWith("ARMI ") && !x.short.includes(" ")),
    "and all of them say the product once and the job once", PRESETS.map((x) => x.short).join(", "));
  check(PRESETS.every((x) => x.examples.length >= 2),
    "and every one of them says what it is the right answer to");
}

console.log("\nNot one of them is a single model");
{
  check(PRESETS.every((p) => p.cast.length >= 1), "every Armi model has somebody else in it");
  for (const p of PRESETS) {
    const c = resolveCast(p.id, { configured: all })!;
    const names = [c.answer.modelId, ...c.parts.map((x) => x.modelId)];
    check(c.parts.length === p.cast.length && new Set(names).size === names.length,
      `${p.name} is ${names.length} models, all different`, names.join(" + "));
  }
}

console.log("\nAnd the second one always comes from a different company");
{
  /* The whole value of a second model is that it is not the first one. Two
     models from one lab share training data, a house style and usually the
     same blind spot, so a check from a sibling is an echo with an invoice. */
  for (const p of PRESETS) {
    const c = resolveCast(p.id, { configured: all })!;
    const home = spec(c.answer.modelId).provider;
    check(c.parts.every((x) => spec(x.modelId).provider !== home && !x.sameCompany),
      `${p.name}: nobody in the cast shares a company with the writer`,
      c.parts.map((x) => spec(x.modelId).provider).join(", ") || "none");
  }
  /* And where there is a choice, it is taken: a rival before a sibling. */
  const two = resolveCast("one", { configured: { anthropic: true, openai: true } })!;
  check(two.parts.every((x) => !x.sameCompany) && !two.short,
    "two keys are enough for the whole cast to come from elsewhere",
    two.parts.map((x) => x.modelId).join(", "));
}

console.log("\nWith one company's key it still fields a cast, and says what kind");
{
  /* The rule the person set: minimum two models in one Armi model. So a
     browser holding one company's key gets a sibling rather than nothing —
     a different set of weights reading the question first is still a second
     reading — and the row says it is a sibling, because that is not the
     independence a check would otherwise be claiming. */
  for (const p of PRESETS) {
    const c = resolveCast(p.id, { configured: only("anthropic") })!;
    check(c.parts.length >= 1, `${p.name} is still more than one model on one key`,
      [c.answer.modelId, ...c.parts.map((x) => x.modelId)].join(" + "));
    check(c.parts.every((x) => x.modelId !== c.answer.modelId),
      `${p.name} never puts the same model in two seats`);
    check(Boolean(c.short), `${p.name} says what a second key would buy`, c.short ?? "said nothing");
  }
  const kin = resolveCast("one", { configured: only("anthropic") })!;
  check(kin.parts.every((x) => x.sameCompany), "and marks the seats that went to a sibling");
  check(/sibling/.test(kin.short ?? ""), "in words, not only in a flag", kin.short ?? "");
  check(makers({ configured: only("anthropic") }).length === 1, "which is what one key means");
  check(makers({ configured: all }).length === 4, "and four keys are four companies");
}

console.log("\nIt runs on whatever key you actually hold");
{
  for (const p of PRESETS) {
    for (const maker of ["anthropic", "openai", "moonshot", "deepseek"]) {
      const got = resolveCast(p.id, { configured: only(maker) })!;
      check(spec(got.answer.modelId).provider === maker, `${p.name} on a ${maker} key answers on ${maker}`, got.answer.modelId);
    }
  }
}

console.log("\nEach one is actually a different tactic");
{
  const fast = engine("flash", { configured: all });
  const deep = engine("quant", { configured: all });
  const long = engine("orbit", { configured: all });
  check(fast !== deep, "the quick one and the careful one are not the same model", `${fast} vs ${deep}`);
  check(spec(long).contextWindow === Math.max(...MODELS.map((m) => m.contextWindow)),
    "the one for long documents takes the biggest window there is", long);
  check(getPreset("flash")!.effort === "low" && getPreset("quant")!.effort === "high",
    "and they think as hard as their names promise");
  check(getPreset("quant")!.cast.length === 2, "the careful one puts three companies on one question");
}

console.log("\nAnd says so when it could not have what it wanted");
{
  const first = resolveCast("orbit", { configured: only("openai") })!.answer;
  check(!first.substituted && !first.why, "its first choice is offered without an excuse", first.modelId);
  const second = resolveCast("orbit", { configured: only("deepseek") })!.answer;
  check(second.substituted && /no key/i.test(second.why),
    "and anything else is named along with the reason", `${second.modelId} — ${second.why}`);
}

console.log("\nA requirement beats the tactic, because an answer to an unread question is not an answer");
{
  /* DeepSeek and Kimi K2 Thinking cannot see. Nova would take one on price
     and must not, when there is a picture in the message. */
  const seeing = resolveCast("flash", { configured: { deepseek: true, anthropic: true }, hasImage: true })!.answer;
  check(spec(seeing.modelId).vision, "an image rules out the engines without eyes", seeing.modelId);
  check(/image/i.test(seeing.why), "and the row says why that one", seeing.why);

  /* Three hundred thousand tokens does not fit a 200k window, whatever the
     tactic prefers. */
  const big = resolveCast("flash", { configured: all, size: 300_000 })!.answer;
  check(spec(big.modelId).contextWindow > 300_000, "and a long thread rules out the small windows", big.modelId);
  check(/long/i.test(big.why), "said in tokens rather than in silence", big.why);
}

console.log("\nWith no key at all it still names an engine");
{
  const none = resolveCast("one", { configured: {} })!;
  check(Boolean(none.answer.modelId) && /no key/i.test(none.answer.why),
    "so the failure that follows is about the missing key", `${none.answer.modelId} — ${none.answer.why}`);
}

console.log("\nAnything that is not a preset passes straight through");
{
  check(resolveCast("claude-opus-4-5", { configured: all }) === null, "a model id is not a preset");
  check(resolveCast("auto", { configured: all }) === null, "and neither is Auto");
  check(engineOf("claude-opus-4-5", { configured: all }) === "claude-opus-4-5", "and it comes back unchanged");
  check(resolvePreset("gpt-5.1", { configured: all }) === null && !isPreset("gpt-5.1"),
    "which is what the picker asks before it draws a row");
}

console.log("\nThe brief is asked for the shape of an answer, not for an answer");
{
  const q = briefPrompt("why is the sky blue");
  check(/not answering it/i.test(q), "the second model is told it is not the one answering");
  check(/why is the sky blue/.test(q), "and given the question");
  check(briefNote("- check the wavelength").includes("do not mention it"),
    "and what comes back is material, not an instruction to obey");
  check(/may be wrong/i.test(briefNote("x")), "offered as fallible, because it is");
}

console.log("\nAnd it is not bought for a one-liner");
{
  const plan = planTurn("thanks");
  check(!worthBriefing("thanks", plan), "a second call before 'thanks' is a second bill for nothing");
  check(!worthBriefing("what is 2+2", planTurn("948392 × 73", { computed: true })), "and a sum needs no brief at all");
  check(worthBriefing("why would you choose an event-sourced architecture here", plan),
    "a real question gets one");
}

console.log("\nThe tactic shapes the turn");
{
  const cast = resolveCast("quant", { configured: all });
  const plain = planTurn("what should I have for lunch", { autoStyle: true });
  check(plain.effort === undefined, "an easy question asks for no particular effort", String(plain.effort));
  check(shapePlan(plain, getPreset("quant"), { autoStyle: true, cast }).effort === "high",
    "picking the careful one means it thinks hard about whatever comes next");
  check(shapePlan(plain, getPreset("flash"), { autoStyle: true }).effort === "low",
    "and picking the quick one means it does not");

  const sage = shapePlan(plain, getPreset("tutor"), { autoStyle: true });
  /* The name is already on that line when this is drawn, so the reason does
     not repeat it: "Sage · Explanatory, because that is what it is for". */
  check(sage.register?.id === "explanatory" && Boolean(sage.register?.why),
    "the teaching one explains, and says why it is explaining", sage.register?.why);

  /* Said outright beats the tactic: somebody who asks for it short has told
     the app something about this turn, which is narrower than a preference
     they set an hour ago. */
  const asked = planTurn("quickly, what is a debounce", { autoStyle: true });
  check(asked.register?.id === "concise", "the request itself reads as concise", asked.register?.id);
  check(shapePlan(asked, getPreset("tutor"), { autoStyle: true }).register?.id === "concise",
    "and the tactic does not overrule what they just asked for");

  /* And a style they chose themselves is not touched at all. */
  const chosen = planTurn("what is a debounce", { autoStyle: false });
  check(shapePlan(chosen, getPreset("tutor"), { autoStyle: false }).register === null,
    "nor a style they picked on purpose");
}

console.log("\nAnd the check is real, or it is not claimed");
{
  const code = planTurn("write a function that debounces calls");
  const both = shapePlan(code, getPreset("forge"), { cast: resolveCast("forge", { configured: all }) });
  check(both.check === "second" && /Forge/.test(both.why), "with two companies, one checks the other", both.why);
  /* With one company there is still a check — the rule is two models, always
     — but it is a sibling, and everything that draws it says so rather than
     selling it as an independent opinion. */
  const alone = resolveCast("forge", { configured: only("anthropic") })!;
  const kin = playerFor(alone, "check");
  check(Boolean(kin) && kin!.sameCompany === true, "with one company it is a sibling that checks", kin?.modelId);
  check(kin!.modelId !== alone.answer.modelId,
    "never the model that wrote the answer, which would be an echo of an echo");
  check(/sibling/.test(alone.short ?? ""), "and the row says which kind of check it is", alone.short ?? "");

  /* A layout is not a thing a second model can settle: what comes back is
     another opinion about taste, charged as a verdict. The list of what can
     be settled lives in `decide.ts` and this reads it rather than keeping a
     second copy that drifts. */
  const look = shapePlan(planTurn("design a landing page layout for a bakery"), getPreset("quant"), {
    cast: resolveCast("quant", { configured: all }),
  });
  check(look.check !== "second", "and it does not grade a layout — that is two opinions, not a check", look.kind);
}

console.log("\nThe duel is two answers, and both have to be able to read the question");
{
  const duel = playerFor(resolveCast("duet", { configured: all }), "duel");
  check(Boolean(duel), "two companies answer the same question", duel?.modelId ?? "nobody");
  const big = playerFor(resolveCast("duet", { configured: all, size: 300_000 }), "duel");
  check(!big || spec(big.modelId).contextWindow > 300_000,
    "and a column that could not hold the thread is not offered as a second opinion", big?.modelId ?? "none");
}

console.log("\nThe five briefs are five different questions");
{
  const of = (f: Parameters<typeof briefPrompt>[1]) => briefPrompt("how does this work", f);
  const asks = (["cover", "plan", "risks", "misconceptions", "audience"] as const).map(of);
  check(new Set(asks).size === 5, "a build is not briefed the way a letter is");
  check(/order to build them in/.test(of("plan")), "the one for building asks for a plan");
  check(/arithmetic slips|unit/.test(of("risks")), "the one for numbers asks where it goes wrong");
  check(/already believes that is wrong/.test(of("misconceptions")), "the teaching one asks what you have got backwards");
  check(/who reads this/.test(of("audience")), "and the writing one asks who is reading");
}

console.log("\nThe council is four jobs rather than four drafts");
{
  const council = resolveCast("council", { configured: all })!;
  const one = resolveCast("one", { configured: all })!;
  const flash = resolveCast("flash", { configured: all })!;
  const seats = playersFor(council, "council");
  check(seats.length === 3, "three seats, and the model that writes makes four", String(seats.length + 1));
  check(new Set(seats.map((x) => x.angle)).size === 3,
    "each with a different half of the question", seats.map((x) => x.angle).join(", "));
  /* One company per job, and the fourth writes what comes of it. Four models
     from two labs would be a committee with one opinion. */
  const companies = new Set([council.answer.modelId, ...seats.map((x) => x.modelId)].map((id) => spec(id).provider));
  check(companies.size === 4, "on four keys, one company per seat", [...companies].join(", "));
  const p = (c: typeof council) => profileOf(c);
  check(p(council).usd > p(one).usd && p(one).usd > p(flash).usd,
    "and the prices run the way the names promise",
    [flash, one, council].map((c) => p(c).usd.toFixed(3)).join(" < "));
  check(p(flash).calls === 2 && p(council).calls === 4,
    "counted in models, which is the number that surprises people",
    `${p(flash).calls} vs ${p(council).calls}`);
}

console.log("\nEach seat is asked for its own half, and the writer is told not to average them");
{
  const asks = (["strategy", "logic", "knowledge"] as const).map((a) => councilPrompt("what should we build", a));
  check(new Set(asks).size === 3, "three different askings, not one in three voices");
  check(asks.every((a) => /Do not write the whole answer/.test(a)),
    "none of them is asked for the answer — that is the writer's job");
  const note = councilNote([{ who: "GPT-5.1", angle: "strategy", text: "build the small one first" }]);
  check(/genuinely disagree/.test(note), "and disagreement is to be surfaced, not smoothed away");
  check(/do not mention that any of this happened/i.test(note),
    "the answer is an answer, not a report on its own making");
  check(/you are the one accountable/.test(note), "with the writer accountable for what it keeps");
}

console.log("\nAnd four models are not convened for four words");
{
  check(!worthConvening("thanks"), "a council for 'thanks' is four bills for nothing");
  check(worthConvening("should we rebuild this service or refactor what is there"),
    "a real question gets one");
}

console.log("\nThe one for pictures keeps its eyes on a machine without them");
{
  /* Argus is the tactic that exists for images, so its cast is chosen for
     that whether or not this particular message has one — picking a blind
     model now and finding out when a screenshot arrives is the failure. */
  const cast = resolveCast("vision", { configured: all })!;
  check(spec(cast.answer.modelId).vision, "the writer can see", cast.answer.modelId);
  check(cast.parts.every((x) => spec(x.modelId).vision), "and so can everybody else in it",
    cast.parts.map((x) => x.modelId).join(", "));
  const blind = resolveCast("vision", { configured: { deepseek: true } })!;
  check(/read an image/i.test(blind.answer.why), "and where nothing can see, it says so", blind.answer.why);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
