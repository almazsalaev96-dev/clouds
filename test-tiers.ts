/**
 * The ladder: a request lands on the tier built for its level, the spend
 * setting caps the level, a picture is never traded for price, and the
 * second pass after a failed check goes up a rung.
 */
import { levelOf, tierFor, TIER_OF, LEVEL_EFFORT } from "./lib/tiers";
import { shapeOf } from "./lib/route";
import { resolveCast, getPreset, PRESETS } from "./lib/presets";
import { MODELS, roleOf, blindPick } from "./lib/models";

let failed = 0;
function check(ok: boolean, what: string, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${what}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}
const level = (text: string, opts: Parameters<typeof levelOf>[2] = {}, hasImage = false) =>
  levelOf(text, shapeOf(text, { hasImage }), opts).level;

console.log("\nEvery level has a tier, and the tiers are the four for anything");
{
  for (const id of Object.values(TIER_OF)) check(Boolean(getPreset(id)), `${id} is a tactic that exists`, getPreset(id)?.name);
  const everyday = PRESETS.filter((p) => p.group === "everyday").map((p) => p.id).sort();
  check(everyday.join(",") === Object.values(TIER_OF).sort().join(","), "and they are exactly the everyday group", everyday.join(", "));
  check(getPreset("astro")!.name === "ARMI Astro 5" && getPreset("one")!.name === "ARMI Mira 4.1" && getPreset("vision")!.name === "ARMI Lumos 4" && getPreset("flash")!.name === "ARMI Nova 4",
    "named as the design names them");
}

console.log("\nThe request is read for its level");
{
  check(level("translate this into French: the meeting is on Tuesday") === 1, "a one-line rewrite is level 1");
  check(level("what time is it in Tokyo") === 1, "a short ask with nothing to weigh is level 1");
  check(level("why would you choose an event-sourced architecture over a CRUD one here") === 2, "a hard everyday question is level 2, not the top");
  check(level("refactor this TypeScript function to remove the nested loop") === 2, "code is level 2");
  check(level("design the complete architecture of my AI SaaS, with the data model, the services and how they scale") === 4, "the whole of a design is level 4");
  check(level("analyse these 30 research papers and produce a rigorous synthesis of what they agree on") === 4, "thirty papers into a rigorous synthesis is level 4");
  check(level("prove that this sort is stable for every input") === 4, "a proof is level 4");
  const heavy = "why does this hold\n" + "lorem ipsum dolor sit amet ".repeat(6_000);
  check(level(heavy) === 4, "a book's worth of text with a why on it is level 4");
  check(level("what is in this picture", {}, true) === 3, "a picture is level 3");
  check(level("summarise this in three lines: the meeting moved, the budget is fixed, and the launch slips a week") !== 4, "an ordinary summary is not the top");
}

console.log("\nThe spend setting caps the level, and a picture is never traded for price");
{
  check(level("why would you choose an event-sourced architecture over a CRUD one here", { spend: "low" }) === 1, "low keeps to the quick tier");
  check(level("design the complete architecture of my AI SaaS and prove the data model consistent", { spend: "balanced" }) === 2, "balanced keeps off the top");
  check(level("design the complete architecture of my AI SaaS and prove the data model consistent", { spend: "any" }) === 4, "any lets it climb");
  check(level("what is in this picture", { spend: "low" }, true) === 3, "a picture still goes where it can be seen on low");
  const t = tierFor("why would you choose an event-sourced architecture over a CRUD one here", { spend: "low" });
  check(/spend setting/.test(t.why) && /^Auto chose Nova 4:/.test(t.why), "and the row says who chose and why", t.why);
  check(!t.why.includes("—"), "with no dash, which the line under an answer would read as a name");
}

console.log("\nThe effort ladder follows the level");
{
  check(LEVEL_EFFORT[1] === "low" && LEVEL_EFFORT[2] === "medium" && LEVEL_EFFORT[4] === "high", "low, medium, high up the rungs");
  check(tierFor("refactor this TypeScript function to remove the nested loop", {}).why.includes("about code"), "and the reason the router had is kept", tierFor("refactor this TypeScript function to remove the nested loop", {}).why);
}

console.log("\nThe second pass after a failed check goes up a rung");
{
  const where = { configured: { openai: true, anthropic: true, deepseek: true, moonshot: true } };
  const first = resolveCast("one", where)!;
  const again = resolveCast("one", where, { escalated: true })!;
  check(first.answer.modelId === "gpt-5.6-terra", "Mira writes on the middle tier first", first.answer.modelId);
  check(again.answer.modelId === "gpt-5.6-sol", "and on the top of that family when the check objected", again.answer.modelId);
  check(/stronger model/.test(again.answer.why), "saying so on the row", again.answer.why);
  const one = resolveCast("one", { configured: { anthropic: true } }, { escalated: true })!;
  check(one.answer.modelId === "claude-opus-5-5", "with one company's key, the strongest of that company", one.answer.modelId);
  check(!getPreset("flash")!.escalate && Boolean(getPreset("one")!.escalate?.length), "the quick tier has no rung above it in its own tactic; the everyday one does");
  check(first.alternates.length > 0 && !first.alternates.includes(first.answer.modelId), "and the cast names who else could write, without the writer", first.alternates.slice(0, 3).join(", "));
  check(first.alternates[0] === "claude-opus-5-5", "in the tactic's own order", first.alternates[0]);
}

console.log("\nThe check on the everyday tier is earned, on the top tier it is owed");
{
  check(getPreset("one")!.cast.some((c) => c.role === "check" && c.when === "earned"), "Mira's check waits for the record, the person or a low confidence line");
  check(getPreset("astro")!.cast.some((c) => c.role === "check" && !c.when), "Astro's check runs on every answer");
  check(getPreset("astro")!.cast.some((c) => c.role === "council" && c.angle === "logic"), "and an independent reasoner sits on Astro");
  check(getPreset("astro")!.effort === "high" && getPreset("flash")!.effort === "low", "with the effort the level asks for");
}

console.log("\nThe bench has roles");
{
  check(roleOf(MODELS.find((m) => m.id === "deepseek-flash")!) === "verifier", "the cheap independent reader is the verifier");
  check(roleOf(MODELS.find((m) => m.id === "kimi-k3")!) === "specialist", "the million-token model is a specialist");
  check(roleOf(MODELS.find((m) => m.id === "claude-opus-5")!) === "fallback", "the previous Opus is a fallback");
  check(roleOf(MODELS.find((m) => m.id === "claude-sonnet-5")!) === "active", "and the everyday one is active");
  check(blindPick({ ...MODELS[0], role: "shadow" }) === false && blindPick(MODELS[0]) === true, "a shadow is never chosen blind");
  check(!MODELS.some((m) => m.id === "gpt-6-astra"), "and nothing fictional is on the bench");
  check(MODELS.some((m) => m.id === "claude-opus-5-5" && !m.legacy), "Opus 5.5 is current");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
