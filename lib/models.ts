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
  {
    id: "claude-opus-4-5",
    provider: "anthropic",
    apiName: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    short: "Opus 4.5",
    blurb: "Deepest reasoning. Best for hard problems and long code.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 5,
    priceOut: 25,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "claude-sonnet-4-5",
    provider: "anthropic",
    apiName: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    short: "Sonnet 4.5",
    blurb: "The everyday default. Fast, and strong at code.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    apiName: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    short: "Haiku 4.5",
    blurb: "Quick and cheap. Good for short questions and titles.",
    contextWindow: 200_000,
    maxOutput: 32_000,
    priceIn: 1,
    priceOut: 5,
    vision: true,
    reasoning: false,
    tools: true,
  },
  /* The generation before, kept because a cast is only as good as its bench.
     Nothing on this list is offered in a menu — the menu is Armi's own models
     — so these are here to be *cast*: a second reading, a brief, a council
     seat. On a browser holding one company's key they are the difference
     between an Armi model that is two models and one that is one. */
  {
    id: "claude-opus-4-1",
    provider: "anthropic",
    apiName: "claude-opus-4-1",
    name: "Claude Opus 4.1",
    short: "Opus 4.1",
    blurb: "The previous deep model. Still strong, and dearer than what replaced it.",
    contextWindow: 200_000,
    maxOutput: 32_000,
    priceIn: 15,
    priceOut: 75,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "claude-opus-4-0",
    provider: "anthropic",
    apiName: "claude-opus-4-0",
    name: "Claude Opus 4",
    short: "Opus 4",
    blurb: "The first of that generation. Superseded twice over.",
    contextWindow: 200_000,
    maxOutput: 32_000,
    priceIn: 15,
    priceOut: 75,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "claude-sonnet-4-0",
    provider: "anthropic",
    apiName: "claude-sonnet-4-0",
    name: "Claude Sonnet 4",
    short: "Sonnet 4",
    blurb: "The previous everyday model. A good second reader.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "claude-3-7-sonnet",
    provider: "anthropic",
    apiName: "claude-3-7-sonnet-latest",
    name: "Claude Sonnet 3.7",
    short: "Sonnet 3.7",
    blurb: "The first that would show its working. Kept for the bench.",
    contextWindow: 200_000,
    maxOutput: 64_000,
    priceIn: 3,
    priceOut: 15,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "claude-3-5-haiku",
    provider: "anthropic",
    apiName: "claude-3-5-haiku-latest",
    name: "Claude Haiku 3.5",
    short: "Haiku 3.5",
    /* Marked blind on purpose. If this is wrong the cost is that it never
       gets handed a picture, which is nothing; the other way round is a
       request that fails on an image it was never able to read. Every
       uncertain capability on this list is written down the safe way. */
    blurb: "The cheapest thing Anthropic sells. Text only, and quick.",
    contextWindow: 200_000,
    maxOutput: 8_192,
    priceIn: 0.8,
    priceOut: 4,
    vision: false,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5.1",
    provider: "openai",
    apiName: "gpt-5.1",
    name: "GPT-5.1",
    short: "GPT-5.1",
    blurb: "Broad general knowledge. Strong all-rounder.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 1.25,
    priceOut: 10,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-5.1-mini",
    provider: "openai",
    apiName: "gpt-5.1-mini",
    name: "GPT-5.1 mini",
    short: "GPT-5.1 mini",
    blurb: "Most of the quality at a fraction of the price.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 0.25,
    priceOut: 2,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    apiName: "gpt-4.1",
    name: "GPT-4.1",
    short: "GPT-4.1",
    blurb: "Previous generation. Predictable, no reasoning step.",
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    priceIn: 2,
    priceOut: 8,
    vision: true,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5",
    provider: "openai",
    apiName: "gpt-5",
    name: "GPT-5",
    short: "GPT-5",
    blurb: "The previous flagship. Reasons, and reads pictures.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 1.25,
    priceOut: 10,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    apiName: "gpt-5-mini",
    name: "GPT-5 mini",
    short: "GPT-5 mini",
    blurb: "Cheap, and still reasons. A good second reader.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 0.25,
    priceOut: 2,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-5-nano",
    provider: "openai",
    apiName: "gpt-5-nano",
    name: "GPT-5 nano",
    short: "GPT-5 nano",
    blurb: "The cheapest that reasons at all. For briefs and checks.",
    contextWindow: 400_000,
    maxOutput: 128_000,
    priceIn: 0.05,
    priceOut: 0.4,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "o3",
    provider: "openai",
    apiName: "o3",
    name: "OpenAI o3",
    short: "o3",
    blurb: "The reasoning line. Slow, deliberate, good at proofs.",
    contextWindow: 200_000,
    maxOutput: 100_000,
    priceIn: 2,
    priceOut: 8,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "o4-mini",
    provider: "openai",
    apiName: "o4-mini",
    name: "OpenAI o4-mini",
    short: "o4-mini",
    blurb: "Small, and thinks before it answers. Strong on maths.",
    contextWindow: 200_000,
    maxOutput: 100_000,
    priceIn: 1.1,
    priceOut: 4.4,
    vision: true,
    reasoning: true,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    apiName: "gpt-4.1-mini",
    name: "GPT-4.1 mini",
    short: "GPT-4.1 mini",
    blurb: "A million tokens for very little. No reasoning step.",
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    priceIn: 0.4,
    priceOut: 1.6,
    vision: true,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-4.1-nano",
    provider: "openai",
    apiName: "gpt-4.1-nano",
    name: "GPT-4.1 nano",
    short: "GPT-4.1 nano",
    blurb: "The cheapest million-token window there is.",
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    priceIn: 0.1,
    priceOut: 0.4,
    vision: true,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-4o",
    provider: "openai",
    apiName: "gpt-4o",
    name: "GPT-4o",
    short: "GPT-4o",
    blurb: "The one that made these models multimodal. Fast, and older.",
    contextWindow: 128_000,
    maxOutput: 16_384,
    priceIn: 2.5,
    priceOut: 10,
    vision: true,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    apiName: "gpt-4o-mini",
    name: "GPT-4o mini",
    short: "GPT-4o mini",
    blurb: "Small, quick, sees. Cheap enough to check every answer.",
    contextWindow: 128_000,
    maxOutput: 16_384,
    priceIn: 0.15,
    priceOut: 0.6,
    vision: true,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "kimi-k2-thinking",
    provider: "moonshot",
    apiName: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    short: "K2 Thinking",
    blurb: "Shows its working. A very large open model, cheap for what it is.",
    contextWindow: 256_000,
    maxOutput: 32_000,
    priceIn: 0.6,
    priceOut: 2.5,
    vision: false,
    reasoning: true,
    tools: true,
  },
  {
    id: "kimi-latest",
    provider: "moonshot",
    apiName: "kimi-latest",
    name: "Kimi",
    short: "Kimi",
    /* Moonshot prices this one by how much you send — three tiers, and what
       is quoted here is the widest. A meter that flattered the model on a
       short thread and understated it on a long one would be worse than a
       number that is honest about the ceiling. */
    blurb: "Quick, inexpensive, reads images. Priced by how much you send.",
    contextWindow: 128_000,
    maxOutput: 16_000,
    priceIn: 1.4,
    priceOut: 4.2,
    vision: true,
    reasoning: false,
    tools: true,
  },
  {
    id: "kimi-k2-0905",
    provider: "moonshot",
    apiName: "kimi-k2-0905-preview",
    name: "Kimi K2",
    short: "K2",
    blurb: "The big open model without the thinking step. Quick for its size.",
    contextWindow: 256_000,
    maxOutput: 16_000,
    priceIn: 0.6,
    priceOut: 2.5,
    vision: false,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "kimi-k2-turbo",
    provider: "moonshot",
    apiName: "kimi-k2-turbo-preview",
    name: "Kimi K2 Turbo",
    short: "K2 Turbo",
    blurb: "The same model served fast, and priced for it.",
    contextWindow: 256_000,
    maxOutput: 16_000,
    priceIn: 2.4,
    priceOut: 10,
    vision: false,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "kimi-thinking",
    provider: "moonshot",
    apiName: "kimi-thinking-preview",
    name: "Kimi Thinking",
    short: "Kimi Thinking",
    blurb: "Reasons, and can read a picture. Dear, and the only one here that does both.",
    contextWindow: 128_000,
    maxOutput: 32_000,
    priceIn: 30,
    priceOut: 30,
    vision: true,
    reasoning: true,
    tools: false,
    legacy: true,
  },
  {
    id: "moonshot-v1-128k",
    provider: "moonshot",
    apiName: "moonshot-v1-128k",
    name: "Moonshot v1 128k",
    short: "v1 128k",
    blurb: "The generation before Kimi. Plain, predictable, roomy.",
    contextWindow: 128_000,
    maxOutput: 8_000,
    priceIn: 2,
    priceOut: 5,
    vision: false,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "moonshot-v1-32k",
    provider: "moonshot",
    apiName: "moonshot-v1-32k",
    name: "Moonshot v1 32k",
    short: "v1 32k",
    blurb: "The same, smaller and cheaper.",
    contextWindow: 32_000,
    maxOutput: 8_000,
    priceIn: 1,
    priceOut: 3,
    vision: false,
    reasoning: false,
    tools: true,
    legacy: true,
  },
  {
    id: "deepseek-chat",
    provider: "deepseek",
    apiName: "deepseek-chat",
    name: "DeepSeek V3",
    short: "V3",
    blurb: "Capable and unusually cheap. Good default for volume.",
    contextWindow: 128_000,
    maxOutput: 8_192,
    priceIn: 0.27,
    priceOut: 1.1,
    vision: false,
    reasoning: false,
    tools: true,
  },
  /* And DeepSeek, where this list is already complete. Their API exposes two
     names — `deepseek-chat` and `deepseek-reasoner` — and points them at
     whatever the current weights are. There is no third to add, and inventing
     one to make the column look as full as the others would be a request that
     fails at the wire. */
  {
    id: "deepseek-reasoner",
    provider: "deepseek",
    apiName: "deepseek-reasoner",
    name: "DeepSeek R1",
    short: "R1",
    blurb: "Shows its working. Slow, cheap, good at maths.",
    contextWindow: 128_000,
    maxOutput: 64_000,
    priceIn: 0.55,
    priceOut: 2.19,
    vision: false,
    reasoning: true,
    tools: false,
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-5";

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
