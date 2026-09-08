/** The one internal shape every provider is normalized into. §11. */

export type ProviderId = "openai" | "anthropic" | "google" | "deepseek";

export type Role = "user" | "assistant" | "system";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string; name?: string }
  | { type: "file"; mimeType: string; name: string; text: string };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type StopReason = "stop" | "length" | "aborted" | "error" | "refusal";

/**
 * Messages carry a parentId, so a conversation is a tree rendered as a linear
 * path. Edit and regenerate create siblings; nothing is ever destroyed.
 * Retrofitting this later is a rewrite, so it exists from the first commit.
 */
export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: Role;
  content: ContentBlock[];
  /** Reasoning trace, kept separate so it never outweighs the answer visually. */
  reasoning?: string;
  modelId?: string;
  usage?: Usage;
  latencyMs?: number;
  /** Time to first token — the number that actually predicts perceived speed. */
  ttftMs?: number;
  createdAt: number;
  stopReason?: StopReason;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  modelId: string;
  systemPrompt?: string;
  /** The current path through the message tree: the last message shown. */
  leafId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface ModelSpec {
  id: string;
  provider: ProviderId;
  /** The provider's own identifier, which is not always our id. */
  apiName: string;
  name: string;
  /** One line, plain language. Not marketing copy. */
  blurb: string;
  contextWindow: number;
  maxOutput: number;
  /** USD per 1M tokens. */
  priceIn: number;
  priceOut: number;
  vision: boolean;
  reasoning: boolean;
  tools: boolean;
  legacy?: boolean;
}

/** What a provider adapter emits. Every provider is reduced to this. */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "usage"; usage: Usage }
  | { type: "done"; stopReason: StopReason }
  | { type: "error"; error: ChatError };

/**
 * Errors are classified at the adapter boundary, so the UI never has to parse
 * a provider string and the user never sees one. §3, principle 6.
 */
export type ErrorKind =
  | "no_key"
  | "bad_key"
  | "rate_limit"
  | "quota"
  | "context_length"
  | "content_filter"
  | "unsupported_content"
  | "provider_down"
  | "network"
  | "timeout"
  | "unknown";

export interface ChatError {
  kind: ErrorKind;
  /** One sentence, plain language, addressed to the user. */
  message: string;
  /** What to do about it. Rendered as the action button's label. */
  action?: "retry" | "add_key" | "switch_model" | "shorten";
  retryAfterMs?: number;
  /** Kept for the console and the report-a-bug path. Never rendered raw. */
  detail?: string;
}

export interface ChatRequest {
  modelId: string;
  messages: Message[];
  systemPrompt?: string;
  params: ModelParams;
  /** Sent only when the server has no key for this provider. */
  clientKey?: string;
}
