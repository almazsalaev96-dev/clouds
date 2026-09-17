"use client";

import * as React from "react";
import Link from "next/link";
import { solve } from "@/lib/marketlab/market";
import { linspace, money, units } from "@/lib/marketlab/num";

/**
 * The hero visual: a real supply-and-demand model, not a picture of one.
 *
 * The slider shifts the demand curve and the equilibrium is recomputed by the
 * same `solve()` the full experiment uses. It is the product's argument in one
 * component — you change something, and the numbers move because they were
 * calculated, not because they were animated.
 */
export function HeroChart() {
  const [shock, setShock] = React.useState(0);
  const base = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5 });
  const now = solve({ demandIntercept: 200, demandSlope: 5, supplyIntercept: 50, supplySlope: 5, demandShock: shock });

  const W = 460, H = 300;
  const pad = { top: 18, right: 72, bottom: 34, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const maxQ = 260, maxP = 46;
  const px = (q: number) => pad.left + (q / maxQ) * plotW;
  const py = (p: number) => pad.top + plotH - (p / maxP) * plotH;

  const qs = linspace(0, maxQ, 2);
  const linePath = (price: (q: number) => number) => {
    const pts = qs.map((q) => ({ q, p: price(q) })).filter((pt) => pt.p >= 0 && pt.p <= maxP);
    // Straight lines, so clipping to the visible window is two intersections.
    const clipped: Array<{ q: number; p: number }> = [];
    for (let q = 0; q <= maxQ; q += 2) {
      const p = price(q);
      if (p >= 0 && p <= maxP) clipped.push({ q, p });
    }
    const use = clipped.length >= 2 ? clipped : pts;
    if (use.length < 2) return "";
    return `M${use.map((pt) => `${px(pt.q).toFixed(1)},${py(pt.p).toFixed(1)}`).join(" L")}`;
  };

  /* The last point on a line that is still inside the frame, so a label can
     be hung off it. */
  const labelAt = (price: (q: number) => number) => {
    let last = { q: 0, p: price(0) };
    for (let q = 0; q <= maxQ; q += 2) {
      const p = price(q);
      if (p >= 0 && p <= maxP) last = { q, p };
    }
    return last;
  };

  const eq = now.equilibrium;
  const was = base.equilibrium;

  return (
    <div className="rounded-ml-lg border border-ml-navy-line bg-ml-navy p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ml-label text-ml-navy-fg-2">A market, live</p>
        <p className="ml-small text-ml-navy-fg-2">Model result</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img"
        aria-label={`Supply and demand. Equilibrium price ${eq ? eq.price.toFixed(2) : "—"}, quantity ${eq ? Math.round(eq.quantity) : "—"}.`}>
        {[0, 10, 20, 30, 40].map((p) => (
          <line key={p} x1={pad.left} x2={pad.left + plotW} y1={py(p)} y2={py(p)} stroke="var(--ml-navy-line)" strokeWidth={1} />
        ))}
        <line x1={pad.left} x2={pad.left + plotW} y1={py(0)} y2={py(0)} stroke="#3e5678" strokeWidth={1} />

        {/* Where it started, kept as a ghost so the shift is visible. */}
        {shock !== 0 ? (
          <path d={linePath((q) => (200 - q) / 5)} fill="none" stroke="#5f7fb5" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
        ) : null}
        <path d={linePath((q) => (q - 50) / 5)} fill="none" stroke="#e0a94a" strokeWidth={2.5} strokeLinecap="round" />
        <path d={linePath((q) => (now.a - q) / 5)} fill="none" stroke="#74a0ff" strokeWidth={2.5} strokeLinecap="round" />

        {eq ? (
          <>
            <line x1={px(eq.quantity)} x2={px(eq.quantity)} y1={py(eq.price)} y2={py(0)} stroke="#8fa4c4" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={pad.left} x2={px(eq.quantity)} y1={py(eq.price)} y2={py(eq.price)} stroke="#8fa4c4" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={px(eq.quantity)} cy={py(eq.price)} r={6} fill="#ffffff" stroke="#0c1a30" strokeWidth={2.5} />
          </>
        ) : null}

        {was && shock !== 0 ? (
          <circle cx={px(was.quantity)} cy={py(was.price)} r={4} fill="#5f7fb5" opacity={0.85} />
        ) : null}

        {/* Anchored to where each line actually leaves the visible window, so
            the label never ends up below the axis when a shock moves the
            curve — which is what happened when it was pinned to the right
            edge at whatever price the equation gave there. */}
        <text x={px(labelAt((q) => (now.a - q) / 5).q) + 8} y={py(labelAt((q) => (now.a - q) / 5).p)}
          fontSize={12} fontWeight={600} fill="#74a0ff" dy="0.32em">Demand</text>
        <text x={px(labelAt((q) => (q - 50) / 5).q) + 8} y={py(labelAt((q) => (q - 50) / 5).p)}
          fontSize={12} fontWeight={600} fill="#e0a94a" dy="0.32em">Supply</text>
        <text x={pad.left + plotW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="#8fa4c4">Quantity</text>
        <text x={12} y={pad.top + plotH / 2} fontSize={11} textAnchor="middle" fill="#8fa4c4"
          transform={`rotate(-90 12 ${pad.top + plotH / 2})`}>Price</text>
      </svg>

      <div className="mt-3">
        <label htmlFor="hero-shock" className="ml-small flex items-baseline justify-between gap-3 text-ml-navy-fg-2">
          <span>Shift demand</span>
          <span className="ml-num text-ml-navy-fg">{shock > 0 ? "+" : ""}{units(shock)} units at every price</span>
        </label>
        <input
          id="hero-shock"
          type="range"
          min={-80} max={120} step={5}
          value={shock}
          onChange={(e) => setShock(Number(e.target.value))}
          className="ml-slider mt-1.5 w-full"
          style={{ ["--ml-fill" as string]: `${((shock + 80) / 200) * 100}%`, accentColor: "#74a0ff" }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-ml-navy-line pt-3">
        <div>
          <dt className="ml-label text-ml-navy-fg-2">Equilibrium price</dt>
          <dd className="ml-num mt-0.5 text-[1.25rem] font-semibold text-ml-navy-fg">
            {eq ? money(eq.price, "GBP") : "—"}
            {was && eq && shock !== 0 ? (
              <span className="ml-small ml-2 font-normal" style={{ color: eq.price >= was.price ? "#4cc48f" : "#f4827c" }}>
                {eq.price >= was.price ? "▲" : "▼"} {money(Math.abs(eq.price - was.price), "GBP")}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="ml-label text-ml-navy-fg-2">Equilibrium quantity</dt>
          <dd className="ml-num mt-0.5 text-[1.25rem] font-semibold text-ml-navy-fg">
            {eq ? units(eq.quantity) : "—"}
            {was && eq && shock !== 0 ? (
              <span className="ml-small ml-2 font-normal" style={{ color: eq.quantity >= was.quantity ? "#4cc48f" : "#f4827c" }}>
                {eq.quantity >= was.quantity ? "▲" : "▼"} {units(Math.abs(eq.quantity - was.quantity))}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="ml-small mt-3 text-ml-navy-fg-2">
        Qd = {units(now.a)} − 5P, Qs = 50 + 5P.{" "}
        <Link href="/experiments/supply-demand" className="font-medium text-[#74a0ff] hover:underline">
          Open the full experiment →
        </Link>
      </p>
    </div>
  );
}
