/**
 * A fact-check that looks things up, rather than a model asked "are you sure?"
 *
 * A model asked to check its own answer repeats its own mistake with more
 * confidence. A second company (lib/verify.ts) catches the reasoning
 * errors; it does not catch a date that both models remember wrong. So the
 * claims in an answer are pulled out one by one and each is searched for
 * on the web, by the strongest keyed model that can search, and comes back
 * *supported*, *unsupported* or *uncertain* with the page it rests on. The
 * verdict on the whole answer is then not "a model agreed" but "these four
 * things were found, this one was not".
 *
 * Confidence is put together from both: the second company's reading and
 * the evidence. Two models agreeing with no evidence is *likely*; evidence
 * for every claim is *high*; a claim found to be wrong is *low* whatever
 * the models thought — which is the whole reason to look.
 */
import { complete } from "./complete";
import type { WebSource } from "./types";

export type ClaimVerdict = "supported" | "unsupported" | "uncertain";

export interface Claim {
  text: string;
  verdict: ClaimVerdict;
  /** One line: what was found, or what could not be. */
  note: string;
  /** The source it rests on, by number in `sources`, where there is one. */
  n?: number;
}

export interface FactCheck {
  claims: Claim[];
  sources: WebSource[];
  /** Which model looked — a searching one, from wherever the keys allow. */
  modelId: string;
  at: number;
}

const PROMPT = (question: string, answer: string) => `Someone asked a question and got the answer below. Your job is to fact-check the answer against the web, not to rewrite it.

1. List the checkable factual claims in the answer — things that are true or false about the world: names, dates, numbers, definitions, who did what, how something works. At most six; the ones that matter most to whether the answer is right. Leave out opinions, advice and things too vague to check.
2. Search the web for each one. Use a different search for each claim rather than one search for all of them.
3. For each claim say whether what you found supports it, contradicts it, or was not enough to tell.

Return JSON only, no prose and no fence:
{"claims":[{"claim":"the claim, in one sentence","verdict":"supported"|"unsupported"|"uncertain","note":"one line on what was found — quote a number or a phrase from the page where you can"}]}

- "unsupported" means a source contradicts it or says something different. Say what the source says instead.
- "uncertain" means you searched and could not settle it. Say why.
- Never mark a claim supported because it sounds right; only because a page says so.

--- The question ---
${question}

--- The answer to check ---
${answer.slice(0, 12_000)}`;

export async function factCheck(question: string, answer: string, modelId: string, opts: { signal?: AbortSignal } = {}): Promise<FactCheck | null> {
  const sources: WebSource[] = [];
  const out = await complete(PROMPT(question, answer), {
    modelId,
    maxTokens: 2_000,
    temperature: 0.1,
    tools: ["web_search"],
    onSource: (s) => { if (!sources.some((x) => x.url === s.url)) sources.push(s); },
    signal: opts.signal,
  });
  if (!out) return null;
  const parsed = parseClaims(out);
  if (!parsed) return null;
  /* A claim's page: the model does not number its sources, so each claim is
     matched to the first page whose title or address shares a word of the
     note with it; failing that, the first page. Honest enough for a link
     that says "here is where this came from". */
  const claims: Claim[] = parsed.map((c) => ({ ...c, n: pageFor(c, sources) }));
  return { claims, sources, modelId, at: Date.now() };
}

export function parseClaims(raw: string): Omit<Claim, "n">[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try { json = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  const list = (json as { claims?: unknown })?.claims;
  if (!Array.isArray(list)) return null;
  const rows = list
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      text: String(r.claim ?? "").trim(),
      verdict: (["supported", "unsupported", "uncertain"].includes(String(r.verdict)) ? String(r.verdict) : "uncertain") as ClaimVerdict,
      note: String(r.note ?? "").trim(),
    }))
    .filter((r) => r.text)
    .slice(0, 6);
  return rows.length ? rows : null;
}

function pageFor(c: Omit<Claim, "n">, sources: WebSource[]): number | undefined {
  if (!sources.length) return undefined;
  const words = `${c.note} ${c.text}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4);
  const hit = sources.find((s) => {
    const hay = `${s.title} ${s.url} ${s.quote ?? ""}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
  return (hit ?? sources[0]).n;
}

export type Confidence = "high" | "likely" | "uncertain" | "low";

/**
 * What the app can honestly say about an answer, from what has been done to
 * it. Not the model's own confidence, which is a number it makes up.
 */
export function systemConfidence(
  verdict?: { agrees: "agrees" | "partly" | "disagrees" } | null,
  facts?: FactCheck | null,
): { level: Confidence; why: string } | null {
  if (!verdict && !facts) return null;
  const n = facts?.claims.length ?? 0;
  const bad = facts?.claims.filter((c) => c.verdict === "unsupported").length ?? 0;
  const ok = facts?.claims.filter((c) => c.verdict === "supported").length ?? 0;
  if (bad > 0) return { level: "low", why: `${bad} of ${n} claims contradicted by what was found` };
  if (verdict?.agrees === "disagrees") return { level: "low", why: "a second company disagrees" };
  if (facts && n > 0 && ok === n && verdict?.agrees !== "partly") {
    return { level: "high", why: verdict ? `every claim found on a page, and a second company agrees` : `every claim found on a page` };
  }
  if (facts && ok > 0) return { level: "likely", why: `${ok} of ${n} claims found on a page${verdict?.agrees === "partly" ? "; a second company mostly agrees" : ""}` };
  if (verdict?.agrees === "agrees") return { level: "likely", why: "a second company agrees; nothing was looked up" };
  if (verdict?.agrees === "partly") return { level: "uncertain", why: "a second company mostly agrees; nothing was looked up" };
  return { level: "uncertain", why: "nothing could be settled from the web" };
}

export const CONFIDENCE_WORD: Record<Confidence, string> = {
  high: "High confidence",
  likely: "Likely right",
  uncertain: "Uncertain",
  low: "Doubtful",
};
