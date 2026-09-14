/* Armi's own models, which are tactics rather than weights.
 *
 * The interesting assertions here are the honest ones. A named model that
 * quietly ran on whatever was cheapest, or that claimed a second opinion it
 * never got, would be a lie the picker tells on every turn — so each one
 * checks that the substitution is *made* and then that it is *said*.
 *
 *   npx jiti test-presets.ts */
import { PRESETS, DEFAULT_PRESET_ID, getPreset, isPreset, resolvePreset, engineOf, shapePlan, shortOf } from "./lib/presets";
import { planTurn } from "./lib/decide";
import { MODELS } from "./lib/models";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const all = { anthropic: true, openai: true, google: true, deepseek: true };
const only = (p: string) => ({ anthropic: false, openai: false, google: false, deepseek: false, [p]: true });
const engine = (id: string, where: Parameters<typeof resolvePreset>[1]) => resolvePreset(id, where)!.modelId;

console.log("\nEvery tactic names engines that exist");
{
  const known = new Set(MODELS.map((m) => m.id));
  const bad = PRESETS.flatMap((p) => p.engines.filter((e) => !known.has(e)).map((e) => `${p.id}:${e}`));
  check(bad.length === 0, "a preset pointing at a model that is not in the registry is unpickable", bad.join(", "));
  const ids = PRESETS.map((p) => p.id);
  check(new Set(ids).size === ids.length, "and no two share an id");
  /* A preset id that collides with a model id would make `getModel` and
     `getPreset` disagree about what the picker is holding. */
  check(!ids.some((id) => known.has(id)), "and none of them is also a model id");
}

console.log("\nThe one a fresh install opens on exists");
{
  check(isPreset(DEFAULT_PRESET_ID), "or every new install starts on a model that is not there", DEFAULT_PRESET_ID);
}

console.log("\nEach one is actually a different tactic");
{
  const fast = engine("nova", { configured: all });
  const deep = engine("orion", { configured: all });
  const long = engine("atlas", { configured: all });
  check(fast !== deep, "the quick one and the careful one are not the same model", `${fast} vs ${deep}`);
  check(MODELS.find((m) => m.id === long)!.contextWindow >= 1_000_000, "the one for long documents holds a million tokens", long);
  check(getPreset("nova")!.effort === "low" && getPreset("orion")!.effort === "high",
    "and they think as hard as their names promise");
}

console.log("\nIt runs on whatever key you actually hold");
{
  for (const p of PRESETS) {
    for (const maker of ["anthropic", "openai", "google", "deepseek"]) {
      const got = resolvePreset(p.id, { configured: only(maker) })!;
      const spec = MODELS.find((m) => m.id === got.modelId)!;
      check(spec.provider === maker, `${p.name} on a ${maker} key answers on ${maker}`, got.modelId);
    }
  }
}

console.log("\nAnd says so when it could not have what it wanted");
{
  const first = resolvePreset("atlas", { configured: only("google") })!;
  check(!first.substituted && !first.why, "its first choice is offered without an excuse", first.modelId);
  const second = resolvePreset("atlas", { configured: only("deepseek") })!;
  check(second.substituted && /no key/i.test(second.why),
    "and anything else is named along with the reason", `${second.modelId} — ${second.why}`);
}

console.log("\nA requirement beats the tactic, because an answer to an unread question is not an answer");
{
  /* DeepSeek cannot see. Nova would take it on price and must not, when
     there is a picture in the message. */
  const blind = engine("nova", { configured: { deepseek: true, anthropic: true } });
  const seeing = resolvePreset("nova", { configured: { deepseek: true, anthropic: true }, hasImage: true })!;
  check(MODELS.find((m) => m.id === seeing.modelId)!.vision, "an image rules out the engines without eyes", seeing.modelId);
  check(/image/i.test(seeing.why), "and the row says why that one", seeing.why);
  check(blind !== seeing.modelId || MODELS.find((m) => m.id === blind)!.vision, "which is a real constraint, not a no-op");

  /* Three hundred thousand tokens does not fit a 200k window, whatever the
     tactic prefers. */
  const big = resolvePreset("nova", { configured: all, size: 300_000 })!;
  check(MODELS.find((m) => m.id === big.modelId)!.contextWindow > 300_000, "and a long thread rules out the small windows", big.modelId);
  check(/long/i.test(big.why), "said in tokens rather than in silence", big.why);
}

console.log("\nWith no key at all it still names an engine");
{
  const none = resolvePreset("astro", { configured: {} })!;
  check(Boolean(none.modelId) && /no key/i.test(none.why),
    "so the failure that follows is about the missing key", `${none.modelId} — ${none.why}`);
}

console.log("\nAnything that is not a preset passes straight through");
{
  check(resolvePreset("claude-opus-4-5", { configured: all }) === null, "a model id is not a preset");
  check(resolvePreset("auto", { configured: all }) === null, "and neither is Auto");
  check(engineOf("claude-opus-4-5", { configured: all }) === "claude-opus-4-5", "and it comes back unchanged");
  check(!isPreset("gpt-5.1") && isPreset("astro"), "which is what the picker asks before it draws a row");
}

console.log("\nThe two-maker one admits when it cannot be itself");
{
  check(shortOf(getPreset("mizar")!, { configured: only("anthropic") }) !== null,
    "one company cannot check its own homework, and the row says so");
  check(shortOf(getPreset("mizar")!, { configured: all }) === null, "with two, it can");
  check(shortOf(getPreset("astro")!, { configured: only("anthropic") }) === null,
    "and nothing else pretends to need two");
}

console.log("\nThe tactic shapes the turn");
{
  const plain = planTurn("what should I have for lunch", { autoStyle: true });
  check(plain.effort === undefined, "an easy question asks for no particular effort", String(plain.effort));
  check(shapePlan(plain, getPreset("orion"), { autoStyle: true }).effort === "high",
    "picking the careful one means it thinks hard about whatever comes next");
  check(shapePlan(plain, getPreset("nova"), { autoStyle: true }).effort === "low",
    "and picking the quick one means it does not");

  const sage = shapePlan(plain, getPreset("sage"), { autoStyle: true });
  /* The name is already on that line when this is drawn, so the reason does
     not repeat it: "Sage · Explanatory, because that is what it is for". */
  check(sage.register?.id === "explanatory" && Boolean(sage.register?.why),
    "the teaching one explains, and says why it is explaining", sage.register?.why);

  /* Said outright beats the tactic: somebody who asks for it short has told
     the app something about this turn, which is narrower than a preference
     they set an hour ago. */
  const asked = planTurn("quickly, what is a debounce", { autoStyle: true });
  check(asked.register?.id === "concise", "the request itself reads as concise", asked.register?.id);
  check(shapePlan(asked, getPreset("sage"), { autoStyle: true }).register?.id === "concise",
    "and the tactic does not overrule what they just asked for");

  /* And a style they chose themselves is not touched at all. */
  const chosen = planTurn("what is a debounce", { autoStyle: false });
  check(shapePlan(chosen, getPreset("sage"), { autoStyle: false }).register === null,
    "nor a style they picked on purpose");
}

console.log("\nAnd the second opinion is real, or it is not claimed");
{
  const code = planTurn("write a function that debounces calls");
  const both = shapePlan(code, getPreset("mizar"), { twoMakers: true });
  check(both.check === "second" && /Mizar/.test(both.why), "with two companies, one checks the other", both.why);
  const alone = shapePlan(code, getPreset("mizar"), { twoMakers: false });
  check(alone.check !== "second", "with one, it does not pretend to", alone.check);
  /* A layout is not a thing a second model can settle: what comes back is
     another opinion about taste, charged as a verdict. The list of what can
     be settled lives in `decide.ts` and this reads it rather than keeping a
     second copy that drifts. */
  const look = shapePlan(planTurn("design a landing page layout for a bakery"), getPreset("mizar"), { twoMakers: true });
  check(look.check !== "second", "and it does not grade a layout — that is two opinions, not a check", look.kind);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
