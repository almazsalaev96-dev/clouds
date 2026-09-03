/**
 * Ink.
 *
 * Written for a pen first. Strokes are stored in page coordinates (0–1 of the page
 * box) rather than pixels, so they stay sharp at any zoom and survive a rotation or
 * a resize — the difference between a drawing toy and something you would write a
 * whole page of working in.
 *
 * A pen always draws; a finger draws only when asked to. That single rule is also
 * the palm rejection, and it is why there is no drawing mode to remember to switch
 * on: on an iPad the hand keeps working the interface while the Pencil writes.
 */

export const TOOLS = {
  pen: { width: 0.0022, colour: "#171717", alpha: 1, composite: "source-over", pressure: true },
  pencil: { width: 0.0030, colour: "#3d3d3d", alpha: 0.80, composite: "source-over", pressure: true },
  highlighter: { width: 0.0180, colour: "#ffd54a", alpha: 0.35, composite: "multiply", pressure: false },
  shape: { width: 0.0022, colour: "#171717", alpha: 1, composite: "source-over", pressure: false },
};

const PEN_MEMORY_MS = 4000;
const SELECT_COLOUR = "#7c5cfc";

export class InkSurface {
  constructor(canvas, surface, opts) {
    this.canvas = canvas;
    this.surface = surface;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;      // { getTool, shouldDraw, onCommit, onChange, onSelect }
    this.strokes = [];
    this.live = null;
    this.lasso = null;
    this.selected = new Set();
    this.lastPenAt = 0;
    this.activePointer = null;
    this.dpr = 1;
    this._bind();
  }

  _bind() {
    const c = this.surface;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => this._down(e));
    c.addEventListener("pointermove", (e) => this._move(e));
    c.addEventListener("pointerup", (e) => this._up(e));
    c.addEventListener("pointercancel", (e) => this._up(e));
    // A hovering pen is still a pen: noting it early rejects the palm before the
    // first mark rather than after it.
    c.addEventListener("pointerenter", (e) => { if (e.pointerType === "pen") this.lastPenAt = performance.now(); });
  }

  _accepts(e) {
    if (e.pointerType === "pen") { this.lastPenAt = performance.now(); return true; }
    if (!this.opts.shouldDraw(e.pointerType)) return false;
    if (e.pointerType === "touch") return performance.now() - this.lastPenAt > PEN_MEMORY_MS;
    return true;
  }

  _point(e) {
    const r = this.canvas.getBoundingClientRect();
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return [
      Math.round(((e.clientX - r.left) / r.width) * 10000) / 10000,
      Math.round(((e.clientY - r.top) / r.height) * 10000) / 10000,
      Math.round(pressure * 100) / 100,
    ];
  }

  _down(e) {
    if (this.activePointer !== null || !this._accepts(e)) return;
    const tool = this.opts.getTool();
    if (tool === "text") return;                  // placing text is the view's job
    this.activePointer = e.pointerId;
    try { this.surface.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    if (tool === "eraser") { this._erase(e); return; }
    if (tool === "lasso") { this.lasso = [this._point(e)]; this.clearSelection(); e.preventDefault(); return; }
    const spec = TOOLS[tool] || TOOLS.pen;
    this.live = { tool, colour: spec.colour, points: [this._point(e)] };
    e.preventDefault();
  }

  _move(e) {
    if (e.pointerId !== this.activePointer) return;
    const tool = this.opts.getTool();
    if (tool === "eraser") { this._erase(e); return; }
    const samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    const events = samples.length ? samples : [e];
    if (tool === "lasso") {
      for (const s of events) this.lasso.push(this._point(s));
      this.render();
      e.preventDefault();
      return;
    }
    if (!this.live) return;
    // Coalesced events carry every sample the digitiser took between frames.
    // Without them a fast stroke is a polygon.
    for (const s of events) this.live.points.push(this._point(s));
    this.render();
    e.preventDefault();
  }

  _up(e) {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    try { this.surface.releasePointerCapture(e.pointerId); } catch { /* already gone */ }

    if (this.lasso) {
      const polygon = this.lasso;
      this.lasso = null;
      this._select(polygon);
      this.render();
      return;
    }
    if (this.live && this.live.points.length > 1) {
      const stroke = this.live.tool === "shape" ? straighten(this.live) : this.live;
      this.strokes.push(stroke);
      this.opts.onCommit(stroke);
    }
    this.live = null;
    this.render();
  }

  /** Erasing removes whole strokes. Nothing underneath is ever altered. */
  _erase(e) {
    const [x, y] = this._point(e);
    const radius = 0.012;
    const before = this.strokes.length;
    this.strokes = this.strokes.filter((s) => !s.points.some(([px, py]) =>
      Math.abs(px - x) < radius && Math.abs(py - y) < radius));
    if (this.strokes.length !== before) {
      this.opts.onChange(this.strokes);
      this.render();
    }
  }

  /** Which strokes the lasso caught, and where to put the menu about them. */
  _select(polygon) {
    if (polygon.length < 3) return;
    this.selected = new Set();
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    this.strokes.forEach((stroke, i) => {
      const inside = stroke.points.some(([x, y]) => pointInPolygon(x, y, polygon));
      if (!inside) return;
      this.selected.add(i);
      for (const [x, y] of stroke.points) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    });
    if (!this.selected.size) { this.opts.onSelect(null); return; }
    const rect = this.canvas.getBoundingClientRect();
    this.opts.onSelect({
      count: this.selected.size,
      box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      anchor: { x: ((minX + maxX) / 2) * rect.width, y: minY * rect.height },
    });
  }

  clearSelection() {
    if (!this.selected.size) return;
    this.selected = new Set();
    this.render();
  }

  deleteSelection() {
    if (!this.selected.size) return false;
    this.strokes = this.strokes.filter((_, i) => !this.selected.has(i));
    this.selected = new Set();
    this.opts.onChange(this.strokes);
    this.render();
    return true;
  }

  setStrokes(strokes) { this.strokes = strokes.slice(); this.selected = new Set(); this.render(); }

  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.render();
  }

  render() {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.strokes.forEach((stroke, i) => this._draw(stroke, this.selected.has(i)));
    if (this.live) this._draw(this.live, false);
    if (this.lasso) this._drawLasso();
  }

  _drawLasso() {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    ctx.strokeStyle = SELECT_COLOUR;
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.setLineDash([5 * this.dpr, 4 * this.dpr]);
    ctx.beginPath();
    ctx.moveTo(this.lasso[0][0] * w, this.lasso[0][1] * h);
    for (const [x, y] of this.lasso.slice(1)) ctx.lineTo(x * w, y * h);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _draw(stroke, highlighted) {
    const { ctx } = this;
    const spec = TOOLS[stroke.tool] || TOOLS.pen;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = Math.min(w, h);
    const pts = stroke.points;
    if (pts.length < 2) return;

    ctx.save();
    if (highlighted) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = SELECT_COLOUR;
      ctx.lineWidth = spec.width * scale * 3.4;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x * w, y * h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = spec.alpha;
    ctx.globalCompositeOperation = spec.composite;
    ctx.strokeStyle = stroke.colour || spec.colour;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (!spec.pressure) {
      ctx.lineWidth = spec.width * scale;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x * w, y * h);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Pressure varies along the stroke, so each segment is drawn at its own width.
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.lineWidth = spec.width * scale * (0.45 + 1.35 * ((a[2] + b[2]) / 2));
      ctx.beginPath();
      ctx.moveTo(a[0] * w, a[1] * h);
      ctx.quadraticCurveTo(a[0] * w, a[1] * h, ((a[0] + b[0]) / 2) * w, ((a[1] + b[1]) / 2) * h);
      ctx.lineTo(b[0] * w, b[1] * h);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Shape recognition, by geometry rather than by guesswork: a stroke that ends
 * where it began and covers its bounding box is an ellipse or a rectangle; one
 * that does not is a straight line. Anything ambiguous is left as drawn.
 */
function straighten(stroke) {
  const pts = stroke.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const span = Math.hypot(w, h);
  const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) < span * 0.22;

  const make = (points) => ({ ...stroke, points: points.map(([x, y]) => [x, y, 0.6]) });

  if (!closed || span < 0.02) return make([[first[0], first[1]], [last[0], last[1]]]);

  // How much of the path hugs the bounding box tells a rectangle from an ellipse.
  const onEdge = pts.filter(([x, y]) =>
    Math.min(x - minX, maxX - x) < w * 0.12 || Math.min(y - minY, maxY - y) < h * 0.12).length;
  if (onEdge / pts.length > 0.82) {
    return make([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const ellipse = [];
  for (let i = 0; i <= 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    ellipse.push([cx + (w / 2) * Math.cos(t), cy + (h / 2) * Math.sin(t)]);
  }
  return make(ellipse);
}
