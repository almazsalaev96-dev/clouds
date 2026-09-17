"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Callout, Card, CardBody, CardHeader, Field, Formula, Input, MetricCard,
  NumberInput, Segmented, Select, SliderField, Table, Td, Textarea, Toggle, cx,
} from "@/components/marketlab/ui/primitives";
import { BarChart, LineChart, type Series } from "@/components/marketlab/charts";
import { profit, profitCurve, runScenarios, bestScenario, type ProfitInput } from "@/lib/marketlab/profit";
import { currencySymbol, decimal, divide, money, percent, signedMoney, units } from "@/lib/marketlab/num";
import { download, slugifyFilename, useHydrated, useLab, type Currency } from "@/lib/marketlab/store";
import { useLabContext } from "@/components/marketlab/assistant/LabAssistant";

/**
 * The business decision tools.
 *
 * One set of inputs feeds four views, which is the point: a pricing question,
 * a break-even question and a scenario question are the same numbers asked
 * three ways, and four disconnected calculators would hide that. The decision
 * report at the end is assembled from whatever is on screen plus the risks and
 * assumptions the user writes — it is a structure to fill in, not a document
 * that writes itself.
 */

type Tab = "pricing" | "breakeven" | "scenarios" | "report";

const DEFAULTS = {
  price: 24,
  variableCost: 11,
  fixedCosts: 9000,
  unitsSold: 900,
  marketing: 0,
  markupMode: false,
  markup: 1.2,
};

export function BusinessTools() {
  const hydrated = useHydrated();
  const currency = useLab((s) => s.currency);
  const setCurrency = useLab((s) => s.setCurrency);
  const sym = currencySymbol(currency);

  const [tab, setTab] = React.useState<Tab>("pricing");
  const [v, setV] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, value: (typeof DEFAULTS)[K]) => setV((s) => ({ ...s, [k]: value }));

  // Cost-plus is an alternative way of arriving at the price, not a different
  // model. Turning it on makes price a derived value so the two can never
  // silently disagree.
  const price = v.markupMode ? v.variableCost * (1 + v.markup) : v.price;

  const input: ProfitInput = {
    price, unitsSold: v.unitsSold, variableCostPerUnit: v.variableCost,
    fixedCosts: v.fixedCosts, marketingSpend: v.marketing,
  };
  const r = profit(input);

  useLabContext({
    surface: "tools",
    inputs: [
      { label: "Selling price", value: money(price, currency) },
      { label: "Variable cost per unit", value: money(v.variableCost, currency) },
      { label: "Fixed costs", value: money(v.fixedCosts, currency, 0) },
      { label: "Units sold", value: units(v.unitsSold) },
      { label: "Marketing spend", value: money(v.marketing, currency, 0) },
    ],
    outputs: [
      { label: "Revenue", value: money(r.revenue, currency, 0) },
      { label: "Total cost", value: money(r.totalCosts, currency, 0) },
      { label: "Profit", value: money(r.profit, currency, 0) },
      { label: "Contribution per unit", value: money(r.contributionPerUnit, currency) },
      { label: "Break-even units", value: r.breakEvenUnits === null ? "none" : units(Math.ceil(r.breakEvenUnits)) },
      { label: "Profit margin", value: percent(r.profitMargin) },
    ],
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="ml-h1 text-ml-text">Business decision tools</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          For a real idea rather than a textbook question. One set of numbers about your business, asked four different
          ways — what to charge, how many you need to sell, what happens if you are wrong about demand, and how to write
          the decision down so somebody else can check it.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* --------------------------------------------- Inputs ---- */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader
            title="Your business"
            description="Every view below reads these numbers."
            actions={<Button size="sm" variant="ghost" onClick={() => setV(DEFAULTS)}>Reset</Button>}
          />
          <CardBody className="space-y-5">
            <Field label="Currency" htmlFor="cur">
              <Select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} disabled={!hydrated}>
                <option value="GBP">Pounds (£)</option>
                <option value="USD">Dollars ($)</option>
                <option value="EUR">Euros (€)</option>
                <option value="none">No symbol</option>
              </Select>
            </Field>

            <Toggle
              checked={v.markupMode}
              onChange={(x) => set("markupMode", x)}
              label="Set price by mark-up on cost"
              hint="Cost-plus pricing. Simple, and it contains no information about what customers will actually pay."
            />

            {v.markupMode ? (
              <SliderField
                label="Mark-up on variable cost"
                value={v.markup}
                onChange={(x) => set("markup", x)}
                min={0} max={4} step={0.05}
                format={(x) => `${percent(x, 0)} → ${money(v.variableCost * (1 + x), currency)}`}
              />
            ) : (
              <Field label="Selling price" htmlFor="price">
                <NumberInput id="price" value={v.price} onChange={(x) => set("price", x)} min={0} max={1_000_000} step={0.5} prefix={sym} />
              </Field>
            )}

            <Field label="Variable cost per unit" htmlFor="vc" hint="Materials, packaging, the hourly labour in each unit.">
              <NumberInput id="vc" value={v.variableCost} onChange={(x) => set("variableCost", x)} min={0} max={1_000_000} step={0.5} prefix={sym} />
            </Field>
            <Field label="Fixed costs per period" htmlFor="fc" hint="Rent, salaries, insurance, subscriptions.">
              <NumberInput id="fc" value={v.fixedCosts} onChange={(x) => set("fixedCosts", x)} min={0} max={100_000_000} step={100} prefix={sym} />
            </Field>
            <Field label="Units sold per period" htmlFor="q" hint="Your actual or forecast volume. Nothing here predicts it for you.">
              <NumberInput id="q" value={v.unitsSold} onChange={(x) => set("unitsSold", x)} min={0} max={10_000_000} step={10} />
            </Field>
            <Field label="Marketing spend" htmlFor="mk" hint="Added to fixed costs.">
              <NumberInput id="mk" value={v.marketing} onChange={(x) => set("marketing", x)} min={0} max={10_000_000} step={100} prefix={sym} />
            </Field>

            <div className="rounded-ml-md border border-ml-border bg-ml-inset px-3 py-2.5">
              <p className="ml-label text-ml-text-4">At a glance</p>
              <dl className="mt-1.5 space-y-1">
                {[
                  ["Contribution per unit", money(r.contributionPerUnit, currency)],
                  ["Contribution margin", percent(r.contributionMargin)],
                  ["Mark-up on variable cost", percent(divide(r.contributionPerUnit, v.variableCost))],
                ].map(([k, val]) => (
                  <div key={k} className="ml-small flex justify-between gap-3">
                    <dt className="text-ml-text-3">{k}</dt>
                    <dd className="ml-num font-medium text-ml-text">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardBody>
        </Card>

        {/* ---------------------------------------------- Views ----- */}
        <div className="min-w-0 space-y-5">
          <Segmented
            label="Tool"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pricing", label: "Pricing" },
              { value: "breakeven", label: "Break-even" },
              { value: "scenarios", label: "Scenarios" },
              { value: "report", label: "Report" },
            ]}
          />

          {tab === "pricing" ? <PricingView input={input} currency={currency} /> : null}
          {tab === "breakeven" ? <BreakEvenView input={input} currency={currency} /> : null}
          {tab === "scenarios" ? <ScenarioView input={input} currency={currency} /> : null}
          {tab === "report" ? <ReportView input={input} currency={currency} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Pricing */

function PricingView({ input, currency }: { input: ProfitInput; currency: Currency }) {
  const r = profit(input);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue" value={money(r.revenue, currency, 0)}
          delta={`${money(input.price, currency)} × ${units(input.unitsSold)}`} provenance="Calculated" />
        <MetricCard label="Total cost" value={money(r.totalCosts, currency, 0)}
          delta={`${money(r.fixedCosts, currency, 0)} fixed + ${money(r.variableCosts, currency, 0)} variable`} provenance="Calculated" />
        <MetricCard label="Profit" value={money(r.profit, currency, 0)}
          tone={r.profit > 0 ? "positive" : r.profit < 0 ? "negative" : "neutral"}
          delta={r.profitMargin === null ? "no revenue" : `${percent(r.profitMargin)} of revenue`} provenance="Calculated" />
        <MetricCard label="Contribution per unit" value={money(r.contributionPerUnit, currency)}
          delta={r.contributionMargin === null ? undefined : `${percent(r.contributionMargin)} contribution margin`}
          tone={r.contributionPerUnit > 0 ? "neutral" : "negative"} provenance="Calculated" />
      </div>

      <Card>
        <CardHeader title="Where the money goes" description="Every unit's selling price, split three ways." />
        <CardBody>
          <BarChart
            yLabel={currency === "none" ? "Value per period" : currency}
            formatValue={(x) => money(x, currency, 0)}
            bars={[
              { id: "rev", label: "Revenue", value: r.revenue, tone: "accent" },
              { id: "vc", label: "Variable costs", value: r.variableCosts, tone: "neutral" },
              { id: "fc", label: "Fixed costs", value: r.fixedCosts, tone: "neutral" },
              { id: "profit", label: "Profit", value: r.profit, tone: r.profit >= 0 ? "positive" : "negative" },
            ]}
            height={250}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mark-up is not margin" description="The single most common arithmetic slip in pricing." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Formula label="Mark-up on cost" expression={`(${decimal(input.price, 2)} − ${decimal(input.variableCostPerUnit, 2)}) ÷ ${decimal(input.variableCostPerUnit, 2)} = ${percent(divide(r.contributionPerUnit, input.variableCostPerUnit), 1)}`} />
            <Formula label="Margin on price" expression={`(${decimal(input.price, 2)} − ${decimal(input.variableCostPerUnit, 2)}) ÷ ${decimal(input.price, 2)} = ${percent(r.contributionMargin, 1)}`} />
          </div>
          <p className="ml-body text-ml-text-2">
            The same two numbers give two different percentages because they are divided by different things. A 50%
            mark-up on cost is a 33% margin on price. Quoting one while meaning the other is how a business talks itself
            into thinking it is a third more profitable than it is.
          </p>
        </CardBody>
      </Card>

      <Callout tone="warning" title="What this cannot tell you">
        <ul>
          <li>Whether anyone will buy at this price. Volume is a number you entered, not a forecast.</li>
          <li>What your competitors charge, or what your customers think the product is worth.</li>
          <li>Whether the cost split into fixed and variable is right. That is a judgement about your own business.</li>
        </ul>
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------- Break-even */

function BreakEvenView({ input, currency }: { input: ProfitInput; currency: Currency }) {
  const r = profit(input);
  const maxUnits = Math.max(input.unitsSold * 1.7, (r.breakEvenUnits ?? 0) * 1.4, 10);
  const curve = profitCurve(input, maxUnits, 49);
  const series: Series[] = [
    { id: "revenue", label: "Revenue", points: curve.map((p) => ({ x: p.q, y: p.revenue })) },
    { id: "cost", label: "Total cost", points: curve.map((p) => ({ x: p.q, y: p.totalCost })), color: "var(--ml-s2)" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Break-even units"
          value={r.breakEvenUnits === null ? "None" : units(Math.ceil(r.breakEvenUnits))}
          delta={r.breakEvenUnits === null ? "no quantity covers the costs" : "per period"}
          tone={r.breakEvenUnits === null ? "negative" : "neutral"}
          provenance="Calculated"
        />
        <MetricCard label="Break-even revenue" value={money(r.breakEvenRevenue, currency, 0)} provenance="Calculated" />
        <MetricCard label="Margin of safety" value={percent(r.marginOfSafety)}
          delta={r.breakEvenUnits === null ? undefined : `${units(Math.max(0, input.unitsSold - r.breakEvenUnits))} units above break-even`}
          tone={(r.marginOfSafety ?? 0) > 0 ? "positive" : "negative"} provenance="Calculated" />
        <MetricCard label="Contribution per unit" value={money(r.contributionPerUnit, currency)}
          tone={r.contributionPerUnit > 0 ? "neutral" : "negative"} provenance="Calculated" />
      </div>

      <Card>
        <CardBody>
          <LineChart
            title="Revenue and cost against volume"
            note="Both lines are straight: costs are assumed linear and every unit sells at the same price. Model result."
            series={series}
            xLabel="Units sold per period"
            yLabel={currency === "none" ? "Value" : currency}
            formatX={(x) => units(x)}
            formatY={(y) => (Math.abs(y) >= 1000 ? `${currencySymbol(currency)}${decimal(y / 1000, 0)}k` : `${currencySymbol(currency)}${decimal(y, 0)}`)}
            formatYFull={(y) => money(y, currency, 0)}
            markers={r.breakEvenUnits !== null
              ? [{ x: r.breakEvenUnits, y: r.breakEvenRevenue ?? 0, label: "Break-even", color: "var(--ml-text)", guides: true }]
              : []}
            xIncludesZero
            directLabels={false}
            height={320}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The calculation, step by step" />
        <CardBody className="space-y-4">
          <Formula
            label="Contribution per unit"
            expression={`${decimal(input.price, 2)} − ${decimal(input.variableCostPerUnit, 2)} = ${decimal(r.contributionPerUnit, 2)}`}
            note="Selling price less the variable cost of making one more."
          />
          <Formula
            label="Break-even quantity"
            expression={
              r.breakEvenUnits === null
                ? "undefined — contribution per unit is not positive"
                : `${decimal(r.fixedCosts, 2)} ÷ ${decimal(r.contributionPerUnit, 2)} = ${decimal(r.breakEvenUnits, 1)} units`
            }
            note={r.breakEvenNote}
          />
          {r.breakEvenUnits !== null ? (
            <Formula
              label="Margin of safety"
              expression={`(${units(input.unitsSold)} − ${decimal(r.breakEvenUnits, 1)}) ÷ ${units(input.unitsSold)} = ${percent(r.marginOfSafety, 1)}`}
              note="How far sales could fall before the business stopped covering its costs."
            />
          ) : null}
        </CardBody>
      </Card>

      {r.breakEvenUnits === null ? (
        <Callout tone="negative" title="There is no break-even quantity here">
          {r.breakEvenNote} A spreadsheet would return a negative number or a division error; neither is the truth. The
          honest answer is that no quantity covers the costs until the price rises above the variable cost.
        </Callout>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Scenarios */

function ScenarioView({ input, currency }: { input: ProfitInput; currency: Currency }) {
  const [ped, setPed] = React.useState(-1.2);
  const [lowPct, setLowPct] = React.useState(-20);
  const [highPct, setHighPct] = React.useState(25);

  const volumeAt = (price: number) => {
    if (!(input.price > 0)) return input.unitsSold;
    const q = input.unitsSold * (price / input.price) ** ped;
    return Number.isFinite(q) ? Math.max(0, q) : 0;
  };
  const at = (pct: number) => {
    const price = input.price * (1 + pct / 100);
    return { ...input, price, unitsSold: volumeAt(price) };
  };

  const rows = runScenarios([
    { id: "low", label: `Low (${lowPct}%)`, input: at(lowPct) },
    { id: "mid", label: "Your price", input },
    { id: "high", label: `High (+${highPct}%)`, input: at(highPct) },
  ]);
  const winner = bestScenario(rows);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Scenario assumptions"
          description="The volumes below are produced by an elasticity you choose. Nothing measured it — which is exactly why it has to be stated."
        />
        <CardBody className="grid gap-5 sm:grid-cols-3">
          <SliderField label="Assumed PED" value={ped} onChange={setPed} min={-4} max={-0.1} step={0.1}
            format={(x) => `${decimal(x, 1)} (${Math.abs(x) < 1 ? "inelastic" : Math.abs(x) > 1 ? "elastic" : "unit"})`} />
          <SliderField label="Low price" value={lowPct} onChange={setLowPct} min={-60} max={-5} step={5} format={(x) => `${x}%`} />
          <SliderField label="High price" value={highPct} onChange={setHighPct} min={5} max={100} step={5} format={(x) => `+${x}%`} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Three prices side by side" />
        <CardBody className="space-y-5">
          <Table head={["Scenario", "Price", "Units", "Revenue", "Total cost", "Profit", "Margin"]}>
            {rows.map((s) => (
              <tr key={s.id} className={winner?.id === s.id ? "bg-ml-positive-subtle" : undefined}>
                <Td>
                  {s.label}
                  {winner?.id === s.id ? <Badge tone="positive" className="ml-2">highest profit</Badge> : null}
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
                <Td numeric>{percent(s.result.profitMargin)}</Td>
              </tr>
            ))}
          </Table>

          <BarChart
            title="Profit by scenario"
            note={`Assumes PED = ${decimal(ped, 1)}. Model result.`}
            yLabel={currency === "none" ? "Profit" : `Profit (${currency})`}
            formatValue={(x) => money(x, currency, 0)}
            bars={rows.map((s) => ({
              id: s.id, label: s.label, value: s.result.profit,
              tone: s.result.profit >= 0 ? "positive" : "negative",
            }))}
            height={240}
          />
        </CardBody>
      </Card>

      <Callout tone="warning" title="Move the elasticity slider before you trust the ranking">
        With inelastic demand the high-price scenario usually wins; with elastic demand the low-price one often does. If
        the ranking flips somewhere in the range you think is plausible, then the honest conclusion is that this evidence
        does not settle the question — and saying so is a stronger piece of analysis than picking one.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------------ Report */

interface ReportDraft {
  question: string;
  assumptions: string;
  risks: string;
  considerations: string;
}

const EMPTY_DRAFT: ReportDraft = { question: "", assumptions: "", risks: "", considerations: "" };

function ReportView({ input, currency }: { input: ProfitInput; currency: Currency }) {
  const [draft, setDraft] = React.useState<ReportDraft>(EMPTY_DRAFT);
  const [done, setDone] = React.useState(false);
  const r = profit(input);

  const markdown = () => [
    "# Business decision report", "",
    `*Prepared in MarketLab on ${new Date().toISOString().slice(0, 10)}*`, "",
    "## Business question", "",
    draft.question.trim() || "_Not yet written._", "",
    "## Assumptions", "",
    draft.assumptions.trim() || "_Not yet written._", "",
    "These figures were also assumed rather than measured:", "",
    "| Assumption | Value |", "| --- | --- |",
    `| Selling price | ${money(input.price, currency)} |`,
    `| Variable cost per unit | ${money(input.variableCostPerUnit, currency)} |`,
    `| Fixed costs per period | ${money(input.fixedCosts, currency, 0)} |`,
    `| Marketing spend | ${money(input.marketingSpend ?? 0, currency, 0)} |`,
    `| Units sold per period | ${units(input.unitsSold)} |`, "",
    "## Calculations", "",
    "```",
    `Total revenue      TR = P × Q          = ${decimal(input.price, 2)} × ${decimal(input.unitsSold, 0)} = ${decimal(r.revenue, 2)}`,
    `Total cost         TC = FC + VC × Q    = ${decimal(r.fixedCosts, 2)} + ${decimal(input.variableCostPerUnit, 2)} × ${decimal(input.unitsSold, 0)} = ${decimal(r.totalCosts, 2)}`,
    `Profit             = TR − TC           = ${decimal(r.profit, 2)}`,
    `Contribution/unit  = P − VC            = ${decimal(r.contributionPerUnit, 2)}`,
    r.breakEvenUnits === null
      ? `Break-even         = FC ÷ (P − VC)     = undefined (${r.breakEvenNote})`
      : `Break-even         = FC ÷ (P − VC)     = ${decimal(r.breakEvenUnits, 1)} units`,
    "```", "",
    "## Results", "",
    "| Measure | Value |", "| --- | --- |",
    `| Total revenue | ${money(r.revenue, currency, 0)} |`,
    `| Total cost | ${money(r.totalCosts, currency, 0)} |`,
    `| Profit | ${money(r.profit, currency, 0)} |`,
    `| Profit margin | ${percent(r.profitMargin)} |`,
    `| Contribution per unit | ${money(r.contributionPerUnit, currency)} |`,
    `| Break-even quantity | ${r.breakEvenUnits === null ? "none" : units(Math.ceil(r.breakEvenUnits))} |`,
    `| Margin of safety | ${percent(r.marginOfSafety)} |`, "",
    "## Risks", "",
    draft.risks.trim() || "_Not yet written._", "",
    "## Limitations of this analysis", "",
    "- Costs are assumed linear: variable cost per unit does not change with volume, and fixed costs do not step up.",
    "- Units sold is an input, not a forecast. Nothing here predicts demand.",
    "- One product, one price, one period. No stock, seasonality, credit or tax.",
    "- This is a profit calculation, not a cash flow forecast. A profitable period can still run out of money.",
    "- Every figure above is a calculated result from the assumptions listed, not an observation of any market.", "",
    "## Decision considerations", "",
    draft.considerations.trim() || "_Not yet written._", "",
    "---", "",
    "Generated by MarketLab. The calculated results follow from the stated assumptions. They are not a prediction of "
    + "what will happen, and no result here should be treated as a guaranteed business outcome.", "",
  ].join("\n");

  const exportReport = () => {
    setDone(true);
    download(
      `${slugifyFilename(draft.question || "business-decision")}-report.md`,
      markdown(),
      "text/markdown;charset=utf-8",
    );
    setTimeout(() => setDone(false), 3000);
  };

  const fields: Array<{ key: keyof ReportDraft; label: string; hint: string; placeholder: string }> = [
    {
      key: "question", label: "Business question", hint: "One sentence. What decision is this analysis for?",
      placeholder: "Should we raise the price of our standard box from £24 to £28 for the autumn term?",
    },
    {
      key: "assumptions", label: "Assumptions", hint: "Everything you have taken as given. The figures in the panel are added automatically.",
      placeholder: "Volume holds at roughly 900 boxes a month; ingredient costs stay flat until January; no competitor responds within the period.",
    },
    {
      key: "risks", label: "Risks", hint: "What could make this decision go wrong, and how likely is each?",
      placeholder: "A competitor undercuts us; our main supplier raises prices; the volume assumption is optimistic because last autumn was unusual.",
    },
    {
      key: "considerations", label: "Decision considerations", hint: "What the numbers do and do not settle, and what you would want to know before committing.",
      placeholder: "The calculation favours the higher price, but it rests entirely on volume holding. A two-week trial at the new price would test that for far less than the cost of being wrong.",
    },
  ];

  return (
    <div className="space-y-5">
      <Callout tone="neutral" title="MarketLab will not write this for you">
        The calculations, the results and the limitations are filled in from your numbers. The question, the assumptions,
        the risks and what you would do about them are yours — they are the part that constitutes a decision, and a
        generated version of them would be worth nothing to the person reading it.
      </Callout>

      <Card>
        <CardHeader title="Business decision report" description="Fill in what only you can know. Everything else is assembled from the panel." />
        <CardBody className="space-y-5">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`rep-${f.key}`}>
              <Textarea
                id={`rep-${f.key}`}
                rows={f.key === "question" ? 2 : 4}
                value={draft[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What the report will contain" description="Assembled from the current numbers." />
        <CardBody>
          <pre className="ml-scroll ml-mono max-h-80 overflow-auto whitespace-pre-wrap rounded-ml-sm border border-ml-border bg-ml-inset px-3 py-3 text-[0.75rem] leading-relaxed text-ml-text-2">
            {markdown()}
          </pre>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ml-small text-ml-text-3">
          Working on a full investigation rather than one decision? The{" "}
          <Link href="/research" className="text-ml-accent underline">research workspace</Link> has the whole structure.
        </p>
        <Button variant="primary" onClick={exportReport}>
          {done ? <><Check size={15} /> Downloaded</> : <><Download size={15} /> Export report (Markdown)</>}
        </Button>
      </div>
    </div>
  );
}
