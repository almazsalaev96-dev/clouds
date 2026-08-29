/**
 * Turns a small, declarative JSON shape list into an inline SVG diagram.
 *
 * This is the tutor's way of drawing a figure — a triangle with labelled
 * sides, a number line, a quick graph — instead of only describing one in
 * words. The model never emits markup, only numbers and short labels in a
 * fixed schema; every value is validated and clamped here, and every string
 * is escaped, so there is no path from a reply to injected HTML/SVG/script.
 *
 * Schema (all fields optional unless noted):
 *   { width, height, shapes: [ ...primitives ] }
 * Primitives (type required):
 *   line    { x1,y1,x2,y2, dashed?, arrow? }
 *   circle  { cx,cy,r, fill? }
 *   rect    { x,y,w,h, fill? }
 *   polygon { points:[[x,y],...], fill? }
 *   arc     { cx,cy,r, start,end }              // degrees; angle markers
 *   text    { x,y,s, anchor?('start'|'middle'|'end'), size? }
 */

const MAX_SHAPES = 24;
const W_RANGE = [80, 560];
const H_RANGE = [60, 440];
const COORD_RANGE = [-2000, 2000];
const MAX_LABEL = 60;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (Number.isFinite(v) ? clamp(v, ...COORD_RANGE) : fallback);
const escapeXml = (s) =>
  String(s).slice(0, MAX_LABEL).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shapeSvg(shape) {
  if (!shape || typeof shape !== 'object') return '';
  const stroke = 'var(--ink, #14162b)';
  const muted = 'var(--ink-3, #8b90ab)';

  switch (shape.type) {
    case 'line': {
      const [x1, y1, x2, y2] = [num(shape.x1), num(shape.y1), num(shape.x2), num(shape.y2)];
      const dash = shape.dashed ? ' stroke-dasharray="5,4"' : '';
      const id = `arrow-${Math.random().toString(36).slice(2, 8)}`;
      if (shape.arrow) {
        return (
          `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
          `<path d="M0 0L10 5L0 10z" fill="${stroke}"/></marker></defs>` +
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"${dash} marker-end="url(#${id})"/>`
        );
      }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"${dash}/>`;
    }
    case 'circle': {
      const cx = num(shape.cx), cy = num(shape.cy), r = clamp(num(shape.r, 1), 0.5, 2000);
      const fill = shape.fill ? 'var(--accent-soft, #eceafe)' : 'none';
      return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${stroke}" stroke-width="2" fill="${fill}"/>`;
    }
    case 'rect': {
      const x = num(shape.x), y = num(shape.y);
      const w = clamp(num(shape.w, 1), 0.5, 2000), h = clamp(num(shape.h, 1), 0.5, 2000);
      const fill = shape.fill ? 'var(--accent-soft, #eceafe)' : 'none';
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${stroke}" stroke-width="2" fill="${fill}"/>`;
    }
    case 'polygon': {
      if (!Array.isArray(shape.points)) return '';
      const pts = shape.points
        .slice(0, 12)
        .map((p) => `${num(p?.[0])},${num(p?.[1])}`)
        .join(' ');
      if (!pts) return '';
      const fill = shape.fill ? 'var(--accent-soft, #eceafe)' : 'none';
      return `<polygon points="${pts}" stroke="${stroke}" stroke-width="2" fill="${fill}" stroke-linejoin="round"/>`;
    }
    case 'arc': {
      const cx = num(shape.cx), cy = num(shape.cy), r = clamp(num(shape.r, 1), 0.5, 2000);
      const start = ((num(shape.start) % 360) * Math.PI) / 180;
      const end = ((num(shape.end) % 360) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      const large = Math.abs(end - start) % (2 * Math.PI) > Math.PI ? 1 : 0;
      return `<path d="M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}" stroke="${muted}" stroke-width="1.6" fill="none"/>`;
    }
    case 'text': {
      const x = num(shape.x), y = num(shape.y);
      const anchor = ['start', 'middle', 'end'].includes(shape.anchor) ? shape.anchor : 'middle';
      const size = clamp(num(shape.size, 13), 8, 28);
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${stroke}" font-family="inherit">${escapeXml(shape.s ?? '')}</text>`;
    }
    default:
      return '';
  }
}

/** @returns {string|null} an inline <svg>, or null if the spec is unusable */
export function diagramSvg(jsonText) {
  let spec;
  try {
    spec = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.shapes)) return null;

  const w = clamp(Number(spec.width) || 320, ...W_RANGE);
  const h = clamp(Number(spec.height) || 200, ...H_RANGE);
  const body = spec.shapes
    .slice(0, MAX_SHAPES)
    .map(shapeSvg)
    .filter(Boolean)
    .join('');
  if (!body) return null;

  return `<svg class="diagram" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram">${body}</svg>`;
}
