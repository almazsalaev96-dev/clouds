/**
 * Supply, demand, equilibrium, shocks and price controls — on straight lines.
 *
 * Linear curves are the Cambridge convention and they have one property that
 * matters for a teaching tool: every result below can be derived by hand in
 * three lines, so a student can check the app rather than trust it.
 *
 *   Demand   Qd = a − b·P     a > 0, b > 0
 *   Supply   Qs = c + d·P     d > 0, c of either sign
 *
 * The curve the student sees is drawn with price on the vertical axis, which
 * is the economics convention and the *inverse* of the functions above. That
 * flip is a common source of confusion, so it is done in one place — here —
 * and the chart just plots what it is given.
 */

import { divide } from "./num";

export interface MarketParams {
  /** Demand intercept: quantity demanded at a price of zero. */
  demandIntercept: number;
  /** Demand slope: units of quantity lost per unit of price. Positive. */
  demandSlope: number;
  /** Supply intercept: quantity supplied at a price of zero. May be negative. */
  supplyIntercept: number;
  /** Supply slope: units of quantity gained per unit of price. Positive. */
  supplySlope: number;
  /** Parallel shift of the demand curve, in quantity units at every price. */
  demandShock?: number;
  /** Parallel shift of the supply curve, in quantity units at every price. */
  supplyShock?: number;
}

export interface Equilibrium {
  price: number;
  quantity: number;
}

export interface MarketState {
  /** Parameters after shocks have been applied. */
  a: number; b: number; c: number; d: number;
  equilibrium: Equilibrium | null;
  /** Highest price anyone will pay — where the demand curve meets the price axis. */
  chokePrice: number | null;
  /** Lowest price at which anything is supplied. Zero when supply is positive at P = 0. */
  supplyFloorPrice: number;
  consumerSurplus: number | null;
  producerSurplus: number | null;
  totalSurplus: number | null;
  problem: string | null;
}

export function quantityDemanded(a: number, b: number, price: number): number {
  return Math.max(0, a - b * price);
}

export function quantitySupplied(c: number, d: number, price: number): number {
  return Math.max(0, c + d * price);
}

/** Inverse demand: the price at which exactly `q` is demanded. */
export function demandPrice(a: number, b: number, q: number): number | null {
  return divide(a - q, b);
}

/** Inverse supply: the price needed to bring `q` to market. */
export function supplyPrice(c: number, d: number, q: number): number | null {
  return divide(q - c, d);
}

export function solve(params: MarketParams): MarketState {
  const a = params.demandIntercept + (params.demandShock ?? 0);
  const b = params.demandSlope;
  const c = params.supplyIntercept + (params.supplyShock ?? 0);
  const d = params.supplySlope;

  const base: MarketState = {
    a, b, c, d,
    equilibrium: null, chokePrice: null, supplyFloorPrice: 0,
    consumerSurplus: null, producerSurplus: null, totalSurplus: null,
    problem: null,
  };

  if (!(b > 0)) return { ...base, problem: "The demand curve must slope downwards: its slope has to be greater than zero." };
  if (!(d > 0)) return { ...base, problem: "The supply curve must slope upwards: its slope has to be greater than zero." };

  const chokePrice = divide(a, b);
  const supplyFloorPrice = c >= 0 ? 0 : -c / d;

  // a − bP = c + dP  ⇒  P* = (a − c) / (b + d)
  const price = divide(a - c, b + d);
  if (price === null) return { ...base, chokePrice, supplyFloorPrice, problem: "The two curves are parallel, so they never cross." };
  if (price < 0) {
    return {
      ...base, chokePrice, supplyFloorPrice,
      problem: "These curves only cross at a negative price, which no market can reach. Raise demand or lower the supply intercept.",
    };
  }

  const quantity = a - b * price;
  if (quantity < 0) {
    return {
      ...base, chokePrice, supplyFloorPrice,
      problem: "The curves cross where quantity is negative, so there is no market at these parameters.",
    };
  }

  // Consumer surplus: the triangle between the choke price and the market
  // price, over the traded quantity.
  const consumerSurplus = chokePrice === null || chokePrice <= price
    ? 0
    : 0.5 * quantity * (chokePrice - price);

  // Producer surplus: revenue less the area under the supply curve. Written as
  // an integral rather than a triangle because when c > 0 the supply curve
  // meets the quantity axis, not the price axis, and the triangle formula
  // silently gives the wrong answer there.
  const producerSurplus = price * quantity - areaUnderSupply(c, d, quantity);

  return {
    a, b, c, d,
    equilibrium: { price, quantity },
    chokePrice,
    supplyFloorPrice,
    consumerSurplus,
    producerSurplus,
    totalSurplus: consumerSurplus + producerSurplus,
    problem: null,
  };
}

/** ∫₀^Q max(0, (q − c)/d) dq — the opportunity cost of supplying Q units. */
export function areaUnderSupply(c: number, d: number, q: number): number {
  if (!(d > 0) || !(q > 0)) return 0;
  if (c >= q) return 0;               // every unit is supplied even at price zero
  const span = q - Math.max(0, c);
  if (c >= 0) return (span * span) / (2 * d);
  // c < 0: supply starts at price −c/d, so the area is a trapezium.
  const pLow = -c / d;
  const pHigh = (q - c) / d;
  return 0.5 * (pLow + pHigh) * q;
}

/* ---------------------------------------------------------------------------
   Price controls
   ------------------------------------------------------------------------ */

export type ControlKind = "none" | "ceiling" | "floor";

export interface ControlResult {
  kind: ControlKind;
  /** The controlled price, or the free-market price when the control does not bind. */
  price: number;
  binding: boolean;
  quantityDemanded: number;
  quantitySupplied: number;
  /** Units of excess demand. Zero unless a ceiling binds. */
  shortage: number;
  /** Units of excess supply. Zero unless a floor binds. */
  surplus: number;
  /** What actually changes hands: the short side of the market. */
  quantityTraded: number;
  deadweightLoss: number | null;
  note: string;
}

export function applyControl(state: MarketState, kind: ControlKind, controlPrice: number): ControlResult | null {
  const eq = state.equilibrium;
  if (!eq) return null;
  const { a, b, c, d } = state;

  if (kind === "none" || !Number.isFinite(controlPrice)) {
    return {
      kind: "none", price: eq.price, binding: false,
      quantityDemanded: eq.quantity, quantitySupplied: eq.quantity,
      shortage: 0, surplus: 0, quantityTraded: eq.quantity, deadweightLoss: 0,
      note: "No price control. The market clears at the equilibrium price.",
    };
  }
  if (controlPrice < 0) return null;

  // A ceiling above the market price, or a floor below it, is legal but inert:
  // the market was already on the permitted side of it.
  const binding = kind === "ceiling" ? controlPrice < eq.price : controlPrice > eq.price;
  const price = binding ? controlPrice : eq.price;
  const qd = quantityDemanded(a, b, price);
  const qs = quantitySupplied(c, d, price);
  const quantityTraded = Math.min(qd, qs);

  let deadweightLoss: number | null = 0;
  if (binding && quantityTraded < eq.quantity) {
    const pd = demandPrice(a, b, quantityTraded);
    const ps = supplyPrice(c, d, quantityTraded);
    deadweightLoss = pd === null || ps === null
      ? null
      : 0.5 * (eq.quantity - quantityTraded) * Math.max(0, pd - ps);
  }

  const note = !binding
    ? kind === "ceiling"
      ? "This ceiling sits above the equilibrium price, so it never binds and the market is unchanged."
      : "This floor sits below the equilibrium price, so it never binds and the market is unchanged."
    : kind === "ceiling"
      ? "A binding ceiling holds price below equilibrium. Quantity supplied falls, quantity demanded rises, and the gap is a shortage."
      : "A binding floor holds price above equilibrium. Quantity supplied rises, quantity demanded falls, and the gap is a surplus.";

  return {
    kind, price, binding,
    quantityDemanded: qd, quantitySupplied: qs,
    shortage: Math.max(0, qd - qs),
    surplus: Math.max(0, qs - qd),
    quantityTraded,
    deadweightLoss,
    note,
  };
}

/* ---------------------------------------------------------------------------
   Comparison
   ------------------------------------------------------------------------ */

export interface Comparison {
  priceChange: number | null;
  quantityChange: number | null;
  priceDirection: "up" | "down" | "flat";
  quantityDirection: "up" | "down" | "flat";
}

export function compare(before: Equilibrium | null, after: Equilibrium | null): Comparison | null {
  if (!before || !after) return null;
  const dp = after.price - before.price;
  const dq = after.quantity - before.quantity;
  const dir = (v: number) => (Math.abs(v) < 1e-9 ? "flat" : v > 0 ? "up" : "down") as "up" | "down" | "flat";
  return {
    priceChange: dp,
    quantityChange: dq,
    priceDirection: dir(dp),
    quantityDirection: dir(dq),
  };
}

/**
 * The sentence a student is expected to be able to write in an exam: which
 * curve moved, which way, and what that does to price and quantity.
 */
export function shockNarrative(demandShock: number, supplyShock: number, comparison: Comparison | null): string {
  const moves: string[] = [];
  if (Math.abs(demandShock) > 1e-9) {
    moves.push(demandShock > 0
      ? "Demand has increased — the demand curve shifts right"
      : "Demand has decreased — the demand curve shifts left");
  }
  if (Math.abs(supplyShock) > 1e-9) {
    moves.push(supplyShock > 0
      ? "Supply has increased — the supply curve shifts right"
      : "Supply has decreased — the supply curve shifts left");
  }
  if (moves.length === 0) return "No shock has been applied, so the market sits at its original equilibrium.";
  if (!comparison) return `${moves.join(". ")}.`;

  const word = (d: "up" | "down" | "flat") => (d === "up" ? "rises" : d === "down" ? "falls" : "is unchanged");
  const tail = `Equilibrium price ${word(comparison.priceDirection)} and equilibrium quantity ${word(comparison.quantityDirection)}.`;

  // The one case worth calling out: opposing shifts leave one of the two
  // indeterminate in theory, and the number the model gives depends entirely
  // on the relative size of the shifts the student chose.
  const opposing = demandShock * supplyShock < 0;
  const caveat = opposing
    ? " Because the two curves moved in opposite directions, the direction of one of these depends on which shift is larger — the model answers for the sizes you set, not in general."
    : "";
  return `${moves.join(". ")}. ${tail}${caveat}`;
}
