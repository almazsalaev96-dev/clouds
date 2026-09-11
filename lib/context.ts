import type { Message, ModelParams, ModelSpec } from "./types";
import { estimateTokens } from "./models";
import { blockText } from "./db";

/**
 * Making a conversation fit the window it is going into.
 *
 * Without this the whole thread is sent every time and the provider answers a
 * long one with a hard error — which is the worst outcome available, because
 * the conversation still exists, the model could still answer, and the person
 * is simply stuck. The app even warned "this thread is nearly full" and then
 * did nothing about it, which is a warning that only tells you when to give up.
 *
 * What every serious assistant does instead is drop from the middle. Recency
 * carries most of the meaning in a conversation, and the opening turns are the
 * ones you are least likely to be referring to twenty exchanges later.
 *
 * Rules, in order of stubbornness:
 *
 *   1. The last message is never dropped. If it alone does not fit, the
 *      provider's own error is the honest answer, because nothing this
 *      function can do would make the request sendable.
 *   2. Room for the reply is reserved before anything is kept. A prompt that
 *      fits perfectly and leaves no space for an answer has not fit.
 *   3. Whole messages only. Half a turn is worse than no turn: the model reads
 *      the fragment as complete and answers something nobody asked.
 *   4. What was dropped is reported, never hidden. Silently forgetting the
 *      first half of a conversation and carrying on as if nothing happened is
 *      the single most disorienting thing an assistant can do.
 */

/** Estimates run low on structured text, and being wrong here costs a whole
 *  request. Everything below is measured against this fraction of the window. */
export const SAFETY = 0.92;

/**
 * Room kept for an answer when nobody has said how long the answer will be.
 *
 * The fitter knows — it has the params in hand and reserves exactly
 * `min(maxTokens, maxOutput)`. The router does not, because it is choosing the
 * model and the model is what `maxOutput` belongs to, so it reserves this
 * instead. Exported rather than written twice: a router working to one number
 * and a fitter to another produces a model chosen for a request the fitter
 * then has to trim, and the reader is told their conversation was cut by an
 * app that had just finished telling them which model it picked for its
 * length.
 */
export const REPLY = 8_000;

export interface Fitted {
  messages: Message[];
  /** How many whole turns were left out, oldest first. */
  dropped: number;
}

/** What one message costs, attachments included. */
export function costOf(m: Message): number {
  let n = estimateTokens(blockText(m.content));
  for (const b of m.content) {
    // A base64 image is not text and does not tokenise like it. Anthropic and
    // OpenAI both land near this for a typical screenshot; over-estimating is
    // the safe direction, since the cost of being low is a failed request.
    if (b.type === "image") n += 1_400;
    else if (b.type === "file") n += estimateTokens(b.text ?? "");
  }
  // Per-message framing: role, delimiters, and the wrapper each provider adds.
  return n + 8;
}

export function fitToContext(
  history: Message[],
  model: ModelSpec,
  params: ModelParams,
  systemPrompt = "",
): Fitted {
  if (history.length === 0) return { messages: history, dropped: 0 };

  const reply = Math.min(params.maxTokens, model.maxOutput);
  const overhead = estimateTokens(systemPrompt) + 32;
  const budget = Math.floor(model.contextWindow * SAFETY) - reply - overhead;

  // A window too small to hold anything is not a truncation problem; send the
  // last turn and let the provider say so in its own words.
  if (budget <= 0) return { messages: history.slice(-1), dropped: history.length - 1 };

  const costs = history.map(costOf);
  const total = costs.reduce((a, b) => a + b, 0);
  if (total <= budget) return { messages: history, dropped: 0 };

  // Walk backwards from the newest, keeping whole turns while they fit.
  let used = 0;
  let firstKept = history.length;
  for (let i = history.length - 1; i >= 0; i--) {
    if (used + costs[i] > budget) break;
    used += costs[i];
    firstKept = i;
  }

  // Rule 1: the last message goes regardless.
  if (firstKept >= history.length) firstKept = history.length - 1;

  /* A conversation that starts on an assistant turn reads as though the model
     spoke first, which changes how it answers. Step back to the user turn that
     prompted it when one is within reach, and forward past it otherwise. */
  if (history[firstKept].role === "assistant") {
    const prior = firstKept - 1;
    if (prior >= 0 && used + costs[prior] <= budget) firstKept = prior;
    else if (firstKept + 1 < history.length) firstKept += 1;
  }

  return { messages: history.slice(firstKept), dropped: firstKept };
}
