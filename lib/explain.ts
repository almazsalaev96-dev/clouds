/**
 * Two small things a tutor does that a deck of cards never has.
 *
 * ## Why, briefly
 *
 * You got a card wrong and the answer is on the screen. What helps now is
 * not a conversation — it is three sentences on why that is the answer and
 * the thing people get wrong, said where you are, with the page it came
 * from quoted so you can see it was not made up. "Explain this" still takes
 * the card to the chat when three sentences are not enough; this is the
 * press before that one. Gemini Notebook's flashcards do the same and it is
 * the part of them students name.
 *
 * ## Try first
 *
 * Guessing at a question before reading the material makes the reading
 * stick better even when the guess is wrong — the pretesting effect, one
 * of the more replicated findings in the study of learning. So a page in
 * the Tutor can offer three questions before you read it; you try each one
 * in your head, then reveal the answer, and the line of the page it came
 * from lights up.
 *
 * Both run on the cheapest model to hand: short prompts, short answers,
 * and the page's own words as the only source where there is one.
 */
import { cheapestAvailable, complete, extractJson } from "./complete";
import { getConfigured } from "./configured";

export interface CardToExplain {
  front: string;
  back: string;
  /** The page or document the card was made from, when it can be found. */
  sourceName?: string;
  sourceText?: string;
}

const SOURCE_CHARS = 14_000;

export async function explainCard(card: CardToExplain, opts: { onText?: (s: string) => void; signal?: AbortSignal } = {}): Promise<string | null> {
  const withSource = Boolean(card.sourceText?.trim());
  const prompt = [
    `Somebody studying got this card wrong.`,
    `Question: ${card.front}`,
    `Answer: ${card.back}`,
    ``,
    `In at most three short sentences: why that is the answer, and the one thing people get wrong about it. Plain words, no preamble, no heading, no bullet points.`,
    withSource
      ? `Then, on its own line beginning with "> ", quote the one sentence from the source below that says so — copied exactly, word for word. If no sentence in it says so, write no quote at all.`
      : ``,
    withSource ? `\n--- ${card.sourceName ?? "source"} ---\n${card.sourceText!.slice(0, SOURCE_CHARS)}` : ``,
  ]
    .filter((l) => l !== ``)
    .join("\n");
  const modelId = cheapestAvailable(getConfigured()) ?? undefined;
  const out = await complete(prompt, { modelId, maxTokens: 320, temperature: 0.2, onText: opts.onText, signal: opts.signal });
  return out?.trim() || null;
}

export interface TryFirst {
  q: string;
  a: string;
  /** The page's own words the answer rests on, for lighting up. */
  quote?: string;
}

export async function tryFirst(pageWords: string, where: string, opts: { modelId?: string; signal?: AbortSignal } = {}): Promise<TryFirst[] | null> {
  const prompt = `Before somebody reads ${where}, write three questions for them to try first — the three things this page is really about, asked so that a person who has not read it yet could still have a go from what they already know.

Return JSON only: an array of three objects with "q" (the question, one sentence), "a" (the answer in one or two sentences, from the page) and "quote" (one sentence from the page, copied exactly, that the answer rests on). No prose, no fence.

--- the page ---
${pageWords.slice(0, SOURCE_CHARS)}`;
  const modelId = opts.modelId ?? cheapestAvailable(getConfigured()) ?? undefined;
  const out = await complete(prompt, { modelId, maxTokens: 900, temperature: 0.3, signal: opts.signal });
  if (!out) return null;
  const parsed = extractJson(out);
  if (!Array.isArray(parsed)) return null;
  const rows = parsed
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      q: String(r.q ?? "").trim(),
      a: String(r.a ?? "").trim(),
      quote: typeof r.quote === "string" && r.quote.trim().length >= 8 ? r.quote.trim() : undefined,
    }))
    .filter((r) => r.q && r.a)
    .slice(0, 3);
  return rows.length ? rows : null;
}

/** The lines of an explanation, with its quotation set apart. */
export function splitQuote(text: string): { body: string; quote?: string } {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^>\s?/.test(l));
  if (at < 0) return { body: text.trim() };
  const quote = lines[at].replace(/^>\s?/, "").trim().replace(/^[“"]|[”"]$/g, "");
  const body = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n").trim();
  return { body, quote: quote.length >= 8 ? quote : undefined };
}
