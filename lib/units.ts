/**
 * Units, converted exactly enough for a science answer.
 *
 * A model converting in its head is where "1 mile = 1.6 km, so 26.2 miles
 * is 41.92 km" comes from — close, confident and wrong in the second
 * decimal. This is a table and a multiplication. Each unit is a factor to
 * the SI base of its kind (temperature, which has an offset, is done on its
 * own); two units of different kinds are refused rather than guessed at.
 */

type Kind = "length" | "mass" | "time" | "area" | "volume" | "speed" | "energy" | "power" | "pressure" | "data" | "amount" | "charge" | "force" | "angle" | "frequency";

const U: Record<string, [Kind, number]> = {
  /* length → metres */
  m: ["length", 1], km: ["length", 1e3], cm: ["length", 1e-2], mm: ["length", 1e-3], um: ["length", 1e-6], "µm": ["length", 1e-6], nm: ["length", 1e-9], pm: ["length", 1e-12],
  in: ["length", 0.0254], inch: ["length", 0.0254], ft: ["length", 0.3048], foot: ["length", 0.3048], feet: ["length", 0.3048], yd: ["length", 0.9144], mi: ["length", 1609.344], mile: ["length", 1609.344],
  nmi: ["length", 1852], au: ["length", 1.495978707e11], ly: ["length", 9.4607304725808e15], pc: ["length", 3.0856775814913673e16], "å": ["length", 1e-10], angstrom: ["length", 1e-10],
  /* mass → kilograms */
  kg: ["mass", 1], g: ["mass", 1e-3], mg: ["mass", 1e-6], ug: ["mass", 1e-9], "µg": ["mass", 1e-9], t: ["mass", 1e3], tonne: ["mass", 1e3],
  lb: ["mass", 0.45359237], oz: ["mass", 0.028349523125], st: ["mass", 6.35029318], u: ["mass", 1.66053906660e-27], da: ["mass", 1.66053906660e-27],
  /* time → seconds */
  s: ["time", 1], ms: ["time", 1e-3], us: ["time", 1e-6], "µs": ["time", 1e-6], ns: ["time", 1e-9], min: ["time", 60], h: ["time", 3600], hr: ["time", 3600], day: ["time", 86400], d: ["time", 86400], week: ["time", 604800], yr: ["time", 31557600], year: ["time", 31557600],
  /* area → m² */
  m2: ["area", 1], km2: ["area", 1e6], cm2: ["area", 1e-4], mm2: ["area", 1e-6], ha: ["area", 1e4], acre: ["area", 4046.8564224], ft2: ["area", 0.09290304], in2: ["area", 0.00064516], mi2: ["area", 2589988.110336],
  /* volume → m³ */
  m3: ["volume", 1], cm3: ["volume", 1e-6], dm3: ["volume", 1e-3], mm3: ["volume", 1e-9], l: ["volume", 1e-3], ml: ["volume", 1e-6], ul: ["volume", 1e-9],
  gal: ["volume", 0.003785411784], ukgal: ["volume", 0.00454609], pt: ["volume", 0.000473176473], ukpt: ["volume", 0.00056826125], floz: ["volume", 2.95735295625e-5], cup: ["volume", 0.0002365882365],
  /* speed → m/s */
  "m/s": ["speed", 1], "km/h": ["speed", 1 / 3.6], kph: ["speed", 1 / 3.6], mph: ["speed", 0.44704], kn: ["speed", 0.514444444], knot: ["speed", 0.514444444], "ft/s": ["speed", 0.3048],
  /* energy → joules */
  j: ["energy", 1], kj: ["energy", 1e3], mj: ["energy", 1e6], cal: ["energy", 4.184], kcal: ["energy", 4184], wh: ["energy", 3600], kwh: ["energy", 3.6e6], ev: ["energy", 1.602176634e-19], btu: ["energy", 1055.05585262],
  /* power → watts */
  w: ["power", 1], kw: ["power", 1e3], mw: ["power", 1e6], hp: ["power", 745.69987158227022],
  /* pressure → pascals */
  pa: ["pressure", 1], kpa: ["pressure", 1e3], mpa: ["pressure", 1e6], bar: ["pressure", 1e5], mbar: ["pressure", 100], atm: ["pressure", 101325], mmhg: ["pressure", 133.322387415], torr: ["pressure", 101325 / 760], psi: ["pressure", 6894.757293168],
  /* data → bytes */
  b: ["data", 1], byte: ["data", 1], kb: ["data", 1e3], mb: ["data", 1e6], gb: ["data", 1e9], tb: ["data", 1e12], kib: ["data", 1024], mib: ["data", 1024 ** 2], gib: ["data", 1024 ** 3], tib: ["data", 1024 ** 4], bit: ["data", 1 / 8],
  /* amount → moles */
  mol: ["amount", 1], mmol: ["amount", 1e-3], umol: ["amount", 1e-6], kmol: ["amount", 1e3],
  /* charge → coulombs */
  c: ["charge", 1], mc: ["charge", 1e-3], uc: ["charge", 1e-6], mah: ["charge", 3.6], ah: ["charge", 3600],
  /* force → newtons */
  n: ["force", 1], kn_force: ["force", 1e3], lbf: ["force", 4.4482216152605], dyn: ["force", 1e-5],
  /* angle → radians */
  rad: ["angle", 1], deg: ["angle", Math.PI / 180], "°": ["angle", Math.PI / 180], grad: ["angle", Math.PI / 200], rev: ["angle", 2 * Math.PI], turn: ["angle", 2 * Math.PI],
  /* frequency → hertz */
  hz: ["frequency", 1], khz: ["frequency", 1e3], mhz: ["frequency", 1e6], ghz: ["frequency", 1e9], rpm: ["frequency", 1 / 60],
};

/* Spellings people use, read to the table's own keys. Case matters for a
   few (mW and MW, mC and MC), so those are looked up before lowering. */
const CASED: Record<string, string> = { MW: "mw_mega", mW: "mw_milli", MJ: "mj", mJ: "mj_milli", MPa: "mpa", MB: "mb", Mb: "mb", MHz: "mhz", mHz: "mhz_milli", mC: "mc", kN: "kn_force", N: "n" };
U.mw_mega = ["power", 1e6];
U.mw_milli = ["power", 1e-3];
U.mj_milli = ["energy", 1e-3];
U.mhz_milli = ["frequency", 1e-3];

const ALIAS: Record<string, string> = {
  metre: "m", meter: "m", metres: "m", meters: "m", kilometre: "km", kilometer: "km", kilometres: "km", kilometers: "km", centimetre: "cm", centimeter: "cm", millimetre: "mm", millimeter: "mm",
  micrometre: "um", micron: "um", nanometre: "nm", nanometer: "nm", inches: "in", yard: "yd", yards: "yd", miles: "mi",
  kilogram: "kg", kilograms: "kg", gram: "g", grams: "g", milligram: "mg", tonnes: "tonne", ton: "tonne", pound: "lb", pounds: "lb", lbs: "lb", ounce: "oz", ounces: "oz", stone: "st",
  second: "s", seconds: "s", sec: "s", minute: "min", minutes: "min", hour: "h", hours: "h", days: "day", weeks: "week", years: "year",
  "m^2": "m2", "m²": "m2", "km^2": "km2", "km²": "km2", "cm^2": "cm2", "cm²": "cm2", "mm²": "mm2", hectare: "ha", hectares: "ha", acres: "acre", "ft²": "ft2",
  "m^3": "m3", "m³": "m3", "cm^3": "cm3", "cm³": "cm3", cc: "cm3", "dm^3": "dm3", "dm³": "dm3", litre: "l", liter: "l", litres: "l", liters: "l", millilitre: "ml", milliliter: "ml",
  gallon: "gal", gallons: "gal", pint: "pt", pints: "pt", "fl oz": "floz",
  "ms-1": "m/s", "m s-1": "m/s", "m s^-1": "m/s", "km/hr": "km/h", "kmh": "km/h", knots: "knot",
  joule: "j", joules: "j", kilojoule: "kj", calorie: "cal", calories: "cal", kilocalorie: "kcal", watt: "w", watts: "w", kilowatt: "kw", horsepower: "hp",
  pascal: "pa", atmosphere: "atm", atmospheres: "atm", "mm hg": "mmhg",
  bytes: "b", kilobyte: "kb", megabyte: "mb", gigabyte: "gb", terabyte: "tb", bits: "bit",
  mole: "mol", moles: "mol", coulomb: "c", coulombs: "c", newton: "n", newtons: "n",
  radian: "rad", radians: "rad", degree: "deg", degrees: "deg", hertz: "hz",
  celsius: "°c", "degc": "°c", "c°": "°c", fahrenheit: "°f", "degf": "°f", kelvin: "k",
};

function unitOf(raw: string): { kind: Kind | "temperature"; key: string } | null {
  const t = raw.trim().replace(/\s+/g, " ");
  if (CASED[t]) return { kind: U[CASED[t]][0], key: CASED[t] };
  let k = t.toLowerCase();
  k = ALIAS[k] ?? k;
  if (["°c", "c_temp", "°f", "k"].includes(k) || /^(°c|°f|k)$/.test(k)) return { kind: "temperature", key: k };
  if (U[k]) return { kind: U[k][0], key: k };
  const bare = k.replace(/\s/g, "");
  if (U[bare]) return { kind: U[bare][0], key: bare };
  return null;
}

const toKelvin = (v: number, u: string) => (u === "°c" ? v + 273.15 : u === "°f" ? (v - 32) * (5 / 9) + 273.15 : v);
const fromKelvin = (k: number, u: string) => (u === "°c" ? k - 273.15 : u === "°f" ? (k - 273.15) * (9 / 5) + 32 : k);

/** A number to `sig` significant figures, in plain notation when it reads well and standard form when not. */
export function sigFig(x: number, sig = 4): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-4 && a < 1e9) {
    const s = Number(x.toPrecision(sig));
    return s.toLocaleString("en-GB", { maximumSignificantDigits: sig, useGrouping: false });
  }
  const [m, e] = x.toExponential(sig - 1).split("e");
  return `${m} × 10^${Number(e)}`;
}

export type Converted = { ok: true; value: number; text: string } | { ok: false; why: string };

/** `value` in `from`, as `to`. Refuses units it does not know and units of different kinds. */
export function convert(value: number, from: string, to: string, sig = 4): Converted {
  if (!Number.isFinite(value)) return { ok: false, why: "That is not a number." };
  const a = unitOf(from);
  const b = unitOf(to);
  if (!a) return { ok: false, why: `Unknown unit “${from}”.` };
  if (!b) return { ok: false, why: `Unknown unit “${to}”.` };
  if (a.kind !== b.kind) return { ok: false, why: `“${from}” is ${a.kind === "temperature" ? "a temperature" : `a ${a.kind}`} and “${to}” is ${b.kind === "temperature" ? "a temperature" : `a ${b.kind}`}: they do not convert.` };
  const out = a.kind === "temperature"
    ? fromKelvin(toKelvin(value, a.key), b.key)
    : (value * U[a.key][1]) / U[b.key][1];
  return { ok: true, value: out, text: `${sigFig(value, 12)} ${from.trim()} = ${sigFig(out, sig)} ${to.trim()}` };
}
