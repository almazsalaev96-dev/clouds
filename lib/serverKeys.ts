/**
 * The server's own provider keys, by the name the provider table gives and
 * by the names people actually type into a hosting dashboard. A key saved
 * as `gpt_api_key` is an OpenAI key that nobody meant to hide; reading it
 * costs nothing and not reading it costs every picture.
 */
import { PROVIDERS } from "./models";

const ALIASES: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY", "OPENAI_KEY", "GPT_API_KEY", "gpt_api_key", "OPENAI"],
  anthropic: ["ANTHROPIC_API_KEY", "ANTHROPIC_KEY", "CLAUDE_API_KEY", "claude_api_key", "ANTHROPIC"],
  moonshot: ["MOONSHOT_API_KEY", "MOONSHOT_KEY", "KIMI_API_KEY", "kimi_api_key", "MOONSHOT"],
  deepseek: ["DEEPSEEK_API_KEY", "DEEPSEEK_KEY", "deepseek_api_key", "DEEPSEEK"],
};

export function serverKeyFor(provider: string): string | undefined {
  const names = [PROVIDERS[provider as keyof typeof PROVIDERS]?.keyName, ...(ALIASES[provider] ?? [])].filter(Boolean) as string[];
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}
