/**
 * Concept identity.
 *
 * Two mentions of "Price Elasticity of Demand" and "price elasticity of demand"
 * are the same concept; treating them as two is what makes knowledge graphs
 * degenerate into noise. Normalisation is deliberately conservative — it folds
 * case, punctuation and a small set of English inflections, and nothing else.
 * Aggressive stemming would merge genuinely distinct concepts, which is a worse
 * failure than missing a merge.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "as", "at", "by", "with", "from", "that", "this", "it",
]);

/** Stable identity key for a concept name. */
export function conceptKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // strip diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(singularise)
    .join(" ")
    .trim();
}

/** Handles only the regular English plural cases; leaves anything else alone. */
function singularise(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses") || word.endsWith("shes") || word.endsWith("ches")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }
  return word;
}

/** Tokenises text for lexical retrieval. Shares normalisation with conceptKey. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(singularise);
}
