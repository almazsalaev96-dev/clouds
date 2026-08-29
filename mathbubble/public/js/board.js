/**
 * The writing surface.
 *
 * Strokes are stored in world coordinates so pan/zoom never degrades them.
 * Committed strokes are baked into an offscreen canvas; only the stroke being
 * drawn is re-rendered each frame. While a pan or pinch is in flight the baked
 * layer is simply transformed (cheap) and re-baked once the gesture settles.
 */

const GRID = 28; // world units between grid dots
const MAX_CAPTURE_EDGE = 1500; // keeps the uploaded crop inside Anthropic's sweet spot

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

let strokeSeq = 0;

export class Board {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = opts.onChange || (() => {});
    this.prefs = opts.prefs;

    this.view = { x: 0, y: 0, scale: 1 }; // world point at screen origin, plus zoom
    this.strokes = [];
    this.history = [];
    this.future = [];

    this.tool = 'pen';
    this.color = this.prefs?.get('color') || '#14162b';
    this.width = this.prefs?.get('penWidth') || 3;

    this.bg = null; // { img, src, rect }

    this.pointers = new Map();
    this.live = null;
    this.gesture = null;
    this.sawPen = false;

    this.baked = document.createElement('canvas');
    this.bakedCtx = this.baked.getContext('2d');
    this.bakedView = { ...this.view };
    this.bakeDirty = true;

    this.dirty = true;
    this.dpr = 1;

    this.#bindPointers();
    this.resize();
    this.#loop();
  }

  /* ---------------- geometry ---------------- */

  toWorld(sx, sy) {
    return { x: sx / this.view.scale + this.view.x, y: sy / this.view.scale + this.view.y };
  }

  toScreen(wx, wy) {
    return { x: (wx - this.view.x) * this.view.scale, y: (wy - this.view.y) * this.view.scale };
  }

  visibleWorldRect() {
    const a = this.toWorld(0, 0);
    const b = this.toWorld(this.cssW, this.cssH);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  contentBounds() {
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };
    const eat = (x, y) => {
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y);
    };
    for (const s of this.strokes) for (const p of s.points) eat(p.x, p.y);
    if (this.bg) {
      eat(this.bg.rect.x, this.bg.rect.y);
      eat(this.bg.rect.x + this.bg.rect.w, this.bg.rect.y + this.bg.rect.h);
    }
    if (!Number.isFinite(min.x)) return null;
    return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
  }

  /* ---------------- sizing ---------------- */

  resize() {
    const r = this.canvas.getBoundingClientRect();
    // Cached so the render and input paths never force a layout read.
    this.cssW = r.width;
    this.cssH = r.height;
    this.originX = r.left;
    this.originY = r.top;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.baked.width = this.canvas.width;
    this.baked.height = this.canvas.height;
    this.bakeDirty = true;
    this.dirty = true;
  }

  /* ---------------- state ---------------- */

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
    this.prefs?.set('color', color);
  }

  setWidth(width) {
    this.width = width;
    this.prefs?.set('penWidth', width);
  }

  load(page) {
    this.strokes = (page.strokes || []).map((s) => ({ ...s, id: s.id ?? ++strokeSeq }));
    this.history = [];
    this.future = [];
    this.bg = null;
    this.view = { x: 0, y: 0, scale: 1 };
    this.bakeDirty = true;
    this.dirty = true;
    if (page.bg) this.setBackground(page.bg.src, page.bg.rect, { silent: true });
  }

  serialize() {
    return {
      strokes: this.strokes.map(({ id, ...rest }) => rest),
      bg: this.bg ? { src: this.bg.src, rect: this.bg.rect } : null,
    };
  }

  setBackground(src, rect = null, { silent = false } = {}) {
    const img = new Image();
    img.onload = () => {
      let placed = rect;
      if (!placed) {
        // Fit the photo to the visible page, leaving a margin to write in.
        const v = this.visibleWorldRect();
        const scale = Math.min((v.w * 0.9) / img.width, (v.h * 0.86) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        placed = { x: v.x + (v.w - w) / 2, y: v.y + v.h * 0.05, w, h };
      }
      this.bg = { img, src, rect: placed };
      this.bakeDirty = true;
      this.dirty = true;
      if (!silent) this.onChange();
    };
    img.src = src;
  }

  clear() {
    if (!this.strokes.length && !this.bg) return;
    this.history.push({ kind: 'clear', strokes: this.strokes, bg: this.bg });
    this.future = [];
    this.strokes = [];
    this.bg = null;
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  undo() {
    const op = this.history.pop();
    if (!op) return;
    if (op.kind === 'add') this.strokes = this.strokes.filter((s) => s.id !== op.stroke.id);
    else if (op.kind === 'erase') this.strokes = op.before;
    else if (op.kind === 'clear') { this.strokes = op.strokes; this.bg = op.bg; }
    else if (op.kind === 'bg') this.bg = op.before;
    this.future.push(op);
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  redo() {
    const op = this.future.pop();
    if (!op) return;
    if (op.kind === 'add') this.strokes.push(op.stroke);
    else if (op.kind === 'erase') this.strokes = op.after;
    else if (op.kind === 'clear') { this.strokes = []; this.bg = null; }
    else if (op.kind === 'bg') this.bg = op.after;
    this.history.push(op);
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.future.length > 0; }

  resetView() {
    const bounds = this.contentBounds();
    if (!bounds || bounds.w < 1 || bounds.h < 1) {
      this.view = { x: 0, y: 0, scale: 1 };
    } else {
      const pad = 40;
      const scale = clamp(
        Math.min((this.cssW - pad * 2) / bounds.w, (this.cssH - pad * 2) / bounds.h),
        0.2,
        2
      );
      this.view = {
        scale,
        x: bounds.x + bounds.w / 2 - this.cssW / (2 * scale),
        y: bounds.y + bounds.h / 2 - this.cssH / (2 * scale),
      };
    }
    this.bakeDirty = true;
    this.dirty = true;
  }

  /* ---------------- input ---------------- */

  #ignoreTouchDrawing() {
    return this.prefs?.get('pencilOnly') || this.sawPen;
  }

  #bindPointers() {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('shading')) return;
      c.setPointerCapture(e.pointerId);
      if (e.pointerType === 'pen') this.sawPen = true;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      if (this.pointers.size >= 2) {
        this.#abortLive();
        this.#startGesture();
        return;
      }

      const wantsPan =
        this.tool === 'pan' ||
        e.pointerType === 'mouse' && e.button === 1 ||
        (e.pointerType === 'touch' && this.#ignoreTouchDrawing());

      if (wantsPan) {
        this.panFrom = { sx: e.clientX, sy: e.clientY, view: { ...this.view } };
        return;
      }

      if (this.tool === 'eraser') {
        this.eraseBefore = this.strokes.slice();
        this.erasing = true;
        this.#eraseAt(e.clientX, e.clientY);
        return;
      }

      this.live = {
        id: ++strokeSeq,
        tool: this.tool,
        color: this.color,
        width: this.tool === 'marker' ? this.width * 5 : this.width,
        points: [this.#point(e)],
      };
      this.dirty = true;
    });

    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      if (this.gesture) return this.#updateGesture();

      if (this.panFrom) {
        const dx = (e.clientX - this.panFrom.sx) / this.view.scale;
        const dy = (e.clientY - this.panFrom.sy) / this.view.scale;
        this.view.x = this.panFrom.view.x - dx;
        this.view.y = this.panFrom.view.y - dy;
        this.dirty = true;
        return;
      }

      if (this.erasing) return this.#eraseAt(e.clientX, e.clientY);

      if (this.live) {
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of events.length ? events : [e]) this.live.points.push(this.#point(ev));
        this.dirty = true;
      }
    });

    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.gesture && this.pointers.size < 2) {
        this.gesture = null;
        this.bakeDirty = true;
        this.dirty = true;
      }
      if (this.panFrom) {
        this.panFrom = null;
        this.bakeDirty = true;
        this.dirty = true;
      }
      if (this.erasing && this.pointers.size === 0) {
        this.erasing = false;
        if (this.eraseBefore && this.eraseBefore.length !== this.strokes.length) {
          this.history.push({ kind: 'erase', before: this.eraseBefore, after: this.strokes.slice() });
          this.future = [];
          this.onChange();
        }
        this.eraseBefore = null;
      }
      if (this.live && this.pointers.size === 0) this.#commitLive();
    };

    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          this.#zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
        } else {
          this.view.x += e.deltaX / this.view.scale;
          this.view.y += e.deltaY / this.view.scale;
          this.bakeDirty = true;
          this.dirty = true;
        }
      },
      { passive: false }
    );
  }

  /** Client coordinates -> world coordinates. */
  #at(clientX, clientY) {
    return this.toWorld(clientX - this.originX, clientY - this.originY);
  }

  #point(e) {
    const w = this.#at(e.clientX, e.clientY);
    // Mouse and most touch report 0 or 0.5 pressure; treat those as "normal".
    const raw = e.pressure;
    const p = e.pointerType === 'pen' && raw > 0 ? clamp(raw, 0.08, 1) : 0.5;
    return { x: w.x, y: w.y, p };
  }

  #commitLive() {
    const s = this.live;
    this.live = null;
    if (!s) return;
    if (s.points.length === 1) s.points.push({ ...s.points[0], x: s.points[0].x + 0.6 });
    this.strokes.push(s);
    this.history.push({ kind: 'add', stroke: s });
    this.future = [];
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  #abortLive() {
    this.live = null;
    this.dirty = true;
  }

  #eraseAt(clientX, clientY) {
    const w = this.#at(clientX, clientY);
    const radius = (this.width * 6) / this.view.scale;
    const before = this.strokes.length;
    this.strokes = this.strokes.filter((s) => !this.#strokeNear(s, w, radius));
    if (this.strokes.length !== before) {
      this.bakeDirty = true;
      this.dirty = true;
    }
  }

  #strokeNear(stroke, w, radius) {
    const r2 = radius * radius;
    const pts = stroke.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1e-6;
      const t = clamp(((w.x - a.x) * vx + (w.y - a.y) * vy) / len2, 0, 1);
      const dx = a.x + t * vx - w.x;
      const dy = a.y + t * vy - w.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  #startGesture() {
    const pts = [...this.pointers.values()];
    this.panFrom = null;
    this.erasing = false;
    this.gesture = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      view: { ...this.view },
    };
  }

  #updateGesture() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const g = this.gesture;
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const scale = clamp(g.view.scale * (dist / g.dist), 0.15, 8);

    // Keep the world point under the initial midpoint pinned to the current one.
    const anchor = {
      x: (g.mid.x - this.originX) / g.view.scale + g.view.x,
      y: (g.mid.y - this.originY) / g.view.scale + g.view.y,
    };
    this.view.scale = scale;
    this.view.x = anchor.x - (mid.x - this.originX) / scale;
    this.view.y = anchor.y - (mid.y - this.originY) / scale;
    this.dirty = true;
  }

  #zoomAt(clientX, clientY, factor) {
    const before = this.#at(clientX, clientY);
    this.view.scale = clamp(this.view.scale * factor, 0.15, 8);
    const after = this.#at(clientX, clientY);
    this.view.x += before.x - after.x;
    this.view.y += before.y - after.y;
    this.bakeDirty = true;
    this.dirty = true;
  }

  /* ---------------- painting ---------------- */

  #paintStroke(ctx, stroke, scale, forPrint = false) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    let color = stroke.color;
    if (forPrint && luminance(color) > 0.62) color = '#14162b'; // dark-mode ink → readable on white

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    if (stroke.tool === 'marker') {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = stroke.width * scale;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Pen: per-segment width so Apple Pencil pressure shows through, with
    // midpoint smoothing so fast strokes don't look faceted.
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.4, stroke.width * ((a.p + b.p) / 2) * 1.8 * scale);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const prev = pts[i - 2] || a;
      ctx.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
      ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  #paintPaper(ctx, w, h) {
    const styles = getComputedStyle(document.documentElement);
    ctx.fillStyle = styles.getPropertyValue('--paper').trim() || '#fff';
    ctx.fillRect(0, 0, w, h);

    const s = this.view.scale;
    if (s < 0.45) return;
    ctx.fillStyle = styles.getPropertyValue('--rule').trim() || '#e3e6f0';
    const step = GRID * s;
    const ox = -((this.view.x * s) % step);
    const oy = -((this.view.y * s) % step);
    const r = s > 1.6 ? 1.4 : 1;
    for (let y = oy; y < h + step; y += step) {
      for (let x = ox; x < w + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  #bake() {
    const ctx = this.bakedCtx;
    const { width, height } = this.baked;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.scale(this.dpr, this.dpr);

    this.#paintPaper(ctx, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(-this.view.x * this.view.scale, -this.view.y * this.view.scale);
    ctx.scale(this.view.scale, this.view.scale);
    if (this.bg?.img) {
      ctx.drawImage(this.bg.img, this.bg.rect.x, this.bg.rect.y, this.bg.rect.w, this.bg.rect.h);
    }
    for (const s of this.strokes) this.#paintStroke(ctx, s, 1);
    ctx.restore();

    this.bakedView = { ...this.view };
    this.bakeDirty = false;
  }

  #render() {
    const ctx = this.ctx;
    if (this.bakeDirty && !this.gesture && !this.panFrom) this.#bake();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(this.dpr, this.dpr);

    // Reproject the baked layer if the view moved since it was baked.
    const bv = this.bakedView;
    const k = this.view.scale / bv.scale;
    if (Math.abs(k - 1) > 1e-4 || bv.x !== this.view.x || bv.y !== this.view.y) {
      this.#paintPaper(ctx, this.cssW, this.cssH);
      ctx.save();
      ctx.translate((bv.x - this.view.x) * this.view.scale, (bv.y - this.view.y) * this.view.scale);
      ctx.scale(k, k);
      ctx.drawImage(this.baked, 0, 0, this.cssW, this.cssH);
      ctx.restore();
    } else {
      ctx.drawImage(this.baked, 0, 0, this.cssW, this.cssH);
    }

    if (this.live) {
      ctx.save();
      ctx.translate(-this.view.x * this.view.scale, -this.view.y * this.view.scale);
      ctx.scale(this.view.scale, this.view.scale);
      this.#paintStroke(ctx, this.live, 1);
      ctx.restore();
    }
    this.dirty = false;
  }

  #loop() {
    const tick = () => {
      if (this.dirty || (this.bakeDirty && !this.gesture && !this.panFrom)) this.#render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- capture ---------------- */

  /**
   * Renders a world-space rectangle to a PNG data URL, always on white with
   * dark ink so the model reads it as cleanly as a scan.
   */
  captureRegion(rect, { pad = 18, minSize = 140 } = {}) {
    const w = Math.max(rect.w, minSize) + pad * 2;
    const h = Math.max(rect.h, minSize) + pad * 2;
    const x = rect.x - pad - (Math.max(rect.w, minSize) - rect.w) / 2;
    const y = rect.y - pad - (Math.max(rect.h, minSize) - rect.h) / 2;

    const scale = Math.min(2.4, MAX_CAPTURE_EDGE / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * scale));
    cv.height = Math.max(1, Math.round(h * scale));
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);

    if (this.bg?.img) ctx.drawImage(this.bg.img, this.bg.rect.x, this.bg.rect.y, this.bg.rect.w, this.bg.rect.h);
    for (const s of this.strokes) this.#paintStroke(ctx, s, 1, true);

    return cv.toDataURL('image/png');
  }
}
