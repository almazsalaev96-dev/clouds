/**
 * Costs, revenue, profit and break-even.
 *
 *   TR = P · Q
 *   TC = FC + VC · Q
 *   Profit = TR − TC
 *   Break-even Q = FC / (P − VC)
 *
 * The only genuinely delicate part is break-even. `FC / (P − VC)` divides by
 * the contribution per unit, and when a business sells at or below its own
 * variable cost that denominator is zero or negative. A spreadsheet returns
 * `#DIV/0!` or, worse, a confident negative number. Neither is the truth. The
 * truth is that there is no break-even quantity at all: every extra unit
 * widens the loss. This module returns `null` and a sentence saying so.
 */

import { divide, finite } from "./num";

export interface ProfitInput {
  price: number;
  unitsSold: number;
  variableCostPerUnit: number;
  fixedCosts: number;
  /** Treated as an addition to fixed costs. */
  marketingSpend?: number;
}

export interface ProfitResult {
  revenue: number;
  variableCosts: number;
  /** Fixed costs including marketing spend. */
  fixedCosts: number;
  totalCosts: number;
  profit: number;
  /** P − VC: what each unit adds towards covering the fixed costs. */
  contributionPerUnit: number;
  totalContribution: number;
  /** Profit ÷ revenue. */
  profitMargin: number | null;
  /** (P − VC) ÷ P. */
  contributionMargin: number | null;
  breakEvenUnits: number | null;
  breakEvenRevenue: number | null;
  /** How far above break-even the business is, as a fraction of current units. */
  marginOfSafety: number | null;
  /** Profit ÷ (fixed + variable costs). */
  returnOnCosts: number | null;
  problem: string | null;
  breakEvenNote: string;
}

export function profit(input: ProfitInput): ProfitResult {
  const price = finite(input.price) ?? 0;
  const q = finite(input.unitsSold) ?? 0;
  const vc = finite(input.variableCostPerUnit) ?? 0;
  const fcBase = finite(input.fixedCosts) ?? 0;
  const marketing = finite(input.marketingSpend) ?? 0;

  const fixedCosts = fcBase + marketing;
  const revenue = price * q;
  const variableCosts = vc * q;
  const totalCosts = fixedCosts + variableCosts;
  const value = revenue - totalCosts;
  const contributionPerUnit = price - vc;
  const totalContribution = contributionPerUnit * q;

  let problem: string | null = null;
  if (price < 0 || vc < 0 || fcBase < 0 || marketing < 0) problem = "Prices and costs cannot be negative.";
  else if (q < 0) problem = "Units sold cannot be negative.";

  let breakEvenUnits: number | null = null;
  let breakEvenNote: string;
  if (contributionPerUnit > 0) {
    breakEvenUnits = divide(fixedCosts, contributionPerUnit);
    breakEvenNote = "Each unit contributes towards the fixed costs, so there is a quantity at which they are exactly covered.";
  } else if (contributionPerUnit === 0) {
    breakEvenNote = "Price exactly equals variable cost, so every unit contributes nothing. The fixed costs are never covered, at any quantity — there is no break-even point.";
  } else {
    breakEvenNote = "Price is below variable cost, so every unit sold makes the loss larger. There is no break-even quantity; the business would have to raise price or cut variable cost first.";
  }

  return {
    revenue,
    variableCosts,
    fixedCosts,
    totalCosts,
    profit: value,
    contributionPerUnit,
    totalContribution,
    profitMargin: divide(value, revenue),
    contributionMargin: divide(contributionPerUnit, price),
    breakEvenUnits,
    breakEvenRevenue: breakEvenUnits === null ? null : breakEvenUnits * price,
    marginOfSafety: breakEvenUnits === null ? null : divide(q - breakEvenUnits, q),
    returnOnCosts: divide(value, totalCosts),
    problem,
    breakEvenNote,
  };
}

/**
 * A demand response to marketing spend, with diminishing returns:
 *
 *   uplift(S) = maxUplift · (1 − e^(−S·ln2 / halfSpend))
 *
 * `halfSpend` is the spend at which half of the maximum uplift is reached, so
 * both parameters are things a student can state and defend. This is an
 * assumption the user sets, not an estimate of anything — every screen that
 * uses it says so, and it is off by default.
 */
export function marketingUplift(spend: number, maxUplift: number, halfSpend: number): number {
  if (!(spend > 0) || !(maxUplift > 0) || !(halfSpend > 0)) return 0;
  const uplift = maxUplift * (1 - Math.exp((-spend * Math.LN2) / halfSpend));
  return Number.isFinite(uplift) ? Math.max(0, uplift) : 0;
}

/* ---------------------------------------------------------------------------
   Scenarios
   ------------------------------------------------------------------------ */

export interface Scenario {
  id: string;
  label: string;
  input: ProfitInput;
}

export interface ScenarioRow extends Scenario {
  result: ProfitResult;
}

export function runScenarios(scenarios: Scenario[]): ScenarioRow[] {
  return scenarios.map((s) => ({ ...s, result: profit(s.input) }));
}

/** The highest-profit scenario, or `null` when they all tie or none is valid. */
export function bestScenario(rows: ScenarioRow[]): ScenarioRow | null {
  const valid = rows.filter((r) => r.result.problem === null);
  if (valid.length === 0) return null;
  const best = valid.reduce((a, b) => (b.result.profit > a.result.profit ? b : a));
  const ties = valid.filter((r) => Math.abs(r.result.profit - best.result.profit) < 1e-9);
  return ties.length === valid.length && valid.length > 1 ? null : best;
}

/**
 * Profit at each quantity across a range — the line behind the break-even
 * chart. Returned as parallel series so the chart does not have to know the
 * cost model.
 */
export function profitCurve(input: ProfitInput, maxUnits: number, points = 41): Array<{
  q: number; revenue: number; totalCost: number; profit: number;
}> {
  const price = finite(input.price) ?? 0;
  const vc = finite(input.variableCostPerUnit) ?? 0;
  const fc = (finite(input.fixedCosts) ?? 0) + (finite(input.marketingSpend) ?? 0);
  const top = Number.isFinite(maxUnits) && maxUnits > 0 ? maxUnits : 1;
  const step = top / Math.max(1, points - 1);
  return Array.from({ length: points }, (_, i) => {
    const q = i * step;
    const revenue = price * q;
    const totalCost = fc + vc * q;
    return { q, revenue, totalCost, profit: revenue - totalCost };
  });
}
