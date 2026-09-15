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
  briefNote, councilPrompt, councilNote, objectionNote, makers, plainly,
} from "./lib/presets";
import { planTurn } from "./lib/decide";
import { MODELS, DEFAULT_MODEL_ID } from "./lib/models";
import { cheapestAvailable } from "./lib/complete";

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

console.log("\nThe bench itself is sound");
{
  /* Twenty-nine engines is past the point where a typo is caught by reading
     the file. What a wrong `apiName` buys is a request that fails at the
     provider, which looks exactly like a key problem and is not one. */
  const ids = MODELS.map((m) => m.id);
  check(new Set(ids).size === ids.length, "no model is in the registry twice", String(ids.length));
  check(MODELS.every((m) => m.apiName.trim().length > 0), "every one of them has a name to send on the wire");
  const overrun = MODELS.filter((m) => m.maxOutput > m.contextWindow);
  check(overrun.length === 0, "and none claims to write more than it can hold", overrun.map((m) => m.id).join(", "));
  const unpriced = MODELS.filter((m) => !(m.priceIn > 0) || !(m.priceOut > 0));
  check(unpriced.length === 0, "and all of them cost something, so the meter is never a lie", unpriced.map((m) => m.id).join(", "));
  for (const company of ["anthropic", "openai", "moonshot", "deepseek"] as const) {
    const mine = MODELS.filter((m) => m.provider === company);
    check(mine.length >= 2, `${company} brings more than one model to the bench`, String(mine.length));
    check(mine.some((m) => !m.legacy), `and at least one of them is current`);
  }
}

console.log("\nAnd every id this app names anywhere is one a provider still answers to");
{
  /* The lesson of the generation that went past unnoticed. A model id is a
     string, so nothing fails at build time when a provider retires one — the
     request just comes back 400, which reads to a person exactly like a bad
     key. Every place in the app that writes an id down by hand is checked
     against the registry here, and the registry is checked against the
     providers by a human reading their documentation. */
  const known = new Set(MODELS.map((m) => m.id));
  check(known.has(DEFAULT_MODEL_ID), "the model a fresh install falls back to exists", DEFAULT_MODEL_ID);
  const cheap = cheapestAvailable({ anthropic: true, openai: true, moonshot: true, deepseek: true });
  check(Boolean(cheap) && known.has(cheap!), "and so does the one the cheap jobs go to", cheap ?? "none");
  for (const company of ["anthropic", "openai", "moonshot", "deepseek"] as const) {
    const only1 = { anthropic: false, openai: false, moonshot: false, deepseek: false, [company]: true };
    const c = cheapestAvailable(only1);
    check(Boolean(c) && MODELS.find((m) => m.id === c)?.provider === company,
      `and on a ${company} key alone it is one of theirs`, c ?? "none");
  }
}

console.log("\nThe cast is designed, not whatever the bench happened to hand over");
{
  /* What "combine them" has to mean to be worth anything. Every current model
     has a job — a bench where half the models are never cast is a list, not a
     family — and no tactic is one company wearing three hats. */
  const all4 = { configured: all };
  const cast = (id: string) => {
    const c = resolveCast(id, all4)!;
    return [c.answer.modelId, ...c.parts.map((x) => x.modelId)];
  };
  const used = new Set(PRESETS.flatMap((p) => cast(p.id)));
  const current = MODELS.filter((m) => !m.legacy);
  const idle = current.filter((m) => !used.has(m.id));
  check(idle.length === 0, "every model a provider currently sells has a seat somewhere",
    idle.map((m) => m.id).join(", ") || `all ${current.length} of them`);
  /* And the older bench is not cast when everything is available — it is
     depth for the browsers that are missing a key, which is a different job. */
  const stale = MODELS.filter((m) => m.legacy && used.has(m.id));
  check(stale.length === 0, "and nothing a generation old is cast while the current one is there",
    stale.map((m) => m.id).join(", "));

  const makers = new Set(MODELS.map((m) => m.provider)).size;
  for (const p of PRESETS) {
    const seats = cast(p.id);
    const labs = new Set(seats.map((id) => spec(id).provider)).size;
    check(labs === Math.min(seats.length, makers),
      `${p.name} spans every company it has seats for — ${labs} across ${seats.length}`,
      seats.map((id) => spec(id).provider).join(", "));
  }
  /* The writers are spread too. Eleven tactics all writing on one company
     would be one company with ten helpers, whatever the casts said. */
  const writers = new Set(PRESETS.map((p) => spec(resolveCast(p.id, all4)!.answer.modelId).provider));
  check(writers.size >= 3, "and the answer is not always written by the same company",
    [...writers].join(", "));
}

console.log("\nA cast that spans fewer companies than it has seats says so");
{
  /* The gap a deeper bench opened. `KIN_SHORT` only ever caught a seat that
     shared a company with the writer, which was the whole of the problem when
     each provider had two or three models — with the bench this deep, two
     keys fill all five council seats one-from-one-lab-four-from-the-other,
     every one of them independent of the writer, and nothing noticed. */
  const two = resolveCast("council", { configured: { anthropic: true, moonshot: true } })!;
  const labs = new Set([two.answer.modelId, ...two.parts.map((x) => x.modelId)].map((id) => spec(id).provider));
  check(two.parts.length === 4 && labs.size === 2, "two keys can now fill all five seats from two labs",
    [...labs].join(" + "));
  check(/companies across/.test(two.short ?? ""), "and the row says that is what happened", two.short ?? "said nothing");
  /* And stays quiet where the spread is everything there is to spread. */
  const four = resolveCast("council", { configured: all })!;
  check(four.short === null, "while four keys and four companies is not a shortfall", four.short ?? "null");
}

console.log("\nA deeper bench is a better cast, not just a longer list");
{
  /* The point of adding the previous generations. On one company's key every
     seat used to come out of the same three models, so the Council — which
     wants four — could not be filled at all. */
  for (const company of ["anthropic", "openai", "moonshot"] as const) {
    const bench = MODELS.filter((m) => m.provider === company).length;
    /* Every seat the bench can fill, which is four wherever the company sells
       five models and fewer where it does not. Asserted against the bench
       rather than against four, because "fill four seats from four models
       without repeating one" is not a bug to fix, it is arithmetic — and a
       seat that cannot be filled is dropped and said, never quietly doubled
       up. */
    const want = Math.min(4, bench - 1);
    const c = resolveCast("council", { configured: only(company) })!;
    const seats = [c.answer.modelId, ...c.parts.map((x) => x.modelId)];
    check(c.parts.length === want,
      `the Council fills every seat a ${company} key can fill — ${want} of 4`, seats.join(" + "));
    check(new Set(seats).size === seats.length, `and no model of theirs sits in two of them`, seats.join(" + "));
    check(want === 4 || Boolean(c.short), `and says so when the bench runs out`, c.short ?? "said nothing");
  }
  /* And it is still honest about what that is: five seats from one lab is
     five readings, not five opinions, and the row has to say so. */
  const one = resolveCast("council", { configured: only("anthropic") })!;
  check(/sibling/.test(one.short ?? ""), "while saying plainly that they are siblings", one.short ?? "");
}

console.log("\nA guess among what is left does not land on last year's model");
{
  /* `pickFrom` falls through to a blind choice when nothing a part named has
     a key. With ten engines that was nearly always a current one; with
     twenty-nine, most of the bench is a previous generation, and without a
     rule the cheapest thing in the building would win every time. */
  const named = new Set(PRESETS.flatMap((p) => [...p.engines, ...p.cast.flatMap((c) => c.engines)]));
  check(named.size >= 20, "the tactics name most of the bench between them", `${named.size} of ${MODELS.length}`);
  for (const p of PRESETS) {
    const c = resolveCast(p.id, { configured: all })!;
    const chosen = [c.answer.modelId, ...c.parts.map((x) => x.modelId)];
    const stale = chosen.filter((id) => spec(id).legacy && !named.has(id));
    check(stale.length === 0, `${p.name} never guesses its way onto a model nobody asked for`, stale.join(", "));
  }
  /* And never onto a window too small to hold the thread it lands in. */
  const cramped = PRESETS.flatMap((p) => {
    const c = resolveCast(p.id, { configured: all })!;
    return [c.answer.modelId, ...c.parts.map((x) => x.modelId)];
  }).filter((id) => spec(id).contextWindow < 100_000);
  check(cramped.length === 0, "nor onto one too small to hold an ordinary conversation", cramped.join(", "));
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
  check(resolvePreset("gpt-5.6-terra", { configured: all }) === null && !isPreset("gpt-5.6-terra"),
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
  const ask = "design a landing page layout for a bakery";
  const look = shapePlan(planTurn(ask), getPreset("quant"), {
    cast: resolveCast("quant", { configured: all }),
    ask,
  });
  check(look.check !== "second", "and it does not grade a layout — that is two opinions, not a check", look.kind);
  /* The refinement the two-model promise forced. A verdict on a layout is
     still two opinions rather than one fact — so it is withheld wherever
     something else in the cast is already reading the work. Where nothing
     else would, the alternative is not "no verdict", it is "one model", and
     that is worse: the second model reads it back, and the line says that is
     what it is rather than calling it a check. */
  const soloist = shapePlan(planTurn(ask), getPreset("lingua"), {
    cast: resolveCast("lingua", { configured: all }),
    ask,
  });
  check(soloist.check === "second", "but a tactic with nobody else in it still gets a second reader", soloist.kind);
  check(/read back by another/.test(soloist.why), "called what it is, not called a check", soloist.why);
}

console.log("\nTwo models, on every kind of request — not only the convenient ones");
{
  /* The promise every one of these names makes. It was being broken in three
     places at once and nothing noticed: a brief gated at six words, so short
     questions ran alone; a check withheld on the kinds it cannot settle, so
     every "teach me", "write me" and "design me" ran alone — including on
     the tactics built for exactly those; and a build, where the check was
     skipped altogether. "Teach me how eigenvalues work" ran on one model for
     nine of the eleven, Tutor among them.
     
     So this is a table, and it stays a table: every tactic against every
     shape of request, and any row that comes back as one model is a broken
     promise rather than a saving. */
  const ASKS: [string, number][] = [
    ["what is a debounce", 0],
    ["teach me how eigenvalues work", 0],
    ["write an email to my landlord about the boiler", 0],
    ["design a landing page layout for a bakery", 0],
    ["build me a stopwatch with lap times", 0],
    ["translate this into Japanese", 0],
    /* Two words and forty pages: the material is the question. */
    ["summarise this", 9_000],
  ];
  let alone = 0;
  for (const [ask, size] of ASKS) {
    for (const p of PRESETS) {
      const cast = resolveCast(p.id, { configured: all })!;
      const plan = shapePlan(planTurn(ask, { autoStyle: true }), p, { autoStyle: true, cast, ask, size });
      let n = 1;
      if (playerFor(cast, "brief") && worthBriefing(ask, plan, size)) n += 1;
      if (playersFor(cast, "council").length && worthConvening(ask, plan)) n += playersFor(cast, "council").length;
      if (plan.check === "second" && playerFor(cast, "check")) n += 1;
      n += playersFor(cast, "duel").length;
      if (n < 2) {
        alone += 1;
        console.log(`  ✗ ${p.name} answers "${ask}" alone`);
      }
    }
  }
  check(alone === 0, `every tactic is two models or more on every shape of request`,
    `${ASKS.length} requests × ${PRESETS.length} models`);
}

console.log("\nBut a greeting is not a question");
{
  /* The floor, and the only place one model is right. Three words, because
     "what is recursion" is a question and "hi" is not — and because a second
     model reading "thanks" is a second bill for nothing. */
  const hi = planTurn("thanks");
  check(!worthBriefing("thanks", hi), "nothing is bought for two words of politeness");
  check(worthBriefing("what is recursion", hi), "and a three-word question is still a question");
  check(worthBriefing("summarise this", hi, 9_000),
    "nor is length in words the test when the question is forty pages long");
}

console.log("\nA check that objects is answered, not just printed");
{
  /* The difference between a critique and a correction. A verdict under a
     wrong answer leaves the reader to do the work; handing the objection
     back to the model that wrote it is what the second model was for. */
  const rigorous = PRESETS.filter((p) => p.revise).map((p) => p.short);
  check(rigorous.length >= 3, "the tactics where being wrong costs something answer again", rigorous.join(", "));
  for (const p of PRESETS.filter((x) => x.revise)) {
    check(p.cast.some((c) => c.role === "check"),
      `${p.name} has somebody to object in the first place`);
  }
  const note = objectionNote({ agrees: "partly", text: "The trailing edge is not the default." });
  check(/> The trailing edge is not the default\./.test(note), "the objection is quoted, not paraphrased");
  check(/Where the objection is wrong, keep what you had/.test(note),
    "and the writer is not told to agree — a second model is not a truth machine");
  check(/compute block rather than arguing/.test(note) && /this app runs that block/.test(note),
    "a disagreement about a number is settled by running it, not by rhetoric");
  check(/say what would settle it/.test(note), "and an unresolved disagreement is said, not smoothed");
  /* And not even to the writer. The rewrite is answerable to the argument;
     a company's model name in the prompt is one long answer away from being
     a company's model name on the screen. */
  check(!/Claude|GPT|Kimi|DeepSeek|Sonnet|Haiku|Opus|Gemini/.test(note),
    "and nobody's model is named in it, because the objection is the argument");
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
  check(playerFor(council, "check") !== null,
    "and a fifth that reads the finished answer from outside the table");
  check(new Set(seats.map((x) => x.angle)).size === 3,
    "each with a different half of the question", seats.map((x) => x.angle).join(", "));
  /* One company per job, and the fourth writes what comes of it. Four models
     from two labs would be a committee with one opinion. */
  const companies = new Set([council.answer.modelId, ...seats.map((x) => x.modelId)].map((id) => spec(id).provider));
  check(companies.size === 4, "on four keys, one company per seat", [...companies].join(", "));
  check(profileOf(council).calls === 5, "five models on one question", String(profileOf(council).calls));
  const p = (c: typeof council) => profileOf(c);
  check(p(council).usd > p(one).usd && p(one).usd > p(flash).usd,
    "and the prices run the way the names promise",
    [flash, one, council].map((c) => p(c).usd.toFixed(3)).join(" < "));
  check(p(flash).calls === 2 && p(council).calls === 5,
    "counted in models, which is the number that surprises people",
    `${p(flash).calls} vs ${p(council).calls}`);
}

console.log("\nEach seat is asked for its own half, and the writer is told not to average them");
{
  const asks = (["strategy", "logic", "knowledge"] as const).map((a) => councilPrompt("what should we build", a));
  check(new Set(asks).size === 3, "three different askings, not one in three voices");
  check(asks.every((a) => /Do not write the whole answer/.test(a)),
    "none of them is asked for the answer — that is the writer's job");
  const note = councilNote([{ angle: "strategy", text: "build the small one first" }]);
  check(/### On /.test(note) && !/Claude|GPT|Kimi|DeepSeek/.test(note),
    "each note is headed by the seat that wrote it rather than by a company");
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
  /* This used to read "where nothing can see, it says so", exercised through
     DeepSeek because both of their models were blind. One of them sees now,
     so there is no company left whose whole bench is blind and the branch has
     nothing to reach it through. What is still worth pinning is the rule that
     branch exists to serve: the requirement beats the preference. DeepSeek's
     stronger model is the one that cannot see, and this tactic takes the
     weaker one every time rather than the better one with its eyes shut. */
  const alone = resolveCast("vision", { configured: only("deepseek") })!;
  check(spec(alone.answer.modelId).vision,
    "on a bench where the strongest model is blind, the tactic takes the one that sees",
    alone.answer.modelId);
  check(alone.parts.every((x) => spec(x.modelId).vision),
    "and will not fill a second pair of eyes with a model that has none",
    alone.parts.map((x) => x.modelId).join(", ") || "no second seat");
}

console.log("\nAnd a line written by an older build is read by today's rules");
{
  /* The line under an answer is stored, not recomputed, so every build that
     ever wrote one is still on somebody's screen. The ones written before the
     rebrand begin with the engine — which is the one thing that must not
     survive into a version of the app that does not name engines. */
  check(plainly("ARMI One — this is about code") === "this is about code",
    "the name comes off the front, because the header two inches up already says it");
  check(plainly("Claude Sonnet 4.5 · ARMI One") === "",
    "a line that was nothing but names leaves nothing behind",
    `"${plainly("Claude Sonnet 4.5 · ARMI One")}"`);
  const old = plainly("Sonnet 4.5 · ARMI One — briefed first by another model");
  check(old === "briefed first by another model", "and what it was actually telling you survives", old);
  /* Including the shortest line this app ever wrote: the router's own, on a
     route it had no reason to explain, which was the engine's name and a
     full stop and nothing else. */
  check(plainly("Sonnet 4.5.") === "", "a line that was only a name and a full stop leaves nothing");
  for (const line of ["GPT-5.1 · ARMI Flash — this is about code", "Kimi · ARMI Duet", "Haiku 4.5 — a one-line rewrite", "Opus 4.5."]) {
    check(!/Claude|GPT|Kimi|DeepSeek|Sonnet|Haiku|Opus/.test(plainly(line)),
      `nothing of somebody else's is left in "${line}"`, `"${plainly(line)}"`);
  }
  /* And it does not eat prose that merely mentions something. The rule is
     about whole segments, not about words inside a sentence. */
  check(plainly("ARMI Quant — the numbers here are worth checking") === "the numbers here are worth checking",
    "while a sentence is left as it was written");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
