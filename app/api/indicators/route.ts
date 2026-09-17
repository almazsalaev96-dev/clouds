import { NextResponse } from "next/server";
import { fetchSeries } from "@/lib/marketlab/data/worldbank";
import { INDICATORS, REGIONS, findIndicator } from "@/lib/marketlab/data/indicators";

/**
 * The data route.
 *
 * It exists so the browser never talks to a statistics API directly: a
 * server-side fetch can be cached, can carry a key when a source needs one
 * (the World Bank does not, FRED will), and cannot be blocked by a CORS policy
 * nobody controls.
 *
 * The contract that matters is the `mode` field. `live` means these numbers
 * came from the named source. `demo` means MarketLab generated them for
 * illustration and they are not observations of anything. Every consumer is
 * required to show which, and the payload carries the attribution string ready
 * to print.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

const MIN_YEAR = 1960;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("indicator") ?? INDICATORS[0].code;
  const country = (params.get("country") ?? "GBR").toUpperCase();
  const thisYear = new Date().getUTCFullYear();
  const from = clampYear(Number(params.get("from") ?? thisYear - 20), thisYear);
  const to = clampYear(Number(params.get("to") ?? thisYear - 1), thisYear);

  if (!findIndicator(code)) {
    return NextResponse.json(
      { error: "Unknown indicator.", available: INDICATORS.map((i) => i.code) },
      { status: 400 },
    );
  }
  if (!/^[A-Z]{2,3}$/.test(country)) {
    return NextResponse.json({ error: "Country must be an ISO country code." }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: "The end year cannot be before the start year." }, { status: 400 });
  }

  const result = await fetchSeries(code, country, from, to);
  if (!result) return NextResponse.json({ error: "Unknown indicator." }, { status: 400 });
  return NextResponse.json(result);
}

function clampYear(value: number, thisYear: number): number {
  if (!Number.isFinite(value)) return thisYear - 10;
  return Math.min(thisYear, Math.max(MIN_YEAR, Math.round(value)));
}

/** The catalogue, so the page does not have to ship it twice. */
export async function OPTIONS() {
  return NextResponse.json({ indicators: INDICATORS, regions: REGIONS });
}
