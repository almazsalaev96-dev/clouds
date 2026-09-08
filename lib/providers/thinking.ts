/**
 * How much of a request's allowance may be spent thinking.
 *
 * Both Anthropic and Google take a thinking budget out of the same ceiling the
 * answer has to fit inside, so a budget set as "the ceiling minus a token" is a
 * request that thinks and then has nowhere to write. Two failures came from
 * that: twelve flashcards asked for 8192 tokens, spent 7168 of them thinking,
 * truncated the JSON, and reported a bad API key; a six-word title asked for
 * 1024, produced a budget equal to the ceiling, and was rejected outright — so
 * conversations silently went untitled for anyone whose only key was Anthropic.
 *
 * The budget is therefore a fraction of the allowance, never a remainder, and a
 * request with no room to think simply does not think. One helper, because the
 * two adapters drifting apart is how this happened.
 */
export function thinkingBudget(
  maxTokens: number,
  effort: "low" | "medium" | "high" | undefined,
): number | null {
  if (!effort) return null;
  const ceiling = { low: 4000, medium: 10000, high: 24000 }[effort];
  const half = Math.floor(maxTokens / 2);
  const budget = Math.min(ceiling, half);
  // Below the providers' own floor there is no point pretending.
  return budget >= 1024 ? budget : null;
}
