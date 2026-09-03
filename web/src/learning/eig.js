/**
 * Choosing the question that tells us the most.
 *
 * A diagnostic's job is to split hypotheses, not to cover a syllabus. A question every
 * hypothesis answers the same way scores exactly zero bits and is never asked — which
 * is arithmetic rather than a heuristic.
 */
const EPS = 1e-12;

export function entropy(distribution) {
  let h = 0;
  for (const p of distribution) if (p > EPS) h -= p * Math.log2(p);
  return h;
}

export function normalise(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  if (total <= EPS) {
    const even = keys.length ? 1 / keys.length : 0;
    return Object.fromEntries(keys.map((k) => [k, even]));
  }
  return Object.fromEntries(keys.map((k) => [k, weights[k] / total]));
}

export function priorMap(hypotheses) {
  return normalise(Object.fromEntries(hypotheses.map((h) => [h.id, Math.max(0, h.prior)])));
}

const responsesOf = (q) =>
  [...new Set(Object.values(q.likelihoods).flatMap((t) => Object.keys(t)))].sort();

export function responseMarginal(prior, q) {
  const out = {};
  for (const r of responsesOf(q)) {
    out[r] = Object.entries(q.likelihoods)
      .reduce((sum, [h, table]) => sum + (prior[h] ?? 0) * (table[r] ?? 0), 0);
  }
  return out;
}

export function posterior(prior, q, response) {
  const weights = {};
  for (const h of Object.keys(prior)) {
    weights[h] = prior[h] * ((q.likelihoods[h] ?? {})[response] ?? 0);
  }
  // The observation is impossible under every hypothesis we hold. Refuse to invent
  // certainty: keep the prior and let the caller widen the hypothesis set.
  if (Object.values(weights).reduce((a, b) => a + b, 0) <= EPS) return { ...prior };
  return normalise(weights);
}

/** Bits of uncertainty about the cause this question is expected to remove. */
export function expectedInformationGain(prior, q) {
  const hPrior = entropy(Object.values(prior));
  let hPost = 0;
  for (const [r, pr] of Object.entries(responseMarginal(prior, q))) {
    if (pr <= EPS) continue;
    hPost += pr * entropy(Object.values(posterior(prior, q, r)));
  }
  return Math.max(0, hPrior - hPost);
}

export function rank(prior, candidates) {
  return candidates
    .map((q) => ({
      question: q,
      score: expectedInformationGain(prior, q) / Math.max(0.25, q.estimatedMinutes ?? 1.5),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const am = a.question.estimatedMinutes ?? 1.5;
      const bm = b.question.estimatedMinutes ?? 1.5;
      if (am !== bm) return am - bm;
      return a.question.id.localeCompare(b.question.id);
    });
}

export function selectNext(prior, candidates, asked = []) {
  const remaining = candidates.filter((q) => !asked.includes(q.id));
  if (!remaining.length) return null;
  const best = rank(prior, remaining)[0];
  return best.score > EPS ? best.question : null;
}

/** A diagnostic in progress. Stops as soon as it is confident enough. */
export function newRun(hypotheses) {
  return { prior: priorMap(hypotheses), asked: [], transcript: [] };
}

export function observe(run, question, response) {
  return {
    prior: posterior(run.prior, question, response),
    asked: [...run.asked, question.id],
    transcript: [...run.transcript, { questionId: question.id, response }],
  };
}

export function leading(run) {
  const entries = Object.entries(run.prior);
  if (!entries.length) return { id: "", probability: 0 };
  entries.sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]));
  return { id: entries[0][0], probability: entries[0][1] };
}

export const remainingUncertainty = (run) => entropy(Object.values(run.prior));
export const isConfident = (run, threshold = 0.8) => leading(run).probability >= threshold;
