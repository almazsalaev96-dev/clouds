/**
 * Model abstraction (§31).
 *
 * The abstraction is at the *task* level, not at "swap the model". A naive
 * provider swap silently degrades quality, because prompts are in practice
 * model-specific. What the application asks for is "do this kind of work";
 * the router decides which model that implies.
 *
 * This file is the port. Adapters (the real Anthropic provider) live outside
 * core, so the intelligence layer keeps zero runtime dependencies and stays
 * testable with no network and no API key.
 */

import type { Failure } from "../types/index.ts";

export type ModelTask =
  /** Open-ended dialogue with the user. Quality-sensitive. */
  | "conversation"
  /** Multi-step problem solving, diagnosis, evaluation. Needs depth. */
  | "reasoning"
  /** Pull structured data out of text. Cheap, high volume. */
  | "extraction"
  /** Label something from a small set. Cheapest, highest volume. */
  | "classification"
  /** Name a conversation or artifact. Trivial, must not cost real money. */
  | "titling";

export type ReasoningDepth = "none" | "low" | "high";

export interface TaskProfile {
  minReasoning: ReasoningDepth;
  minContextTokens: number;
  needsMultimodal: boolean;
  /** True when a human is waiting on the first token. */
  latencySensitive: boolean;
}

/**
 * What each kind of work actually requires. Keeping this as data rather than
 * scattered conditionals means adding a model is a table edit, and the routing
 * rationale is legible.
 */
export const TASK_PROFILES: Record<ModelTask, TaskProfile> = {
  conversation:   { minReasoning: "high", minContextTokens: 100_000, needsMultimodal: true,  latencySensitive: true },
  reasoning:      { minReasoning: "high", minContextTokens: 100_000, needsMultimodal: false, latencySensitive: false },
  extraction:     { minReasoning: "low",  minContextTokens: 32_000,  needsMultimodal: false, latencySensitive: false },
  classification: { minReasoning: "none", minContextTokens: 8_000,   needsMultimodal: false, latencySensitive: true },
  titling:        { minReasoning: "none", minContextTokens: 4_000,   needsMultimodal: false, latencySensitive: true },
};

export interface ProviderCapabilities {
  reasoning: ReasoningDepth;
  contextTokens: number;
  multimodal: boolean;
  /** USD per million input tokens. Drives "cheapest that qualifies". */
  costPerMTokIn: number;
  costPerMTokOut: number;
}

/**
 * Content blocks mirror the shape the Messages API actually uses, so a tool
 * round-trip survives the abstraction rather than being flattened into prose.
 * Flattening is tempting and quietly destroys the model's ability to reason
 * about which call produced which result.
 */
export type ModelContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

export interface ModelMessage {
  role: "user" | "assistant";
  content: string | ModelContent[];
}

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
  maxTokens: number;
  task: ModelTask;
  tools?: ToolSpec[];
  /** Cache-friendly: stable prefix content the provider may mark cacheable. */
  cacheablePrefix?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ModelEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "done"; inputTokens: number; outputTokens: number; model: string }
  | { type: "failure"; failure: Failure };

export interface ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  /** False when the provider cannot run — e.g. no key configured. */
  isAvailable(): boolean;
  /** Why it is unavailable, for honest display (§33). */
  unavailableReason(): Failure | null;
  stream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ModelEvent>;
}
