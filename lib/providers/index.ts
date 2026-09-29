import type { ChatRequest, ProviderId, StreamEvent } from "../types";
import { getModel } from "../models";
import { streamAnthropic } from "./anthropic";
import { streamOpenAI, streamDeepSeek, streamMoonshot, streamGoogle, streamXai, streamMistral, streamQwen, streamPerplexity, streamGroq, streamOpenRouter } from "./openai";
import { streamOpenAIResponses } from "./responses";

type Adapter = (req: ChatRequest, key: string, signal: AbortSignal) => AsyncGenerator<StreamEvent>;

/* A model on the person's own computer is called from their browser
   (`lib/local.ts`); the server cannot reach it and must not pretend to. */
// eslint-disable-next-line require-yield
async function* notHere(): AsyncGenerator<StreamEvent> {
  yield { type: "error", error: { kind: "network", message: "A model on your computer is reached from your browser, not from Armi's server. Reload the page and try again.", action: "retry" } };
}

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
  local: notHere,
};

export function adapterFor(modelId: string): Adapter {
  /* The server has no list of what is installed on anybody's computer, so
     `getModel` would answer the default engine for a local id — and the
     question would be sent, and billed, to a company it was never meant
     for. Caught by the id's own shape instead. */
  if (modelId.startsWith("local/")) return notHere;
  const model = getModel(modelId);
  /* One provider has two APIs and they take different shapes, so the model
     says which — the same way it says how it is told to think. */
  if (model.wire === "responses") return streamOpenAIResponses;
  return ADAPTERS[model.provider];
}

export { classifyError } from "./shared";
