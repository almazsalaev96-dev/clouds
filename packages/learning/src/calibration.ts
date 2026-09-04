/**
 * Metacognitive calibration.
 *
 * Students rarely fail because they cannot learn; they fail because they believe
 * they already know things they do not. So the engine measures the gap between
 * stated confidence and actual accuracy, and reports it as a first-class number.
 */

export interface ConfidenceObservation {
  /** Stated probability of being correct, 0..1, collected *before* the answer. */
  confidence: number;
  correct: boolean;
}

export interface CalibrationBucket {
  from: number;
  to: number;
  n: number;
  meanConfidence: number;
  accuracy: number;
}

export interface CalibrationReport {
  n: number;
  /** Mean squared error of the forecasts. Lower is better; 0.25 = coin-flip guessing. */
  brier: number;
  /** Mean confidence minus accuracy. Positive = overconfident. */
  bias: number;
  meanConfidence: number;
  accuracy: number;
  buckets: CalibrationBucket[];
  verdict: 'overconfident' | 'underconfident' | 'well-calibrated' | 'insufficient-data';
}

const BUCKET_EDGES = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
const MIN_OBSERVATIONS = 10;

export function calibration(
  observations: readonly ConfidenceObservation[],
  biasTolerance = 0.05,
): CalibrationReport {
  const valid = observations.filter(
    (o) => Number.isFinite(o.confidence) && o.confidence >= 0 && o.confidence <= 1,
  );
  const n = valid.length;
  if (n === 0) {
    return {
      n: 0,
      brier: 0,
      bias: 0,
      meanConfidence: 0,
      accuracy: 0,
      buckets: [],
      verdict: 'insufficient-data',
    };
  }

  const brier = valid.reduce((s, o) => s + (o.confidence - (o.correct ? 1 : 0)) ** 2, 0) / n;
  const meanConfidence = valid.reduce((s, o) => s + o.confidence, 0) / n;
  const accuracy = valid.filter((o) => o.correct).length / n;
  const bias = meanConfidence - accuracy;

  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const from = BUCKET_EDGES[i] as number;
    const to = BUCKET_EDGES[i + 1] as number;
    const inBucket = valid.filter((o) => o.confidence >= from && o.confidence < to);
    if (inBucket.length === 0) continue;
    buckets.push({
      from,
      to: Math.min(to, 1),
      n: inBucket.length,
      meanConfidence: inBucket.reduce((s, o) => s + o.confidence, 0) / inBucket.length,
      accuracy: inBucket.filter((o) => o.correct).length / inBucket.length,
    });
  }

  const verdict =
    n < MIN_OBSERVATIONS
      ? 'insufficient-data'
      : bias > biasTolerance
        ? 'overconfident'
        : bias < -biasTolerance
          ? 'underconfident'
          : 'well-calibrated';

  return { n, brier, bias, meanConfidence, accuracy, buckets, verdict };
}
