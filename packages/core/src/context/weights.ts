/**
 * Ranking weights, in one file, deliberately.
 *
 * These numbers decide what the AI knows on every turn — which makes them the
 * highest-leverage constants in the product. Keeping them in a single named
 * module (rather than scattered as magic numbers through the scorer) means
 * tuning is a reviewable diff, and every ranking decision can be explained by
 * pointing at a line here.
 */

export interface Weights {
  explicit: number;
  lexicalMatch: number;
  recency: number;
  proximity: number;
  graphDistance: number;
  learningRelevance: number;
  pinned: number;
}

/**
 * `explicit` dominates by design. If the user selected a passage and asked
 * "why is this wrong?", nothing the retriever finds should outrank the thing
 * they pointed at. Getting this wrong is the difference between a product that
 * feels attentive and one that feels like it changes the subject.
 */
export const DEFAULT_WEIGHTS: Weights = {
  explicit: 10.0,
  lexicalMatch: 3.0,
  recency: 1.5,
  proximity: 2.0,
  graphDistance: 1.0,
  learningRelevance: 1.2,
  pinned: 2.5,
};

/**
 * Budget floors, as a fraction of the total context budget.
 *
 * These exist to prevent a single 400-page textbook from evicting the user's
 * own selection, their memories, or the conversation they are in the middle
 * of. Without floors, a greedy score-ordered pack degrades badly exactly when
 * the corpus gets large — which is precisely when context matters most.
 *
 * Floors are guarantees of *availability*, not of consumption: an unused floor
 * is released back to the general pool.
 */
export const BUDGET_FLOORS: Partial<Record<string, number>> = {
  selection: 0.20,
  conversationTurn: 0.20,
  memory: 0.08,
  projectIntent: 0.03,
};

/** Half-life in milliseconds for the recency decay curve. */
export const RECENCY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 3; // three days

/**
 * Characters per token. A deliberate approximation: the real number depends on
 * the tokenizer, which is model-specific, and the ranker must run before the
 * model is chosen. Budgets are set conservatively to absorb the error.
 */
export const CHARS_PER_TOKEN = 4;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);
