/**
 * Claude implementation of `AIProvider`.
 *
 * Structured outputs do the first layer of enforcement, our own validator does the
 * second, and a single repair round handles the rest. If a reply still does not match
 * the contract after that, the request fails loudly rather than handing the app a shape
 * it did not ask for.
 */

import Anthropic from "@anthropic-ai/sdk";
import { describeIssues, toJSONSchema, validate } from "../../domain/schema.ts";
import {
  AIRefusal, AIUnavailable,
  type AIProvider, type AIRequest, type AIResult,
} from "./provider.ts";

export interface AnthropicProviderOptions {
  apiKey: string;
  models: Record<AIRequest["task"], string>;
  defaultMaxOutputTokens: number;
  defaultEffort: "low" | "medium" | "high" | "xhigh" | "max";
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly options: AnthropicProviderOptions;

  constructor(options: AnthropicProviderOptions) {
    this.options = options;
    this.client = new Anthropic({ apiKey: options.apiKey });
  }

  async complete<T>(request: AIRequest): Promise<AIResult<T>> {
    const model = this.options.models[request.task];
    const jsonSchema = toJSONSchema(request.schema);

    const content: Anthropic.ContentBlockParam[] = [];
    for (const image of request.images ?? []) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.data },
      });
    }
    content.push({ type: "text", text: request.prompt });

    const messages: Anthropic.MessageParam[] = [{ role: "user", content }];

    const first = await this.send(model, request, messages, jsonSchema);
    const parsedFirst = this.parse(first.text);
    if (parsedFirst.ok) {
      const check = validate<T>(request.schema, parsedFirst.value);
      if (check.ok) {
        return { value: check.value, usage: first.usage, repaired: false };
      }
      // One repair round, quoting the exact problem. Asking twice with no new
      // information just spends money on the same mistake.
      messages.push({ role: "assistant", content: first.text });
      messages.push({
        role: "user",
        content:
          `That reply did not match the required shape: ${describeIssues(check.issues)}. ` +
          `Reply again with the same content corrected to fit the schema exactly.`,
      });
    } else {
      messages.push({ role: "assistant", content: first.text });
      messages.push({
        role: "user",
        content: "That reply was not valid JSON. Reply again with only the JSON object.",
      });
    }

    const second = await this.send(model, request, messages, jsonSchema);
    const parsedSecond = this.parse(second.text);
    if (!parsedSecond.ok) {
      throw new AIUnavailable("The model did not return usable JSON after a repair round.", false);
    }
    const finalCheck = validate<T>(request.schema, parsedSecond.value);
    if (!finalCheck.ok) {
      throw new AIUnavailable(
        `The model's reply did not match the contract: ${describeIssues(finalCheck.issues)}`,
        false,
      );
    }
    const usage = {
      ...second.usage,
      inputTokens: first.usage.inputTokens + second.usage.inputTokens,
      outputTokens: first.usage.outputTokens + second.usage.outputTokens,
      cacheReadTokens: first.usage.cacheReadTokens + second.usage.cacheReadTokens,
    };
    return { value: finalCheck.value, usage, repaired: true };
  }

  private async send(
    model: string,
    request: AIRequest,
    messages: Anthropic.MessageParam[],
    jsonSchema: Record<string, unknown>,
  ): Promise<{ text: string; usage: AIResult["usage"] }> {
    let response: Anthropic.Message;
    try {
      // Streaming so a long reply cannot hit the HTTP timeout; the caller wants the
      // whole object, so the final message is what we take.
      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages,
        thinking: { type: "adaptive" },
        output_config: {
          effort: request.effort ?? this.options.defaultEffort,
          format: { type: "json_schema", schema: jsonSchema },
        },
      });
      response = await stream.finalMessage();
    } catch (error) {
      throw translate(error);
    }

    if (response.stop_reason === "refusal") {
      throw new AIRefusal(
        "The model declined this request.",
        response.stop_details?.category ?? null,
      );
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        model: response.model,
      },
    };
  }

  private parse(text: string): { ok: true; value: unknown } | { ok: false } {
    const trimmed = text.trim();
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      // Structured outputs make fences unlikely, but recovering from one is cheaper
      // than a whole extra round trip.
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return { ok: true, value: JSON.parse(trimmed.slice(start, end + 1)) };
        } catch { /* fall through */ }
      }
      return { ok: false };
    }
  }
}

function translate(error: unknown): Error {
  if (error instanceof Anthropic.RateLimitError) {
    return new AIUnavailable("The tutor is busy. Try again in a moment.", true);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    // Deliberately vague to the caller; the operator sees the real cause in the log.
    return new AIUnavailable("The tutor is not configured correctly.", false);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AIUnavailable("Could not reach the tutor.", true);
  }
  if (error instanceof Anthropic.APIError) {
    return new AIUnavailable(`The tutor could not answer (${error.status}).`, error.status >= 500);
  }
  return error instanceof Error ? error : new Error(String(error));
}
