"use client";

/**
 * Charts, hand-rolled as inline SVG.
 *
 * No charting library: the shapes needed here are simple, the bundle cost of a
 * library is not, and full control over the marks is what keeps the analytics
 * legible in both themes. Every chart inherits theme tokens, carries an
 * accessible text alternative, and scrolls horizontally inside its own
 * container rather than forcing the page to.
 */

import type { ReactNode } from "react";

const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

function Frame({
  width,
  height,
  children,
  label,
}: {
  width: number;
  height: number;
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="scroll-x">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={label}
        style={{ display: "block", overflow: "visible" }}
      >
        {children}
      </svg>
    </div>
  );
}

export function LineChart({
  series,
  height = 170,
  yMax = 1,
  yLabel,
  band,
}: {
  series: { label: string; colour?: string; points: { x: string; y: number }[] }[];
  height?: number;
  yMax?: number;
  yLabel?: string;
  /** Optional confidence band on the first series. */
  band?: { x: string; low: number; high: number }[];
}) {
  const width = 560;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <p className="small muted">No data yet.</p>;

  const xs = [...new Set(all.map((p) => p.x))].sort();
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (v: string) => PAD.left + (xs.indexOf(v) / Math.max(1, xs.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  return (
    <Frame
      width={width}
      height={height}
      label={`${yLabel ?? "Trend"} over ${xs.length} points. ${series
        .map((s) => `${s.label} ends at ${Math.round((s.points[s.points.length - 1]?.y ?? 0) * 100)}%`)
        .join("; ")}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">
            {Math.round((t / yMax) * 100)}
          </text>
        </g>
      ))}

      {band && band.length > 1 && (
        <path
          d={
            `M ${band.map((b) => `${x(b.x)},${y(b.high)}`).join(" L ")} ` +
            `L ${[...band].reverse().map((b) => `${x(b.x)},${y(b.low)}`).join(" L ")} Z`
          }
          fill="var(--accent)"
          opacity={0.1}
        />
      )}

      {series.map((s, i) => (
        <g key={s.label}>
          <path
            d={`M ${s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(" L ")}`}
            fill="none"
            stroke={s.colour ?? (i === 0 ? "var(--accent)" : "var(--stable)")}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.points.map((p) => (
            <circle key={p.x} cx={x(p.x)} cy={y(p.y)} r={2.4} fill={s.colour ?? (i === 0 ? "var(--accent)" : "var(--stable)")} />
          ))}
        </g>
      ))}

      {xs.map((v, i) =>
        i % Math.ceil(xs.length / 7) === 0 ? (
          <text key={v} x={x(v)} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">
            {v.slice(5)}
          </text>
        ) : null,
      )}
    </Frame>
  );
}

export function BarChart({
  data,
  height = 180,
  colour = "var(--accent)",
  format = (n: number) => String(Math.round(n)),
  horizontal,
}: {
  data: { label: string; value: number; colour?: string }[];
  height?: number;
  colour?: string;
  format?: (n: number) => string;
  horizontal?: boolean;
}) {
  if (!data.length) return <p className="small muted">No data yet.</p>;
  const max = Math.max(...data.map((d) => d.value), 0.0001);

  if (horizontal) {
    return (
      <div className="stack tight">
        {data.map((d) => (
          <div key={d.label} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 32%) 1fr auto", gap: 10, alignItems: "center" }}>
            <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>
              {d.label}
            </span>
            <div className="meter" style={{ height: 8 }}>
              <div className="meter-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.colour ?? colour }} />
            </div>
            <span className="num tiny muted" style={{ minWidth: 34, textAlign: "right" }}>
              {format(d.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const width = Math.max(320, data.length * 56);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const bw = (innerW / data.length) * 0.62;

  return (
    <Frame width={width} height={height} label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      {data.map((d, i) => {
        const cx = PAD.left + (i + 0.5) * (innerW / data.length);
        const h = (d.value / max) * innerH;
        return (
          <g key={d.label}>
            <rect x={cx - bw / 2} y={PAD.top + innerH - h} width={bw} height={Math.max(1, h)} rx={2} fill={d.colour ?? colour} />
            <text x={cx} y={PAD.top + innerH - h - 4} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="var(--mono)">
              {format(d.value)}
            </text>
            <text x={cx} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">
              {d.label.length > 9 ? `${d.label.slice(0, 8)}…` : d.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/**
 * Topics × skill-types grid. The chart that reveals hidden weaknesses: a
 * student strong on recall and weak on evaluation looks fine in any per-topic
 * average, and is not fine.
 */
export function Heatmap({
  rows,
  columns,
  value,
  onCell,
}: {
  rows: { id: string; label: string }[];
  columns: { id: string; label: string }[];
  value: (rowId: string, colId: string) => { score: number; observations: number } | null;
  onCell?: (rowId: string, colId: string) => void;
}) {
  if (!rows.length) return <p className="small muted">No topics yet.</p>;
  return (
    <div className="scroll-x">
      <table className="table" style={{ minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ width: "34%" }}>Topic</th>
            {columns.map((c) => (
              <th key={c.id} className="num">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ fontSize: "0.85rem" }}>{r.label}</td>
              {columns.map((c) => {
                const v = value(r.id, c.id);
                return (
                  <td key={c.id} style={{ padding: 4 }}>
                    <div
                      className="heatcell"
                      onClick={onCell ? () => onCell(r.id, c.id) : undefined}
                      title={
                        v
                          ? `${r.label} · ${c.label}: ${Math.round(v.score * 100)}% from ${v.observations} attempt${v.observations === 1 ? "" : "s"}`
                          : `${r.label} · ${c.label}: never tested`
                      }
                      style={{
                        background: v ? heatColour(v.score, v.observations) : "transparent",
                        borderStyle: v ? "solid" : "dashed",
                        cursor: onCell ? "pointer" : "default",
                      }}
                    >
                      {v ? Math.round(v.score * 100) : "–"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Colour encodes score; opacity encodes evidence. A cell backed by two attempts
 * is visibly paler than one backed by twenty, so thin evidence cannot be
 * mistaken for a finding.
 */
function heatColour(score: number, observations: number): string {
  const confidence = Math.min(1, observations / 8);
  const token = score >= 0.85 ? "--secure" : score >= 0.7 ? "--stable" : score >= 0.5 ? "--fading" : score >= 0.3 ? "--risk" : "--lost";
  return `color-mix(in srgb, var(${token}) ${Math.round(14 + confidence * 42)}%, transparent)`;
}

export function Sparkline({ values, height = 26, colour = "var(--accent)" }: { values: number[]; height?: number; colour?: string }) {
  if (values.length < 2) return null;
  const width = 90;
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Trend: ${values.map((v) => Math.round(v * 100)).join(", ")}`}>
      <path d={`M ${pts.join(" L ")}`} fill="none" stroke={colour} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Progress ring for readiness. One number, one arc, no decoration. */
export function Ring({
  value,
  size = 108,
  label,
  sublabel,
  tone = "var(--accent)",
}: {
  value: number;
  size?: number;
  label?: string;
  sublabel?: string;
  tone?: string;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "Progress"}: ${Math.round(value * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 500ms cubic-bezier(.22,.61,.36,1)" }}
      />
      <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.24} fill="var(--ink)" fontFamily="var(--serif)" fontWeight={500}>
        {Math.round(value * 100)}
      </text>
      {sublabel && (
        <text x="50%" y="65%" textAnchor="middle" fontSize={size * 0.1} fill="var(--muted)" fontFamily="var(--mono)" letterSpacing="0.1em">
          {sublabel.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
