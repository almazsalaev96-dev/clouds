/** Provider selection. Server-only: importing this from a client component is a bug. */

import "server-only";
import { AnthropicProvider } from "./anthropic";
import { NullProvider, type AIProvider } from "./provider";

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;

  const kind = process.env.AI_PROVIDER ?? "none";
  if (kind === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY,
      {
        fast: process.env.AI_MODEL_FAST ?? "claude-haiku-4-5-20251001",
        reasoning: process.env.AI_MODEL_REASONING ?? "claude-opus-5",
      },
      Number(process.env.AI_MAX_TOKENS_PER_REQUEST ?? 4000),
      Number(process.env.AI_DAILY_REQUEST_BUDGET ?? 500),
    );
  } else {
    cached = new NullProvider();
  }
  return cached;
}

export function aiAvailable(): boolean {
  return getProvider().available;
}

export * from "./provider";
export * from "./prompts";
