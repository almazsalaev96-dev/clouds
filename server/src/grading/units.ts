/**
 * Units, because "9.8" and "9.8 m/s²" are not the same answer in physics and
 * "0.0098 km/s²" is.
 *
 * Everything reduces to a seven-element SI dimension vector plus a scale factor, so
 * comparison is dimension equality followed by numeric equality of the scaled values.
 */

export type Dimension = readonly [
  number, number, number, number, number, number, number,
]; // m, kg, s, A, K, mol, cd

export const DIMENSIONLESS: Dimension = [0, 0, 0, 0, 0, 0, 0];

export interface Unit {
  factor: number;      // multiply by this to reach SI base units
  dim: Dimension;
  offset?: number;     // for °C / °F only; applied before the factor
}

const D = (m = 0, kg = 0, s = 0, a = 0, k = 0, mol = 0, cd = 0): Dimension =>
  [m, kg, s, a, k, mol, cd];

/** Exact symbols first: `m` is metre, not milli-nothing. */
const BASE: Record<string, Unit> = {
  m: { factor: 1, dim: D(1) },
  metre: { factor: 1, dim: D(1) }, meter: { factor: 1, dim: D(1) },
  kg: { factor: 1, dim: D(0, 1) },
  g: { factor: 1e-3, dim: D(0, 1) }, gram: { factor: 1e-3, dim: D(0, 1) },
  tonne: { factor: 1e3, dim: D(0, 1) }, t: { factor: 1e3, dim: D(0, 1) },
  s: { factor: 1, dim: D(0, 0, 1) }, sec: { factor: 1, dim: D(0, 0, 1) },
  min: { factor: 60, dim: D(0, 0, 1) },
  h: { factor: 3600, dim: D(0, 0, 1) }, hr: { factor: 3600, dim: D(0, 0, 1) },
  day: { factor: 86400, dim: D(0, 0, 1) },
  A: { factor: 1, dim: D(0, 0, 0, 1) },
  K: { factor: 1, dim: D(0, 0, 0, 0, 1) },
  mol: { factor: 1, dim: D(0, 0, 0, 0, 0, 1) },
  cd: { factor: 1, dim: D(0, 0, 0, 0, 0, 0, 1) },

  N: { factor: 1, dim: D(1, 1, -2) },
  J: { factor: 1, dim: D(2, 1, -2) },
  eV: { factor: 1.602176634e-19, dim: D(2, 1, -2) },
  W: { factor: 1, dim: D(2, 1, -3) },
  Pa: { factor: 1, dim: D(-1, 1, -2) },
  bar: { factor: 1e5, dim: D(-1, 1, -2) },
  atm: { factor: 101325, dim: D(-1, 1, -2) },
  C: { factor: 1, dim: D(0, 0, 1, 1) },
  V: { factor: 1, dim: D(2, 1, -3, -1) },
  ohm: { factor: 1, dim: D(2, 1, -3, -2) },
  "Ω": { factor: 1, dim: D(2, 1, -3, -2) },
  F: { factor: 1, dim: D(-2, -1, 4, 2) },
  H: { factor: 1, dim: D(2, 1, -2, -2) },
  T: { factor: 1, dim: D(0, 1, -2, -1) },
  Wb: { factor: 1, dim: D(2, 1, -2, -1) },
  Hz: { factor: 1, dim: D(0, 0, -1) },
  Bq: { factor: 1, dim: D(0, 0, -1) },

  L: { factor: 1e-3, dim: D(3) }, l: { factor: 1e-3, dim: D(3) },
  litre: { factor: 1e-3, dim: D(3) }, liter: { factor: 1e-3, dim: D(3) },
  ha: { factor: 1e4, dim: D(2) },

  rad: { factor: 1, dim: DIMENSIONLESS },
  sr: { factor: 1, dim: DIMENSIONLESS },
  deg: { factor: Math.PI / 180, dim: DIMENSIONLESS },
  "°": { factor: Math.PI / 180, dim: DIMENSIONLESS },
};

const PREFIX: Record<string, number> = {
  T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, "µ": 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
};

/** Prefixing kilograms is a trap: the SI base already carries the kilo. */
const PREFIXABLE = new Set([
  "m", "g", "s", "A", "K", "mol", "N", "J", "W", "Pa", "C", "V", "ohm", "Ω",
  "F", "H", "T", "Wb", "Hz", "Bq", "L", "l", "eV",
]);

function lookupSymbol(sym: string): Unit | null {
  const exact = BASE[sym];
  if (exact) return exact;
  for (const [p, mul] of Object.entries(PREFIX)) {
    if (sym.length > p.length && sym.startsWith(p)) {
      const rest = sym.slice(p.length);
      const base = BASE[rest];
      if (base && PREFIXABLE.has(rest)) {
        return { factor: base.factor * mul, dim: base.dim };
      }
    }
  }
  return null;
}

function mulDim(a: Dimension, b: Dimension, sign: number): Dimension {
  return a.map((x, i) => x + sign * b[i]!) as unknown as Dimension;
}

function powDim(a: Dimension, n: number): Dimension {
  return a.map((x) => x * n) as unknown as Dimension;
}

export function sameDimension(a: Dimension, b: Dimension): boolean {
  return a.every((x, i) => Math.abs(x - b[i]!) < 1e-9);
}

export function formatDimension(d: Dimension): string {
  const names = ["m", "kg", "s", "A", "K", "mol", "cd"];
  const parts = d.map((e, i) => (e === 0 ? "" : e === 1 ? names[i]! : `${names[i]}^${e}`))
    .filter(Boolean);
  return parts.length ? parts.join("·") : "dimensionless";
}

const UNIT_TOKEN = /^([A-Za-zµ°Ω]+)(\s*\^\s*(-?\d+(?:\/\d+)?)|(-?\d))?/;

/**
 * Parse a unit expression such as `m/s^2`, `kg m s^-2`, `N m`, `J/(kg K)`.
 * Returns null rather than guessing when any symbol is unrecognised — a wrong unit
 * conversion is worse than declining to check units at all.
 */
export function parseUnit(text: string): Unit | null {
  const s = text.trim().replace(/·/g, " ").replace(/\s+/g, " ");
  if (!s) return null;

  let factor = 1;
  let dim: Dimension = DIMENSIONLESS;
  let sign = 1;
  let i = 0;
  let sawAny = false;
  const depth: number[] = [];

  while (i < s.length) {
    const ch = s[i]!;
    if (ch === " " || ch === "*") { i++; continue; }
    if (ch === "/") { sign = -1; i++; continue; }
    if (ch === "(") { depth.push(sign); i++; continue; }
    if (ch === ")") { sign = depth.pop() ?? 1; i++; continue; }

    const m = UNIT_TOKEN.exec(s.slice(i));
    if (!m) return null;
    const unit = lookupSymbol(m[1]!);
    if (!unit) return null;
    if (unit.offset !== undefined) return null; // offset units cannot combine

    let exp = 1;
    const expText = m[3] ?? m[4];
    if (expText) {
      exp = expText.includes("/")
        ? Number(expText.split("/")[0]) / Number(expText.split("/")[1])
        : Number(expText);
      if (!Number.isFinite(exp)) return null;
    }

    const effective = sign * exp;
    factor *= Math.pow(unit.factor, effective);
    dim = mulDim(dim, powDim(unit.dim, effective), 1);
    sawAny = true;
    i += m[0]!.length;
    // A single `/` applies only to the token that follows it unless bracketed,
    // matching how `J/kg K` is read aloud and written on a whiteboard.
    if (sign === -1 && depth.length === 0) sign = 1;
  }

  return sawAny ? { factor, dim } : null;
}

export interface Quantity {
  magnitudeText: string;
  unitText: string | null;
}

const TRAILING_UNIT = /\s*([A-Za-zµ°Ω][A-Za-zµ°Ω0-9^\/*\-.()·\s]*)$/;

/**
 * Split "9.81 m/s^2" into "9.81" and "m/s^2".
 *
 * Only attempted when the question actually expects a unit, because `2x` ends in a
 * letter too and stripping `x` as a unit would be a disaster.
 */
export function splitQuantity(text: string): Quantity {
  const t = text.trim();
  const m = TRAILING_UNIT.exec(t);
  if (!m) return { magnitudeText: t, unitText: null };
  const candidate = m[1]!.trim();
  if (!parseUnit(candidate)) return { magnitudeText: t, unitText: null };
  const magnitude = t.slice(0, t.length - m[0]!.length).trim();
  if (!magnitude) return { magnitudeText: t, unitText: null };
  return { magnitudeText: magnitude, unitText: candidate };
}
