"use client";

import * as React from "react";
import { AlertTriangle, Download, ExternalLink, RefreshCw } from "lucide-react";
import {
  Badge, Button, Callout, Card, CardBody, CardHeader, Field, MetricCard, NumberInput,
  Select, Skeleton, Table, Td,
} from "@/components/marketlab/ui/primitives";
import { LineChart } from "@/components/marketlab/charts";
import {
  INDICATORS, REGIONS, toCsv, yearOnYear, type SeriesResult,
} from "@/lib/marketlab/data/indicators";
import { compact, decimal, signedPercent } from "@/lib/marketlab/num";
import { download, slugifyFilename } from "@/lib/marketlab/store";
import { useLabContext } from "@/components/marketlab/assistant/LabAssistant";

/**
 * The data explorer.
 *
 * The badge in the header is the most important element on this page. `Live`
 * means the numbers came from the named source and can be cited. `Demo` means
 * MarketLab generated them for illustration and they are not observations of
 * anything — and the page says so in three places rather than one, because a
 * figure copied out of here and into a piece of research carries no badge with
 * it.
 */
export function DataExplorer({ initialIndicator }: { initialIndicator?: string }) {
  const thisYear = new Date().getUTCFullYear();
  const [indicator, setIndicator] = React.useState(
    INDICATORS.find((i) => i.code === initialIndicator)?.code ?? INDICATORS[0].code,
  );
  const [country, setCountry] = React.useState("GBR");
  const [from, setFrom] = React.useState(thisYear - 20);
  const [to, setTo] = React.useState(thisYear - 1);

  const [data, setData] = React.useState<SeriesResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ indicator, country, from: String(from), to: String(to) });
      const response = await fetch(`/api/indicators?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? `The data route replied ${response.status}.`);
      setData(body as SeriesResult);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load this series.");
    } finally {
      setLoading(false);
    }
  }, [indicator, country, from, to]);

  React.useEffect(() => { void load(); }, [load]);

  const meta = INDICATORS.find((i) => i.code === indicator)!;
  const rows = data ? yearOnYear(data.points) : [];
  const latest = rows[rows.length - 1];
  const earliest = rows[0];
  const values = rows.map((r) => r.value);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  useLabContext({
    surface: "data",
    inputs: [
      { label: "Indicator", value: meta.name },
      { label: "Country", value: REGIONS.find((r) => r.iso3 === country)?.name ?? country },
      { label: "Period", value: `${from}–${to}` },
      { label: "Data mode", value: data?.mode === "live" ? "live (real observations)" : "illustrative demo data" },
    ],
    outputs: latest ? [
      { label: `Latest value (${latest.year})`, value: `${decimal(latest.value, meta.dp)} ${meta.unit}` },
      { label: "Period mean", value: mean === null ? "—" : `${decimal(mean, meta.dp)} ${meta.unit}` },
    ] : [],
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="ml-h1 text-ml-text">Data</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          Real economic indicators, each with what it measures, what it does not, and where it came from. When a live
          source cannot be reached, MarketLab shows clearly labelled illustrative data instead — never unlabelled numbers
          standing in for real ones.
        </p>
      </header>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Indicator" htmlFor="ind">
            <Select id="ind" value={indicator} onChange={(e) => setIndicator(e.target.value)}>
              {INDICATORS.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
            </Select>
          </Field>
          <Field label="Country or region" htmlFor="ctry">
            <Select id="ctry" value={country} onChange={(e) => setCountry(e.target.value)}>
              {REGIONS.map((r) => <option key={r.iso3} value={r.iso3}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="From year" htmlFor="from">
            <NumberInput id="from" value={from} onChange={setFrom} min={1960} max={thisYear} step={1} />
          </Field>
          <Field label="To year" htmlFor="to">
            <NumberInput id="to" value={to} onChange={setTo} min={1960} max={thisYear} step={1} />
          </Field>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <CardBody className="space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-72 w-full" />
            <p className="ml-small text-ml-text-4">Loading {meta.name}…</p>
          </CardBody>
        </Card>
      ) : error ? (
        <Callout tone="negative" title="This series could not be loaded">
          <p>{error}</p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw size={14} /> Try again</Button>
          </div>
        </Callout>
      ) : data && rows.length > 0 ? (
        <>
          {data.mode === "demo" ? (
            <Callout tone="warning" title="These are illustrative demo figures, not real data">
              <p>
                {data.fellBackBecause ?? "No live data source is reachable from this environment."} The shape below is
                generated by MarketLab so the page is explorable; <strong>it is not an observation of anything</strong> and
                must not be cited as data.
              </p>
              <p className="mt-2">
                The real series is <strong>{meta.name}</strong> ({meta.code}), published by {meta.source}.{" "}
                <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ml-accent underline">
                  Look it up at the source <ExternalLink size={11} className="inline" aria-hidden />
                </a>
              </p>
            </Callout>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label={`Latest (${latest.year})`}
              value={`${decimal(latest.value, meta.dp)}`}
              delta={meta.unit}
              hint={latest.change !== null ? `${signedPercent(latest.change)} on the year before` : undefined}
              provenance={data.mode === "live" ? "Observed" : "Demo figure"}
            />
            <MetricCard
              label={`Earliest (${earliest.year})`}
              value={`${decimal(earliest.value, meta.dp)}`}
              delta={meta.unit}
              provenance={data.mode === "live" ? "Observed" : "Demo figure"}
            />
            <MetricCard
              label="Mean over the period"
              value={mean === null ? "—" : decimal(mean, meta.dp)}
              delta={`${rows.length} observations`}
              provenance="Calculated"
            />
          </div>

          <Card>
            <CardHeader
              title={`${meta.name} — ${data.region.name}`}
              description={`${from} to ${to}`}
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={data.mode === "live" ? "positive" : "warning"}>
                    {data.mode === "live" ? "Live data" : "Demo data"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => download(
                      `${slugifyFilename(`${meta.name}-${data.region.name}-${from}-${to}`)}.csv`,
                      toCsv(data),
                      "text/csv;charset=utf-8",
                    )}
                  >
                    <Download size={14} /> CSV
                  </Button>
                </div>
              }
            />
            <CardBody>
              <LineChart
                series={[{
                  id: meta.code,
                  label: meta.name,
                  points: rows.map((r) => ({ x: r.year, y: r.value })),
                  dots: rows.length <= 30,
                }]}
                xLabel="Year"
                yLabel={meta.unit}
                formatX={(x) => String(Math.round(x))}
                formatY={(y) => compact(y)}
                formatYFull={(y) => `${decimal(y, meta.dp)} ${meta.unit}`}
                zeroLine
                height={340}
                directLabels={false}
              />
              <p className="ml-small mt-3 border-t border-ml-border pt-3 text-ml-text-4">
                <strong className="text-ml-text-3">Source.</strong> {data.attribution}
              </p>
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="What this indicator measures" />
              <CardBody className="space-y-3">
                <p className="ml-body text-ml-text-2">{meta.explanation}</p>
                <Callout tone="warning" title="What it does not measure">{meta.caveat}</Callout>
                <p className="ml-small text-ml-text-4">
                  Series code <code className="ml-mono">{meta.code}</code> ·{" "}
                  <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ml-accent underline">
                    Source page <ExternalLink size={11} className="inline" aria-hidden />
                  </a>
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="The numbers" description="Year-on-year change is calculated by MarketLab from the values." />
              <CardBody>
                <div className="ml-scroll max-h-80 overflow-y-auto">
                  <Table head={["Year", meta.unit, "Change"]}>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.year}>
                        <Td>{r.year}</Td>
                        <Td numeric>{decimal(r.value, meta.dp)}</Td>
                        <Td numeric>
                          <span className={r.change === null ? undefined : r.change > 0 ? "text-ml-positive" : r.change < 0 ? "text-ml-negative" : undefined}>
                            {signedPercent(r.change)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      ) : (
        <Callout tone="neutral" title="No observations for this combination">
          <p>
            There are no values for {meta.name} in {REGIONS.find((r) => r.iso3 === country)?.name ?? country} between{" "}
            {from} and {to}. Try a wider period or a different country — coverage varies a great deal by indicator.
          </p>
        </Callout>
      )}

      <Card>
        <CardHeader title="How the data layer is built" description="So it can be pointed at more sources later." />
        <CardBody className="ml-body ml-prose space-y-3 text-ml-text-2">
          <p>
            The browser never talks to a statistics API directly. It asks MarketLab&apos;s own{" "}
            <code className="ml-mono">/api/indicators</code> route, which fetches from the source, normalises the reply
            into one shape and caches it. Everything downstream — the chart, the table, the export — is written against
            that one shape, so adding FRED, OECD or a national statistics office means writing one adapter and changing
            nothing else.
          </p>
          <p>
            The World Bank indicator API is the one wired up, because it needs no key and no account. It does need
            outbound network access. Where that is unavailable, the route returns illustrative data with{" "}
            <code className="ml-mono">mode: &quot;demo&quot;</code> and the reason, and every surface shows the badge you
            can see above.
          </p>
          <p className="flex items-start gap-2 text-ml-text-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-ml-warning" aria-hidden />
            <span>
              If you are citing a figure in a piece of research, go to the source page and quote it from there. Any
              intermediary — this one included — can be out of date, and a citation should point at the publisher.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
