import type { ModelSpec, ProviderId } from "./types";

export const PROVIDERS: Record<
  ProviderId,
  { name: string; keyName: string; keyUrl: string; keyPrefix: string }
> = {
  anthropic: {
    name: "Anthropic",
    keyName: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
  },
  openai: {
    name: "OpenAI",
    keyName: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
  },
  moonshot: {
    name: "Moonshot",
    keyName: "MOONSHOT_API_KEY",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    keyPrefix: "sk-",
  },
  deepseek: {
    name: "DeepSeek",
    keyName: "DEEPSEEK_API_KEY",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyPrefix: "sk-",
  },
};

/**
 * "Let the app decide", as a value the picker can hold.
 *
 * Not a model, and deliberately not stored as one: it is the *absence* of a
 * choice, which is a different thing from a choice of something automatic, and
 * every place that asks "which model" has to be able to tell them apart.
 */
export const AUTO = "auto";

/**
 * The author of an answer no model produced.
 *
 * `getModel` falls back to the default for an id it does not know, which is
 * right for a model that has been retired and wrong for this: it put "Claude
 * Sonnet 4.5" above a sum that was worked out locally and never left the
 * browser. Attributing an answer to a model that was not called is a small lie
 * told by the one feature whose entire point is that it did not call one.
 */
export const CALCULATOR = "calculator";

/**
 * Every model this app can call, from all four companies.
 *
 * None of these names is ever drawn on screen — the menu is Armi's own models
 * and has been since the engines came off it. This is the bench they are cast
 * from, and a deeper bench is worth more here than it would be in a picker:
 * an Armi model is two or three engines with different jobs, and the rule
 * that makes the second one worth paying for is that it comes from somewhere
 * else. Ten models could not always manage that. Twenty-nine nearly always
 * can, and where a browser holds one company's key the sibling it falls back
 * to is now a real choice — Opus against Haiku, o3 against GPT-5.1 — rather
 * than whichever of three was left.
 *
 * Two rules about what is written here, because both of them are load-bearing:
 *
 *  - `apiName` is the string that goes on the wire and `id` is what this app
 *    calls it. They differ wherever a provider's own name is dated or carries
 *    `-preview`, so a stored setting does not rot when the alias moves.
 *  - Where a capability is uncertain it is written down the *safe* way. A
 *    model marked blind that can in fact see is never handed a picture, which
 *    costs an opportunity; a model marked sighted that cannot is a request
 *    that fails on the one message it was needed for.
 *
 * Blurbs say what the model is for, in the words a person would use. They are
 * read in Settings and by nothing else.
 */
export const MODELS: ModelSpec[] = [
  /* ---------------------------------------------------------- Anthropic -- */

  {
    id: "claude-fable-5-1",
    provider: "anthropic",
    apiName: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    short: "Fable 5.1",
    blurb: "The deepest thinker here. For long, hard problems that will not come apart in one pass.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 10,
    priceOut: 50,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    apiName: "claude-opus-5",
    name: "Claude Opus 5",
    short: "Opus 5",
    blurb: "Complex work and long code. The one to start from for most hard things.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    apiName: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    short: "Sonnet 5",
    blurb: "The best balance of speed and intelligence. A good default for anything.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 2,
    priceOut: 10,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    apiName: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    short: "Haiku 4.5",
    blurb: "The fastest here, and close behind the big ones. Good for briefs and checks.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 1,
    priceOut: 5,
    vision: true,
    reasoning: true,
    thinks: "budget",
    tools: true,
  },

  /* Still sold, one generation back. Kept because a cast is only as good as
     its bench: on a browser holding one company's key these are what the
     second and third seats are filled from. Anything Anthropic has actually
     retired is not here — an id that 404s is not depth, it is a failed
     request wearing the name of a model. */

  {
    id: "claude-fable-5",
    provider: "anthropic",
    apiName: "claude-fable-5",
    name: "Claude Fable 5",
    short: "Fable 5",
    blurb: "The previous deep model.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 10,
    priceOut: 50,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    apiName: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    short: "Opus 4.8",
    blurb: "A previous flagship. Still strong, and still sold.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-opus-4-7",
    provider: "anthropic",
    apiName: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    short: "Opus 4.7",
    blurb: "A previous flagship. Still strong, and still sold.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-opus-4-6",
    provider: "anthropic",
    apiName: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    short: "Opus 4.6",
    blurb: "A previous flagship. Still strong, and still sold.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-opus-4-5",
    provider: "anthropic",
    apiName: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    short: "Opus 4.5",
    blurb: "The last of the extended-thinking flagships.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    thinks: "budget",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    apiName: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    short: "Sonnet 4.6",
    blurb: "The previous everyday model, with the wide window.",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    thinks: "effort",
    tools: true,
    legacy: true,
  },
  {
    id: "claude-sonnet-4-5",
    provider: "anthropic",
    apiName: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    short: "Sonnet 4.5",
    blurb: "The one before that. A dependable second reader.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    thinks: "budget",
    tools: true,
    legacy: true,
  },

  /* ------------------------------------------------------------- OpenAI -- */

  {
    id: "gpt-6-astra",
    provider: "openai",
    apiName: "gpt-6-astra",
    name: "GPT-6 Astra",
    short: "GPT-6 Astra",
    blurb: "Their flagship. Reasoning and coding, at flagship prices.",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    priceIn: 10,
    priceOut: 50,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    apiName: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    short: "Sol",
    blurb: "The top of the previous generation. Deep, and dear.",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 30,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-5.6-terra",
    provider: "openai",
    apiName: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    short: "Terra",
    blurb: "The middle tier, and the everyday one. A million tokens.",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    priceIn: 2,
    priceOut: 12,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    apiName: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    short: "Luna",
    blurb: "A million-token window for almost nothing. Briefs and checks live here.",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    priceIn: 0.2,
    priceOut: 1.2,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-5.5",
    provider: "openai",
    apiName: "gpt-5.5",
    name: "GPT-5.5",
    short: "GPT-5.5",
    blurb: "The generation before the named tiers.",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    priceIn: 5,
    priceOut: 30,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5.2",
    provider: "openai",
    apiName: "gpt-5.2",
    name: "GPT-5.2",
    short: "GPT-5.2",
    blurb: "Older, cheaper, and a narrower window.",
    contextWindow: 272_000,
    maxOutput: 128_000,
    priceIn: 1.75,
    priceOut: 14,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5",
    provider: "openai",
    apiName: "gpt-5",
    name: "GPT-5",
    short: "GPT-5",
    blurb: "The first of that line, and still sold.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 1.25,
    priceOut: 10,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },

  /* ----------------------------------------------------------- Moonshot -- */

  {
    id: "kimi-k3",
    provider: "moonshot",
    apiName: "kimi-k3",
    name: "Kimi K3",
    short: "K3",
    blurb: "Their flagship: a very large open model with a million-token window and eyes.",
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "kimi-k2.6",
    provider: "moonshot",
    apiName: "kimi-k2.6",
    name: "Kimi K2.6",
    short: "K2.6",
    blurb: "The general-purpose one. Cheap for its size, and reads images.",
    contextWindow: 256_000,
    maxOutput: 32_000,
    priceIn: 0.95,
    priceOut: 4,
    vision: true,
    reasoning: false,
    tools: true,
  },
  {
    id: "kimi-k2.7-code",
    provider: "moonshot",
    apiName: "kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    short: "K2.7 Code",
    blurb: "Tuned for code, and it shows its working.",
    contextWindow: 256_000,
    maxOutput: 32_000,
    priceIn: 0.95,
    priceOut: 4,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "kimi-k2.7-code-highspeed",
    provider: "moonshot",
    apiName: "kimi-k2.7-code-highspeed",
    name: "Kimi K2.7 Code Highspeed",
    short: "K2.7 Fast",
    blurb: "The same model served fast, and priced for the hurry.",
    contextWindow: 256_000,
    maxOutput: 32_000,
    priceIn: 0.95,
    priceOut: 8,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },

  /* ----------------------------------------------------------- DeepSeek -- */
  /* Two ids, which is the whole of what their API exposes — and both of them
     are new. `deepseek-chat` and `deepseek-reasoner`, which this app called
     until now, were discontinued in July 2026: every DeepSeek request it made
     after that date failed, and the app had no way to know it was asking for
     something that no longer existed.
     
     Priced at the peak rate. DeepSeek charges roughly half of this outside
     working hours, and a meter that quoted the cheaper number would flatter
     the bill for two thirds of the week and understate it for the third when
     most people are working. */

  {
    id: "deepseek-flash",
    provider: "deepseek",
    apiName: "deepseek-flash",
    name: "DeepSeek Flash",
    short: "Flash",
    blurb: "Quick, very cheap, a million-token window, and it reads images.",
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    priceIn: 0.3,
    priceOut: 1.2,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "deepseek-v4-pro",
    provider: "deepseek",
    apiName: "deepseek-v4-pro",
    name: "DeepSeek Pro",
    short: "Pro",
    blurb: "The large one. Still cheaper than most things here.",
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    priceIn: 0.66,
    priceOut: 1.98,
    vision: false,
    reasoning: true,
    tools: true,
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-5";

const byId = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: string): ModelSpec {
  return byId.get(id) ?? byId.get(DEFAULT_MODEL_ID)!;
}

export function modelsByProvider(): [ProviderId, ModelSpec[]][] {
  const order: ProviderId[] = ["anthropic", "openai", "moonshot", "deepseek"];
  return order.map((p) => [p, MODELS.filter((m) => m.provider === p)]);
}

export function estimateCost(
  model: ModelSpec,
  inputTokens: number,
  outputTokens: number,
): number {
  return (inputTokens * model.priceIn + outputTokens * model.priceOut) / 1_000_000;
}

/**
 * A local approximation, deliberately not a tokenizer. Shipping a 2MB WASM
 * tokenizer to render a number in 12px grey text is a bad trade; ~3.8 chars
 * per token is within a few percent for prose and close enough for code.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export function formatContext(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}K`;
}
