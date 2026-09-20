"use client";

import * as React from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { barPath, fmt, layout, parseChart, type ChartSpec } from "@/lib/chart";
import { CodeBlock } from "./CodeBlock";

/**
 * A chart, drawn from a fence.
 *
 * The model says what the numbers are; this decides where they go. The two
 * are kept apart on purpose — a model is near-perfect at "Q3 was 41" and
 * measurably bad at "put that label 14px to the left", and asking it for
 * coordinates is how you get overlapping text and bars that miss their axis.
 *
 * ## What it will not do
 *
 * It will not draw mid-stream: half a JSON object is not a chart, and one
 * that redraws itself eight times as an answer arrives is worse than one
 * that appears once. It will not show a parse error in the answer: a fence
 * it cannot read is shown as the code it is, which is the honest fallback
 * and blames nobody. And it will not make colour carry identity alone — two
 * or more series always get a legend, and the table is one press away.
 *
 * ## The rules it draws by
 *
 * Bars capped at 24px with a 2px surface gap and a rounded data-end that is
 * square at the baseline; lines 2px with 8px end markers ringed in surface;
 * hairline solid gridlines a step off the surface; text in text tokens and
 * never in a series colour; a hover readout that lists every series at that
 * x, with the value leading and the label following. Each of those is a
 * rule with a reason, and the reasons are in the method this follows.
 */
export function Chart({ src, streaming }: { src: string; streaming?: boolean }) {
  const spec = React.useMemo(() => (streaming ? null : parseChart(src)), [src, streaming]);
  if (!spec) return <CodeBlock code={src} lang="chart" />;
  return <Drawn spec={spec} src={src} />;
}

const HEIGHT = 220;

function Drawn({ spec, src }: { spec: ChartSpec; src: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(560);
  const [hover, setHover] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);

  /* Sized to the column it is in, and re-laid when that changes. A chart at
     a fixed 560px is fine on a desk and a horizontal scroll on a phone. */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = React.useMemo(() => layout(spec, width, HEIGHT), [spec, width]);
  const many = spec.series.length > 1;

  /* The crosshair finds the x: whichever category centre is nearest the
     pointer, so the hit target is the whole column and not a pinpoint. */
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    for (let i = 1; i < L.columns.length; i++) {
      if (Math.abs(L.columns[i].x - px) < Math.abs(L.columns[best].x - px)) best = i;
    }
    setHover(best);
  };

  const at = hover === null ? null : L.columns[hover];

  return (
    <figure className="my-4" aria-label={spec.title ?? "Chart"}>
      {spec.title && <figcaption className="mb-1.5 text-sm font-medium text-primary">{spec.title}</figcaption>}
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={describe(spec)}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block select-none overflow-visible"
        >
          {/* Gridlines: one step off the surface, hairline, solid, behind. */}
          {L.ticks.map((t) => (
            <g key={t.value}>
              <line x1={L.plot.x} x2={L.plot.x + L.plot.w} y1={t.y} y2={t.y} stroke="var(--border-subtle)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={L.plot.x - 6} y={t.y + 3.5} textAnchor="end" className="fill-[var(--text-tertiary)] text-[10px] tnum">
                {fmt(t.value, spec.unit)}
              </text>
            </g>
          ))}
          {/* The baseline itself, a shade firmer than the grid. */}
          <line x1={L.plot.x} x2={L.plot.x + L.plot.w} y1={L.baseline} y2={L.baseline} stroke="var(--border-strong)" strokeWidth={1} shapeRendering="crispEdges" />

          {/* Category labels along the bottom, thinned when they would collide. */}
          {L.columns.map((c, i) => {
            const every = Math.max(1, Math.ceil(L.columns.length / Math.floor(L.plot.w / 56)));
            if (i % every !== 0) return null;
            return (
              <text key={i} x={c.x} y={HEIGHT - 8} textAnchor="middle" className="fill-[var(--text-tertiary)] text-[10px]">
                {c.label}
              </text>
            );
          })}

          {/* Crosshair on hover: a hairline at the nearest x. */}
          {at && (
            <line x1={at.x} x2={at.x} y1={L.plot.y} y2={L.plot.y + L.plot.h} stroke="var(--border-strong)" strokeWidth={1} shapeRendering="crispEdges" />
          )}

          {/* Bars. The hovered group lifts, so the reader sees it respond. */}
          {L.bars.map((b, i) => (
            <path
              key={i}
              d={barPath(b)}
              fill={`var(--chart-${b.series + 1})`}
              opacity={hover === null || spec.x[hover] === b.label ? 1 : 0.55}
              className="transition-opacity duration-[var(--dur-fast)]"
            >
              <title>{`${fmt(b.value, spec.unit)} · ${spec.series[b.series].name} · ${b.label}`}</title>
            </path>
          ))}

          {/* Lines, broken at gaps, with an 8px end marker ringed in surface. */}
          {L.lines.map((pts, si) => {
            const segs: string[] = [];
            let cur: string[] = [];
            for (const p of pts) {
              if (Number.isNaN(p.y)) { if (cur.length) segs.push(cur.join(" ")); cur = []; continue; }
              cur.push(`${cur.length ? "L" : "M"}${p.x},${p.y}`);
            }
            if (cur.length) segs.push(cur.join(" "));
            const last = [...pts].reverse().find((p) => !Number.isNaN(p.y));
            const colour = `var(--chart-${si + 1})`;
            return (
              <g key={si}>
                {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
                {last && <circle cx={last.x} cy={last.y} r={4} fill={colour} stroke="var(--bg-surface)" strokeWidth={2} />}
                {/* Hovered point, on every series at that x. */}
                {at && !Number.isNaN(pts[hover!].y) && (
                  <circle cx={pts[hover!].x} cy={pts[hover!].y} r={4} fill={colour} stroke="var(--bg-surface)" strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>

        {/* One readout, every series at that x. Value leads, label follows;
            a swatch beside the text carries identity, the text never does. */}
        {at && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-md border border-line bg-surface px-2 py-1.5 text-xs shadow-[var(--shadow-md)]"
            style={{ left: Math.min(width - 150, Math.max(0, at.x + 8)) }}
          >
            <p className="mb-0.5 text-tiny text-tertiary">{at.label}</p>
            {spec.series.map((s, si) => (
              <p key={si} className="flex items-center gap-1.5 whitespace-nowrap">
                <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: `var(--chart-${si + 1})` }} />
                <span className="font-medium text-primary tnum">{fmt(s.values[hover!], spec.unit)}</span>
                {many && <span className="text-tertiary">{s.name}</span>}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Identity is never colour alone: two or more series get a legend. A
          single series needs none — the title names it. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {many && spec.series.map((s, si) => (
          <span key={si} className="flex items-center gap-1.5 text-xs text-secondary">
            <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: `var(--chart-${si + 1})` }} />
            {s.name}
          </span>
        ))}
        <button
          onClick={() => setTable((v) => !v)}
          aria-pressed={table}
          className="focus-inset ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <Table2 size={11} />
          {table ? "Hide table" : "As a table"}
        </button>
      </div>

      {/* The table view: every value reachable without hovering, and the
          thing a screen reader actually gets. */}
      {table && (
        <div className="table-scroll mt-2">
          <table>
            <thead>
              <tr>
                <th></th>
                {spec.series.map((s, si) => <th key={si}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {spec.x.map((label, i) => (
                <tr key={i}>
                  <td>{label}</td>
                  {spec.series.map((s, si) => <td key={si} className="tnum">{fmt(s.values[i], spec.unit)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="mt-1">
        <summary className={cn("cursor-pointer text-tiny text-faint hover:text-tertiary")}>Source</summary>
        <CodeBlock code={src} lang="json" bare />
      </details>
    </figure>
  );
}

/** What a screen reader hears instead of the picture. */
function describe(spec: ChartSpec): string {
  const kind = spec.type === "line" ? "Line chart" : "Bar chart";
  const what = spec.series.map((s) => s.name).join(", ");
  return `${kind}${spec.title ? ` of ${spec.title}` : ""}: ${what} across ${spec.x.length} categories, ${spec.x[0]} to ${spec.x[spec.x.length - 1]}. A table of the values is available.`;
}
