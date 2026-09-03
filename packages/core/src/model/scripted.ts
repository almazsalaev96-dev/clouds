/**
 * A scripted provider used only by tests.
 *
 * This is a test double, not a fallback. It is deliberately not registered in
 * production wiring: a system that quietly answers with canned text when the
 * real model is unreachable would be exactly the "fake intelligence" §50
 * forbids. When no model is available, the product says so (§33).
 */

import type { Failure } from "../types/index.ts";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
  ProviderCapabilities,
} from "./types.ts";

export interface ScriptedTurn {
  text?: string;
  toolUse?: { name: string; input: unknown };
  failure?: Failure;
}

export class ScriptedProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  /** Requests this provider received, so tests can assert on prompt content. */
  readonly received: ModelRequest[] = [];
  private turns: ScriptedTurn[];
  private available: boolean;

  constructor(opts: {
    id?: string;
    turns: ScriptedTurn[];
    capabilities?: Partial<ProviderCapabilities>;
    available?: boolean;
  }) {
    this.id = opts.id ?? "scripted";
    this.turns = [...opts.turns];
    this.available = opts.available ?? true;
    this.capabilities = {
      qualityRank: 100,
      reasoning: "high",
      contextTokens: 1_000_000,
      multimodal: true,
      costPerMTokIn: 0,
      costPerMTokOut: 0,
      ...opts.capabilities,
    };
  }

  isAvailable(): boolean {
    return this.available;
  }

  unavailableReason(): Failure | null {
    return this.available
      ? null
      : { code: "model_unavailable", message: "Scripted provider disabled.", retryable: false };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    this.received.push(request);
    const turn = this.turns.shift() ?? { text: "" };

    if (turn.failure) {
      yield { type: "failure", failure: turn.failure };
      return;
    }
    if (turn.text) {
      // Emit in chunks so streaming consumers are exercised realistically.
      for (const chunk of turn.text.match(/.{1,24}/gs) ?? []) {
        yield { type: "text", text: chunk };
      }
    }
    if (turn.toolUse) {
      yield {
        type: "tool_use",
        id: `call_${this.received.length}`,
        name: turn.toolUse.name,
        input: turn.toolUse.input,
      };
    }
    yield {
      type: "done",
      inputTokens: Math.ceil(JSON.stringify(request.messages).length / 4),
      outputTokens: Math.ceil((turn.text?.length ?? 0) / 4),
      model: this.id,
    };
  }
}
