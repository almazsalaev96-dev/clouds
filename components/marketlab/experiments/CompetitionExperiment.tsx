"use client";

import * as React from "react";
import {
  Badge, Callout, Card, CardBody, CardHeader, MetricCard, SliderField, Table, Td,
} from "@/components/marketlab/ui/primitives";
import { BarChart, LineChart, SERIES_TOKENS, type Series } from "@/components/marketlab/charts";
import { ExperimentShell, ResultGrid } from "./ExperimentShell";
import { findExperiment } from "@/lib/marketlab/experiments";
import {
  bestResponsePrice, compete, concentration, concentrationLabel, ownPriceCurve, type Firm, type MarketAssumptions,
} from "@/lib/marketlab/competition";
import { currencySymbol, decimal, money, percent, signedMoney, units } from "@/lib/marketlab/num";
import { useLab } from "@/lib/marketlab/store";

const META = findExperiment("competition")!;

const DEFAULTS = {
  myPrice: 20,
  myAppeal: 5,
  myVariableCost: 8,
  myFixedCost: 20000,
  rivalAPrice: 19,
  rivalAAppeal: 5,
  rivalBPrice: 24,
  rivalBAppeal: 6.5,
  marketSize: 20000,
  priceSensitivity: 0.18,
  outsideAppeal: 0,
};

export function CompetitionExperiment() {
  const currency = useLab((s) => s.currency);
  const sym = currencySymbol(currency);
  const [v, setV] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, value: (typeof DEFAULTS)[K]) => setV((s) => ({ ...s, [k]: value }));

  const firms: Firm[] = [
    { id: "me", name: "Your business", price: v.myPrice, appeal: v.myAppeal, variableCost: v.myVariableCost, fixedCost: v.myFixedCost },
    { id: "a", name: "Rival A", price: v.rivalAPrice, appeal: v.rivalAAppeal, variableCost: v.myVariableCost, fixedCost: v.myFixedCost },
    { id: "b", name: "Rival B", price: v.rivalBPrice, appeal: v.rivalBAppeal, variableCost: v.myVariableCost, fixedCost: v.myFixedCost },
  ];
  const assumptions: MarketAssumptions = {
    marketSize: v.marketSize, priceSensitivity: v.priceSensitivity, outsideAppeal: v.outsideAppeal,
  };

  const result = compete(firms, assumptions);
  const me = result.firms[0];
  const priceMin = Math.max(0.5, v.myVariableCost);
  const priceMax = Math.max(priceMin + 1, v.myVariableCost + 40);
  const curve = ownPriceCurve(firms, assumptions, "me", priceMin, priceMax, 61);
  const best = bestResponsePrice(firms, assumptions, "me", priceMin, priceMax);
  const hhi = concentration(result);

  const profitSeries: Series = {
    id: "profit", label: "Profit", points: curve.map((p) => ({ x: p.price, y: p.profit })),
  };
  const shareSeries: Series = {
    id: "share", label: "Market share", color: "var(--ml-s4)", style: "dashed",
    points: curve.map((p) => ({ x: p.price, y: p.share * 100 })),
  };

  const outputs = [
    { label: "Your market share", value: percent(me?.share ?? null) },
    { label: "Your units sold", value: units(me?.quantity ?? null) },
    { label: "Your revenue", value: money(me?.revenue ?? null, currency, 0) },
    { label: "Your profit", value: money(me?.profit ?? null, currency, 0) },
    { label: "Profit-maximising price against these rivals", value: best ? money(best.price, currency) : "—" },
    { label: "Customers buying nothing", value: percent(result.noPurchaseShare) },
    { label: "HHI", value: hhi === null ? "—" : decimal(hhi, 0) },
  ];

  return (
    <ExperimentShell
      meta={META}
      inputs={{
        yourPrice: v.myPrice, yourAppeal: v.myAppeal,
        variableCostPerUnit: v.myVariableCost, fixedCost: v.myFixedCost,
        rivalAPrice: v.rivalAPrice, rivalAAppeal: v.rivalAAppeal,
        rivalBPrice: v.rivalBPrice, rivalBAppeal: v.rivalBAppeal,
        marketSize: v.marketSize, priceSensitivity: v.priceSensitivity, outsideAppeal: v.outsideAppeal,
        currency,
      }}
      outputs={outputs}
      onReset={() => setV(DEFAULTS)}
      controls={
        <>
          <div>
            <p className="ml-label text-ml-text-3">Your business</p>
            <div className="mt-2 space-y-4">
              <SliderField label="Your price" value={v.myPrice} onChange={(x) => set("myPrice", x)}
                min={0} max={60} step={0.5} format={(x) => money(x, currency)} />
              <SliderField label="Your non-price appeal" value={v.myAppeal} onChange={(x) => set("myAppeal", x)}
                min={0} max={10} step={0.1} format={(x) => decimal(x, 1)}
                hint="Brand, quality, service, convenience — everything competition is about other than price." />
              <SliderField label="Variable cost per unit" value={v.myVariableCost} onChange={(x) => set("myVariableCost", x)}
                min={0} max={40} step={0.5} format={(x) => money(x, currency)} />
              <SliderField label="Fixed cost per period" value={v.myFixedCost} onChange={(x) => set("myFixedCost", x)}
                min={0} max={200000} step={1000} format={(x) => money(x, currency, 0)} />
            </div>
          </div>

          <div className="border-t border-ml-border pt-4">
            <p className="ml-label text-ml-text-3">Rivals</p>
            <div className="mt-2 space-y-4">
              <SliderField label="Rival A price" value={v.rivalAPrice} onChange={(x) => set("rivalAPrice", x)}
                min={0} max={60} step={0.5} format={(x) => money(x, currency)} />
              <SliderField label="Rival A appeal" value={v.rivalAAppeal} onChange={(x) => set("rivalAAppeal", x)}
                min={0} max={10} step={0.1} format={(x) => decimal(x, 1)} />
              <SliderField label="Rival B price" value={v.rivalBPrice} onChange={(x) => set("rivalBPrice", x)}
                min={0} max={60} step={0.5} format={(x) => money(x, currency)} />
              <SliderField label="Rival B appeal" value={v.rivalBAppeal} onChange={(x) => set("rivalBAppeal", x)}
                min={0} max={10} step={0.1} format={(x) => decimal(x, 1)} />
            </div>
          </div>

          <div className="border-t border-ml-border pt-4">
            <p className="ml-label text-ml-text-3">The market</p>
            <div className="mt-2 space-y-4">
              <SliderField label="Customers per period" value={v.marketSize} onChange={(x) => set("marketSize", x)}
                min={100} max={200000} step={100} format={(x) => units(x)} />
              <SliderField
                label="Price sensitivity (β)"
                value={v.priceSensitivity}
                onChange={(x) => set("priceSensitivity", x)}
                min={0} max={1} step={0.01}
                format={(x) => decimal(x, 2)}
                hint="The dial that matters most. At 0 nobody notices price at all; at 1 a small difference decides everything."
              />
              <SliderField
                label="Appeal of buying nothing"
                value={v.outsideAppeal}
                onChange={(x) => set("outsideAppeal", x)}
                min={-5} max={5} step={0.1}
                format={(x) => decimal(x, 1)}
                hint="Higher means more customers walk away entirely rather than buying from someone."
              />
            </div>
          </div>
        </>
      }
      chart={
        <div className="space-y-6">
          <LineChart
            title="Your profit and share across your own price"
            note="Rivals' prices are held fixed. In a real market they would respond. Model result."
            series={[profitSeries, shareSeries]}
            xLabel={`Your price (${currency === "none" ? "per unit" : currency})`}
            yLabel="Profit / share (%)"
            formatX={(x) => `${sym}${decimal(x, 0)}`}
            formatXFull={(x) => money(x, currency)}
            formatY={(y) => (Math.abs(y) >= 1000 ? `${decimal(y / 1000, 0)}k` : decimal(y, 0))}
            markers={[
              ...(best ? [{ x: best.price, y: best.profit, label: "Best response", color: "var(--ml-positive)", guides: true }] : []),
              { x: v.myPrice, y: me?.profit ?? 0, label: "You", color: "var(--ml-accent)" },
            ]}
            zeroLine
            height={320}
            directLabels={false}
          />
          <BarChart
            title="Market share"
            note="Including the customers who buy from nobody. Model result."
            yLabel="Share of customers"
            formatValue={(x) => `${decimal(x, 1)}%`}
            bars={[
              ...result.firms.map((f, i) => ({
                id: f.id, label: f.name, value: f.share * 100,
                tone: (f.id === "me" ? "accent" : "neutral") as "accent" | "neutral",
                note: `${money(f.price, currency)} · appeal ${decimal(f.appeal, 1)}`,
              })),
              { id: "none", label: "Buys nothing", value: result.noPurchaseShare * 100, tone: "neutral" as const },
            ]}
            horizontal
          />
        </div>
      }
      results={
        <ResultGrid>
          <MetricCard label="Your market share" value={percent(me?.share ?? null)}
            delta={`${units(me?.quantity ?? null)} customers`} provenance="Calculated" />
          <MetricCard label="Your revenue" value={money(me?.revenue ?? null, currency, 0)}
            delta={`${money(v.myPrice, currency)} × ${units(me?.quantity ?? null)}`} provenance="Calculated" />
          <MetricCard label="Your profit" value={money(me?.profit ?? null, currency, 0)}
            delta={`contribution ${money((me?.contributionPerUnit ?? 0), currency)} per unit`}
            tone={(me?.profit ?? 0) > 0 ? "positive" : (me?.profit ?? 0) < 0 ? "negative" : "neutral"} provenance="Calculated" />
          <MetricCard
            label="Best price against these rivals"
            value={best ? money(best.price, currency) : "—"}
            delta={best && me ? `${signedMoney(best.profit - me.profit, currency, 0)} vs your price` : undefined}
            provenance="Calculated"
          />
        </ResultGrid>
      }
      interpretation={
        <>
          {result.problem ? <Callout tone="warning" title="Check the assumptions">{result.problem}</Callout> : null}

          <p>
            <strong>Where your share comes from.</strong> Your attractiveness is appeal minus β × price:{" "}
            <span className="ml-mono">{decimal(v.myAppeal, 1)} − {decimal(v.priceSensitivity, 2)} × {decimal(v.myPrice, 2)} = {decimal(v.myAppeal - v.priceSensitivity * v.myPrice, 2)}</span>.
            Rival A&apos;s is {decimal(v.rivalAAppeal - v.priceSensitivity * v.rivalAPrice, 2)} and Rival B&apos;s is{" "}
            {decimal(v.rivalBAppeal - v.priceSensitivity * v.rivalBPrice, 2)}. Share is those three numbers, and the
            appeal of buying nothing, run through the logit rule — so what decides your share is the *gap* between you
            and the alternatives, never your own number alone.
          </p>

          {best && me ? (
            <p>
              <strong>The pricing trade-off.</strong> Against these rivals, the price that maximises your modelled profit
              is <span className="ml-num">{money(best.price, currency)}</span>, worth{" "}
              <span className="ml-num">{money(best.profit, currency, 0)}</span>. You are charging{" "}
              {money(v.myPrice, currency)}, which is {Math.abs(v.myPrice - best.price) < 0.5 ? "essentially that price" : v.myPrice < best.price ? "below it" : "above it"}
              {Math.abs(v.myPrice - best.price) >= 0.5 ? ` and gives up ${money(best.profit - me.profit, currency, 0)}` : ""}.
              Cutting price below that point wins share but gives up contribution on every unit, including the ones you
              would have sold anyway; raising it above earns more per sale than it loses in volume only up to a point.
            </p>
          ) : null}

          <p>
            <strong>Concentration.</strong> Among the firms that sell, the Herfindahl–Hirschman index is{" "}
            <span className="ml-num">{hhi === null ? "—" : decimal(hhi, 0)}</span> —{" "}
            {concentrationLabel(hhi).toLowerCase()}. {percent(result.noPurchaseShare)} of customers buy from nobody, which
            is what stops this being a fixed prize the three of you divide.
          </p>

          <Callout tone="warning" title="Rivals do not respond in this model">
            The best-response price is the best price <em>holding their prices fixed</em>. In an oligopoly a price cut is
            usually matched, and once it is, the share you gained here largely disappears while both of you earn less on
            every unit. That is the central insight of oligopoly theory and this model deliberately does not contain it —
            which makes &ldquo;what would happen if they matched me?&rdquo; a good thing to test by hand: set your price
            lower, then set theirs to the same, and compare.
          </Callout>
        </>
      }
      extra={
        <Card>
          <CardHeader title="All three firms" description="At the prices currently set. Every figure is a model result." />
          <CardBody>
            <Table head={["Firm", "Price", "Appeal", "Share", "Units", "Revenue", "Profit"]}>
              {result.firms.map((f, i) => (
                <tr key={f.id} className={f.id === "me" ? "bg-ml-accent-subtle" : undefined}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES_TOKENS[i % SERIES_TOKENS.length] }} />
                      {f.name}
                      {f.id === "me" ? <Badge tone="accent">you</Badge> : null}
                    </span>
                  </Td>
                  <Td numeric>{money(f.price, currency)}</Td>
                  <Td numeric>{decimal(f.appeal, 1)}</Td>
                  <Td numeric>{percent(f.share)}</Td>
                  <Td numeric>{units(f.quantity)}</Td>
                  <Td numeric>{money(f.revenue, currency, 0)}</Td>
                  <Td numeric>
                    <span className={f.profit > 0 ? "text-ml-positive" : f.profit < 0 ? "text-ml-negative" : undefined}>
                      {signedMoney(f.profit, currency, 0)}
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
            <p className="ml-small mt-3 text-ml-text-3">
              Rivals are given your cost structure so that differences in profit come only from price and appeal. If you
              want to model a rival with a genuine cost advantage, that is a different experiment — and a good one.
            </p>
          </CardBody>
        </Card>
      }
    />
  );
}
