/**
 * Shape recognition — the thing that makes a hand-drawn diagram look drawn on
 * purpose. A wobbly circle becomes a circle, a rough triangle becomes a
 * triangle, a shaky line becomes straight.
 *
 * Deliberately conservative: every candidate shape is scored by how far the
 * original points actually sit from the idealised outline, and anything that
 * doesn't fit closely is left exactly as drawn. Snapping something the student
 * meant to be freehand is far worse than failing to snap something they meant
 * to be a square.
 *
 * Pure functions over {x, y} arrays — no DOM, no canvas — so this is testable
 * on its own.
 */

const SAMPLES = 64;

/* ---------------- geometry helpers ---------------- */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Evenly spaced resample, so corner detection isn't skewed by drawing speed. */
function resample(pts, n = SAMPLES) {
  const total = pathLength(pts);
  if (total === 0) return pts.slice(0, 1);
  const step = total / (n - 1);
  const out = [pts[0]];
  let acc = 0;
  let prev = pts[0];

  for (let i = 1; i < pts.length; ) {
    const d = dist(prev, pts[i]);
    if (acc + d >= step) {
      const t = (step - acc) / d;
      const next = { x: prev.x + (pts[i].x - prev.x) * t, y: prev.y + (pts[i].y - prev.y) * t };
      out.push(next);
      prev = next;
      acc = 0;
    } else {
      acc += d;
      prev = pts[i];
      i++;
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

function distToSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(a.x + t * vx - p.x, a.y + t * vy - p.y);
}

/** Ramer–Douglas–Peucker, for finding a polygon's real corners. */
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSegment(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplify(pts.slice(0, idx + 1), eps).slice(0, -1),
    ...simplify(pts.slice(idx), eps),
  ];
}

/* ---------------- fit scoring ---------------- */

/** Mean distance from the drawn points to the idealised outline. */
function meanErrorToPolyline(pts, outline, closed) {
  let total = 0;
  for (const p of pts) {
    let best = Infinity;
    const n = closed ? outline.length : outline.length - 1;
    for (let i = 0; i < n; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      best = Math.min(best, distToSegment(p, a, b));
    }
    total += best;
  }
  return total / pts.length;
}

function meanErrorToCircle(pts, c, r) {
  let total = 0;
  for (const p of pts) total += Math.abs(dist(p, c) - r);
  return total / pts.length;
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

const circlePoints = (c, r, n = 72) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });

const ellipsePoints = (c, rx, ry, n = 72) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: c.x + rx * Math.cos(a), y: c.y + ry * Math.sin(a) };
  });

/* ---------------- recognition ---------------- */

/**
 * @param {{x:number,y:number}[]} rawPoints  the stroke as drawn
 * @param {{minSize?:number, tolerance?:number}} [opts]
 *   minSize   ignore strokes smaller than this (world units)
 *   tolerance fit strictness as a fraction of the shape's diagonal; lower is stricter
 * @returns {{type:string, points:{x:number,y:number}[], closed:boolean}|null}
 */
export function recognizeShape(rawPoints, opts = {}) {
  const { minSize = 24, tolerance = 0.075 } = opts;
  if (!Array.isArray(rawPoints) || rawPoints.length < 6) return null;

  const pts = resample(rawPoints.map((p) => ({ x: p.x, y: p.y })));
  const box = bbox(pts);
  const diag = Math.hypot(box.w, box.h);
  if (diag < minSize) return null;

  const len = pathLength(pts);
  if (len < minSize) return null;

  const limit = diag * tolerance;
  const gap = dist(pts[0], pts[pts.length - 1]);
  const closed = gap < Math.max(diag * 0.3, len * 0.18);

  /* --- open strokes: only a straight line is worth snapping --- */
  if (!closed) {
    const line = [pts[0], pts[pts.length - 1]];
    // A line's own length, not its bbox diagonal, is the fair yardstick.
    if (meanErrorToPolyline(pts, line, false) <= dist(line[0], line[1]) * tolerance) {
      return { type: 'line', points: line, closed: false };
    }
    return null;
  }

  /* --- closed strokes: circle / ellipse / polygon --- */
  //
  // Candidates are scored as error × a complexity penalty. Without that
  // penalty the most complex shape always wins — a wobbly circle fits an
  // 8-gon better than it fits a circle, purely because the 8-gon has more
  // degrees of freedom — and the student gets a polygon they never drew.
  // Canonical shapes are what people actually mean, so they score at par
  // and everything looser has to be clearly better to win.
  const PENALTY = {
    circle: 1,
    triangle: 1,
    rectangle: 1,
    ellipse: 1.15,
    quadrilateral: 1.3,
    polygon: 1.7,
  };
  const candidates = [];
  const offer = (type, points, err, extraPenalty = 1) => {
    const score = err * PENALTY[type] * extraPenalty;
    if (score <= limit) candidates.push({ type, points, closed: true, score });
  };

  const c = centroid(pts);
  const radii = pts.map((p) => dist(p, c));
  const rMean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const aspect = box.w && box.h ? Math.max(box.w, box.h) / Math.min(box.w, box.h) : Infinity;

  // Corner count, from a closed simplification of the outline. Clear corner
  // evidence is the strongest signal there is, so it also decides how much a
  // curved candidate should be trusted below.
  const loop = [...pts, pts[0]];
  const simplified = simplify(loop, diag * 0.05);
  const corners = simplified.slice(0, -1); // drop the repeated closing point
  const cornerCount = corners.length;
  // A shape whose outline simplifies to 3 or 4 corners is a polygon someone
  // drew badly, not an oval — hold curved fits to a much higher bar there.
  const curvedPenalty = cornerCount === 3 || cornerCount === 4 ? 1.8 : 1;

  if (aspect < 1.25) {
    offer('circle', circlePoints(c, rMean), meanErrorToCircle(pts, c, rMean), curvedPenalty);
  } else if (aspect < 4) {
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const outline = ellipsePoints({ x: cx, y: cy }, box.w / 2, box.h / 2);
    offer('ellipse', outline, meanErrorToPolyline(pts, outline, true), curvedPenalty);
  }

  if (cornerCount === 3) {
    offer('triangle', corners, meanErrorToPolyline(pts, corners, true));
  }

  // The bounding box is always worth scoring, not only when corner detection
  // happened to find exactly four corners. A box drawn sloppily enough to
  // lose its corners is still a box, and without this it would fall through
  // to whatever curved fit happened to score next — turning it into an oval.
  // A circle is far from its own bbox, so this never steals a curved shape.
  const rect = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  offer('rectangle', rect, meanErrorToPolyline(pts, rect, true));

  if (cornerCount === 4) {
    // A rotated square loses the axis-aligned fit above and stays a
    // quadrilateral with the corners as drawn.
    offer('quadrilateral', corners, meanErrorToPolyline(pts, corners, true));
  }

  if (cornerCount >= 5 && cornerCount <= 8) {
    offer('polygon', corners, meanErrorToPolyline(pts, corners, true));
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  return { type: best.type, points: best.points, closed: best.closed };
}
