/**
 * Price elasticity of demand, and what it does to revenue.
 *
 * Two things in here are easy to get wrong and are therefore done explicitly.
 *
 * 1. THE SIGN. For a normal good the law of demand makes PED negative: price
 *    up, quantity down. Most textbooks — Cambridge included — then talk about
 *    "elastic" and "inelastic" using the *magnitude*, and a lot of software
 *    quietly drops the minus sign without saying so. This module returns both
 *    `ped` (signed, the real value) and `magnitude` (|PED|, the one the
 *    classification uses), and the interface shows both. A positive signed PED
 *    is not an error — it means quantity rose with price, which is a Giffen or
 *    Veblen case, or a sign that something other than price moved — and the
 *    result says so rather than hiding it.
 *
 * 2. THE METHOD. Percentage change from a base point and the midpoint (arc)
 *    formula give different numbers for the same two observations, and the gap
 *    widens as the change gets bigger. Neither is "the" answer, so the method
 *    is a parameter and the result carries the method it used.
 */

import { divide, finite, midpointChange, pctChange } from "./num";

export type ElasticityMethod = "midpoint" | "base";

export type ElasticityBand =
  | "perfectly-inelastic"
  | "inelastic"
  | "unit-elastic"
  | "elastic"
  | "perfectly-elastic";

export interface ElasticityInput {
  initialPrice: number;
  initialQuantity: number;
  newPrice: number;
  newQuantity: number;
  method?: ElasticityMethod;
}

export interface ElasticityResult {
  method: ElasticityMethod;
  /** Proportional change in quantity (0.2 = +20%). */
  quantityChange: number | null;
  /** Proportional change in price. */
  priceChange: number | null;
  /** The signed coefficient. Negative for a normal good. */
  ped: number | null;
  /** |PED| — the value the elastic/inelastic classification is based on. */
  magnitude: number | null;
  band: ElasticityBand | null;
  /** True when quantity moved the same way as price (an unusual result). */
  anomalousSign: boolean;
  /** Why the coefficient could not be computed, if it could not. */
  problem: string | null;
}

export function classify(magnitude: number | null): ElasticityBand | null {
  if (magnitude === null || !Number.isFinite(magnitude)) {
    return magnitude === Infinity ? "perfectly-elastic" : null;
  }
  if (magnitude === 0) return "perfectly-inelastic";
  // A tenth of a percent either side of 1 counts as unit elastic. Without a
  // tolerance, 0.9999999 from floating-point arithmetic reads as "inelastic",
  // which is a statement about IEEE 754 rather than about the market.
  if (Math.abs(magnitude - 1) < 1e-3) return "unit-elastic";
  return magnitude < 1 ? "inelastic" : "elastic";
}

export const BAND_LABEL: Record<ElasticityBand, string> = {
  "perfectly-inelastic": "Perfectly inelastic",
  inelastic: "Inelastic",
  "unit-elastic": "Unit elastic",
  elastic: "Elastic",
  "perfectly-elastic": "Perfectly elastic",
};

/** What the band means for revenue when price *rises*. */
export const BAND_REVENUE_RULE: Record<ElasticityBand, string> = {
  "perfectly-inelastic": "Quantity does not respond at all, so revenue moves in proportion to price.",
  inelastic: "Quantity falls proportionally less than price rises, so total revenue rises.",
  "unit-elastic": "Quantity falls in exact proportion to the price rise, so total revenue is unchanged.",
  elastic: "Quantity falls proportionally more than price rises, so total revenue falls.",
  "perfectly-elastic": "Any price rise loses the whole market, so revenue falls to zero.",
};

export function elasticity(input: ElasticityInput): ElasticityResult {
  const method = input.method ?? "midpoint";
  const p0 = finite(input.initialPrice);
  const q0 = finite(input.initialQuantity);
  const p1 = finite(input.newPrice);
  const q1 = finite(input.newQuantity);

  const empty: ElasticityResult = {
    method, quantityChange: null, priceChange: null, ped: null,
    magnitude: null, band: null, anomalousSign: false, problem: null,
  };

  if (p0 === null || q0 === null || p1 === null || q1 === null) {
    return { ...empty, problem: "One of the four values is missing or not a number." };
  }
  if (p0 < 0 || p1 < 0 || q0 < 0 || q1 < 0) {
    return { ...empty, problem: "Prices and quantities cannot be negative." };
  }

  const change = method === "midpoint" ? midpointChange : pctChange;
  const priceChange = change(p0, p1);
  const quantityChange = change(q0, q1);

  if (priceChange === null) {
    return {
      ...empty, quantityChange, priceChange,
      problem: method === "base"
        ? "The initial price is zero, so a percentage change in price is undefined."
        : "Both prices are zero, so a percentage change in price is undefined.",
    };
  }
  if (priceChange === 0) {
    return {
      ...empty, quantityChange, priceChange,
      problem: "Price did not change. Elasticity divides by the change in price, so it has no value here.",
    };
  }
  if (quantityChange === null) {
    return {
      ...empty, quantityChange, priceChange,
      problem: "The initial quantity is zero, so a percentage change in quantity is undefined.",
    };
  }

  const ped = divide(quantityChange, priceChange);
  const magnitude = ped === null ? null : Math.abs(ped);
  return {
    method,
    quantityChange,
    priceChange,
    ped,
    magnitude,
    band: classify(magnitude),
    anomalousSign: ped !== null && ped > 0,
    problem: null,
  };
}

/* ---------------------------------------------------------------------------
   Revenue
   ------------------------------------------------------------------------ */

export interface RevenueResult {
  initialRevenue: number;
  newRevenue: number;
  change: number;
  changeFraction: number | null;
  direction: "up" | "down" | "flat";
}

export function revenue(p0: number, q0: number, p1: number, q1: number): RevenueResult | null {
  const a = finite(p0), b = finite(q0), c = finite(p1), d = finite(q1);
  if (a === null || b === null || c === null || d === null) return null;
  const initialRevenue = a * b;
  const newRevenue = c * d;
  const change = newRevenue - initialRevenue;
  return {
    initialRevenue,
    newRevenue,
    change,
    changeFraction: pctChange(initialRevenue, newRevenue),
    // A change smaller than a hundredth of a currency unit is rounding, not a
    // result: unit-elastic demand produces a revenue "change" of 1e-13 and
    // calling that a rise would contradict the very rule being demonstrated.
    direction: Math.abs(change) < 1e-9 ? "flat" : change > 0 ? "up" : "down",
  };
}

/* ---------------------------------------------------------------------------
   Demand models used to draw the curves.

   These are the assumptions the charts rest on, and the interface names them
   on the chart itself. Neither is a claim about how any real market behaves.
   ------------------------------------------------------------------------ */

/**
 * Constant-elasticity demand: Q(P) = Q0 · (P / P0)^PED.
 *
 * The only functional form whose elasticity is the same at every price, so it
 * is the honest curve to draw when the user has *assumed* an elasticity rather
 * than measured two points.
 */
export function constantElasticityQuantity(price: number, p0: number, q0: number, ped: number): number | null {
  if (!(p0 > 0) || !(price > 0) || !Number.isFinite(q0) || !Number.isFinite(ped)) return null;
  const q = q0 * (price / p0) ** ped;
  return Number.isFinite(q) ? Math.max(0, q) : null;
}

/**
 * The straight line through two observed points. Elasticity along a linear
 * demand curve is *not* constant — it falls in magnitude as you move down the
 * curve — which is itself worth seeing, so the experiment says so.
 */
export function linearDemandQuantity(price: number, p0: number, q0: number, p1: number, q1: number): number | null {
  if (p1 === p0) return null;
  const slope = (q1 - q0) / (p1 - p0);
  const q = q0 + slope * (price - p0);
  return Number.isFinite(q) ? Math.max(0, q) : null;
}

/**
 * The new quantity implied by an assumed elasticity — the inverse of
 * `elasticity()`, used when the student supplies PED instead of measuring Q1.
 *
 * Base method:     Q1 = Q0 · (1 + PED · %ΔP)
 * Midpoint method: solving (Q1−Q0)/((Q1+Q0)/2) = PED · %ΔP_mid for Q1 gives
 *                  Q1 = Q0 · (2 + k) / (2 − k), where k = PED · %ΔP_mid.
 *                  k = 2 has no solution: it asks quantity to fall by 200% of
 *                  its own midpoint, which no positive quantity can do.
 */
export function quantityFromElasticity(
  p0: number, q0: number, p1: number, ped: number, method: ElasticityMethod = "midpoint",
): number | null {
  if (!Number.isFinite(p0) || !Number.isFinite(q0) || !Number.isFinite(p1) || !Number.isFinite(ped)) return null;
  if (q0 < 0) return null;
  if (method === "base") {
    const dp = pctChange(p0, p1);
    if (dp === null) return null;
    const q = q0 * (1 + ped * dp);
    return Number.isFinite(q) ? Math.max(0, q) : null;
  }
  const dp = midpointChange(p0, p1);
  if (dp === null) return null;
  const k = ped * dp;
  if (Math.abs(k - 2) < 1e-9) return null;
  const q = (q0 * (2 + k)) / (2 - k);
  return Number.isFinite(q) && q >= 0 ? q : 0;
}
