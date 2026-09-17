/* Which providers are having a bad minute.   npx jiti test-health.ts */
import { noteFailure, noteSuccess, isAiling, ailmentOf, wellOnly, whyAvoided, forgetHealth } from "./lib/health";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const T = 1_000_000;
const models = [
  { id: "a", provider: "anthropic" as const },
  { id: "b", provider: "openai" as const },
  { id: "c", provider: "moonshot" as const },
];

console.log("\nA failure is remembered, and only for as long as it means anything");
{
  forgetHealth();
  noteFailure("anthropic", "provider_down", T);
  check(isAiling("anthropic", T + 1000), "a company having trouble is stepped around");
  check(!isAiling("openai", T + 1000), "and nobody else is");
  check(!isAiling("anthropic", T + 3 * 60_000), "two minutes later it is asked again");
  forgetHealth();
  noteFailure("openai", "quota", T);
  check(isAiling("openai", T + 5 * 60_000), "an account out of credit is remembered longer — it does not fix itself while you wait");
  check(!isAiling("openai", T + 11 * 60_000), "but not forever, because you may have just topped it up");
}

console.log("\nWhat is not the provider's fault is not held against it");
{
  forgetHealth();
  for (const kind of ["network", "timeout", "unknown", "content_filter", "context_length"] as const) {
    noteFailure("deepseek", kind, T);
  }
  check(!isAiling("deepseek", T), "a dropped connection is as likely to be the café as the company");
}

console.log("\nAn answer clears it");
{
  forgetHealth();
  noteFailure("moonshot", "rate_limit", T);
  check(isAiling("moonshot", T), "limited a moment ago");
  noteSuccess("moonshot", T + 100);
  check(!isAiling("moonshot", T + 100), "and then it answered, so it is well");
}

console.log("\nChoosing among them never ends with nobody");
{
  forgetHealth();
  noteFailure("anthropic", "provider_down", T);
  const well = wellOnly(models, T);
  check(well.length === 2 && !well.some((m) => m.provider === "anthropic"), "the ailing one is left out", well.map((m) => m.id).join(","));
  noteFailure("openai", "provider_down", T);
  noteFailure("moonshot", "provider_down", T);
  check(wellOnly(models, T).length === 3, "but when everything is ailing the memory is ignored — refusing to try is worse than trying");
  check(wellOnly([], T).length === 0, "and nothing in is nothing out");
}

console.log("\nIt can say why in words");
{
  check(/out of credit/.test(whyAvoided("quota", "OpenAI")), "credit");
  check(/rate-limiting/.test(whyAvoided("rate_limit", "Anthropic")), "limits");
  check(/rejected the key/.test(whyAvoided("bad_key", "Moonshot")), "keys");
  check(!/undefined/.test(whyAvoided("provider_down", "DeepSeek")), "and anything else reads as trouble", whyAvoided("provider_down", "DeepSeek"));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
