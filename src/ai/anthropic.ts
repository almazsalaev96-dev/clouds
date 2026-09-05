/**
 * Anthropic provider.
 *
 * Model routing is explicit: mechanical work (classification, card drafting,
 * summarising) goes to the fast model, and work where being wrong costs the
 * student marks (marking, tutoring, question generation) goes to the reasoning
 * model. Routing by task rather than sending everything to the largest model is
 * the single biggest lever on cost, and it does not cost quality where it
 * matters.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AIUnavailableError,
  RequestBudget,
  ResponseCache,
  type AIProvider,
  type GenerateOptions,
  type GenerateResult,
  type StructuredOptions,
  FALLBACKS,
} from "./provider";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly available = true;
  private client: Anthropic;
  private cache = new ResponseCache();
  private budget: RequestBudget;

  constructor(
    apiKey: string,
    private readonly models: { fast: string; reasoning: string },
    private readonly maxTokens: number,
    dailyBudget: number,
  ) {
    this.client = new Anthropic({ apiKey });
    this.budget = new RequestBudget(dailyBudget);
  }

  private model(tier?: "fast" | "reasoning") {
    return tier === "reasoning" ? this.models.reasoning : this.models.fast;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const cached = this.cache.get(opts);
    if (cached) return cached;
    this.budget.check();

    const started = Date.now();
    try {
      const res = await this.client.messages.create({
        model: this.model(opts.tier),
        max_tokens: Math.min(opts.maxTokens ?? 1500, this.maxTokens),
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const result: GenerateResult = {
        text,
        model: res.model,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cached: false,
        ms: Date.now() - started,
      };
      this.cache.put(opts, result);
      return result;
    } catch (err) {
      throw new AIUnavailableError(
        err instanceof Error ? err.message : "The AI request failed.",
        FALLBACKS[opts.feature],
      );
    }
  }

  /**
   * Structured output via a forced tool call. Validation is strict: a response
   * that does not satisfy the schema is an error, not something to paper over —
   * a half-parsed mark scheme is worse than no mark scheme.
   */
  async generateStructured<T>(opts: StructuredOptions<T>): Promise<{ value: T; meta: GenerateResult }> {
    this.budget.check();
    const started = Date.now();
    try {
      const res = await this.client.messages.create({
        model: this.model(opts.tier),
        max_tokens: Math.min(opts.maxTokens ?? 2000, this.maxTokens),
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: [
          {
            name: opts.schemaName,
            description: `Return the result as ${opts.schemaName}.`,
            input_schema: opts.schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: opts.schemaName },
      });

      const toolUse = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) {
        throw new Error("The model did not return structured output.");
      }

      const value = opts.validate(toolUse.input);
      return {
        value,
        meta: {
          text: JSON.stringify(toolUse.input),
          model: res.model,
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          cached: false,
          ms: Date.now() - started,
        },
      };
    } catch (err) {
      throw new AIUnavailableError(
        err instanceof Error ? err.message : "The AI request failed.",
        FALLBACKS[opts.feature],
      );
    }
  }
}
