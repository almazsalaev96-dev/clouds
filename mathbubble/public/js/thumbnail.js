/**
 * Small preview images for the Pages grid.
 *
 * A page with a background (a photo or a PDF-rendered page) already IS an
 * image, so its own src is the fastest, most accurate thumbnail — no need to
 * recomposite it. A hand-drawn page with no background gets a lightweight
 * canvas render of just its strokes, scaled to fit a small box.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function strokeBounds(strokes) {
  let min = { x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  for (const s of strokes) {
    for (const p of s.points) {
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y);
    }
  }
  return Number.isFinite(min.x) ? { min, max } : null;
}

/** @returns {string|null} a PNG data URL, or null for a genuinely blank page */
export function strokesThumbnail(page, size = 240) {
  if (!page.strokes?.length) return null;
  const bounds = strokeBounds(page.strokes);
  if (!bounds) return null;

  const w = Math.max(1, bounds.max.x - bounds.min.x);
  const h = Math.max(1, bounds.max.y - bounds.min.y);
  const pad = Math.max(w, h) * 0.1;
  const scale = Math.min((size - 16) / (w + pad * 2), (size - 16) / (h + pad * 2));

  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(bounds.min.x + w / 2), -(bounds.min.y + h / 2));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of page.strokes) {
    if (s.points.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.tool === 'marker' ? 0.32 : 1;
    ctx.lineWidth = clamp((s.tool === 'marker' ? s.width * 5 : s.width) * 0.9, 1, 40);
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
  }
  return cv.toDataURL('image/png');
}
