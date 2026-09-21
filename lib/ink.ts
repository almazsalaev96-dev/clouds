/**
 * Ink on a page.
 *
 * A pencil on a page is the oldest study tool there is, and the one every
 * tablet app is measured by. What is drawn here is kept in the page's own
 * coordinates — 0..1 across and down — so the same stroke sits on the same
 * word whether the page is drawn at 400px on a phone or 1400px on a desk,
 * and so a region cut out of the page can be cut out of the ink as well.
 *
 * Pressure rides with every point. Apple Pencil reports it through the
 * pointer event (0..1); a mouse reports 0.5 while a button is down, a
 * finger 0 or 1 — so a pen gets a line that thickens where it pressed and
 * everything else gets one even line. Tilt is read but not drawn: a study
 * pen is not a paintbrush, and a line that changes with the angle of the
 * hand reads as a wobble.
 *
 * Handwriting is not an affectation here. Mueller & Oppenheimer (2014)
 * found longhand note-takers ahead on conceptual questions, and the
 * mechanism was *selection*: a hand too slow to transcribe has to decide
 * what matters. The 2024 EEG work (van der Weel & van der Meer) shows
 * handwriting recruits far wider connectivity than typing, though it did
 * not test retention. The honest reading of both is that writing on the
 * page makes the person do the choosing — which is the whole point of a
 * tutor that does not do the work for them.
 */

export type Tool = "point" | "pen" | "hi" | "erase";

export interface Stroke {
  id: string;
  tool: "pen" | "hi";
  /** Flat [x, y, pressure, x, y, pressure, …], page coordinates 0..1. */
  points: number[];
}

/** Ink colours. Fixed, because the page underneath is always the page. */
export const INK = { pen: "#1f3f9e", hi: "#ffd23f" } as const;

/** Stroke width in thousandths of the page's width. */
export function widthOf(s: Stroke): number {
  if (s.tool === "hi") return 22;
  let sum = 0;
  let n = 0;
  for (let i = 2; i < s.points.length; i += 3) { sum += s.points[i]; n++; }
  const p = n ? sum / n : 0.5;
  return 2.6 * (0.55 + p);
}

/** The SVG path of a stroke, in page coordinates. */
export function pathOf(s: Stroke): string {
  const pts = s.points;
  if (pts.length < 3) return "";
  if (pts.length === 3) return `M ${pts[0]} ${pts[1]} L ${pts[0]} ${pts[1]}`;
  let d = `M ${pts[0]} ${pts[1]}`;
  for (let i = 3; i < pts.length; i += 3) d += ` L ${pts[i]} ${pts[i + 1]}`;
  return d;
}

/** Everything but the strokes that pass within `r` of a point. */
export function eraseAt(strokes: Stroke[], x: number, y: number, r: number): Stroke[] {
  const r2 = r * r;
  return strokes.filter((s) => {
    for (let i = 0; i < s.points.length; i += 3) {
      const dx = s.points[i] - x;
      const dy = s.points[i + 1] - y;
      if (dx * dx + dy * dy <= r2) return false;
    }
    return true;
  });
}

/** The box the ink is in, or null when the page is clean. */
export function boundsOf(strokes: Stroke[]): { x: number; y: number; w: number; h: number } | null {
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0;
  let any = false;
  for (const s of strokes) {
    for (let i = 0; i < s.points.length; i += 3) {
      any = true;
      x1 = Math.min(x1, s.points[i]); y1 = Math.min(y1, s.points[i + 1]);
      x2 = Math.max(x2, s.points[i]); y2 = Math.max(y2, s.points[i + 1]);
    }
  }
  return any ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}

/**
 * The page with the ink on it, as one picture — what the model is shown when
 * you have written on the page. The page is drawn at its own resolution and
 * the strokes over it in the same coordinates, so what it sees is what you
 * see.
 */
export async function composite(pageUrl: string, strokes: Stroke[]): Promise<string> {
  if (!strokes.length) return pageUrl;
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = pageUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return pageUrl;
  ctx.drawImage(img, 0, 0);
  const W = canvas.width, H = canvas.height;
  for (const s of strokes) {
    if (s.points.length < 3) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK[s.tool];
    ctx.lineWidth = (widthOf(s) / 1000) * W;
    if (s.tool === "hi") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; }
    ctx.beginPath();
    ctx.moveTo(s.points[0] * W, s.points[1] * H);
    if (s.points.length === 3) ctx.lineTo(s.points[0] * W, s.points[1] * H);
    for (let i = 3; i < s.points.length; i += 3) ctx.lineTo(s.points[i] * W, s.points[i + 1] * H);
    ctx.stroke();
    ctx.restore();
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * What the model says about each step of a piece of working, parsed out of
 * its answer. It is asked for JSON; anything else is shown as prose, and the
 * page gets no marks — a mark drawn from a guess would be a lie in ink.
 */
export interface StepMark { text: string; ok: boolean; note?: string }

export function parseMarks(text: string): { steps: StepMark[]; summary: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { steps?: unknown; summary?: unknown };
    if (!Array.isArray(o.steps)) return null;
    const steps: StepMark[] = o.steps
      .filter((s): s is { text: unknown; ok: unknown; note?: unknown } => typeof s === "object" && s !== null)
      .map((s) => ({ text: String(s.text ?? ""), ok: Boolean(s.ok), note: s.note ? String(s.note) : undefined }))
      .filter((s) => s.text);
    if (!steps.length) return null;
    return { steps, summary: typeof o.summary === "string" ? o.summary : "" };
  } catch {
    return null;
  }
}

/** The marks, said as markdown for the transcript. */
export function marksMarkdown(m: { steps: StepMark[]; summary: string }): string {
  const lines = m.steps.map((s, i) => `${i + 1}. ${s.ok ? "✓" : "✗"} ${s.text}${s.note ? ` — ${s.note}` : ""}`);
  const wrong = m.steps.filter((s) => !s.ok).length;
  const head = wrong === 0 ? "Every step holds." : wrong === 1 ? "One step does not hold." : `${wrong} steps do not hold.`;
  return [head, "", ...lines, m.summary ? "" : "", m.summary].filter((l) => l !== undefined).join("\n").trim();
}

/** The quoted lines of an answer — what the model says the page says. */
export function quotesIn(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^>\s?(.+)$/.exec(line);
    if (m) {
      const q = m[1].trim().replace(/^[“"]|[”"]$/g, "");
      if (q.length >= 8 && !out.includes(q)) out.push(q);
    }
  }
  return out.slice(0, 6);
}
