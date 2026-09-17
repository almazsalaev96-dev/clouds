"use client";

import * as React from "react";
import {
  Badge, Callout, Card, CardBody, CardHeader, MetricCard, NumberInput, Field, Segmented, Table, Td,
} from "@/components/marketlab/ui/primitives";
import { BarChart, LineChart, type Series } from "@/components/marketlab/charts";
import { ExperimentShell, ResultGrid } from "./ExperimentShell";
import { findExperiment } from "@/lib/marketlab/experiments";
import {
  BAND_LABEL, BAND_REVENUE_RULE, constantElasticityQuantity, elasticity, linearDemandQuantity,
  quantityFromElasticity, revenue, type ElasticityMethod,
} from "@/lib/marketlab/elasticity";
import { currencySymbol, decimal, linspace, money, percent, signedMoney, signedPercent, units } from "@/lib/marketlab/num";
import { useLab } from "@/lib/marketlab/store";

const META = findExperiment("elasticity")!;

const DEFAULTS = {
  driver: "observed" as "observed" | "assumed",
  method: "midpoint" as ElasticityMethod,
  p0: 10,
  q0: 1000,
  p1: 12,
  q1: 800,
  assumedPed: -1.2,
};

export function ElasticityExperiment() {
  const currency = useLab((s) => s.currency);
  const sym = currencySymbol(currency);
  const [v, setV] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, value: (typeof DEFAULTS)[K]) => setV((s) => ({ ...s, [k]: value }));

  // When elasticity is the driver, the new quantity is derived from it rather
  // than entered — which is the whole difference between measuring an
  // elasticity and assuming one, and the interface makes you pick.
  const q1 = v.driver === "observed"
    ? v.q1
    : quantityFromElasticity(v.p0, v.q0, v.p1, v.assumedPed, v.method) ?? 0;

  const e = elasticity({ initialPrice: v.p0, initialQuantity: v.q0, newPrice: v.p1, newQuantity: q1, method: v.method });
  const r = revenue(v.p0, v.q0, v.p1, q1);

  const ped = v.driver === "assumed" ? v.assumedPed : e.ped;
  const magnitude = ped === null ? null : Math.abs(ped);
  const band = e.band;

  /* The revenue curve. Which demand model is honest here depends on which
     driver the student chose: a constant-elasticity curve when they assumed an
     elasticity, a straight line through the two points when they measured one. */
  const priceMin = Math.max(0.01, Math.min(v.p0, v.p1) * 0.4);
  const priceMax = Math.max(v.p0, v.p1) * 1.8;
  const curvePoints = linspace(priceMin, priceMax, 61);
  const modelQuantity = (p: number) =>
    v.driver === "assumed" || v.p0 === v.p1
      ? constantElasticityQuantity(p, v.p0, v.q0, ped ?? -1)
      : linearDemandQuantity(p, v.p0, v.q0, v.p1, q1);

  /* Two charts, not two lines on one. Revenue peaks near £10,000 while quantity
     sits near 1,000, so plotting them against a single axis flattens the demand
     curve into a line that looks like it barely moves — which is the exact
     misreading this experiment exists to correct. Same x-scale, stacked, one
     measure each. */
  const revenueSeries: Series = {
    id: "tr",
    label: "Total revenue",
    points: curvePoints.map((p) => {
      const q = modelQuantity(p);
      return { x: p, y: q === null ? null : p * q };
    }),
    area: true,
  };
  const quantitySeries: Series = {
    id: "qd",
    label: "Quantity demanded",
    points: curvePoints.map((p) => ({ x: p, y: modelQuantity(p) })),
    color: "var(--ml-s2)",
  };

  const outputs = [
    { label: "Price elasticity of demand", value: ped === null ? "—" : decimal(ped, 2) },
    { label: "Elasticity band", value: band ? BAND_LABEL[band] : "—" },
    { label: "Original revenue", value: money(r?.initialRevenue ?? null, currency) },
    { label: "New revenue", value: money(r?.newRevenue ?? null, currency) },
    { label: "Revenue change", value: r ? `${signedMoney(r.change, currency)} (${signedPercent(r.changeFraction)})` : "—" },
    { label: "New quantity", value: units(q1) },
  ];

  const revenueTone = r?.direction === "up" ? "positive" : r?.direction === "down" ? "negative" : "neutral";

  return (
    <ExperimentShell
      meta={META}
      inputs={{
        driver: v.driver, method: v.method,
        initialPrice: v.p0, initialQuantity: v.q0, newPrice: v.p1,
        newQuantity: Number(q1.toFixed(4)),
        assumedPED: v.driver === "assumed" ? v.assumedPed : "not used",
        currency,
      }}
      outputs={outputs}
      onReset={() => setV(DEFAULTS)}
      controls={
        <>
          <Field label="What do you know?" hint={
            v.driver === "observed"
              ? "You have two price–quantity observations, and elasticity is what you are measuring."
              : "You are assuming an elasticity, and the new quantity follows from it."
          }>
            <Segmented
              label="Driver"
              value={v.driver}
              onChange={(d) => set("driver", d)}
              options={[
                { value: "observed", label: "Two observations" },
                { value: "assumed", label: "An elasticity" },
              ]}
            />
          </Field>

          <Field label="Method" hint={
            v.method === "midpoint"
              ? "Midpoint: percentage changes are taken against the average of the two values, so the answer is the same in both directions."
              : "Base year: percentage changes are taken against the starting value. Simpler, but 10→12 and 12→10 give different magnitudes."
          }>
            <Segmented
              label="Method"
              value={v.method}
              onChange={(m) => set("method", m)}
              options={[
                { value: "midpoint", label: "Midpoint" },
                { value: "base", label: "Base year" },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Initial price" htmlFor="p0">
              <NumberInput id="p0" value={v.p0} onChange={(x) => set("p0", x)} min={0} max={100000} step={0.1} prefix={sym} />
            </Field>
            <Field label="New price" htmlFor="p1">
              <NumberInput id="p1" value={v.p1} onChange={(x) => set("p1", x)} min={0} max={100000} step={0.1} prefix={sym} />
            </Field>
            <Field label="Initial quantity" htmlFor="q0">
              <NumberInput id="q0" value={v.q0} onChange={(x) => set("q0", x)} min={0} max={10_000_000} step={1} />
            </Field>
            {v.driver === "observed" ? (
              <Field label="New quantity" htmlFor="q1">
                <NumberInput id="q1" value={v.q1} onChange={(x) => set("q1", x)} min={0} max={10_000_000} step={1} />
              </Field>
            ) : (
              <Field label="New quantity" hint="Derived from your elasticity.">
                <div className="ml-num flex h-[42px] items-center rounded-ml-sm border border-dashed border-ml-border bg-ml-inset px-3 text-[0.9375rem] text-ml-text">
                  {units(q1)}
                </div>
              </Field>
            )}
          </div>

          {v.driver === "assumed" ? (
            <Field
              label="Assumed price elasticity of demand"
              htmlFor="ped"
              hint="Negative for a normal good. −0.5 is inelastic, −1 is unit elastic, −2 is elastic."
            >
              <NumberInput id="ped" value={v.assumedPed} onChange={(x) => set("assumedPed", x)} min={-10} max={5} step={0.05} />
            </Field>
          ) : null}

          <div className="rounded-ml-md border border-ml-border bg-ml-inset px-3 py-2.5">
            <p className="ml-label text-ml-text-4">Percentage changes</p>
            <dl className="mt-1.5 space-y-1">
              <div className="ml-small flex justify-between gap-3">
                <dt className="text-ml-text-3">Change in price</dt>
                <dd className="ml-num font-medium text-ml-text">{signedPercent(e.priceChange)}</dd>
              </div>
              <div className="ml-small flex justify-between gap-3">
                <dt className="text-ml-text-3">Change in quantity</dt>
                <dd className="ml-num font-medium text-ml-text">{signedPercent(e.quantityChange)}</dd>
              </div>
            </dl>
          </div>
        </>
      }
      chart={
        <div className="space-y-6">
          <LineChart
            title="Total revenue across a range of prices"
            note={
              v.driver === "assumed"
                ? `Assumes a constant-elasticity demand curve, Q(P) = Q₀ × (P/P₀)^${decimal(ped ?? 0, 2)}. Model result.`
                : "Assumes demand is the straight line through your two observations. Elasticity is not constant along it. Model result."
            }
            series={[revenueSeries]}
            xLabel={`Price (${currency === "none" ? "per unit" : currency})`}
            yLabel={`Total revenue${currency === "none" ? "" : ` (${currency})`}`}
            formatX={(x) => `${sym}${decimal(x, x < 10 ? 1 : 0)}`}
            formatXFull={(x) => money(x, currency)}
            formatY={(y) => (Math.abs(y) >= 1000 ? `${sym}${decimal(y / 1000, 0)}k` : `${sym}${decimal(y, 0)}`)}
            formatYFull={(y) => money(y, currency, 0)}
            yIncludesZero
            markers={[
              { x: v.p0, y: r?.initialRevenue ?? 0, label: "Before", color: "var(--ml-text-3)", guides: true },
              { x: v.p1, y: r?.newRevenue ?? 0, label: "After", color: "var(--ml-accent)", guides: true },
            ]}
            directLabels={false}
            height={280}
          />
          <LineChart
            title="The demand curve behind it"
            note="The same price range. Quantity is in units, so it gets its own axis rather than being squashed onto the revenue one."
            series={[quantitySeries]}
            xLabel={`Price (${currency === "none" ? "per unit" : currency})`}
            yLabel="Quantity demanded (units)"
            formatX={(x) => `${sym}${decimal(x, x < 10 ? 1 : 0)}`}
            formatXFull={(x) => money(x, currency)}
            formatY={(y) => units(y)}
            formatYFull={(y) => `${units(y)} units`}
            yIncludesZero
            markers={[
              { x: v.p0, y: v.q0, label: "Before", color: "var(--ml-text-3)" },
              { x: v.p1, y: q1, label: "After", color: "var(--ml-accent)" },
            ]}
            directLabels={false}
            height={230}
          />
          <BarChart
            title="Total revenue before and after"
            note="TR = P × Q, at the two prices you set. Model result."
            yLabel={`Revenue (${currency === "none" ? "units" : currency})`}
            formatValue={(x) => money(x, currency, 0)}
            bars={[
              { id: "before", label: "Before", value: r?.initialRevenue ?? 0, tone: "neutral", note: `${money(v.p0, currency)} × ${units(v.q0)}` },
              { id: "after", label: "After", value: r?.newRevenue ?? 0, tone: revenueTone === "neutral" ? "accent" : revenueTone, note: `${money(v.p1, currency)} × ${units(q1)}` },
            ]}
            height={230}
          />
        </div>
      }
      results={
        <ResultGrid>
          <MetricCard
            label="Elasticity (PED)"
            value={ped === null ? "—" : decimal(ped, 2)}
            delta={magnitude === null ? undefined : `|PED| = ${decimal(magnitude, 2)}`}
            hint={band ? BAND_LABEL[band] : e.problem ?? undefined}
            provenance={v.driver === "assumed" ? "Assumption" : "Calculated"}
          />
          <MetricCard label="Original revenue" value={money(r?.initialRevenue ?? null, currency, 0)}
            delta={`${money(v.p0, currency)} × ${units(v.q0)}`} provenance="Calculated" />
          <MetricCard label="New revenue" value={money(r?.newRevenue ?? null, currency, 0)}
            delta={`${money(v.p1, currency)} × ${units(q1)}`} provenance="Calculated" />
          <MetricCard
            label="Revenue change"
            value={r ? signedMoney(r.change, currency, 0) : "—"}
            delta={r ? signedPercent(r.changeFraction) : undefined}
            tone={revenueTone}
            provenance="Calculated"
          />
        </ResultGrid>
      }
      interpretation={
        <>
          {e.problem ? (
            <Callout tone="warning" title="No elasticity can be calculated from these numbers">{e.problem}</Callout>
          ) : null}

          {ped !== null && band ? (
            <>
              <p>
                <strong>Sign.</strong> The coefficient is <span className="ml-num">{decimal(ped, 2)}</span>.{" "}
                {ped < 0
                  ? "It is negative because quantity demanded moved in the opposite direction to price, which is what the law of demand predicts for a normal good."
                  : "It is positive, which means quantity demanded moved in the same direction as price. That is unusual — it happens for Giffen and Veblen goods, and far more often it means something other than price also changed between your two observations."}
                {" "}The elastic/inelastic classification uses the magnitude,{" "}
                <span className="ml-num">{decimal(Math.abs(ped), 2)}</span>, but you should quote the sign.
              </p>
              <p>
                <strong>Band.</strong> {BAND_LABEL[band]}. {BAND_REVENUE_RULE[band]}
              </p>
              <p>
                <strong>Revenue.</strong> Price {v.p1 > v.p0 ? "rose" : v.p1 < v.p0 ? "fell" : "did not change"} by{" "}
                <span className="ml-num">{signedPercent(e.priceChange)}</span> and quantity{" "}
                {(e.quantityChange ?? 0) >= 0 ? "rose" : "fell"} by{" "}
                <span className="ml-num">{signedPercent(e.quantityChange)}</span>, so total revenue{" "}
                {r?.direction === "up" ? "rose" : r?.direction === "down" ? "fell" : "did not change"} from{" "}
                <span className="ml-num">{money(r?.initialRevenue ?? null, currency)}</span> to{" "}
                <span className="ml-num">{money(r?.newRevenue ?? null, currency)}</span>
                {r ? <> — a change of <span className="ml-num">{signedMoney(r.change, currency)}</span></> : null}.
                {" "}This is arithmetic, not a law: it follows from TR = P × Q and nothing else.
              </p>
              <p>
                <strong>Method matters.</strong> These figures use the{" "}
                {v.method === "midpoint" ? "midpoint (arc)" : "base-year"} method. Switching the method changes the
                coefficient — sometimes across a band boundary — without a single input changing. Any research write-up
                has to state which method it used.
              </p>
            </>
          ) : null}

          <Callout tone="neutral" title="Revenue is not profit">
            Nothing on this page accounts for the cost of supplying the units. A price cut that raises revenue can still
            reduce profit if the extra units cost more to make than they bring in. The{" "}
            <a href="/experiments/profit" className="text-ml-accent underline">profit simulator</a> is where that question
            gets answered.
          </Callout>
        </>
      }
      extra={
        <Card>
          <CardHeader
            title="The same price change at different elasticities"
            description="Your price change, applied to the same starting point under a range of assumed elasticities. Every row is a model result."
          />
          <CardBody>
            <Table head={["Assumed PED", "Band", "New quantity", "New revenue", "Change"]}>
              {[-0.2, -0.5, -0.8, -1.0, -1.5, -2.0, -3.0].map((assumed) => {
                const qty = quantityFromElasticity(v.p0, v.q0, v.p1, assumed, v.method) ?? 0;
                const rev = revenue(v.p0, v.q0, v.p1, qty);
                const mag = Math.abs(assumed);
                const rowBand = Math.abs(mag - 1) < 1e-3 ? "Unit elastic" : mag < 1 ? "Inelastic" : "Elastic";
                const highlight = ped !== null && Math.abs(assumed - ped) < 0.03;
                return (
                  <tr key={assumed} className={highlight ? "bg-ml-accent-subtle" : undefined}>
                    <Td>
                      <span className="ml-num">{decimal(assumed, 1)}</span>
                      {highlight ? <Badge tone="accent" className="ml-2">yours</Badge> : null}
                    </Td>
                    <Td numeric>{rowBand}</Td>
                    <Td numeric>{units(qty)}</Td>
                    <Td numeric>{money(rev?.newRevenue ?? null, currency, 0)}</Td>
                    <Td numeric>
                      <span className={rev?.direction === "up" ? "text-ml-positive" : rev?.direction === "down" ? "text-ml-negative" : undefined}>
                        {rev ? signedPercent(rev.changeFraction) : "—"}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </Table>
            <p className="ml-small mt-3 text-ml-text-3">
              Read down the last column. The sign flips as |PED| passes 1 — that crossing point is the whole content of
              the revenue rule, and it is worth being able to say why it is there rather than that it is.
            </p>
          </CardBody>
        </Card>
      }
    />
  );
}
