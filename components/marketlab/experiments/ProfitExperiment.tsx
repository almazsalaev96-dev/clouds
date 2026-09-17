"use client";

import * as React from "react";
import {
  Callout, Card, CardBody, CardHeader, Field, MetricCard, NumberInput, SliderField, Table, Td, Toggle,
} from "@/components/marketlab/ui/primitives";
import { LineChart, type Series } from "@/components/marketlab/charts";
import { ExperimentShell, ResultGrid } from "./ExperimentShell";
import { findExperiment } from "@/lib/marketlab/experiments";
import { bestScenario, marketingUplift, profit, profitCurve, runScenarios } from "@/lib/marketlab/profit";
import { currencySymbol, decimal, money, percent, signedMoney, units } from "@/lib/marketlab/num";
import { useLab } from "@/lib/marketlab/store";

const META = findExperiment("profit")!;

const DEFAULTS = {
  price: 25,
  baseUnits: 900,
  variableCost: 11,
  fixedCosts: 9000,
  marketing: 0,
  modelResponse: false,
  maxUplift: 400,
  halfSpend: 2000,
};

export function ProfitExperiment() {
  const currency = useLab((s) => s.currency);
  const sym = currencySymbol(currency);
  const [v, setV] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, value: (typeof DEFAULTS)[K]) => setV((s) => ({ ...s, [k]: value }));

  const uplift = v.modelResponse ? marketingUplift(v.marketing, v.maxUplift, v.halfSpend) : 0;
  const unitsSold = v.baseUnits + uplift;

  const input = {
    price: v.price, unitsSold, variableCostPerUnit: v.variableCost,
    fixedCosts: v.fixedCosts, marketingSpend: v.marketing,
  };
  const r = profit(input);

  const maxUnits = Math.max(unitsSold * 1.6, (r.breakEvenUnits ?? 0) * 1.4, 10);
  const curve = profitCurve(input, maxUnits, 49);

  const series: Series[] = [
    { id: "revenue", label: "Revenue", points: curve.map((p) => ({ x: p.q, y: p.revenue })) },
    { id: "cost", label: "Total cost", points: curve.map((p) => ({ x: p.q, y: p.totalCost })), color: "var(--ml-s2)" },
    { id: "profit", label: "Profit", points: curve.map((p) => ({ x: p.q, y: p.profit })), color: "var(--ml-s4)", style: "dashed" },
  ];

  const markers = [
    ...(r.breakEvenUnits !== null
      ? [{ x: r.breakEvenUnits, y: r.breakEvenRevenue ?? 0, label: "Break-even", color: "var(--ml-text)", guides: true }]
      : []),
    { x: unitsSold, y: v.price * unitsSold, label: "Your volume", color: "var(--ml-accent)" },
  ];

  /* Three prices around the one the student set, so "should I charge more?"
     has an answer on the same screen as the question. Volume is scaled by an
     assumed elasticity of −1.2, which is stated on the table rather than
     buried — it is the single most consequential assumption here. */
  const SCENARIO_PED = -1.2;
  const scenarioUnits = (price: number) => {
    if (v.price <= 0) return unitsSold;
    const q = unitsSold * (price / v.price) ** SCENARIO_PED;
    return Number.isFinite(q) ? Math.max(0, q) : 0;
  };
  const scenarios = runScenarios([
    { id: "low", label: "Low", input: { ...input, price: v.price * 0.8, unitsSold: scenarioUnits(v.price * 0.8) } },
    { id: "mid", label: "Your price", input: { ...input } },
    { id: "high", label: "High", input: { ...input, price: v.price * 1.25, unitsSold: scenarioUnits(v.price * 1.25) } },
  ]);
  const winner = bestScenario(scenarios);

  const outputs = [
    { label: "Total revenue", value: money(r.revenue, currency, 0) },
    { label: "Total cost", value: money(r.totalCosts, currency, 0) },
    { label: "Profit", value: money(r.profit, currency, 0) },
    { label: "Contribution per unit", value: money(r.contributionPerUnit, currency) },
    { label: "Break-even units", value: r.breakEvenUnits === null ? "none" : units(Math.ceil(r.breakEvenUnits)) },
    { label: "Margin of safety", value: percent(r.marginOfSafety) },
    { label: "Profit margin", value: percent(r.profitMargin) },
    { label: "Units sold", value: units(unitsSold) },
  ];

  return (
    <ExperimentShell
      meta={META}
      inputs={{
        price: v.price, unitsBeforeMarketing: v.baseUnits, variableCostPerUnit: v.variableCost,
        fixedCosts: v.fixedCosts, marketingSpend: v.marketing,
        marketingResponseModelled: v.modelResponse,
        assumedMaxUplift: v.modelResponse ? v.maxUplift : "not used",
        assumedHalfSpend: v.modelResponse ? v.halfSpend : "not used",
        unitsSold: Number(unitsSold.toFixed(2)),
        currency,
      }}
      outputs={outputs}
      onReset={() => setV(DEFAULTS)}
      controls={
        <>
          <SliderField label="Selling price" value={v.price} onChange={(x) => set("price", x)}
            min={0} max={Math.max(100, v.variableCost * 5)} step={0.5} format={(x) => money(x, currency)} />
          <SliderField label="Units sold" value={v.baseUnits} onChange={(x) => set("baseUnits", x)}
            min={0} max={20000} step={10} format={(x) => `${units(x)} per period`}
            hint={v.modelResponse ? "Before any effect from marketing." : undefined} />
          <SliderField label="Variable cost per unit" value={v.variableCost} onChange={(x) => set("variableCost", x)}
            min={0} max={Math.max(50, v.price * 2)} step={0.5} format={(x) => money(x, currency)} />
          <Field label="Fixed costs per period" htmlFor="fc" hint="Rent, salaries, insurance — everything that does not change with output.">
            <NumberInput id="fc" value={v.fixedCosts} onChange={(x) => set("fixedCosts", x)} min={0} max={10_000_000} step={100} prefix={sym} />
          </Field>
          <Field label="Marketing spend" htmlFor="mk" hint="Added to fixed costs.">
            <NumberInput id="mk" value={v.marketing} onChange={(x) => set("marketing", x)} min={0} max={1_000_000} step={100} prefix={sym} />
          </Field>

          <div className="border-t border-ml-border pt-4">
            <Toggle
              checked={v.modelResponse}
              onChange={(x) => set("modelResponse", x)}
              label="Model a demand response to marketing"
              hint="Off by default. When on, units sold rise with spend under an assumption you set — it is not an estimate from data."
            />
          </div>
          {v.modelResponse ? (
            <div className="space-y-4 rounded-ml-md border border-ml-warning/30 bg-ml-warning-subtle px-3 py-3">
              <p className="ml-small text-ml-text-2">
                <strong>Assumption.</strong> uplift = maxUplift × (1 − e<sup>−spend·ln2 ÷ halfSpend</sup>). Diminishing
                returns, saturating at the ceiling you choose.
              </p>
              <SliderField label="Maximum extra units" value={v.maxUplift} onChange={(x) => set("maxUplift", x)}
                min={0} max={5000} step={25} format={(x) => units(x)} />
              <SliderField label="Spend for half that uplift" value={v.halfSpend} onChange={(x) => set("halfSpend", x)}
                min={100} max={50000} step={100} format={(x) => money(x, currency, 0)} />
              <p className="ml-small text-ml-text-2">
                At {money(v.marketing, currency, 0)} the model adds <strong className="ml-num">{units(uplift)}</strong> units.
              </p>
            </div>
          ) : null}
        </>
      }
      chart={
        <LineChart
          title="Revenue, cost and profit against volume"
          note="Straight lines throughout: costs are assumed linear and every unit sells at the same price. Model result."
          series={series}
          xLabel="Units sold per period"
          yLabel={`${currency === "none" ? "Value" : currency}`}
          formatX={(x) => units(x)}
          formatY={(y) => (Math.abs(y) >= 1000 ? `${sym}${decimal(y / 1000, 0)}k` : `${sym}${decimal(y, 0)}`)}
          formatYFull={(y) => money(y, currency, 0)}
          markers={markers}
          xIncludesZero
          zeroLine
          height={340}
          directLabels={false}
        />
      }
      results={
        <ResultGrid>
          <MetricCard label="Total revenue" value={money(r.revenue, currency, 0)}
            delta={`${money(v.price, currency)} × ${units(unitsSold)}`} provenance="Calculated" />
          <MetricCard label="Total cost" value={money(r.totalCosts, currency, 0)}
            delta={`${money(r.fixedCosts, currency, 0)} fixed + ${money(r.variableCosts, currency, 0)} variable`} provenance="Calculated" />
          <MetricCard label="Profit" value={money(r.profit, currency, 0)}
            delta={r.profitMargin === null ? "no revenue, so no margin" : `${percent(r.profitMargin)} margin`}
            tone={r.profit > 0 ? "positive" : r.profit < 0 ? "negative" : "neutral"} provenance="Calculated" />
          <MetricCard
            label="Break-even"
            value={r.breakEvenUnits === null ? "None" : units(Math.ceil(r.breakEvenUnits))}
            delta={r.breakEvenUnits === null ? "no quantity covers the costs" : `${money(r.breakEvenRevenue, currency, 0)} of revenue`}
            tone={r.breakEvenUnits === null ? "negative" : "neutral"}
            provenance="Calculated"
          />
        </ResultGrid>
      }
      interpretation={
        <>
          {r.problem ? <Callout tone="warning" title="Check the inputs">{r.problem}</Callout> : null}

          <p>
            <strong>Contribution.</strong> Each unit sells for {money(v.price, currency)} and costs{" "}
            {money(v.variableCost, currency)} to make, so it contributes{" "}
            <span className="ml-num">{money(r.contributionPerUnit, currency)}</span> towards the fixed costs. Across{" "}
            {units(unitsSold)} units that is <span className="ml-num">{money(r.totalContribution, currency, 0)}</span> of
            total contribution, against {money(r.fixedCosts, currency, 0)} of fixed costs — leaving a{" "}
            {r.profit >= 0 ? "profit" : "loss"} of <span className="ml-num">{money(Math.abs(r.profit), currency, 0)}</span>.
          </p>

          <p><strong>Break-even.</strong> {r.breakEvenNote}{" "}
            {r.breakEvenUnits !== null ? (
              <>
                <span className="ml-mono">BEQ = {money(r.fixedCosts, currency, 0)} ÷ {money(r.contributionPerUnit, currency)} = {units(Math.ceil(r.breakEvenUnits))} units</span>.
                {" "}You are selling {units(unitsSold)}, so the margin of safety is{" "}
                <span className="ml-num">{percent(r.marginOfSafety)}</span> — sales could fall by that much before the
                business stopped covering its costs.
              </>
            ) : null}
          </p>

          {v.marketing > 0 ? (
            <p>
              <strong>Marketing.</strong> {money(v.marketing, currency, 0)} of spend raises the break-even point by{" "}
              <span className="ml-num">
                {r.contributionPerUnit > 0 ? units(Math.ceil(v.marketing / r.contributionPerUnit)) : "an unbounded number of"}
              </span>{" "}
              units, because it has to be earned back {money(r.contributionPerUnit, currency)} at a time.
              {v.modelResponse
                ? ` The model assumes it brings in ${units(uplift)} extra units, which is worth ${money(uplift * r.contributionPerUnit, currency, 0)} of contribution — ${uplift * r.contributionPerUnit >= v.marketing ? "more" : "less"} than it cost. That comparison is only as good as the assumption behind it.`
                : " Nothing in the model assumes it brings in any extra sales; switch the demand response on if you want to test a specific assumption about that."}
            </p>
          ) : null}

          <Callout tone="neutral" title="Profit is not cash">
            A period can show a profit and still leave the business unable to pay its bills, because a sale on credit is
            profit today and cash in sixty days. Nothing on this page is a cash flow forecast.
          </Callout>
        </>
      }
      extra={
        <Card>
          <CardHeader
            title="Low, medium and high price"
            description="The same cost structure at three prices. Volume is scaled by an assumed price elasticity of demand of −1.2 — change that assumption and the ranking can change with it."
          />
          <CardBody>
            <Table head={["Scenario", "Price", "Units", "Revenue", "Total cost", "Profit"]}>
              {scenarios.map((s) => (
                <tr key={s.id} className={winner?.id === s.id ? "bg-ml-positive-subtle" : undefined}>
                  <Td>
                    {s.label}
                    {winner?.id === s.id ? <span className="ml-small ml-2 text-ml-positive">highest profit</span> : null}
                  </Td>
                  <Td numeric>{money(s.input.price, currency)}</Td>
                  <Td numeric>{units(s.input.unitsSold)}</Td>
                  <Td numeric>{money(s.result.revenue, currency, 0)}</Td>
                  <Td numeric>{money(s.result.totalCosts, currency, 0)}</Td>
                  <Td numeric>
                    <span className={s.result.profit > 0 ? "text-ml-positive" : s.result.profit < 0 ? "text-ml-negative" : undefined}>
                      {signedMoney(s.result.profit, currency, 0)}
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
            <p className="ml-small mt-3 text-ml-text-3">
              This table is the clearest demonstration in MarketLab of why an assumption has to be stated. The prices and
              costs are yours; the volumes are produced by an elasticity nobody measured. A different elasticity gives a
              different winner, and a research write-up that quoted the winner without the assumption would be reporting
              the assumption rather than a finding.
            </p>
          </CardBody>
        </Card>
      }
    />
  );
}
