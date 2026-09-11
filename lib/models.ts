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
  google: {
    name: "Google",
    keyName: "GOOGLE_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPrefix: "",
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
 * Blurbs say what the model is *for*, in the words a user would use. A picker
 * that lists twelve names and no guidance has pushed the decision back onto
 * the person least equipped to make it.
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
    id: "gemini-3-pro",
    provider: "google",
    apiName: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    short: "Gemini 3 Pro",
    blurb: "Huge context. Best when you paste a lot at once.",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    priceIn: 2,
    priceOut: 12,
    vision: true,
    reasoning: true,
    tools: true,
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    apiName: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    short: "2.5 Flash",
    blurb: "Very fast, very cheap, million-token context.",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    priceIn: 0.3,
    priceOut: 2.5,
    vision: true,
    reasoning: true,
    tools: true,
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
  const order: ProviderId[] = ["anthropic", "openai", "google", "deepseek"];
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
