/* The router and the calculator, on their own — no browser, no model, no
   network. The interesting cases are the ones where a plausible-looking answer
   is the wrong one.

   Run with jiti, which is already here as a Next dependency and resolves
   extensionless TypeScript imports the way the app's own bundler does:
   `npx jiti test-route.ts`. Node's --experimental-strip-types cannot, and
   adding .ts extensions across lib/ to suit one test file would be the test
   changing the app to fit itself. */
import { solve } from "./lib/arith";
import { MODELS } from "./lib/models";
import { checker, route, shapeOf } from "./lib/route";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nSums that never needed a model");
{
  check(solve("948,392 × 73")?.text === "69,232,616", "the example everybody gives", solve("948,392 × 73")?.text);
  check(solve("what is 2+2?")?.text === "4", "asked the way people ask");
  check(solve("(3 + 4) * 2 ^ 3")?.text === "56", "brackets and powers, in the right order", solve("(3 + 4) * 2 ^ 3")?.text);
  check(solve("2 ^ 3 ^ 2")?.text === "512", "powers bind right, as in maths — not 64", solve("2 ^ 3 ^ 2")?.text);
  check(solve("-5 + 3")?.text === "-2", "a leading minus is a sign, not a syntax error");
  check(solve("100 ÷ 8")?.text === "12.5", "the division sign people actually type");
  check(solve("0.1 + 0.2")?.text === "0.3",
    "and float noise is not an answer — 0.30000000000000004 is correct and useless",
    solve("0.1 + 0.2")?.text);
}

console.log("\nAnd the things that only look like sums");
{
  check(solve("2 + 2") !== null, "a sum typed like a sum is a sum");
  check(solve("2+2") === null,
    "one typed without spaces and without a lead-in is not — it goes to a model, which costs a penny and cannot read a date as a division");
  check(solve("42") === null, "a bare number is not — there is nothing to work out");
  check(solve("what is 9/11") === null,
    "and a lead-in does not redeem it: this is a day in 2001, not 0.818181818182");
  check(solve("what is 24/7") === null, "nor this an idiom divided");
  check(solve("what is 12/25/2024") === null, "nor this Christmas");
  check(solve("what is 555-1234") === null, "nor this a telephone number subtracted");
  check(solve("what is 9 / 11")?.text === "0.818181818182",
    "spaces make it arithmetic again, and then it is answered", solve("what is 9 / 11")?.text);
  check(solve("what is 2+2 and why") === null, "a question containing a sum is a question");
  check(solve("what is 3 in binary") === null, "not every arithmetic-sounding thing is arithmetic");
  check(solve("1 / 0") === null, "division by zero is not an answer, and Infinity is not one either");
  check(solve("fetch('/x') + 1") === null, "nothing outside the grammar gets through");
  check(solve("1,5 + 1") === null,
    "a decimal comma is a real ambiguity and is refused rather than guessed at");
  check(solve("1,500 + 1")?.text === "1,501", "but a thousands separator is just how it was written");
}

console.log("\nExact, or else silent");
{
  check(solve("what is 123456789 * 987654321")?.text === "121,932,631,112,635,269",
    "a product past 2^53 is the product, not the nearest double to it",
    solve("what is 123456789 * 987654321")?.text);
  check(solve("what is 99999999 * 99999999")?.text === "9,999,999,800,000,001",
    "the classic one, which a float gets wrong in the last digit",
    solve("what is 99999999 * 99999999")?.text);
  check(solve("what is -2^2")?.text === "-4",
    "a sign outside the power, as everywhere that writes mathematics", solve("what is -2^2")?.text);
  check(solve("1 / 10^400") === null,
    "a quotient too small for a double is declined, not rounded to an exact-looking 0",
    String(solve("1 / 10^400")?.text));
  check(solve("what is 10^400") === null,
    "and an integer too large to carry is declined rather than printed beside an Infinity");
  check(solve("what is 2 ^ 2000") === null, "an exponent nobody typed on purpose is not worked out");
  check(solve("3,1415 * 2") === null,
    "π written the European way is refused, not read as 31,415", solve("3,1415 * 2")?.text);
  check(solve("what is 0 * -1")?.text === "0", "and nobody writes the sign of nothing");
  check(solve("948,392 × 73")?.exact === true, "a product is the product, and says so");
  check(solve("100 ÷ 8")?.exact === true, "and so is a decimal that ends");
  check(solve("what is 1 / 3")?.exact === false,
    "twelve significant figures of a number that does not end is not exact, and the caption must not say it is");

}

console.log("\nReading what a request needs");
{
  check(shapeOf("translate this to French: hello").quick, "a small mechanical edit reads as one");
  check(!shapeOf("translate this to French: " + "x ".repeat(3000)).quick,
    "but not over forty pages — length is half of what “quick” means");
  check(shapeOf("why did we choose PostgreSQL over MySQL").depth, "a why is a thinking question");
  check(shapeOf("fix this bug in my useEffect").coding, "code words read as code");
  check(shapeOf("const x = 1;\nfunction go() {}").coding, "and so does actual code with no words at all");
  check(shapeOf("hello", { hasImage: true }).vision, "an image is noticed");
}

console.log("\nPicking one");
const ALL = { anthropic: true, openai: true, google: true, deepseek: true };
const ctx = (over = {}) => ({ configured: ALL, keys: {}, effort: "auto", current: "claude-sonnet-4-5", ...over });
{
  const quick = route("translate this to French: hello", ctx() as never);
  check(/haiku|mini|flash/i.test(quick.modelId), "a one-line rewrite goes somewhere fast and cheap", quick.modelId);
  check(/mechanical/.test(quick.why), "and says why", quick.why);

  const hard = route("why would you choose an event-sourced architecture here", ctx() as never);
  check(/opus|gpt-5\.1$|reasoner|gemini-3/i.test(hard.modelId), "a hard question goes somewhere that thinks", hard.modelId);

  const code = route("refactor this typescript function to remove the nested loop", ctx() as never);
  check(/sonnet|opus|gpt-5\.1$/i.test(code.modelId), "code goes to something good at code", code.modelId);

  /* The one that matters: a requirement is not a preference. */
  const seen = route("what is in this picture", ctx({ hasImage: true }) as never);
  check(/opus|sonnet|haiku|gpt|gemini/i.test(seen.modelId), "an image goes to a model with eyes", seen.modelId);
  check(/image/.test(seen.why), "and says so", seen.why);

  const onlyDeepseek = route("what is in this picture", {
    configured: { deepseek: true }, keys: {}, effort: "auto", hasImage: true, current: "deepseek-chat",
  } as never);
  check(onlyDeepseek.modelId.startsWith("deepseek"),
    "with only a blind provider configured it still answers rather than inventing a key it does not have",
    onlyDeepseek.modelId);
}

console.log("\nAnd the sentence beside a sum says which kind it is");
{
  const third = route("what is 1 / 3", ctx() as never);
  check(!/exact/.test(third.why), "a repeating decimal does not claim exactness", third.why);
  const product = route("948,392 × 73", ctx() as never);
  check(/exact/.test(product.why), "where a product does", product.why);
}

console.log("\nLong things go where they fit");
{
  /* 300k tokens: past Claude's 200k and DeepSeek's 128k, inside Gemini's and
     GPT-4.1's million. Small enough to fit everywhere is not a test of
     anything — the earlier version of this used 75k, which every configured
     model can hold, so nothing was being filtered and the assertion was
     passing judgement on a decision that never happened. */
  const huge = route("summarise this", { ...ctx(), extra: "word ".repeat(240_000) } as never);
  check(/gemini|gpt-4\.1/i.test(huge.modelId), "only something with room is chosen", huge.modelId);
  check(/k tokens to read/.test(huge.why), "and the reason says it is about length", huge.why);

  // And when nothing can hold it, say so rather than sending it to be cut.
  const vast = route("summarise this", {
    configured: { deepseek: true }, keys: {}, effort: "auto", current: "deepseek-chat",
    extra: "word ".repeat(400_000),
  } as never);
  check(/longer than anything configured can hold/.test(vast.why),
    "and when nothing can hold it, that is said rather than quietly truncated", vast.why);
}

console.log("\nWhat counts as part of the request, and what only counts as length");
{
  /* The conversation is for size. It used to be read for subject too, so one
     code block anywhere in a thread made every message after it about code. */
  const later = shapeOf("what should we have for lunch", { extra: "const x = 1;\nfunction go() {}" });
  check(!later.coding, "a code block earlier in the conversation does not make this question about code");
  const attached = shapeOf("fix this", { attached: "const x = 1;\nfunction go() {}" });
  check(attached.coding, "but a file attached to this message does — nothing in the sentence says so");

  /* Size is passed in when the caller can count properly. The router and the
     fitter measuring differently is how a model gets chosen for a request it
     cannot hold. */
  const counted = shapeOf("summarise this", { size: 300_000 });
  check(counted.size === 300_000, "a counted size is used as given rather than re-measured from a sample");
  const huge = route("summarise this", { ...ctx(), size: 300_000 } as never);
  check(/gemini|gpt-4\.1/i.test(huge.modelId),
    "and a two-hundred-page attachment the sample never contained still picks somewhere with room", huge.modelId);
}

console.log("\nWhen nothing can do it, that is said");
{
  const blind = route("what is in this picture", {
    configured: { deepseek: true }, keys: {}, effort: "auto", hasImage: true, current: "deepseek-chat",
  } as never);
  check(/nothing configured can read an image/.test(blind.why),
    "an image with nothing configured that can see it is not routed in silence", blind.why);
}

console.log("\nEconomy means the cheap one");
{
  /* Buckets put DeepSeek at about $1.40 a million and Haiku at $6.00 on the
     same rung, and the bucket outweighed the price tiebreak three to one. */
  const cheap = route("say hello", { ...ctx(), effort: "economy" } as never);
  const spec = (id: string) => MODELS.find((m) => m.id === id)!;
  const picked = spec(cheap.modelId);
  const dearer = MODELS.filter((m) => ALL[m.provider as keyof typeof ALL])
    .filter((m) => m.priceIn + m.priceOut * 3 < picked.priceIn + picked.priceOut * 3);
  check(dearer.length === 0,
    "nothing configured is cheaper than the one economy picked",
    `${cheap.modelId} at $${(picked.priceIn + picked.priceOut * 3).toFixed(2)}, beaten by ${dearer.map((m) => m.id).join(", ") || "nothing"}`);
}

console.log("\nA second opinion, when one can be guaranteed");
{
  const retired = checker("claude-3-opus-20240229", { configured: ALL, keys: {} });
  check(retired !== null && !retired.startsWith("claude"),
    "a model no longer in the registry is still placed by its own name, so the check comes from elsewhere",
    String(retired));
  check(checker("some-model-nobody-has-heard-of", { configured: ALL, keys: {} }) === null,
    "and an id nothing can place gets no check at all rather than one that might be from the same weights");
}

console.log("\nThe same question routes the same way twice");
{
  const a = route("why is this slow", ctx() as never).modelId;
  const b = route("why is this slow", ctx() as never).modelId;
  check(a === b, "ties are broken deterministically, so it can be reasoned about", `${a} / ${b}`);
}

console.log("\nAnd you can overrule it");
{
  const cheap = route("why would you choose an event-sourced architecture here", ctx({ effort: "economy" }) as never);
  const deep = route("why would you choose an event-sourced architecture here", ctx({ effort: "deep" }) as never);
  check(cheap.modelId !== deep.modelId, "economy and deep disagree, as they should", `${cheap.modelId} vs ${deep.modelId}`);
  check(/you asked for economy/.test(cheap.why), "and it says the choice was yours", cheap.why);
}

console.log("\nA second opinion comes from somewhere else");
{
  const other = checker("claude-sonnet-4-5", { configured: ALL, keys: {} });
  check(other !== null && !other.startsWith("claude"),
    "checking an Anthropic answer does not go back to Anthropic — a model marking its own homework agrees with itself",
    other ?? "none");

  const deep = checker("claude-sonnet-4-5", { configured: ALL, keys: {} });
  check(/gpt-5\.1$|gemini-3|reasoner/.test(deep ?? ""),
    "and it is the strongest available elsewhere, not the cheapest — a check you cannot rely on told you nothing",
    deep ?? "none");

  const alone = checker("claude-sonnet-4-5", { configured: { anthropic: true }, keys: {} });
  check(alone === null,
    "with one provider there is no second opinion, and that is said rather than faked with a sibling model",
    String(alone));

  const back = checker("gpt-5.1", { configured: { anthropic: true, openai: true }, keys: {} });
  check(back?.startsWith("claude") === true, "it works in the other direction too", back ?? "none");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
