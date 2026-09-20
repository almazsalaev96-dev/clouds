/**
 * A small chart, from a fence.
 *
 * A model asked about a trend answers with a table, because a table is the
 * one shape it can write. A ```chart fence lets it say the same thing as
 * numbers and have them drawn. The fence carries data and nothing about how
 * to draw it — the model is good at "these are the values" and measurably
 * bad at "put this label 14px to the left" — so everything spatial is
 * decided here, once, by the same rules every time.
 *
 * Pure: a string in, geometry out. The SVG that draws it is elsewhere and
 * has nothing to test.
 */

export interface Series {
  name: string;
  values: (number | null)[];
}

export interface ChartSpec {
  type: "bar" | "line";
  title?: string;
  /** Category labels along the x axis, one per value. */
  x: string[];
  series: Series[];
  /** Appended to values in labels and the table: "ms", "%", "£". */
  unit?: string;
}

/** How many series get a colour of their own. The rest fold into "Other". */
export const MAX_SERIES = 4;

/**
 * Read the fence.
 *
 * Two shapes are accepted. The full one names its series; the short one is
 * a single series as `labels` and `values`, because that is what a model
 * writes when asked for one line and it should not have to know the long
 * form exists. Anything else — a value that is not a number, rows of
 * different lengths, no x at all — is refused, and the caller shows the
 * source instead. A chart drawn from half-understood data is worse than a
 * code block.
 */
export function parseChart(text: string): ChartSpec | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const type = r.type === "line" ? "line" : r.type === "bar" || r.type === undefined ? "bar" : null;
  if (!type) return null;

  const x = Array.isArray(r.x) ? r.x : Array.isArray(r.labels) ? r.labels : null;
  if (!x || !x.length || !x.every((v) => typeof v === "string" || typeof v === "number")) return null;
  const labels = x.map(String);

  let series: Series[];
  if (Array.isArray(r.series)) {
    series = [];
    for (const s of r.series) {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      if (typeof o.name !== "string" || !Array.isArray(o.values)) return null;
      const values = o.values.map(num);
      if (values.some((v) => v === undefined)) return null;
      series.push({ name: o.name, values: values as (number | null)[] });
    }
  } else if (Array.isArray(r.values)) {
    const values = r.values.map(num);
    if (values.some((v) => v === undefined)) return null;
    series = [{ name: typeof r.title === "string" ? r.title : "Value", values: values as (number | null)[] }];
  } else {
    return null;
  }
  if (!series.length) return null;
  if (series.some((s) => s.values.length !== labels.length)) return null;

  return {
    type,
    title: typeof r.title === "string" ? r.title.trim() || undefined : undefined,
    x: labels,
    series: fold(series),
    unit: typeof r.unit === "string" ? r.unit.trim() || undefined : undefined,
  };
}

/** A number, null for a gap, undefined for something that is neither. */
function num(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/**
 * Past the fourth series, the rest become one.
 *
 * A fifth colour is never generated: four is where a reader stops being able
 * to tell the legend from the lines, and the palette has been validated for
 * exactly four adjacent slots. The tail is summed into "Other", which keeps
 * the totals honest while giving up a distinction that could not be seen.
 */
export function fold(series: Series[]): Series[] {
  if (series.length <= MAX_SERIES) return series;
  const keep = series.slice(0, MAX_SERIES - 1);
  const rest = series.slice(MAX_SERIES - 1);
  const n = rest[0].values.length;
  const other: (number | null)[] = Array.from({ length: n }, (_, i) => {
    const vs = rest.map((s) => s.values[i]).filter((v): v is number => v !== null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  });
  return [...keep, { name: "Other", values: other }];
}

/* ------------------------------------------------------------------ ticks -- */

/**
 * Round gridline values.
 *
 * The classic nice-number ladder: pick a step of 1, 2 or 5 times a power of
 * ten so the ticks land where a person would have put them, and always
 * include zero for a bar chart because a bar that does not start at zero
 * is a lie about its own length.
 */
export function niceTicks(lo: number, hi: number, want = 4, includeZero = true): number[] {
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (hi === lo) hi = lo + 1;
  const span = hi - lo;
  const rough = span / Math.max(1, want);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const first = Math.floor(lo / step) * step;
  const last = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = first; v <= last + step / 2; v += step) out.push(round(v));
  return out;
}

const round = (v: number) => Math.round(v * 1e9) / 1e9;

/* ----------------------------------------------------------------- layout -- */

export interface Point { x: number; y: number; value: number | null; label: string }
export interface Bar { x: number; y: number; w: number; h: number; value: number; label: string; series: number }

export interface Layout {
  width: number;
  height: number;
  /** The plot area, inside the axis bands. */
  plot: { x: number; y: number; w: number; h: number };
  ticks: { value: number; y: number }[];
  /** The y of zero, where bars grow from. */
  baseline: number;
  /** x centre of each category. */
  columns: { x: number; label: string }[];
  /** Lines: one polyline per series, with gaps where a value is null. */
  lines: Point[][];
  /** Bars: every bar, laid out in groups per category. */
  bars: Bar[];
}

/** Mark specs, fixed. */
export const BAR_MAX = 24;
export const GAP = 2;

/**
 * Where everything goes, in pixels.
 *
 * The plot's height is what is left after the axis band, so a fixed-height
 * chart never grows a scroll bar to reach its own labels — the commonest
 * way a chart card goes wrong.
 */
/** About how wide one character of a 10px tick label is. */
const CH = 6;

export function layout(spec: ChartSpec, width: number, height: number): Layout {
  const all = spec.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const ticks = niceTicks(Math.min(...all, 0), Math.max(...all, 0), 4, spec.type === "bar" || Math.min(...all) >= 0);

  /* The left band is as wide as the widest tick label, not a constant. At
     44px "2,500 req" lost its first digit off the edge — an axis that reads
     ",500" is worse than no axis, because it is a number that is wrong. */
  const widest = Math.max(...ticks.map((t) => fmt(t, spec.unit).length));
  const left = Math.max(28, Math.min(120, widest * CH + 12));
  const right = 12, top = 8, bottom = 24;
  const plot = { x: left, y: top, w: Math.max(40, width - left - right), h: Math.max(40, height - top - bottom) };
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h;

  const n = spec.x.length;
  const slot = plot.w / n;
  const columns = spec.x.map((label, i) => ({ x: plot.x + slot * (i + 0.5), label }));

  const lines: Point[][] = spec.type === "line"
    ? spec.series.map((s) => s.values.map((v, i) => ({ x: columns[i].x, y: v === null ? NaN : y(v), value: v, label: spec.x[i] })))
    : [];

  const bars: Bar[] = [];
  if (spec.type === "bar") {
    const k = spec.series.length;
    /* Capped, never filling the slot: the band's leftover is air, and air is
       what makes a bar read as a mark rather than a stripe. */
    const w = Math.min(BAR_MAX, (slot - GAP * (k + 1)) / k);
    const groupW = w * k + GAP * (k - 1);
    spec.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        if (v === null) return;
        const x0 = columns[i].x - groupW / 2 + si * (w + GAP);
        const top = y(Math.max(0, v)), base = y(Math.min(0, v));
        bars.push({ x: x0, y: top, w, h: Math.max(0, base - top), value: v, label: spec.x[i], series: si });
      });
    });
  }

  return {
    width, height, plot,
    ticks: ticks.map((value) => ({ value, y: y(value) })),
    baseline: y(0),
    columns, lines, bars,
  };
}

/**
 * A value as the reader would say it.
 *
 * Thousands grouped, up to two decimals where the number has them, the unit
 * on the end. Not `toLocaleString` with the system locale, because a chart
 * written in one locale and read in another should not change its commas.
 */
export function fmt(v: number | null, unit?: string): string {
  if (v === null) return "—";
  const abs = Math.abs(v);
  const s = abs >= 1000 ? Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : Number.isInteger(v) ? String(v) : v.toFixed(abs < 1 ? 2 : 1).replace(/\.0$/, "");
  return unit ? (unit === "%" || unit === "£" || unit === "$" || unit === "€" ? (unit === "%" ? `${s}%` : `${unit}${s}`) : `${s} ${unit}`) : s;
}

/** The bar's outline with its data-end rounded and its baseline end square. */
export function barPath(b: Bar, r = 4): string {
  const rr = Math.min(r, b.w / 2, b.h);
  if (b.h <= 0) return "";
  const { x, y, w, h } = b;
  return [
    `M${x},${y + h}`, `V${y + rr}`, `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`, `Q${x + w},${y} ${x + w},${y + rr}`, `V${y + h}`, "Z",
  ].join(" ");
}
