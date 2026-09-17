/**
 * The indicator catalogue, and the illustrative series that stand in for real
 * data when no live source is reachable.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE. Numbers produced here are never
 * presented as observations. Every path that can return them also returns
 * `mode: "demo"`, and every surface that renders them shows a badge saying so.
 * The shapes below are plausible — that is the point of a teaching demo — but
 * plausible is not the same as true, and a student quoting one of these figures
 * in a piece of research would be quoting MarketLab, not the World Bank.
 *
 * The indicator codes, names and descriptions are real. They are the actual
 * World Bank series identifiers, so the moment the app can reach the API the
 * same catalogue starts returning real observations without anything else
 * changing.
 */

export interface Indicator {
  /** The real World Bank series code. */
  code: string;
  name: string;
  unit: string;
  /** Decimal places the values are quoted to. */
  dp: number;
  /** What the indicator measures and how to read it. */
  explanation: string;
  /** What it does not measure — the caveat a careful student needs. */
  caveat: string;
  source: string;
  sourceUrl: string;
  /** Roughly where a typical country sits, used to shape the demo series. */
  demoBase: number;
  demoSpread: number;
  /** Whether higher is conventionally better. Drives nothing but the copy. */
  direction: "higher-better" | "lower-better" | "neutral";
}

export const INDICATORS: Indicator[] = [
  {
    code: "NY.GDP.MKTP.KD.ZG",
    name: "GDP growth (annual %)",
    unit: "%",
    dp: 1,
    explanation:
      "The percentage change in a country's real gross domestic product from one year to the next. 'Real' means the figure has been adjusted for inflation, so it measures a change in the volume of output rather than in prices. It is the headline measure of economic growth.",
    caveat:
      "GDP counts output, not wellbeing. It says nothing about how the output is distributed, what it cost the environment, or how much unpaid work sits outside it.",
    source: "World Bank national accounts data, and OECD National Accounts data files",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
    demoBase: 2.4, demoSpread: 2.6, direction: "higher-better",
  },
  {
    code: "FP.CPI.TOTL.ZG",
    name: "Inflation, consumer prices (annual %)",
    unit: "%",
    dp: 1,
    explanation:
      "The annual percentage change in the cost of a fixed basket of goods and services bought by a typical household. A figure of 3% means that basket costs 3% more than it did a year ago.",
    caveat:
      "The basket is an average. Households that spend a larger share of their income on the items rising fastest — usually food and energy — experience higher inflation than the headline figure.",
    source: "International Monetary Fund, International Financial Statistics",
    sourceUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
    demoBase: 3.1, demoSpread: 2.9, direction: "lower-better",
  },
  {
    code: "SL.UEM.TOTL.ZS",
    name: "Unemployment, total (% of labour force)",
    unit: "%",
    dp: 1,
    explanation:
      "The share of the labour force that is without work but available for and seeking employment. The labour force is everyone working or looking for work — not the whole population.",
    caveat:
      "People who have given up looking are not counted as unemployed, so the rate can fall because discouraged workers left the labour force rather than because anyone found a job. It also says nothing about underemployment.",
    source: "International Labour Organization, ILO modelled estimates",
    sourceUrl: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
    demoBase: 6.0, demoSpread: 2.2, direction: "lower-better",
  },
  {
    code: "NY.GDP.PCAP.CD",
    name: "GDP per capita (current US$)",
    unit: "US$",
    dp: 0,
    explanation:
      "Gross domestic product divided by the mid-year population, in current US dollars. The usual first comparison of average material living standards between countries.",
    caveat:
      "It is a mean, so it is pulled upwards by high incomes and says nothing about the median household. Converting at market exchange rates also understates what a dollar buys in lower-income countries.",
    source: "World Bank national accounts data",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
    demoBase: 34_000, demoSpread: 6_000, direction: "higher-better",
  },
  {
    code: "NE.EXP.GNFS.ZS",
    name: "Exports of goods and services (% of GDP)",
    unit: "% of GDP",
    dp: 1,
    explanation:
      "The value of everything a country sells abroad, as a share of its total output. A standard measure of how open an economy is to international trade.",
    caveat:
      "A high share can mean a competitive export sector or simply a small domestic market. Re-exports can also inflate it without much being produced locally.",
    source: "World Bank national accounts data",
    sourceUrl: "https://data.worldbank.org/indicator/NE.EXP.GNFS.ZS",
    demoBase: 31.0, demoSpread: 5.0, direction: "neutral",
  },
  {
    code: "FR.INR.RINR",
    name: "Real interest rate (%)",
    unit: "%",
    dp: 1,
    explanation:
      "The lending interest rate adjusted for inflation as measured by the GDP deflator. It is the return a lender actually earns in purchasing power, and the real cost a business faces to borrow.",
    caveat:
      "It is a single national average across very different kinds of borrowing, and it depends on which inflation measure is used to deflate it.",
    source: "International Monetary Fund, International Financial Statistics",
    sourceUrl: "https://data.worldbank.org/indicator/FR.INR.RINR",
    demoBase: 2.2, demoSpread: 2.4, direction: "neutral",
  },
  {
    code: "SP.POP.TOTL",
    name: "Population, total",
    unit: "people",
    dp: 0,
    explanation:
      "The total resident population, counting all residents regardless of legal status or citizenship, at mid-year.",
    caveat:
      "Census coverage and estimation methods differ between countries, and between years within a country.",
    source: "United Nations Population Division, World Population Prospects",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
    demoBase: 62_000_000, demoSpread: 1_200_000, direction: "neutral",
  },
  {
    code: "NV.IND.MANF.ZS",
    name: "Manufacturing, value added (% of GDP)",
    unit: "% of GDP",
    dp: 1,
    explanation:
      "The share of GDP produced by manufacturing — the net output of the sector after adding up outputs and subtracting intermediate inputs.",
    caveat:
      "A falling share does not by itself mean manufacturing is shrinking: it can fall because services grew faster.",
    source: "World Bank national accounts data",
    sourceUrl: "https://data.worldbank.org/indicator/NV.IND.MANF.ZS",
    demoBase: 12.5, demoSpread: 2.0, direction: "neutral",
  },
];

export interface Region {
  iso3: string;
  name: string;
  /** Multiplies the demo base, so different countries do not draw the same line. */
  demoFactor: number;
}

export const REGIONS: Region[] = [
  { iso3: "GBR", name: "United Kingdom", demoFactor: 1.0 },
  { iso3: "USA", name: "United States", demoFactor: 1.25 },
  { iso3: "DEU", name: "Germany", demoFactor: 1.08 },
  { iso3: "FRA", name: "France", demoFactor: 0.98 },
  { iso3: "JPN", name: "Japan", demoFactor: 0.9 },
  { iso3: "CHN", name: "China", demoFactor: 0.42 },
  { iso3: "IND", name: "India", demoFactor: 0.12 },
  { iso3: "BRA", name: "Brazil", demoFactor: 0.3 },
  { iso3: "ZAF", name: "South Africa", demoFactor: 0.22 },
  { iso3: "KAZ", name: "Kazakhstan", demoFactor: 0.33 },
  { iso3: "NGA", name: "Nigeria", demoFactor: 0.07 },
  { iso3: "WLD", name: "World", demoFactor: 0.4 },
];

export interface SeriesPoint {
  year: number;
  value: number;
}

export type DataMode = "live" | "demo";

export interface SeriesResult {
  mode: DataMode;
  indicator: Indicator;
  region: Region | { iso3: string; name: string };
  points: SeriesPoint[];
  /** Named exactly, so the interface never has to guess what to attribute. */
  attribution: string;
  /** Present when a live fetch was attempted and failed. */
  fellBackBecause?: string;
  fetchedAt: number;
}

export function findIndicator(code: string): Indicator | undefined {
  return INDICATORS.find((i) => i.code === code);
}

export function findRegion(iso3: string): Region | undefined {
  return REGIONS.find((r) => r.iso3 === iso3.toUpperCase());
}

/**
 * A deterministic hash, so the same indicator/region/year always draws the
 * same demo point. A demo series that changes on every page load is worse than
 * useless for teaching — a student cannot refer back to what they saw.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map to [0, 1).
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * ILLUSTRATIVE DATA. Not an observation, not an estimate, and not attributable
 * to anybody. It exists so the Data section is explorable before an API is
 * connected, and every caller labels it as a demo.
 */
export function demoSeries(code: string, iso3: string, from: number, to: number): SeriesPoint[] {
  const indicator = findIndicator(code);
  if (!indicator) return [];
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];

  const region = findRegion(iso3);
  const factor = region?.demoFactor ?? 1;
  const isLevel = indicator.dp === 0;           // populations and dollar levels trend
  const base = indicator.demoBase * (isLevel ? factor : 0.8 + factor * 0.4);

  const points: SeriesPoint[] = [];
  // A slow random walk plus a shared cycle, so neighbouring years relate to
  // each other the way a real macro series does rather than jittering.
  let drift = 0;
  for (let year = from; year <= to; year++) {
    const noise = hash(`${code}|${iso3}|${year}`) - 0.5;
    drift = drift * 0.72 + noise;
    const cycle = Math.sin((year - from) / 3.1 + factor * 4) * 0.35;
    const value = isLevel
      ? base * (1 + 0.018 * (year - from)) * (1 + (drift * 0.02 + cycle * 0.01))
      : base + (drift + cycle) * indicator.demoSpread;
    points.push({ year, value: Number(value.toFixed(indicator.dp === 0 ? 0 : 3)) });
  }
  return points;
}

export function demoResult(code: string, iso3: string, from: number, to: number, reason?: string): SeriesResult | null {
  const indicator = findIndicator(code);
  if (!indicator) return null;
  const region = findRegion(iso3) ?? { iso3, name: iso3 };
  return {
    mode: "demo",
    indicator,
    region,
    points: demoSeries(code, iso3, from, to),
    attribution:
      "Illustrative demo data generated by MarketLab. These are not observations and must not be cited as data. " +
      `The real series is ${indicator.name} (${indicator.code}), published by ${indicator.source}.`,
    fellBackBecause: reason,
    fetchedAt: Date.now(),
  };
}

/** Simple year-on-year change, used by the table. Null for the first year. */
export function yearOnYear(points: SeriesPoint[]): Array<SeriesPoint & { change: number | null }> {
  return points.map((p, i) => {
    const prev = points[i - 1];
    return { ...p, change: prev && prev.value !== 0 ? (p.value - prev.value) / Math.abs(prev.value) : null };
  });
}

export function toCsv(result: SeriesResult): string {
  const head = `# ${result.indicator.name} (${result.indicator.code}) — ${result.region.name}`;
  const mode = `# Data mode: ${result.mode === "live" ? "live" : "ILLUSTRATIVE DEMO — not real observations"}`;
  const attribution = `# ${result.attribution.replace(/\n/g, " ")}`;
  const rows = result.points.map((p) => `${p.year},${p.value}`);
  return [head, mode, attribution, "year,value", ...rows].join("\n");
}
