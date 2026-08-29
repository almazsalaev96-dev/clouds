/**
 * Shade-to-ask.
 *
 * While active, an overlay canvas takes the pointer input and the student
 * scribbles over the part of their work they want help with. The marks are
 * kept in world coordinates (so they track pan/zoom) and are never written to
 * the page itself — the crop that gets sent is the clean work underneath.
 */

const HIGHLIGHT = 'rgba(255, 209, 71, 0.55)';
const EDGE = 'rgba(124, 58, 237, 0.9)';

export class Shader {
  constructor(canvas, board, { onSelection } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.onSelection = onSelection || (() => {});
    this.active = false;
    this.marks = [];
    this.live = null;
    this.dpr = 1;

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this.live = [this.#point(e)];
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !this.live) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) this.live.push(this.#point(ev));
      this.#draw();
    });

    const end = () => {
      if (!this.live) return;
      if (this.live.length > 1) this.marks.push(this.live);
      this.live = null;
      this.#draw();
      this.onSelection(this.hasSelection);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    this.resize();
  }

  get hasSelection() {
    return this.marks.length > 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    if (this.active) this.#draw();
  }

  start() {
    this.active = true;
    this.marks = [];
    this.live = null;
    document.body.classList.add('shading');
    this.#draw();
    this.onSelection(false);
  }

  stop() {
    this.active = false;
    this.marks = [];
    this.live = null;
    document.body.classList.remove('shading');
    this.#clear();
  }

  /** Bounding box of everything shaded, in world coordinates. */
  bounds() {
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };
    for (const mark of this.marks) {
      for (const p of mark) {
        min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y);
        max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y);
      }
    }
    if (!Number.isFinite(min.x)) return null;
    const grow = 14 / this.board.view.scale; // the brush has width; include it
    return {
      x: min.x - grow,
      y: min.y - grow,
      w: max.x - min.x + grow * 2,
      h: max.y - min.y + grow * 2,
    };
  }

  #point(e) {
    const r = this.canvas.getBoundingClientRect();
    return this.board.toWorld(e.clientX - r.left, e.clientY - r.top);
  }

  #clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  #draw() {
    const ctx = this.ctx;
    this.#clear();
    ctx.scale(this.dpr, this.dpr);

    const view = this.board.view;
    ctx.save();
    ctx.translate(-view.x * view.scale, -view.y * view.scale);
    ctx.scale(view.scale, view.scale);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = 30 / view.scale;
    const all = this.live ? [...this.marks, this.live] : this.marks;
    for (const mark of all) {
      if (mark.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(mark[0].x, mark[0].y);
      for (let i = 1; i < mark.length; i++) ctx.lineTo(mark[i].x, mark[i].y);
      ctx.stroke();
    }
    ctx.restore();

    // Dashed frame showing exactly what will be sent.
    const b = this.bounds();
    if (b && !this.live) {
      const a = this.board.toScreen(b.x, b.y);
      const c = this.board.toScreen(b.x + b.w, b.y + b.h);
      const pad = 10;
      ctx.save();
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      const x = a.x - pad;
      const y = a.y - pad;
      const w = c.x - a.x + pad * 2;
      const h = c.y - a.y + pad * 2;
      const radius = 12;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
      else ctx.rect(x, y, w, h);
      ctx.stroke();
      ctx.restore();
    }
  }
}
