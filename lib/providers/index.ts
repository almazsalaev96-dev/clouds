import type { ChatRequest, ProviderId, StreamEvent } from "../types";
import { getModel } from "../models";
import { streamAnthropic } from "./anthropic";
import { streamOpenAI, streamDeepSeek, streamMoonshot, streamGoogle, streamXai, streamMistral, streamQwen, streamPerplexity, streamGroq, streamOpenRouter } from "./openai";
import { streamOpenAIResponses } from "./responses";

type Adapter = (req: ChatRequest, key: string, signal: AbortSignal) => AsyncGenerator<StreamEvent>;

/** Adding a fifth provider is one new file and one line here. */
const ADAPTERS: Record<ProviderId, Adapter> = {
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  moonshot: streamMoonshot,
  deepseek: streamDeepSeek,
  google: streamGoogle,
  xai: streamXai,
  mistral: streamMistral,
  qwen: streamQwen,
  perplexity: streamPerplexity,
  groq: streamGroq,
  openrouter: streamOpenRouter,
};

export function adapterFor(modelId: string): Adapter {
  const model = getModel(modelId);
  /* One provider has two APIs and they take different shapes, so the model
     says which — the same way it says how it is told to think. */
  if (model.wire === "responses") return streamOpenAIResponses;
  return ADAPTERS[model.provider];
}

export { classifyError } from "./shared";
