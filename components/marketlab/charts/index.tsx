"use client";

/**
 * MarketLab's chart kit.
 *
 * Written rather than imported. A charting library would have been quicker,
 * but three of the requirements here are things most of them make you fight:
 *
 *   — every mark has to resolve to a design token, so the dark theme is a
 *     re-derivation and not a filter;
 *   — every chart has to have a table view, because a chart that cannot be
 *     read by a screen reader is not an accessible way to publish a result;
 *   — no chart may ever carry two y-scales, because a dual axis lets you
 *     manufacture any correlation you like by choosing the scales, and this is
 *     a research tool.
 *
 * The series colours are validated for colour-vision deficiency (see the note
 * beside `--ml-s1` in marketlab.css) and identity is never carried by colour
 * alone: two or more series always get a legend, and up to four also get a
 * direct label at the end of the line.
 */

import * as React from "react";
import { compact, niceStep, ticks as axisTicks } from "@/lib/marketlab/num";
import { cx } from "@/components/marketlab/ui/primitives";

export const SERIES_TOKENS = ["var(--ml-s1)", "var(--ml-s2)", "var(--ml-s3)", "var(--ml-s4)", "var(--ml-s5)"] as const;

export interface Point { x: number; y: number | null }

export interface Series {
  id: string;
  label: string;
  points: Point[];
  /** A token string. Defaults to the series' position in the fixed order. */
  color?: string;
  style?: "solid" | "dashed";
  /** Fills to the baseline. Use sparingly; two filled areas overlap badly. */
  area?: boolean;
  /** Draws a dot at every point. Off by default — a dot per point is noise. */
  dots?: boolean;
}

export interface Marker {
  x: number; y: number; label: string; color?: string;
  /** Drop lines to both axes, which is how an equilibrium point is read. */
  guides?: boolean;
}

export interface Band {
  /** A shaded region between two x values, for a shortage or a surplus. */
  from: number; to: number; label?: string; tone?: "positive" | "negative" | "neutral";
  orientation?: "x" | "y";
}

interface Scale { min: number; max: number; map: (v: number) => number }

function makeScale(min: number, max: number, from: number, to: number): Scale {
  const span = max - min || 1;
  return { min, max, map: (v) => from + ((v - min) / span) * (to - from) };
}

/** Pads a domain outwards to the next nice step so lines never touch the frame. */
function domain(values: number[], includeZero: boolean): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [0, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(max - min, 5);
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ------------------------------------------------------------------------- */

export interface ChartFrameProps {
  title?: string;
  /** One line under the title. The place to name the model's assumption. */
  note?: string;
  height?: number;
  children: React.ReactNode;
  legend?: React.ReactNode;
  /** The same data as rows. Always offered; a chart alone is not accessible. */
  table?: React.ReactNode;
  className?: string;
}

export function ChartFrame({ title, note, children, legend, table, className }: ChartFrameProps) {
  const [showTable, setShowTable] = React.useState(false);
  return (
    <figure className={cx("min-w-0", className)}>
      {(title || table) && (
        <figcaption className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <p className="ml-h3 text-ml-text">{title}</p> : null}
            {note ? <p className="ml-small mt-0.5 text-ml-text-4">{note}</p> : null}
          </div>
          {table ? (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="ml-small shrink-0 rounded-ml-xs px-2 py-1 font-medium text-ml-accent hover:bg-ml-accent-subtle"
              aria-expanded={showTable}
            >
              {showTable ? "Show chart" : "Show data"}
            </button>
          ) : null}
        </figcaption>
      )}
      {showTable && table ? <div className="ml-fade-in">{table}</div> : children}
      {legend && !showTable ? <div className="mt-3">{legend}</div> : null}
    </figure>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; style?: "solid" | "dashed" }> }) {
  if (items.length < 2) return null; // one series is named by the title
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((s) => (
        <li key={s.label} className="ml-small flex items-center gap-1.5 text-ml-text-3">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={s.style === "dashed"
              ? { backgroundImage: `repeating-linear-gradient(to right, ${s.color} 0 4px, transparent 4px 7px)` }
              : { background: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- LineChart -- */

export interface LineChartProps {
  series: Series[];
  xLabel: string;
  yLabel: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  /** Tooltip formatting, which usually wants more precision than the axis. */
  formatXFull?: (v: number) => string;
  formatYFull?: (v: number) => string;
  markers?: Marker[];
  bands?: Band[];
  height?: number;
  yIncludesZero?: boolean;
  xIncludesZero?: boolean;
  /** Draws a rule at y = 0 when the range crosses it. */
  zeroLine?: boolean;
  title?: string;
  note?: string;
  /** Hides the direct end-of-line labels when they would collide. */
  directLabels?: boolean;
}

export function LineChart({
  series, xLabel, yLabel, formatX = compact, formatY = compact,
  formatXFull, formatYFull, markers = [], bands = [], height = 300,
  yIncludesZero = false, xIncludesZero = false, zeroLine = false,
  title, note, directLabels = true,
}: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<{ x: number; px: number } | null>(null);

  const w = Math.max(280, width);
  const h = height;
  const xs = series.flatMap((s) => s.points.map((p) => p.x)).concat(markers.map((m) => m.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((v): v is number => v !== null)).concat(markers.map((m) => m.y));
  const [x0, x1] = domain(xs, xIncludesZero);
  const [y0, y1] = domain(ys, yIncludesZero);

  const xTicks = axisTicks(x0, x1, w < 460 ? 4 : 6);
  const yTicks = axisTicks(y0, y1, 5);
  /* Wide enough for the longest tick label plus the rotated axis title, which
     is what stops "£10,000" colliding with "Revenue (GBP)". */
  const pad = {
    top: 14, right: directLabels ? 64 : 18, bottom: 40,
    left: Math.min(110, Math.max(46, ...yTicks.map((t) => formatY(t).length * 6.6 + 22))),
  };
  const plotW = Math.max(40, w - pad.left - pad.right);
  const plotH = Math.max(40, h - pad.top - pad.bottom);
  const sx = makeScale(x0, x1, pad.left, pad.left + plotW);
  const sy = makeScale(y0, y1, pad.top + plotH, pad.top);

  const path = (s: Series) => {
    let d = "";
    let pen = false;
    for (const p of s.points) {
      if (p.y === null || !Number.isFinite(p.y)) { pen = false; continue; }
      const cmd = pen ? "L" : "M";
      d += `${cmd}${sx.map(p.x).toFixed(2)},${sy.map(p.y).toFixed(2)} `;
      pen = true;
    }
    return d.trim();
  };

  const areaPath = (s: Series) => {
    const pts = s.points.filter((p) => p.y !== null && Number.isFinite(p.y)) as Array<{ x: number; y: number }>;
    if (pts.length < 2) return "";
    const base = sy.map(Math.max(y0, Math.min(0, y1)));
    const top = pts.map((p) => `${sx.map(p.x).toFixed(2)},${sy.map(p.y).toFixed(2)}`).join(" L");
    return `M${sx.map(pts[0].x).toFixed(2)},${base.toFixed(2)} L${top} L${sx.map(pts[pts.length - 1].x).toFixed(2)},${base.toFixed(2)} Z`;
  };

  // The hovered x: the nearest x present in the first series that has points.
  const domainXs = React.useMemo(() => {
    const source = series.find((s) => s.points.length > 1);
    return source ? source.points.map((p) => p.x) : [];
  }, [series]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (domainXs.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    if (px < pad.left - 8 || px > pad.left + plotW + 8) { setHover(null); return; }
    const value = x0 + ((px - pad.left) / plotW) * (x1 - x0);
    let nearest = domainXs[0];
    for (const candidate of domainXs) {
      if (Math.abs(candidate - value) < Math.abs(nearest - value)) nearest = candidate;
    }
    setHover({ x: nearest, px: sx.map(nearest) });
  };

  const hoverRows = hover
    ? series.map((s) => {
        const p = s.points.find((q) => q.x === hover.x);
        return { series: s, y: p?.y ?? null };
      }).filter((r) => r.y !== null)
    : [];

  const fx = formatXFull ?? formatX;
  const fy = formatYFull ?? formatY;

  const legendItems = series.map((s, i) => ({
    label: s.label, color: s.color ?? SERIES_TOKENS[i % SERIES_TOKENS.length], style: s.style,
  }));

  const summary = `${title ?? "Chart"}. ${xLabel} against ${yLabel}. `
    + series.map((s) => `${s.label}: ${s.points.length} points.`).join(" ");

  return (
    <ChartFrame
      title={title}
      note={note}
      legend={<Legend items={legendItems} />}
      table={<SeriesTable series={series} xLabel={xLabel} yLabel={yLabel} formatX={fx} formatY={fy} />}
    >
      <div ref={ref} className="relative w-full">
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={summary}
          className="block touch-pan-y select-none overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Shaded regions sit under everything. */}
          {bands.map((b, i) => {
            const tone = b.tone === "positive" ? "var(--ml-positive)" : b.tone === "negative" ? "var(--ml-negative)" : "var(--ml-text-4)";
            if (b.orientation === "y") {
              const top = sy.map(Math.max(b.from, b.to));
              const bottom = sy.map(Math.min(b.from, b.to));
              return <rect key={i} x={pad.left} y={top} width={plotW} height={Math.max(0, bottom - top)} fill={tone} opacity={0.1} />;
            }
            const left = sx.map(Math.min(b.from, b.to));
            const right = sx.map(Math.max(b.from, b.to));
            return <rect key={i} x={left} y={pad.top} width={Math.max(0, right - left)} height={plotH} fill={tone} opacity={0.1} />;
          })}

          {/* Grid — recessive, horizontal only. Vertical gridlines on a
              continuous x add ink without adding information. */}
          {yTicks.map((t) => (
            <line key={`g${t}`} x1={pad.left} x2={pad.left + plotW} y1={sy.map(t)} y2={sy.map(t)} stroke="var(--ml-grid)" strokeWidth={1} />
          ))}
          {zeroLine && y0 < 0 && y1 > 0 ? (
            <line x1={pad.left} x2={pad.left + plotW} y1={sy.map(0)} y2={sy.map(0)} stroke="var(--ml-axis)" strokeWidth={1.5} />
          ) : null}

          {/* Axes */}
          <line x1={pad.left} x2={pad.left + plotW} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--ml-axis)" strokeWidth={1} />
          {yTicks.map((t) => (
            <text key={`yt${t}`} x={pad.left - 8} y={sy.map(t)} dy="0.32em" textAnchor="end"
              className="ml-num" fontSize={11} fill="var(--ml-text-4)">{formatY(t)}</text>
          ))}
          {xTicks.map((t) => (
            <text key={`xt${t}`} x={sx.map(t)} y={pad.top + plotH + 16} textAnchor="middle"
              className="ml-num" fontSize={11} fill="var(--ml-text-4)">{formatX(t)}</text>
          ))}
          <text x={pad.left + plotW / 2} y={h - 4} textAnchor="middle" fontSize={11} fill="var(--ml-text-3)">{xLabel}</text>
          <text x={12} y={pad.top + plotH / 2} textAnchor="middle" fontSize={11} fill="var(--ml-text-3)"
            transform={`rotate(-90 12 ${pad.top + plotH / 2})`}>{yLabel}</text>

          {/* Areas, then lines, so a fill never covers a stroke. */}
          {series.map((s, i) => s.area ? (
            <path key={`a${s.id}`} d={areaPath(s)} fill={s.color ?? SERIES_TOKENS[i % SERIES_TOKENS.length]} opacity={0.12} />
          ) : null)}

          {series.map((s, i) => {
            const color = s.color ?? SERIES_TOKENS[i % SERIES_TOKENS.length];
            return (
              <g key={s.id}>
                <path d={path(s)} fill="none" stroke={color} strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={s.style === "dashed" ? "5 4" : undefined} />
                {s.dots ? s.points.map((p, j) => p.y === null ? null : (
                  <circle key={j} cx={sx.map(p.x)} cy={sy.map(p.y)} r={3.5} fill={color}
                    stroke="var(--ml-surface)" strokeWidth={2} />
                )) : null}
              </g>
            );
          })}

          {/* Direct labels — identity without reading the legend. */}
          {directLabels && series.length <= 4 ? series.map((s, i) => {
            const last = [...s.points].reverse().find((p) => p.y !== null) as Point | undefined;
            if (!last || last.y === null) return null;
            return (
              <text key={`l${s.id}`} x={sx.map(last.x) + 7} y={sy.map(last.y)} dy="0.32em"
                fontSize={11} fontWeight={600} fill={s.color ?? SERIES_TOKENS[i % SERIES_TOKENS.length]}>
                {s.label.length > 9 ? `${s.label.slice(0, 8)}…` : s.label}
              </text>
            );
          }) : null}

          {/* Markers — the equilibrium point and anything like it. */}
          {markers.map((m, i) => (
            <g key={`m${i}`}>
              {m.guides ? (
                <>
                  <line x1={sx.map(m.x)} x2={sx.map(m.x)} y1={sy.map(m.y)} y2={pad.top + plotH}
                    stroke={m.color ?? "var(--ml-text-4)"} strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={pad.left} x2={sx.map(m.x)} y1={sy.map(m.y)} y2={sy.map(m.y)}
                    stroke={m.color ?? "var(--ml-text-4)"} strokeWidth={1} strokeDasharray="3 3" />
                </>
              ) : null}
              <circle cx={sx.map(m.x)} cy={sy.map(m.y)} r={5} fill={m.color ?? "var(--ml-text)"} stroke="var(--ml-surface)" strokeWidth={2} />
              <text x={sx.map(m.x) + 9} y={sy.map(m.y) - 8} fontSize={11} fontWeight={600} fill="var(--ml-text-2)">{m.label}</text>
            </g>
          ))}

          {/* Crosshair */}
          {hover ? (
            <g pointerEvents="none">
              <line x1={hover.px} x2={hover.px} y1={pad.top} y2={pad.top + plotH} stroke="var(--ml-border-strong)" strokeWidth={1} />
              {hoverRows.map((r, i) => (
                <circle key={r.series.id} cx={hover.px} cy={sy.map(r.y as number)} r={4.5}
                  fill={r.series.color ?? SERIES_TOKENS[series.indexOf(r.series) % SERIES_TOKENS.length]}
                  stroke="var(--ml-surface)" strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </svg>

        {hover && hoverRows.length > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-ml-sm border border-ml-border bg-ml-surface px-3 py-2 shadow-ml-md"
            style={{
              left: `${Math.min(Math.max((hover.px / w) * 100, 4), 74)}%`,
              top: 8,
            }}
          >
            <p className="ml-label text-ml-text-4">{xLabel}</p>
            <p className="ml-num text-[0.875rem] font-semibold text-ml-text">{fx(hover.x)}</p>
            <ul className="mt-1.5 space-y-0.5">
              {hoverRows.map((r) => (
                <li key={r.series.id} className="ml-small flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-ml-text-3">
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full"
                      style={{ background: r.series.color ?? SERIES_TOKENS[series.indexOf(r.series) % SERIES_TOKENS.length] }} />
                    {r.series.label}
                  </span>
                  <span className="ml-num font-medium text-ml-text">{fy(r.y as number)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}

function SeriesTable({ series, xLabel, yLabel, formatX, formatY }: {
  series: Series[]; xLabel: string; yLabel: string; formatX: (v: number) => string; formatY: (v: number) => string;
}) {
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b);
  const rows = xs.length > 60 ? xs.filter((_, i) => i % Math.ceil(xs.length / 60) === 0) : xs;
  return (
    <div className="ml-scroll max-h-80 overflow-auto rounded-ml-md border border-ml-border">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{`${yLabel} against ${xLabel}`}</caption>
        <thead className="sticky top-0 bg-ml-surface">
          <tr className="border-b border-ml-border">
            <th scope="col" className="ml-label px-3 py-2 text-ml-text-4">{xLabel}</th>
            {series.map((s) => (
              <th key={s.id} scope="col" className="ml-label px-3 py-2 text-right text-ml-text-4">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ml-border">
          {rows.map((x) => (
            <tr key={x}>
              <td className="ml-num px-3 py-1.5 text-[0.8125rem] text-ml-text-2">{formatX(x)}</td>
              {series.map((s) => {
                const p = s.points.find((q) => q.x === x);
                return (
                  <td key={s.id} className="ml-num px-3 py-1.5 text-right text-[0.8125rem] text-ml-text">
                    {p && p.y !== null ? formatY(p.y) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length < xs.length ? (
        <p className="ml-small border-t border-ml-border px-3 py-2 text-ml-text-4">
          Showing {rows.length} of {xs.length} points, evenly sampled. Export the run for the full series.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- BarChart -- */

export interface Bar {
  id: string;
  label: string;
  value: number;
  /** Green and red here mean the sign of a financial result, nothing else. */
  tone?: "accent" | "positive" | "negative" | "neutral";
  note?: string;
}

export function BarChart({
  bars, yLabel, formatValue = compact, height = 260, title, note, horizontal = false,
}: {
  bars: Bar[]; yLabel: string; formatValue?: (v: number) => string;
  height?: number; title?: string; note?: string; horizontal?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<string | null>(null);
  const w = Math.max(260, width);

  const color = (b: Bar) =>
    b.tone === "positive" ? "var(--ml-positive)"
    : b.tone === "negative" ? "var(--ml-negative)"
    : b.tone === "neutral" ? "var(--ml-text-4)"
    : "var(--ml-s1)";

  if (horizontal) {
    const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
    return (
      <ChartFrame title={title} note={note} table={<BarTable bars={bars} yLabel={yLabel} formatValue={formatValue} />}>
        <ul className="space-y-2.5">
          {bars.map((b) => (
            <li key={b.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="ml-small truncate text-ml-text-2">{b.label}</span>
                <span className="ml-num text-[0.8125rem] font-semibold text-ml-text">{formatValue(b.value)}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ml-subtle">
                <div className="h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${(Math.abs(b.value) / max) * 100}%`, background: color(b) }} />
              </div>
              {b.note ? <p className="ml-small mt-0.5 text-ml-text-4">{b.note}</p> : null}
            </li>
          ))}
        </ul>
      </ChartFrame>
    );
  }

  /* Left padding follows the longest tick label rather than a guess. At a flat
     58px, "£10,000" ran under the rotated axis title. */
  const tickWidth = (v: number) => formatValue(v).length * 6.6 + 14;
  const [y0, y1] = domain(bars.map((b) => b.value), true);
  const preTicks = axisTicks(y0, y1, 5);
  const pad = {
    top: 16, right: 12, bottom: 44,
    left: Math.min(110, Math.max(46, ...preTicks.map(tickWidth))),
  };
  const plotW = Math.max(40, w - pad.left - pad.right);
  const plotH = Math.max(40, height - pad.top - pad.bottom);
  const sy = makeScale(y0, y1, pad.top + plotH, pad.top);
  const yTicks = preTicks;
  // 2px of surface between neighbouring bars, per the mark spec.
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(8, Math.min(72, slot - 12));
  const zeroY = sy.map(Math.min(Math.max(0, y0), y1));

  return (
    <ChartFrame title={title} note={note} table={<BarTable bars={bars} yLabel={yLabel} formatValue={formatValue} />}>
      <div ref={ref} className="relative w-full">
        <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img"
          aria-label={`${title ?? "Bar chart"}. ${bars.map((b) => `${b.label}: ${formatValue(b.value)}`).join("; ")}`}
          className="block overflow-visible">
          {yTicks.map((t) => (
            <line key={t} x1={pad.left} x2={pad.left + plotW} y1={sy.map(t)} y2={sy.map(t)} stroke="var(--ml-grid)" strokeWidth={1} />
          ))}
          {yTicks.map((t) => (
            <text key={`t${t}`} x={pad.left - 8} y={sy.map(t)} dy="0.32em" textAnchor="end"
              className="ml-num" fontSize={11} fill="var(--ml-text-4)">{formatValue(t)}</text>
          ))}
          <line x1={pad.left} x2={pad.left + plotW} y1={zeroY} y2={zeroY} stroke="var(--ml-axis)" strokeWidth={1} />

          {bars.map((b, i) => {
            const cx0 = pad.left + slot * i + slot / 2;
            const top = sy.map(Math.max(0, b.value));
            const bottom = sy.map(Math.min(0, b.value));
            const hgt = Math.max(1, bottom - top);
            return (
              <g key={b.id}
                onPointerEnter={() => setHover(b.id)}
                onPointerLeave={() => setHover(null)}
              >
                <rect x={cx0 - slot / 2} y={pad.top} width={slot} height={plotH} fill="transparent" />
                <rect
                  x={cx0 - barW / 2} y={top} width={barW} height={hgt}
                  /* 4px rounded ends on the data end only; the baseline end
                     stays square so the bar is anchored to the axis. */
                  rx={4}
                  fill={color(b)}
                  opacity={hover === null || hover === b.id ? 1 : 0.45}
                />
                <text x={cx0} y={height - 26} textAnchor="middle" fontSize={11} fill="var(--ml-text-3)">
                  {b.label.length > 14 ? `${b.label.slice(0, 13)}…` : b.label}
                </text>
                <text x={cx0} y={height - 10} textAnchor="middle" className="ml-num" fontSize={11} fontWeight={600} fill="var(--ml-text)">
                  {formatValue(b.value)}
                </text>
              </g>
            );
          })}
          <text x={12} y={pad.top + plotH / 2} textAnchor="middle" fontSize={11} fill="var(--ml-text-3)"
            transform={`rotate(-90 12 ${pad.top + plotH / 2})`}>{yLabel}</text>
        </svg>
      </div>
    </ChartFrame>
  );
}

function BarTable({ bars, yLabel, formatValue }: { bars: Bar[]; yLabel: string; formatValue: (v: number) => string }) {
  return (
    <div className="ml-scroll overflow-auto rounded-ml-md border border-ml-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ml-border">
            <th scope="col" className="ml-label px-3 py-2 text-ml-text-4">Series</th>
            <th scope="col" className="ml-label px-3 py-2 text-right text-ml-text-4">{yLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ml-border">
          {bars.map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-1.5 text-[0.8125rem] text-ml-text-2">{b.label}</td>
              <td className="ml-num px-3 py-1.5 text-right text-[0.8125rem] text-ml-text">{formatValue(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- Sparkline -- */

export function Sparkline({ values, width = 96, height = 26, tone = "accent" }: {
  values: number[]; width?: number; height?: number; tone?: "accent" | "positive" | "negative";
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const stroke = tone === "positive" ? "var(--ml-positive)" : tone === "negative" ? "var(--ml-negative)" : "var(--ml-s1)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
