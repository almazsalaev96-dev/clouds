"use client";

import * as React from "react";
import {
  Callout, Card, CardBody, CardHeader, Field, MetricCard, NumberInput, Segmented, SliderField, Table, Td,
} from "@/components/marketlab/ui/primitives";
import { LineChart, type Marker, type Series } from "@/components/marketlab/charts";
import { ExperimentShell, ResultGrid } from "./ExperimentShell";
import { findExperiment } from "@/lib/marketlab/experiments";
import {
  applyControl, compare, shockNarrative, solve, type ControlKind,
} from "@/lib/marketlab/market";
import { currencySymbol, decimal, linspace, money, signedPercent, units } from "@/lib/marketlab/num";
import { useLab } from "@/lib/marketlab/store";

const META = findExperiment("supply-demand")!;

const DEFAULTS = {
  a: 200,      // quantity demanded at a price of zero
  b: 5,        // units of quantity lost per unit of price
  c: 50,       // quantity supplied at a price of zero
  d: 5,        // units of quantity gained per unit of price
  demandShock: 0,
  supplyShock: 0,
  control: "none" as ControlKind,
  controlPrice: 10,
};

export function SupplyDemandExperiment() {
  const currency = useLab((s) => s.currency);
  const sym = currencySymbol(currency);
  const [v, setV] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, value: (typeof DEFAULTS)[K]) => setV((s) => ({ ...s, [k]: value }));

  const before = solve({ demandIntercept: v.a, demandSlope: v.b, supplyIntercept: v.c, supplySlope: v.d });
  const after = solve({
    demandIntercept: v.a, demandSlope: v.b, supplyIntercept: v.c, supplySlope: v.d,
    demandShock: v.demandShock, supplyShock: v.supplyShock,
  });
  const shocked = Math.abs(v.demandShock) > 1e-9 || Math.abs(v.supplyShock) > 1e-9;
  const control = applyControl(after, v.control, v.controlPrice);
  const delta = compare(before.equilibrium, after.equilibrium);

  /* Price on the vertical axis, quantity on the horizontal — the economics
     convention, and the inverse of the Qd = a − bP the maths is written in.
     The flip happens here so nothing downstream has to think about it. */
  const maxQ = Math.max(
    before.equilibrium?.quantity ?? 0, after.equilibrium?.quantity ?? 0,
    control?.quantityDemanded ?? 0, control?.quantitySupplied ?? 0, 10,
  ) * 1.45;
  const maxP = Math.max(after.chokePrice ?? 0, before.chokePrice ?? 0, v.controlPrice, 1) * 1.05;
  const qs = linspace(0, maxQ, 41);

  const line = (id: string, label: string, color: string, price: (q: number) => number | null, style?: "dashed"): Series => ({
    id, label, color, style,
    points: qs.map((q) => {
      const p = price(q);
      return { x: q, y: p === null || p < 0 || p > maxP ? null : p };
    }),
  });

  const series: Series[] = [
    line("demand", "Demand", "var(--ml-s1)", (q) => (after.a - q) / after.b),
    line("supply", "Supply", "var(--ml-s2)", (q) => (q - after.c) / after.d),
  ];
  if (shocked && before.equilibrium) {
    series.push(
      line("demand0", "Demand (before)", "var(--ml-s1)", (q) => (before.a - q) / before.b, "dashed"),
      line("supply0", "Supply (before)", "var(--ml-s2)", (q) => (q - before.c) / before.d, "dashed"),
    );
  }

  const markers: Marker[] = [];
  if (after.equilibrium) {
    markers.push({
      x: after.equilibrium.quantity, y: after.equilibrium.price,
      label: shocked ? "New equilibrium" : "Equilibrium", color: "var(--ml-text)", guides: true,
    });
  }
  if (shocked && before.equilibrium) {
    markers.push({ x: before.equilibrium.quantity, y: before.equilibrium.price, label: "Before", color: "var(--ml-text-4)" });
  }

  const bands = control?.binding
    ? [{
        from: Math.min(control.quantitySupplied, control.quantityDemanded),
        to: Math.max(control.quantitySupplied, control.quantityDemanded),
        // The shaded strip is the gap between the two quantities — a shortage
        // or a surplus. Both are a market failing to clear, so both are red.
        tone: "negative" as const,
      }]
    : [];

  const outputs = [
    { label: "Equilibrium price", value: money(after.equilibrium?.price ?? null, currency) },
    { label: "Equilibrium quantity", value: units(after.equilibrium?.quantity ?? null) },
    { label: "Consumer surplus", value: money(after.consumerSurplus, currency, 0) },
    { label: "Producer surplus", value: money(after.producerSurplus, currency, 0) },
    { label: "Price control", value: control && control.kind !== "none" ? `${control.kind} at ${money(v.controlPrice, currency)}${control.binding ? " (binding)" : " (not binding)"}` : "none" },
    { label: "Shortage", value: units(control?.shortage ?? 0) },
    { label: "Surplus", value: units(control?.surplus ?? 0) },
    { label: "Deadweight loss", value: money(control?.deadweightLoss ?? null, currency, 0) },
  ];

  return (
    <ExperimentShell
      meta={META}
      inputs={{
        demandIntercept: v.a, demandSlope: v.b, supplyIntercept: v.c, supplySlope: v.d,
        demandShock: v.demandShock, supplyShock: v.supplyShock,
        control: v.control, controlPrice: v.controlPrice, currency,
      }}
      outputs={outputs}
      onReset={() => setV(DEFAULTS)}
      controls={
        <>
          {/* Set in the mono face rather than in a label style: the label style
              uppercases, and an uppercased "Qd = a − b × P" turns the two
              parameters the student is about to edit into different letters
              from the ones named on the fields. */}
          <div>
            <p className="ml-mono text-[0.8125rem] font-medium text-ml-text-2">Demand: Qd = a − b × P</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Intercept (a)" htmlFor="a" hint="Quantity demanded at a price of zero.">
                <NumberInput id="a" value={v.a} onChange={(x) => set("a", x)} min={1} max={100000} step={5} />
              </Field>
              <Field label="Slope (b)" htmlFor="b" hint="Units lost per unit of price.">
                <NumberInput id="b" value={v.b} onChange={(x) => set("b", x)} min={0.1} max={1000} step={0.5} />
              </Field>
            </div>
          </div>

          <div>
            <p className="ml-mono text-[0.8125rem] font-medium text-ml-text-2">Supply: Qs = c + d × P</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Intercept (c)" htmlFor="c" hint="Negative means nothing is supplied until price rises.">
                <NumberInput id="c" value={v.c} onChange={(x) => set("c", x)} min={-100000} max={100000} step={5} />
              </Field>
              <Field label="Slope (d)" htmlFor="d" hint="Units gained per unit of price.">
                <NumberInput id="d" value={v.d} onChange={(x) => set("d", x)} min={0.1} max={1000} step={0.5} />
              </Field>
            </div>
          </div>

          <div className="border-t border-ml-border pt-4">
            <SliderField
              label="Demand shock"
              value={v.demandShock}
              onChange={(x) => set("demandShock", x)}
              min={-Math.round(v.a * 0.8)} max={Math.round(v.a * 0.8)} step={5}
              format={(x) => `${x > 0 ? "+" : ""}${units(x)} units`}
              hint="A parallel shift: how much more (or less) is demanded at every price."
            />
          </div>
          <SliderField
            label="Supply shock"
            value={v.supplyShock}
            onChange={(x) => set("supplyShock", x)}
            min={-Math.round(v.a * 0.8)} max={Math.round(v.a * 0.8)} step={5}
            format={(x) => `${x > 0 ? "+" : ""}${units(x)} units`}
            hint="A parallel shift of the supply curve at every price."
          />

          <div className="border-t border-ml-border pt-4">
            <Field label="Price control" hint="A control only does something when it sits on the wrong side of the equilibrium price.">
              <Segmented
                label="Price control"
                value={v.control}
                onChange={(k) => set("control", k)}
                options={[
                  { value: "none", label: "None" },
                  { value: "ceiling", label: "Maximum" },
                  { value: "floor", label: "Minimum" },
                ]}
              />
            </Field>
          </div>
          {v.control !== "none" ? (
            <SliderField
              label={v.control === "ceiling" ? "Maximum price" : "Minimum price"}
              value={v.controlPrice}
              onChange={(x) => set("controlPrice", x)}
              min={0} max={Math.max(1, Math.round((after.chokePrice ?? 40)))} step={0.5}
              format={(x) => money(x, currency)}
              hint={control?.binding ? "Binding — it is changing the market." : "Not binding — the market is already on the legal side of it."}
            />
          ) : null}
        </>
      }
      chart={
        <LineChart
          title="The market"
          note="Price on the vertical axis, quantity on the horizontal — the economics convention. Model result."
          series={series}
          xLabel="Quantity"
          yLabel={`Price (${currency === "none" ? "per unit" : currency})`}
          formatX={(x) => units(x)}
          formatY={(y) => `${sym}${decimal(y, y < 10 ? 1 : 0)}`}
          formatYFull={(y) => money(y, currency)}
          markers={markers}
          bands={bands}
          xIncludesZero
          yIncludesZero
          height={360}
          directLabels={false}
        />
      }
      results={
        <ResultGrid>
          <MetricCard
            label="Equilibrium price"
            value={money(after.equilibrium?.price ?? null, currency)}
            delta={delta && shocked ? `${signedPercent(delta.priceChange !== null && before.equilibrium ? delta.priceChange / before.equilibrium.price : null)} vs before` : undefined}
            tone={shocked && delta ? (delta.priceDirection === "up" ? "positive" : delta.priceDirection === "down" ? "negative" : "neutral") : "neutral"}
            provenance="Calculated"
          />
          <MetricCard
            label="Equilibrium quantity"
            value={units(after.equilibrium?.quantity ?? null)}
            delta={delta && shocked && before.equilibrium ? `${signedPercent(delta.quantityChange !== null ? delta.quantityChange / before.equilibrium.quantity : null)} vs before` : undefined}
            provenance="Calculated"
          />
          <MetricCard
            label={control?.kind === "floor" ? "Surplus" : "Shortage"}
            value={units(control?.kind === "floor" ? control.surplus : control?.shortage ?? 0)}
            hint={control?.binding ? "units per period" : "no binding control"}
            tone={control?.binding ? "negative" : "neutral"}
            provenance="Calculated"
          />
          <MetricCard
            label="Total surplus"
            value={money(after.totalSurplus, currency, 0)}
            delta={control?.deadweightLoss ? `Deadweight loss ${money(control.deadweightLoss, currency, 0)}` : undefined}
            provenance="Calculated"
          />
        </ResultGrid>
      }
      interpretation={
        <>
          {after.problem ? (
            <Callout tone="warning" title="These parameters do not describe a market">{after.problem}</Callout>
          ) : (
            <>
              <p>
                <strong>Equilibrium.</strong> Setting Qd = Qs gives{" "}
                <span className="ml-mono">P* = (a − c) ÷ (b + d) = ({decimal(after.a, 0)} − {decimal(after.c, 0)}) ÷ ({decimal(after.b, 1)} + {decimal(after.d, 1)}) = {decimal(after.equilibrium!.price, 2)}</span>,
                and substituting back gives Q* = {units(after.equilibrium!.quantity)}. You can check that by hand in two lines,
                which is the point of using straight-line curves.
              </p>
              <p><strong>The shock.</strong> {shockNarrative(v.demandShock, v.supplyShock, delta)}</p>
              <p>
                <strong>Welfare.</strong> Consumer surplus is{" "}
                <span className="ml-num">{money(after.consumerSurplus, currency, 0)}</span> — the area between what buyers
                would have paid, up to the choke price of{" "}
                <span className="ml-num">{money(after.chokePrice, currency)}</span>, and what they did pay. Producer surplus is{" "}
                <span className="ml-num">{money(after.producerSurplus, currency, 0)}</span>. Both assume every buyer&apos;s
                willingness to pay can be read off the demand curve, which is an assumption about the model, not an
                observation about people.
              </p>
            </>
          )}

          {control && control.kind !== "none" ? (
            <Callout tone={control.binding ? "warning" : "neutral"} title={control.binding ? "The control is binding" : "The control is not binding"}>
              <p>{control.note}</p>
              {control.binding ? (
                <p className="mt-2">
                  At <strong>{money(control.price, currency)}</strong>, quantity demanded is{" "}
                  <span className="ml-num">{units(control.quantityDemanded)}</span> and quantity supplied is{" "}
                  <span className="ml-num">{units(control.quantitySupplied)}</span>. Only the short side trades, so{" "}
                  <span className="ml-num">{units(control.quantityTraded)}</span> changes hands — down from{" "}
                  <span className="ml-num">{units(after.equilibrium?.quantity ?? null)}</span> at equilibrium. The
                  transactions that no longer happen are worth{" "}
                  <span className="ml-num">{money(control.deadweightLoss, currency, 0)}</span> in lost surplus.
                </p>
              ) : null}
              <p className="mt-2">
                What the model does not show: who gets the units that do trade. In a real shortage that is decided by
                queues, rationing, personal connections or a parallel market, and the cost of that is not in any figure
                on this page.
              </p>
            </Callout>
          ) : null}
        </>
      }
      extra={
        shocked && before.equilibrium && after.equilibrium ? (
          <Card>
            <CardHeader title="Before and after" description="The same market, with and without the shocks you applied." />
            <CardBody>
              <Table head={["", "Before", "After", "Change"]}>
                <tr>
                  <Td>Equilibrium price</Td>
                  <Td numeric>{money(before.equilibrium.price, currency)}</Td>
                  <Td numeric>{money(after.equilibrium.price, currency)}</Td>
                  <Td numeric>
                    <span className={delta?.priceDirection === "up" ? "text-ml-positive" : delta?.priceDirection === "down" ? "text-ml-negative" : undefined}>
                      {signedPercent(delta?.priceChange !== null && delta ? delta.priceChange! / before.equilibrium.price : null)}
                    </span>
                  </Td>
                </tr>
                <tr>
                  <Td>Equilibrium quantity</Td>
                  <Td numeric>{units(before.equilibrium.quantity)}</Td>
                  <Td numeric>{units(after.equilibrium.quantity)}</Td>
                  <Td numeric>
                    <span className={delta?.quantityDirection === "up" ? "text-ml-positive" : delta?.quantityDirection === "down" ? "text-ml-negative" : undefined}>
                      {signedPercent(delta?.quantityChange !== null && delta ? delta.quantityChange! / before.equilibrium.quantity : null)}
                    </span>
                  </Td>
                </tr>
                <tr>
                  <Td>Consumer surplus</Td>
                  <Td numeric>{money(before.consumerSurplus, currency, 0)}</Td>
                  <Td numeric>{money(after.consumerSurplus, currency, 0)}</Td>
                  <Td numeric>{signedPercent(before.consumerSurplus ? ((after.consumerSurplus ?? 0) - before.consumerSurplus) / before.consumerSurplus : null)}</Td>
                </tr>
                <tr>
                  <Td>Producer surplus</Td>
                  <Td numeric>{money(before.producerSurplus, currency, 0)}</Td>
                  <Td numeric>{money(after.producerSurplus, currency, 0)}</Td>
                  <Td numeric>{signedPercent(before.producerSurplus ? ((after.producerSurplus ?? 0) - before.producerSurplus) / before.producerSurplus : null)}</Td>
                </tr>
              </Table>
            </CardBody>
          </Card>
        ) : null
      }
    />
  );
}
