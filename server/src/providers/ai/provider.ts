/**
 * The AI provider protocol.
 *
 * Everything above this line is written against `AIProvider`, never against a vendor.
 * Models change faster than products do, and a study workspace whose architecture
 * cannot survive that is a study workspace with a shelf life.
 */

import type { Schema } from "../../domain/schema.ts";

export interface ImagePart {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  /** Base64, no data: prefix, no newlines. */
  data: string;
}

export interface AIRequest {
  /** Which task this is, so the gateway can route models and set effort. */
  task: "tutor" | "check" | "handwriting" | "documentAnalysis" | "generate" | "review";
  system: string;
  /** Plain text of the assembled, budgeted, redacted context. */
  prompt: string;
  images?: ImagePart[];
  /** The contract the reply must satisfy. Enforced twice: by the model, then by us. */
  schema: Schema;
  maxOutputTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
}

export interface AIResult<T = unknown> {
  value: T;
  usage: AIUsage;
  /** True when the first reply failed validation and a repair round was needed. */
  repaired: boolean;
}

export class AIRefusal extends Error {
  readonly category: string | null;
  constructor(message: string, category: string | null) {
    super(message);
    this.name = "AIRefusal";
    this.category = category;
  }
}

export class AIUnavailable extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "AIUnavailable";
    this.retryable = retryable;
  }
}

export interface AIProvider {
  readonly name: string;
  /** Structured, validated, or it throws. There is no free-text escape hatch. */
  complete<T>(request: AIRequest): Promise<AIResult<T>>;
}
