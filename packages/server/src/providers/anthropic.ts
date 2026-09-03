/**
 * Anthropic provider — the adapter for the model port defined in core.
 *
 * This lives in the server, not in core, for two reasons: the SDK dependency
 * stays out of the layer holding all user knowledge, and the API key never
 * exists anywhere a client could reach (§30).
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ModelEvent,
  ModelMessage,
  ModelProvider,
  ModelRequest,
  ProviderCapabilities,
} from "../../../core/src/model/types.ts";
import type { Failure } from "../../../core/src/types/index.ts";

export interface AnthropicModelConfig {
  id: string;
  model: string;
  capabilities: ProviderCapabilities;
  /**
   * Adaptive thinking. On Claude Opus 5 thinking is on by default, so this is
   * about being explicit rather than enabling it; `display: "summarized"`
   * matters because the default omits reasoning entirely, which reads to a
   * user as a long unexplained pause.
   */
  thinking?: boolean;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * The fleet.
 *
 * Opus 5 handles anything the user judges. Haiku handles the constant
 * background work — titling, classification — where paying frontier prices
 * would be pure waste. Sonnet sits between them as the fallback if Opus is
 * unavailable. Costs are per million input tokens.
 */
export const MODELS: AnthropicModelConfig[] = [
  {
    id: "opus-5",
    model: "claude-opus-5",
    thinking: true,
    effort: "high",
    capabilities: {
      qualityRank: 100, reasoning: "high", contextTokens: 1_000_000,
      multimodal: true, costPerMTokIn: 5, costPerMTokOut: 25,
    },
  },
  {
    id: "sonnet-5",
    model: "claude-sonnet-5",
    thinking: true,
    capabilities: {
      qualityRank: 70, reasoning: "high", contextTokens: 1_000_000,
      multimodal: true, costPerMTokIn: 2, costPerMTokOut: 10,
    },
  },
  {
    id: "haiku-4-5",
    model: "claude-haiku-4-5",
    capabilities: {
      qualityRank: 40, reasoning: "low", contextTokens: 200_000,
      multimodal: true, costPerMTokIn: 1, costPerMTokOut: 5,
    },
  },
];

const NO_KEY: Failure = {
  code: "no_api_key",
  message:
    "No AI model is connected yet. Set ANTHROPIC_API_KEY on the server to enable " +
    "conversation — reading, search, notes and artifacts work without it.",
  retryable: false,
};

export class AnthropicProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  private config: AnthropicModelConfig;
  private client: Anthropic | null;

  constructor(config: AnthropicModelConfig, apiKey: string | undefined) {
    this.id = config.id;
    this.config = config;
    this.capabilities = config.capabilities;
    // A bare client also resolves an `ant auth login` profile, so an unset
    // ANTHROPIC_API_KEY does not by itself mean there are no credentials.
    this.client = apiKey || process.env.ANTHROPIC_AUTH_TOKEN
      ? new Anthropic(apiKey ? { apiKey } : {})
      : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  unavailableReason(): Failure | null {
    return this.client ? null : NO_KEY;
  }

  async *stream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ModelEvent> {
    if (!this.client) {
      yield { type: "failure", failure: NO_KEY };
      return;
    }

    try {
      const stream = this.client.messages.stream(
        {
          model: this.config.model,
          max_tokens: request.maxTokens,
          // The identity prefix is stable across every turn; marking it
          // cacheable is where the savings are, since the volatile context
          // follows it.
          system: [
            {
              type: "text",
              text: request.system,
              ...(request.cacheablePrefix ? { cache_control: { type: "ephemeral" as const } } : {}),
            },
          ],
          messages: request.messages.map(toSdkMessage),
          ...(this.config.thinking
            ? { thinking: { type: "adaptive" as const, display: "summarized" as const } }
            : {}),
          ...(this.config.effort ? { output_config: { effort: this.config.effort } } : {}),
          ...(request.tools?.length
            ? {
                tools: request.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
                })),
              }
            : {}),
        },
        { signal },
      );

      // Stream text as it arrives so the interface never sits still, then take
      // tool calls from the final message where their JSON is complete and
      // already parsed — accumulating partial input_json_delta by hand is a
      // reliable source of malformed-argument bugs.
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          event.delta.text
        ) {
          yield { type: "text", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();

      if (final.stop_reason === "refusal") {
        yield {
          type: "failure",
          failure: {
            code: "model_error",
            message: "The model declined to answer that. Try rephrasing the request.",
            retryable: false,
            detail: final.stop_details?.explanation ?? undefined,
          },
        };
        return;
      }

      for (const block of final.content) {
        if (block.type === "tool_use") {
          yield { type: "tool_use", id: block.id, name: block.name, input: block.input };
        }
      }

      yield {
        type: "done",
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        model: final.model,
      };
    } catch (error) {
      yield { type: "failure", failure: describe(error) };
    }
  }
}

function toSdkMessage(message: ModelMessage): Anthropic.MessageParam {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content };
  }
  return {
    role: message.role,
    content: message.content.map((block): Anthropic.ContentBlockParam => {
      switch (block.type) {
        case "text":
          return { type: "text", text: block.text };
        case "tool_use":
          return { type: "tool_use", id: block.id, name: block.name, input: block.input };
        case "tool_result":
          return {
            type: "tool_result",
            tool_use_id: block.toolUseId,
            content: block.content,
            ...(block.isError ? { is_error: true } : {}),
          };
      }
    }),
  };
}

/** Turns SDK errors into the typed failures the interface knows how to render. */
function describe(error: unknown): Failure {
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      code: "no_api_key",
      message: "The AI credentials were rejected. Check the server's API key.",
      retryable: false,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      code: "rate_limited",
      message: "The AI is rate limited right now. Wait a moment and try again.",
      retryable: true,
    };
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return { code: "timeout", message: "The AI took too long to respond.", retryable: true };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return {
      code: "model_unavailable",
      message: "Could not reach the AI. Check the server's network connection.",
      retryable: true,
    };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      code: "model_error",
      message: "The AI returned an error.",
      retryable: (error.status ?? 500) >= 500,
      detail: error.message,
    };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "timeout", message: "That request was cancelled.", retryable: true };
  }
  return {
    code: "model_error",
    message: "Something went wrong talking to the AI.",
    retryable: true,
    detail: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Builds every configured provider. Unavailable ones are still registered so
 * the router can report *why* rather than claiming nothing is configured.
 */
export function anthropicProviders(apiKey = process.env.ANTHROPIC_API_KEY): AnthropicProvider[] {
  return MODELS.map((config) => new AnthropicProvider(config, apiKey));
}
