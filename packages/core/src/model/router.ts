/**
 * Task-based model routing (§31).
 *
 * Picks the cheapest available provider that actually meets the task's
 * requirements. This is a real cost-control mechanism, not a gesture at model
 * agnosticism: titling a conversation and diagnosing a misconception should
 * not cost the same, and in a product where every turn assembles rich context,
 * that difference compounds fast.
 */

import type { Failure, Result } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";
import {
  TASK_PROFILES,
  type ModelProvider,
  type ModelTask,
  type ReasoningDepth,
} from "./types.ts";

const DEPTH_RANK: Record<ReasoningDepth, number> = { none: 0, low: 1, high: 2 };

export class ModelRouter {
  private providers: ModelProvider[] = [];

  register(provider: ModelProvider): this {
    this.providers.push(provider);
    return this;
  }

  /** Providers that meet the task profile, best choice for that task first. */
  candidates(task: ModelTask): ModelProvider[] {
    const profile = TASK_PROFILES[task];
    const qualified = this.providers.filter((p) =>
      DEPTH_RANK[p.capabilities.reasoning] >= DEPTH_RANK[profile.minReasoning] &&
      p.capabilities.contextTokens >= profile.minContextTokens &&
      (!profile.needsMultimodal || p.capabilities.multimodal));

    return qualified.sort((a, b) =>
      profile.optimiseFor === "quality"
        // Most capable first; cost breaks ties between equals.
        ? b.capabilities.qualityRank - a.capabilities.qualityRank ||
          a.capabilities.costPerMTokIn - b.capabilities.costPerMTokIn
        // Cheapest first; capability breaks ties.
        : a.capabilities.costPerMTokIn - b.capabilities.costPerMTokIn ||
          b.capabilities.qualityRank - a.capabilities.qualityRank);
  }

  /**
   * Resolves a task to a usable provider, skipping any that are configured but
   * currently unavailable so a missing key on one model does not take down a
   * capability another model could serve.
   */
  select(task: ModelTask): Result<ModelProvider> {
    const candidates = this.candidates(task);
    if (candidates.length === 0) {
      return fail(
        "model_unavailable",
        `No model is configured that can handle ${task} work.`,
      );
    }
    const usable = candidates.find((p) => p.isAvailable());
    if (usable) return ok(usable);

    // Every candidate is unavailable — report the first one's actual reason
    // rather than a generic error, so the user learns what to fix.
    const reason: Failure | null = candidates[0].unavailableReason();
    return {
      ok: false,
      failure: reason ?? {
        code: "model_unavailable",
        message: "The AI model is not reachable right now.",
        retryable: true,
      },
    };
  }

  get registered(): readonly ModelProvider[] {
    return this.providers;
  }
}
