/**
 * Ink.
 *
 * Written for a pen first. Strokes are stored in page coordinates (0–1 of the
 * page box) rather than pixels, so they stay sharp at any zoom and survive a
 * rotation or a window resize — which is the difference between a drawing toy and
 * something you would write a whole page of working in.
 *
 * Palm rejection is the other half. As soon as a `pen` pointer is seen the canvas
 * stops treating `touch` as drawing, so a hand resting on the glass pans instead
 * of scrawling. It is a heuristic, but it is the one that matches how people hold
 * an iPad, and it is reversible: put the pen down for a while and touch draws
 * again.
 */

export const TOOLS = {
  pen: { width: 0.0022, colour: "#1b1b1f", alpha: 1, composite: "source-over", pressure: true },
  pencil: { width: 0.0030, colour: "#3a3a44", alpha: 0.82, composite: "source-over", pressure: true },
  highlighter: { width: 0.0180, colour: "#ffd54a", alpha: 0.38, composite: "multiply", pressure: false },
};

const PEN_MEMORY_MS = 4000;

export class InkSurface {
  constructor(canvas, surface, opts) {
    this.canvas = canvas;
    this.surface = surface;           // the element that receives pointer events
    this.ctx = canvas.getContext("2d");
    this.opts = opts;                 // { onCommit, onChange, getTool, shouldDraw }
    this.strokes = [];
    this.live = null;
    this.lastPenAt = 0;
    this.activePointer = null;
    this.dpr = 1;
    this.box = { width: 1, height: 1 };
    this._bind();
  }

  _bind() {
    const c = this.surface;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => this._down(e));
    c.addEventListener("pointermove", (e) => this._move(e));
    c.addEventListener("pointerup", (e) => this._up(e));
    c.addEventListener("pointercancel", (e) => this._up(e));
    c.addEventListener("pointerleave", (e) => this._up(e));
    // A pen hovering is still a pen. Noting it early means the palm is rejected
    // before the first mark rather than after it.
    c.addEventListener("pointerenter", (e) => { if (e.pointerType === "pen") this.lastPenAt = performance.now(); });
  }

  /**
   * True when this pointer should draw rather than reach the page beneath.
   *
   * A pen always draws — that is what a pen is for, and it is why there is no
   * "drawing mode" to remember to turn on. A finger only draws when the student
   * has asked it to, so on an iPad the hand keeps working the interface while the
   * Pencil writes. That split is also the palm rejection.
   */
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
    this.activePointer = e.pointerId;
    try { this.surface.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const tool = this.opts.getTool();
    if (tool === "eraser") { this._erase(e); return; }
    const spec = TOOLS[tool] || TOOLS.pen;
    this.live = { tool, colour: spec.colour, points: [this._point(e)] };
    e.preventDefault();
  }

  _move(e) {
    if (e.pointerId !== this.activePointer) return;
    if (this.opts.getTool() === "eraser") { this._erase(e); return; }
    if (!this.live) return;
    // Coalesced events carry every sample the digitiser took between frames. Without
    // them a fast stroke is a polygon.
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    for (const sample of events.length ? events : [e]) this.live.points.push(this._point(sample));
    this.render();
    e.preventDefault();
  }

  _up(e) {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    try { this.surface.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    if (this.live && this.live.points.length > 1) {
      this.strokes.push(this.live);
      this.opts.onCommit(this.live);
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

  setStrokes(strokes) { this.strokes = strokes.slice(); this.render(); }

  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.box = { width, height };
    this.render();
  }

  render() {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const stroke of this.strokes) this._draw(stroke);
    if (this.live) this._draw(this.live);
  }

  _draw(stroke) {
    const { ctx } = this;
    const spec = TOOLS[stroke.tool] || TOOLS.pen;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = Math.min(w, h);
    const pts = stroke.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.globalAlpha = spec.alpha;
    ctx.globalCompositeOperation = spec.composite;
    ctx.strokeStyle = stroke.colour || spec.colour;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (!spec.pressure) {
      ctx.lineWidth = spec.width * scale;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Pressure varies along the stroke, so each segment is drawn at its own width.
    // Midpoint smoothing keeps the line from showing the digitiser's samples.
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const pressure = (a[2] + b[2]) / 2;
      ctx.lineWidth = spec.width * scale * (0.45 + 1.35 * pressure);
      ctx.beginPath();
      ctx.moveTo(a[0] * w, a[1] * h);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      ctx.quadraticCurveTo(a[0] * w, a[1] * h, mx * w, my * h);
      ctx.lineTo(b[0] * w, b[1] * h);
      ctx.stroke();
    }
    ctx.restore();
  }
}
