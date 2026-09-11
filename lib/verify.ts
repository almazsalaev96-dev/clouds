import { complete, extractJson, type Progress } from "./complete";

/**
 * A second opinion, kept in its own module.
 *
 * Not because it is large, but because of who reaches it: only the chat shell,
 * and only through a dynamic import at the moment somebody presses the button.
 * Left in `generate.ts` it would have ridden into the first load anyway — the
 * canvas imports that file eagerly, so anything in it is in the bundle drawn
 * before a person has typed a word, however lazily the one caller asks for it.
 */

/** What a second opinion came back with. */
export interface Verdict {
  /** Where the two ended up. */
  agrees: "agrees" | "partly" | "disagrees";
  /** The disagreement, or the confirmation, in the checker's own words. */
  text: string;
  /** Which model did the checking — the whole point is that it is another one. */
  modelId: string;
}

/**
 * Ask a *different* model whether the first one was right.
 *
 * This is the one thing an app holding four providers' keys can do that no
 * single-provider app can do honestly, and it is the thing that makes an
 * answer trustworthy rather than merely fluent. A model marking its own
 * homework agrees with itself: it reproduces the same reasoning from the same
 * weights and reports that it checks out, which is not verification, it is an
 * echo with extra steps.
 *
 * So the checker is chosen from a **different provider**, and where there is
 * no second provider configured this refuses rather than pretending. A check
 * that could only ever say yes is worse than no check, because it is evidence
 * to a reader and nothing to the person who wrote it.
 *
 * It is given the question and the answer and not told which model produced
 * it. A checker told it is reviewing a well-known model's work is a checker
 * with a thumb on the scale, in whichever direction.
 */
export async function verifyAnswer(
  question: string,
  answer: string,
  checkerId: string,
  progress?: Progress,
): Promise<Verdict | null> {
  const out = await complete(
    `Someone asked a question and got the answer below, from a different assistant. Check it.

You are not rewriting it and not improving it. You are saying whether it is right.

Answer with JSON and nothing else:

{"agrees": "agrees" | "partly" | "disagrees",
 "text": "what you found, in markdown"}

Rules:
- "agrees" means you checked it and found nothing wrong. Say briefly what you checked, not just that you agree.
- "partly" means the substance is right but something is wrong, missing, or overstated. Name it precisely.
- "disagrees" means something important is wrong. Say what, say why, and give the correct version.
- Be specific about *which claim*. "The third paragraph says X; that is wrong because Y" is useful. "Some details may be inaccurate" is not, and is the failure mode to avoid.
- Where the question has no single right answer, say that rather than manufacturing a disagreement about taste.
- Do not flatter it and do not look for fault to justify being asked. Both are ways of not answering.
- No prose outside the JSON.

THE QUESTION
${question.slice(0, 20_000)}

THE ANSWER
${answer.slice(0, 40_000)}`,
    { modelId: checkerId, maxTokens: 1536, temperature: 0.2, ...progress },
  );
  if (!out) return null;

  const raw = extractJson(out) as { agrees?: unknown; text?: unknown } | null;
  const text = typeof raw?.text === "string" ? raw.text.trim() : out.trim();
  if (!text) return null;
  const agrees =
    raw?.agrees === "disagrees" || raw?.agrees === "partly" || raw?.agrees === "agrees"
      ? raw.agrees
      : /* Unparseable verdicts are not read as agreement. A checker whose
           answer could not be understood has not confirmed anything, and
           defaulting to "agrees" would turn every malformed reply into a green
           tick — the one failure mode that matters here. */
        "partly";
  return { agrees, text, modelId: checkerId };
}
