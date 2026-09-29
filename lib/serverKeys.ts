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
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "gemini_api_key", "GEMINI"],
  xai: ["XAI_API_KEY", "GROK_API_KEY", "xai_api_key", "grok_api_key", "XAI"],
  mistral: ["MISTRAL_API_KEY", "MISTRAL_KEY", "mistral_api_key", "MISTRAL"],
  qwen: ["DASHSCOPE_API_KEY", "QWEN_API_KEY", "qwen_api_key", "DASHSCOPE"],
  perplexity: ["PERPLEXITY_API_KEY", "PPLX_API_KEY", "perplexity_api_key", "PERPLEXITY"],
  groq: ["GROQ_API_KEY", "groq_api_key", "GROQ"],
  openrouter: ["OPENROUTER_API_KEY", "openrouter_api_key", "OPENROUTER"],
};

export function serverKeyFor(provider: string): string | undefined {
  const names = [PROVIDERS[provider as keyof typeof PROVIDERS]?.keyName, ...(ALIASES[provider] ?? [])].filter(Boolean) as string[];
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}
