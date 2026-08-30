/**
 * The writing surface.
 *
 * Strokes are stored in world coordinates so pan/zoom never degrades them.
 * Committed strokes are baked into an offscreen canvas; only the stroke being
 * drawn is re-rendered each frame. While a pan or pinch is in flight the baked
 * layer is simply transformed (cheap) and re-baked once the gesture settles.
 */

import { recognizeShape } from './shapes.js';

const GRID = 28; // world units between grid dots
const MAX_CAPTURE_EDGE = 1500; // keeps the uploaded crop inside Anthropic's sweet spot

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

const TEXT_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
const LINE_HEIGHT = 1.35;

/**
 * Size of a text box in world units. Canvas measureText needs a context, so
 * one throwaway context is kept here rather than created per call.
 */
let measureCtx = null;
function textMetrics(item) {
  const lines = String(item.text || '').split('\n');
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${item.size}px ${TEXT_FONT}`;
  let width = 0;
  for (const line of lines) width = Math.max(width, measureCtx.measureText(line).width);
  return {
    width: Math.max(width, item.size * 0.6),
    height: lines.length * item.size * LINE_HEIGHT,
    ascent: item.size * 0.82,
    lines,
  };
}

/** Standard ray cast, for deciding what a lasso loop enclosed. */
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
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
    this.texts = []; // typed text boxes: { id, x, y, text, size, color }
    this.history = [];
    this.future = [];
    this.template = 'dots';

    // Lasso selection. Holds ids from both strokes and texts; both carry ids
    // from the same counter so one Set can address either.
    this.selection = new Set();
    this.lasso = null; // world-space points while the loop is being drawn
    this.onSelectionChange = opts.onSelectionChange || (() => {});
    this.onTextEdit = opts.onTextEdit || (() => {});

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
    for (const t of this.texts) {
      const m = textMetrics(t);
      eat(t.x, t.y - m.ascent);
      eat(t.x + m.width, t.y - m.ascent + m.height);
    }
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
    this.texts = (page.texts || []).map((t) => ({ ...t, id: t.id ?? ++strokeSeq }));
    this.template = page.template || 'dots';
    this.clearSelection();
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
      texts: this.texts.map(({ id, ...rest }) => rest),
      template: this.template,
      bg: this.bg ? { src: this.bg.src, rect: this.bg.rect } : null,
    };
  }

  setTemplate(name) {
    this.template = name;
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
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
    if (!this.strokes.length && !this.texts.length && !this.bg) return;
    this.history.push({ kind: 'clear', strokes: this.strokes, texts: this.texts, bg: this.bg });
    this.future = [];
    this.strokes = [];
    this.texts = [];
    this.clearSelection();
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
    else if (op.kind === 'clear') { this.strokes = op.strokes; this.texts = op.texts || []; this.bg = op.bg; }
    else if (op.kind === 'bg') this.bg = op.before;
    else if (op.kind === 'snap') { op.stroke.points = op.raw; delete op.stroke.shape; }
    else if (op.kind === 'items') { this.strokes = op.beforeStrokes; this.texts = op.beforeTexts; }
    else if (op.kind === 'move') this.#shiftItems(op.ids, -op.dx, -op.dy);
    else if (op.kind === 'text') { this.texts = op.before; }
    this.clearSelection();
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
    else if (op.kind === 'clear') { this.strokes = []; this.texts = []; this.bg = null; }
    else if (op.kind === 'bg') this.bg = op.after;
    else if (op.kind === 'snap') { op.stroke.points = op.ideal; op.stroke.shape = op.shape; }
    else if (op.kind === 'items') { this.strokes = op.afterStrokes; this.texts = op.afterTexts; }
    else if (op.kind === 'move') this.#shiftItems(op.ids, op.dx, op.dy);
    else if (op.kind === 'text') { this.texts = op.after; }
    this.clearSelection();
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

      if (this.tool === 'text') {
        const world = this.#at(e.clientX, e.clientY);
        // Hand the pointer back and open the editor on the next frame: focusing
        // a textarea while the canvas still holds pointer capture makes focus
        // bounce back on release, blurring the editor and committing it empty.
        try { c.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        this.pointers.delete(e.pointerId);
        const item = this.textAt(world) || this.addText(world);
        requestAnimationFrame(() => this.onTextEdit(item));
        return;
      }

      if (this.tool === 'lasso') {
        const world = this.#at(e.clientX, e.clientY);
        const bounds = this.selectionBounds();
        // Pressing inside an existing selection moves it; anywhere else
        // starts a new loop.
        if (bounds && world.x >= bounds.x - 8 && world.x <= bounds.x + bounds.w + 8 &&
            world.y >= bounds.y - 8 && world.y <= bounds.y + bounds.h + 8) {
          this.moving = { from: world, total: { dx: 0, dy: 0 }, ids: [...this.selection] };
        } else {
          this.clearSelection();
          this.lasso = [world];
          this.dirty = true;
        }
        return;
      }

      const start = this.#point(e);
      if (this.tool === 'line') start.p = 0.5; // uniform weight along a ruled line
      this.live = {
        id: ++strokeSeq,
        tool: this.tool,
        color: this.color,
        width: this.tool === 'marker' ? this.width * 5 : this.width,
        points: [start],
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

      if (this.lasso) {
        this.lasso.push(this.#at(e.clientX, e.clientY));
        this.dirty = true;
        return;
      }

      if (this.moving) {
        const world = this.#at(e.clientX, e.clientY);
        const dx = world.x - this.moving.from.x;
        const dy = world.y - this.moving.from.y;
        this.#shiftItems(this.moving.ids, dx, dy);
        this.moving.total.dx += dx;
        this.moving.total.dy += dy;
        this.moving.from = world;
        this.onSelectionChange?.(this);
        return;
      }

      if (this.live) {
        if (this.live.tool === 'line') {
          // A ruler, not a pen: always exactly the anchor and the current point.
          this.live.points = [this.live.points[0], this.#point(e)];
        } else {
          const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
          for (const ev of events.length ? events : [e]) this.live.points.push(this.#point(ev));
        }
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
      if (this.lasso && this.pointers.size === 0) {
        this.#applyLasso();
        this.lasso = null;
        this.dirty = true;
      }
      if (this.moving && this.pointers.size === 0) {
        const { ids, total } = this.moving;
        this.moving = null;
        if (Math.abs(total.dx) > 0.5 || Math.abs(total.dy) > 0.5) {
          this.history.push({ kind: 'move', ids, dx: total.dx, dy: total.dy });
          this.future = [];
          this.onChange();
        }
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

    // Shape snapping, as its own history step after the add, so the first
    // undo returns the stroke exactly as drawn and only a second undo
    // removes it — the behaviour people expect from note apps.
    if (this.tool === 'pen' && this.prefs?.get('snapShapes')) {
      const raw = s.points;
      // Recognition works in world units, so the threshold has to as well:
      // a shape that looks small on screen while zoomed out is still large.
      const shape = recognizeShape(raw, { minSize: 24 / this.view.scale });
      if (shape) {
        const pressure = raw.reduce((a, p) => a + (p.p ?? 0.5), 0) / raw.length;
        const ideal = shape.points.map((p) => ({ x: p.x, y: p.y, p: pressure }));
        if (shape.closed) ideal.push({ ...ideal[0] });
        s.points = ideal;
        s.shape = shape.type;
        this.history.push({ kind: 'snap', stroke: s, raw, ideal, shape: shape.type });
      }
    }

    this.future = [];
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  /* ---------------- selection ---------------- */

  clearSelection() {
    if (!this.selection.size) return;
    this.selection.clear();
    this.bakeDirty = true;
    this.dirty = true;
    this.onSelectionChange?.(this);
  }

  get selectedItems() {
    return [
      ...this.strokes.filter((s) => this.selection.has(s.id)),
      ...this.texts.filter((t) => this.selection.has(t.id)),
    ];
  }

  /** Bounding box of the current selection, in world units. */
  selectionBounds() {
    if (!this.selection.size) return null;
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };
    const eat = (x, y) => {
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y);
    };
    for (const s of this.strokes) {
      if (!this.selection.has(s.id)) continue;
      for (const p of s.points) eat(p.x, p.y);
    }
    for (const t of this.texts) {
      if (!this.selection.has(t.id)) continue;
      const m = textMetrics(t);
      eat(t.x, t.y - m.ascent);
      eat(t.x + m.width, t.y - m.ascent + m.height);
    }
    if (!Number.isFinite(min.x)) return null;
    return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
  }

  #shiftItems(ids, dx, dy) {
    for (const s of this.strokes) {
      if (!ids.includes(s.id)) continue;
      for (const p of s.points) { p.x += dx; p.y += dy; }
    }
    for (const t of this.texts) {
      if (!ids.includes(t.id)) continue;
      t.x += dx;
      t.y += dy;
    }
    this.bakeDirty = true;
    this.dirty = true;
  }

  deleteSelection() {
    if (!this.selection.size) return;
    const beforeStrokes = this.strokes.slice();
    const beforeTexts = this.texts.slice();
    this.strokes = this.strokes.filter((s) => !this.selection.has(s.id));
    this.texts = this.texts.filter((t) => !this.selection.has(t.id));
    this.history.push({
      kind: 'items',
      beforeStrokes, beforeTexts,
      afterStrokes: this.strokes.slice(), afterTexts: this.texts.slice(),
    });
    this.future = [];
    this.clearSelection();
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  duplicateSelection(offset = 24) {
    if (!this.selection.size) return;
    const beforeStrokes = this.strokes.slice();
    const beforeTexts = this.texts.slice();
    const copies = new Set();
    for (const src of this.strokes.filter((s) => this.selection.has(s.id))) {
      const copy = { ...src, id: ++strokeSeq, points: src.points.map((p) => ({ ...p, x: p.x + offset, y: p.y + offset })) };
      this.strokes.push(copy);
      copies.add(copy.id);
    }
    for (const src of this.texts.filter((t) => this.selection.has(t.id))) {
      const copy = { ...src, id: ++strokeSeq, x: src.x + offset, y: src.y + offset };
      this.texts.push(copy);
      copies.add(copy.id);
    }
    this.history.push({
      kind: 'items',
      beforeStrokes, beforeTexts,
      afterStrokes: this.strokes.slice(), afterTexts: this.texts.slice(),
    });
    this.future = [];
    this.selection = copies;
    this.bakeDirty = true;
    this.dirty = true;
    this.onSelectionChange?.(this);
    this.onChange();
  }

  recolorSelection(color) {
    if (!this.selection.size) return;
    const beforeStrokes = this.strokes.map((s) => ({ ...s }));
    const beforeTexts = this.texts.map((t) => ({ ...t }));
    for (const s of this.strokes) if (this.selection.has(s.id)) s.color = color;
    for (const t of this.texts) if (this.selection.has(t.id)) t.color = color;
    this.history.push({
      kind: 'items',
      beforeStrokes, beforeTexts,
      afterStrokes: this.strokes.map((s) => ({ ...s })), afterTexts: this.texts.map((t) => ({ ...t })),
    });
    this.future = [];
    this.bakeDirty = true;
    this.dirty = true;
    this.onChange();
  }

  /* ---------------- text ---------------- */

  textAt(world, slack = 8) {
    // Topmost first, so the most recently added text wins an overlap.
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      const m = textMetrics(t);
      if (
        world.x >= t.x - slack && world.x <= t.x + m.width + slack &&
        world.y >= t.y - m.ascent - slack && world.y <= t.y - m.ascent + m.height + slack
      ) return t;
    }
    return null;
  }

  /**
   * A new, detached text box. Deliberately NOT added to `texts` yet —
   * commitText adds it only once it has content, so opening a box and
   * tapping away leaves nothing behind instead of leaking an empty one
   * into the page and into storage.
   */
  addText(world) {
    return {
      id: ++strokeSeq,
      x: world.x,
      y: world.y,
      text: '',
      size: Math.max(14, this.width * 5),
      color: this.color,
    };
  }

  /** Commits an edit to a text box; empty text removes it entirely. */
  commitText(item, value) {
    const before = this.texts.map((t) => ({ ...t }));
    const text = String(value ?? '').replace(/\s+$/, '');
    if (!text) this.texts = this.texts.filter((t) => t.id !== item.id);
    else {
      const target = this.texts.find((t) => t.id === item.id);
      if (target) target.text = text;
      else this.texts.push({ ...item, text });
    }
    const after = this.texts.map((t) => ({ ...t }));
    // A no-op edit (opened a box, typed nothing, tapped away) shouldn't
    // occupy an undo step.
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      this.history.push({ kind: 'text', before, after });
      this.future = [];
      this.onChange();
    }
    this.bakeDirty = true;
    this.dirty = true;
  }

  /** Selects everything the finished loop mostly encloses. */
  #applyLasso() {
    const poly = this.lasso;
    if (!poly || poly.length < 3) return;
    const picked = new Set();

    for (const stroke of this.strokes) {
      const inside = stroke.points.filter((p) => pointInPolygon(p, poly)).length;
      // "Mostly inside" rather than "entirely inside": people loop roughly
      // around what they want and clip the odd tail of a descender.
      if (inside / stroke.points.length >= 0.6) picked.add(stroke.id);
    }
    for (const t of this.texts) {
      const m = textMetrics(t);
      const centre = { x: t.x + m.width / 2, y: t.y - m.ascent + m.height / 2 };
      if (pointInPolygon(centre, poly)) picked.add(t.id);
    }

    this.selection = picked;
    this.bakeDirty = true;
    this.onSelectionChange?.(this);
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
    this.lasso = null;
    this.moving = null;
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

    // A snapped shape is geometry, not handwriting: draw it as one continuous
    // path at a uniform width. The midpoint smoothing below starts the path
    // half a segment in, which on a closed shape leaves a visible notch where
    // it comes back round, and pressure variation makes a "clean" shape look
    // anything but.
    if (stroke.shape) {
      ctx.lineWidth = Math.max(0.4, stroke.width * 0.9 * scale);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (stroke.shape !== 'line') ctx.closePath();
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
    const paper = styles.getPropertyValue('--paper').trim() || '#fff';
    const rule = styles.getPropertyValue('--rule').trim() || '#e3e6f0';
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    const template = this.template || 'dots';
    if (template === 'plain') return;

    const s = this.view.scale;
    if (s < 0.45) return; // ruling becomes visual noise when zoomed far out

    const step = GRID * s;
    const ox = -((this.view.x * s) % step);
    const oy = -((this.view.y * s) % step);

    ctx.save();
    ctx.fillStyle = rule;
    ctx.strokeStyle = rule;

    if (template === 'dots') {
      const r = s > 1.6 ? 1.4 : 1;
      for (let y = oy; y < h + step; y += step) {
        for (let x = ox; x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (template === 'lines' || template === 'grid' || template === 'graph') {
      // Ruled lines share the horizontal pass; grid/graph add verticals, and
      // graph darkens every fifth line the way squared paper does.
      const major = template === 'graph' ? 5 : 0;
      ctx.lineWidth = 1;
      const startRow = Math.floor(this.view.y / GRID);
      let row = startRow;
      for (let y = oy; y < h + step; y += step, row++) {
        ctx.globalAlpha = major && row % major === 0 ? 1 : 0.55;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.stroke();
      }
      if (template !== 'lines') {
        const startCol = Math.floor(this.view.x / GRID);
        let col = startCol;
        for (let x = ox; x < w + step; x += step, col++) {
          ctx.globalAlpha = major && col % major === 0 ? 1 : 0.55;
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, h);
          ctx.stroke();
        }
      }
    } else if (template === 'music') {
      // Staves of five lines, repeating every eight grid rows.
      const staffGap = GRID * s * 0.42;
      const blockStep = step * 8;
      const startBlock = -((this.view.y * s) % blockStep);
      ctx.lineWidth = 1;
      for (let top = startBlock; top < h + blockStep; top += blockStep) {
        for (let i = 0; i < 5; i++) {
          const y = Math.round(top + i * staffGap) + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /** Text boxes, drawn in world space. */
  #paintTexts(ctx, forPrint = false) {
    for (const t of this.texts) {
      if (!t.text) continue;
      let color = t.color || '#14162b';
      if (forPrint && luminance(color) > 0.62) color = '#14162b';
      const m = textMetrics(t);
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${t.size}px ${TEXT_FONT}`;
      ctx.textBaseline = 'alphabetic';
      m.lines.forEach((line, i) => ctx.fillText(line, t.x, t.y + i * t.size * LINE_HEIGHT));
      ctx.restore();
    }
  }

  /** Selection highlight + the loop being drawn, in world space. */
  #paintSelection(ctx) {
    if (this.selection.size) {
      ctx.save();
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.9)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of this.strokes) {
        if (!this.selection.has(stroke.id) || stroke.points.length < 2) continue;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = (stroke.width + 8) / this.view.scale + stroke.width;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        ctx.stroke();
      }
      ctx.restore();

      const b = this.selectionBounds();
      if (b) {
        const pad = 10 / this.view.scale;
        ctx.save();
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.9)';
        ctx.lineWidth = 1.5 / this.view.scale;
        ctx.setLineDash([6 / this.view.scale, 5 / this.view.scale]);
        ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
        ctx.restore();
      }
    }

    if (this.lasso && this.lasso.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.85)';
      ctx.fillStyle = 'rgba(124, 58, 237, 0.08)';
      ctx.lineWidth = 1.5 / this.view.scale;
      ctx.setLineDash([6 / this.view.scale, 5 / this.view.scale]);
      ctx.beginPath();
      ctx.moveTo(this.lasso[0].x, this.lasso[0].y);
      for (const p of this.lasso.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
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
    this.#paintTexts(ctx);
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

    if (this.live || this.selection.size || this.lasso) {
      ctx.save();
      ctx.translate(-this.view.x * this.view.scale, -this.view.y * this.view.scale);
      ctx.scale(this.view.scale, this.view.scale);
      if (this.live) this.#paintStroke(ctx, this.live, 1);
      this.#paintSelection(ctx);
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
    this.#paintTexts(ctx, true);

    return cv.toDataURL('image/png');
  }
}
