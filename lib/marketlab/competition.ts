/**
 * Competition and pricing — a deliberately simple model of rival firms.
 *
 * WHAT THIS IS. Each firm has a price and a non-price appeal score (brand,
 * quality, service, convenience — everything competition is about other than
 * the number on the label). A customer's attraction to firm i is
 *
 *   uᵢ = appealᵢ − β · priceᵢ
 *
 * and the share of the market each firm wins is that attraction run through a
 * logit:
 *
 *   shareᵢ = e^(uᵢ) / ( e^(u₀) + Σⱼ e^(uⱼ) )
 *
 * where u₀ is the attraction of buying nothing at all, which is what stops the
 * model pretending the market is a fixed size that somebody always wins.
 *
 * WHAT THIS IS NOT. It is not a prediction of any real market, and it is not
 * derived from data. It is a teaching model whose one honest claim is internal:
 * given these assumptions, this is what follows. β in particular is a dial the
 * student sets, not a measurement — the whole point of the experiment is to see
 * how much the conclusion depends on it.
 */

import { divide, linspace } from "./num";

export interface Firm {
  id: string;
  name: string;
  price: number;
  /** Non-price competitiveness, on whatever scale the user chooses. */
  appeal: number;
  variableCost: number;
  fixedCost: number;
}

export interface MarketAssumptions {
  /** Customers in the market per period. */
  marketSize: number;
  /** How strongly attraction falls as price rises. Higher = more price-sensitive. */
  priceSensitivity: number;
  /** Attraction of the outside option (buying nothing). */
  outsideAppeal: number;
}

export interface FirmOutcome extends Firm {
  share: number;
  quantity: number;
  revenue: number;
  totalCost: number;
  profit: number;
  contributionPerUnit: number;
}

export interface CompetitionResult {
  firms: FirmOutcome[];
  /** Share of customers who buy nothing. */
  noPurchaseShare: number;
  /** Units sold across all firms. */
  totalQuantity: number;
  problem: string | null;
}

function utilities(firms: Firm[], m: MarketAssumptions): number[] {
  return firms.map((f) => f.appeal - m.priceSensitivity * f.price);
}

export function shares(firms: Firm[], m: MarketAssumptions): number[] | null {
  if (firms.length === 0) return null;
  const us = utilities(firms, m);
  if (us.some((u) => !Number.isFinite(u)) || !Number.isFinite(m.outsideAppeal)) return null;
  // Subtracting the largest utility before exponentiating. Without it, a firm
  // priced at zero with a high appeal overflows to Infinity and every share
  // becomes NaN — the classic logit bug.
  const all = [...us, m.outsideAppeal];
  const max = Math.max(...all);
  const exps = all.map((u) => Math.exp(u - max));
  const total = exps.reduce((s, e) => s + e, 0);
  if (!(total > 0) || !Number.isFinite(total)) return null;
  return exps.slice(0, firms.length).map((e) => e / total);
}

export function compete(firms: Firm[], m: MarketAssumptions): CompetitionResult {
  const empty: CompetitionResult = { firms: [], noPurchaseShare: 0, totalQuantity: 0, problem: null };
  if (firms.length === 0) return { ...empty, problem: "Add at least one firm." };
  if (!(m.marketSize >= 0)) return { ...empty, problem: "Market size cannot be negative." };
  if (!(m.priceSensitivity >= 0)) return { ...empty, problem: "Price sensitivity cannot be negative." };
  if (firms.some((f) => f.price < 0 || f.variableCost < 0 || f.fixedCost < 0)) {
    return { ...empty, problem: "Prices and costs cannot be negative." };
  }

  const s = shares(firms, m);
  if (!s) return { ...empty, problem: "These assumptions do not produce a usable set of market shares." };

  const outcomes: FirmOutcome[] = firms.map((f, i) => {
    const share = s[i];
    const quantity = m.marketSize * share;
    const revenue = f.price * quantity;
    const totalCost = f.fixedCost + f.variableCost * quantity;
    return {
      ...f, share, quantity, revenue, totalCost,
      profit: revenue - totalCost,
      contributionPerUnit: f.price - f.variableCost,
    };
  });

  const claimed = s.reduce((acc, v) => acc + v, 0);
  return {
    firms: outcomes,
    noPurchaseShare: Math.max(0, 1 - claimed),
    totalQuantity: outcomes.reduce((acc, f) => acc + f.quantity, 0),
    problem: null,
  };
}

/**
 * One firm's profit across a range of its own prices, holding every rival's
 * price fixed. This is a *best-response* curve, not a forecast: in a real
 * market the rivals would respond, and the experiment says so.
 */
export function ownPriceCurve(
  firms: Firm[], m: MarketAssumptions, firmId: string, minPrice: number, maxPrice: number, points = 49,
): Array<{ price: number; profit: number; share: number; quantity: number }> {
  const index = firms.findIndex((f) => f.id === firmId);
  if (index < 0 || !(maxPrice > minPrice)) return [];
  return linspace(minPrice, maxPrice, points).map((price) => {
    const trial = firms.map((f, i) => (i === index ? { ...f, price } : f));
    const out = compete(trial, m);
    const me = out.firms[index];
    return me
      ? { price, profit: me.profit, share: me.share, quantity: me.quantity }
      : { price, profit: 0, share: 0, quantity: 0 };
  });
}

/** The price on that curve with the highest profit. A scan, not calculus. */
export function bestResponsePrice(
  firms: Firm[], m: MarketAssumptions, firmId: string, minPrice: number, maxPrice: number,
): { price: number; profit: number } | null {
  // Two passes: a coarse scan to find the neighbourhood, then a fine one
  // inside it. A single 49-point scan lands on a grid price rather than the
  // actual peak, and the difference is visible on the chart.
  const coarse = ownPriceCurve(firms, m, firmId, minPrice, maxPrice, 81);
  if (coarse.length === 0) return null;
  const peak = coarse.reduce((a, b) => (b.profit > a.profit ? b : a));
  const width = (maxPrice - minPrice) / 80;
  const fine = ownPriceCurve(firms, m, firmId,
    Math.max(minPrice, peak.price - width), Math.min(maxPrice, peak.price + width), 41);
  const best = fine.length > 0 ? fine.reduce((a, b) => (b.profit > a.profit ? b : a)) : peak;
  return { price: best.price, profit: best.profit };
}

/** Herfindahl–Hirschman Index over the firms that actually sell, 0–10 000. */
export function concentration(result: CompetitionResult): number | null {
  const total = result.firms.reduce((s, f) => s + f.share, 0);
  if (!(total > 0)) return null;
  return result.firms.reduce((s, f) => {
    const relative = divide(f.share, total) ?? 0;
    return s + (relative * 100) ** 2;
  }, 0);
}

export function concentrationLabel(hhi: number | null): string {
  if (hhi === null) return "—";
  if (hhi >= 2500) return "Highly concentrated";
  if (hhi >= 1500) return "Moderately concentrated";
  return "Competitive";
}
