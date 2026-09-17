/**
 * Numeric plumbing.
 *
 * Every experiment in this app is a chain of divisions and percentages run on
 * numbers a student typed. The two ways that goes wrong are a division by
 * something that turned out to be zero, and a value that is `NaN` five steps
 * before anybody sees it. Both are handled here, once, so that no formula
 * further up has to carry a guard clause.
 *
 * The rule the whole codebase follows: a calculation that cannot be performed
 * returns `null`, never `0`, never `NaN`, never `Infinity`. `null` means "this
 * question has no answer under these inputs" and the interface is obliged to
 * say so. A silent `0` is a wrong answer wearing the clothes of a right one.
 */

/** A finite number, or `null` if the value is missing, infinite or NaN. */
export function finite(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Division that refuses rather than returning Infinity. */
export function divide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const out = numerator / denominator;
  return Number.isFinite(out) ? out : null;
}

/** Proportional change from `from` to `to`, as a fraction (0.1 = +10%). */
export function pctChange(from: number, to: number): number | null {
  if (from === 0) return null; // undefined: you cannot be a percentage of nothing
  return divide(to - from, Math.abs(from));
}

/**
 * Midpoint (arc) proportional change — the convention Cambridge uses for
 * elasticity, because it gives the same magnitude whichever direction you
 * travel between the two points.
 */
export function midpointChange(from: number, to: number): number | null {
  const mid = (from + to) / 2;
  if (mid === 0) return null;
  return divide(to - from, Math.abs(mid));
}

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** Rounds to `dp` decimal places without the float dust `toFixed` leaves. */
export function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** dp;
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * f) / f;
}

/** True when two numbers agree to `dp` decimal places. Used by the test suite. */
export function near(a: number, b: number, dp = 6): boolean {
  return Math.abs(a - b) < 0.5 * 10 ** -dp;
}

/** `n` evenly spaced values across [min, max], inclusive of both ends. */
export function linspace(min: number, max: number, n: number): number[] {
  if (n < 2) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + step * i);
}

/** A "nice" axis step — 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(range: number, targetTicks = 5): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const raw = range / Math.max(1, targetTicks);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Axis ticks covering [min, max] on a nice step. */
export function ticks(min: number, max: number, targetTicks = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const step = niceStep(max - min, targetTicks);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start, guard = 0; v <= max + step * 1e-9 && guard < 200; v += step, guard++) {
    out.push(round(v, 10));
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Formatting. Kept beside the arithmetic so a number is displayed the same way
   everywhere it appears — a figure that reads "1,240.5" in one panel and
   "1240.50" in the next reads as two different figures.
   ------------------------------------------------------------------------ */

export type Currency = "GBP" | "USD" | "EUR" | "none";

const SYMBOL: Record<Currency, string> = { GBP: "£", USD: "$", EUR: "€", none: "" };

export function currencySymbol(c: Currency): string {
  return SYMBOL[c] ?? "";
}

/** Money. Two decimals under 1,000; none above, where the pennies are noise. */
export function money(v: number | null, currency: Currency = "GBP", dp?: number): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const places = dp ?? (Math.abs(v) < 1000 ? 2 : 0);
  const sym = SYMBOL[currency] ?? "";
  const body = Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: places, maximumFractionDigits: places });
  return `${v < 0 ? "−" : ""}${sym}${body}`;
}

/** Money with an explicit sign, for deltas. */
export function signedMoney(v: number | null, currency: Currency = "GBP", dp?: number): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (v === 0) return money(0, currency, dp);
  return (v > 0 ? "+" : "") + money(v, currency, dp);
}

/** A fraction (0.125) rendered as a percentage ("12.5%"). */
export function percent(fraction: number | null, dp = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return "—";
  return `${round(fraction * 100, dp).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}%`;
}

export function signedPercent(fraction: number | null, dp = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return "—";
  if (fraction === 0) return percent(0, dp);
  return (fraction > 0 ? "+" : "−") + percent(Math.abs(fraction), dp);
}

/** A plain count — units, people, items. */
export function units(v: number | null, dp = 0): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return round(v, dp).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** A bare number at a sensible precision for its magnitude. */
export function decimal(v: number | null, dp = 2): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return round(v, dp).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Compacts large axis labels: 1_200_000 -> "1.2m". */
export function compact(v: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${round(v / 1e9, 1)}bn`;
  if (abs >= 1e6) return `${round(v / 1e6, 1)}m`;
  if (abs >= 1e4) return `${round(v / 1e3, 0)}k`;
  if (abs >= 1e3) return `${round(v / 1e3, 1)}k`;
  return String(round(v, abs < 1 ? 2 : abs < 10 ? 1 : 0));
}
