/**
 * The live-data integration layer.
 *
 * This is the only place in MarketLab that talks to an outside statistical
 * source, and it is deliberately thin: fetch, validate, hand back a
 * `SeriesResult` in exactly the shape the demo generator produces. Everything
 * upstream — the page, the chart, the table, the export — is written against
 * that one shape, so connecting a second source later (FRED, OECD, ONS) means
 * writing another adapter here and nothing else.
 *
 * The World Bank's indicator API needs no key and no account, which is why it
 * is the one that ships wired up. It does need outbound network access, and a
 * lot of environments this app will run in do not have it. When the fetch
 * fails for any reason the caller gets labelled demo data and the reason it
 * fell back — never a silent substitution, and never real-looking numbers
 * without the badge that says they are not real.
 */

import { demoResult, findIndicator, findRegion, type SeriesPoint, type SeriesResult } from "./indicators";

const API = "https://api.worldbank.org/v2";
const TIMEOUT_MS = 6000;

interface WorldBankRow {
  date?: string;
  value?: number | null;
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
}

/**
 * Fetches one indicator for one country. Returns demo data, clearly marked,
 * rather than throwing: a data page that renders an error where a chart should
 * be teaches nothing, and a page that pretends is worse.
 */
export async function fetchSeries(
  code: string, iso3: string, from: number, to: number,
): Promise<SeriesResult | null> {
  const indicator = findIndicator(code);
  if (!indicator) return null;
  const region = findRegion(iso3) ?? { iso3: iso3.toUpperCase(), name: iso3.toUpperCase() };

  if (process.env.MARKETLAB_DATA_MODE === "demo") {
    return demoResult(code, region.iso3, from, to, "MARKETLAB_DATA_MODE is set to demo.");
  }

  const url = `${API}/country/${encodeURIComponent(region.iso3)}/indicator/${encodeURIComponent(code)}`
    + `?format=json&per_page=200&date=${from}:${to}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      // The World Bank's numbers for a past year do not change. A day of cache
      // is the difference between a snappy page and a page that waits on a
      // third party every time a student moves a dropdown.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) {
      return demoResult(code, region.iso3, from, to, `The World Bank API replied ${response.status}.`);
    }
    const body: unknown = await response.json();
    const points = parse(body);
    if (points === null) {
      return demoResult(code, region.iso3, from, to, "The World Bank API replied in an unexpected shape.");
    }
    if (points.length === 0) {
      return demoResult(code, region.iso3, from, to, "The World Bank has no observations for this indicator, country and period.");
    }
    return {
      mode: "live",
      indicator,
      region,
      points,
      attribution: `${indicator.name} (${indicator.code}). Source: ${indicator.source}, retrieved from the World Bank open data API.`,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? `The World Bank API did not respond within ${TIMEOUT_MS / 1000} seconds.`
      : "This environment could not reach the World Bank API.";
    return demoResult(code, region.iso3, from, to, reason);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The API answers `[metadata, rows]`. Rows arrive newest-first and carry nulls
 * for years with no observation; both are fixed here so that nothing
 * downstream has to know the wire format.
 */
export function parse(body: unknown): SeriesPoint[] | null {
  if (!Array.isArray(body) || body.length < 2) return null;
  const rows = body[1];
  if (!Array.isArray(rows)) return null;
  const points: SeriesPoint[] = [];
  for (const raw of rows as WorldBankRow[]) {
    if (!raw || typeof raw !== "object") continue;
    const year = Number(raw.date);
    const value = raw.value;
    if (!Number.isFinite(year)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue; // a gap is a gap
    points.push({ year, value });
  }
  return points.sort((a, b) => a.year - b.year);
}
