import type { ChatRequest, ProviderId, StreamEvent } from "../types";
import { getModel } from "../models";
import { streamAnthropic } from "./anthropic";
import { streamOpenAI, streamDeepSeek, streamMoonshot } from "./openai";

type Adapter = (req: ChatRequest, key: string, signal: AbortSignal) => AsyncGenerator<StreamEvent>;

/** Adding a fifth provider is one new file and one line here. */
const ADAPTERS: Record<ProviderId, Adapter> = {
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  moonshot: streamMoonshot,
  deepseek: streamDeepSeek,
};

export function adapterFor(modelId: string): Adapter {
  return ADAPTERS[getModel(modelId).provider];
}

export { classifyError, baseUrlFor } from "./shared";
