/**
 * The floating circle.
 *
 * Tap  -> shade mode (the fast path: one tap, then drag over the question).
 * Hold -> a small menu of the other ways in.
 * Drag -> move it; it snaps to the nearest side and remembers where it sat.
 *
 * It dims when untouched so it never competes with the student's
 * working, and comes back to full the moment it is touched.
 */

import { prefs } from './store.js';

const SIZE = 64;
const EDGE = 14;
const HOLD_MS = 380;
const MOVE_TOLERANCE = 9;
const IDLE_MS = 3500;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Bubble {
  constructor(el, menuEl, { onTap, onMenu } = {}) {
    this.el = el;
    this.menu = menuEl;
    this.onTap = onTap || (() => {});
    this.onMenu = onMenu || (() => {});
    this.pos = prefs.get('bubble') || { x: 0.94, y: 0.78 };
    this.idleTimer = null;

    this.#place();
    this.#bind();
    this.#scheduleIdle();

    window.addEventListener('resize', () => this.#place());
  }

  setArmed(on) {
    this.el.classList.toggle('armed', Boolean(on));
    if (on) this.wake();
  }

  wake() {
    this.el.classList.remove('idle');
    this.#scheduleIdle();
  }

  closeMenu() {
    this.menu.classList.remove('open');
  }

  /**
   * Slides the bubble out from under a panel that has just opened over it,
   * parking it just clear of the panel's edge rather than flinging it across
   * the screen — the student's thumb is already near where it was.
   */
  avoid(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const bubble = this.el.getBoundingClientRect();
    const overlaps = bubble.right > rect.left && bubble.left < rect.right &&
      bubble.bottom > rect.top && bubble.top < rect.bottom;
    if (!overlaps) return;

    const { w, h } = this.#viewport();
    if (rect.left > w * 0.35) {
      // Docked to the right: sit to its left.
      this.pos = { x: (rect.left - 12 - SIZE / 2) / w, y: this.pos.y };
    } else {
      // Bottom sheet: lift above it.
      this.pos = { x: this.pos.x, y: (rect.top - 12 - SIZE / 2) / h };
    }
    this.#place(true);
  }

  /* ---------------- internals ---------------- */

  #viewport() {
    return {
      w: window.innerWidth,
      h: window.innerHeight,
    };
  }

  #place(animate = false) {
    const { w, h } = this.#viewport();
    const x = clamp(this.pos.x * w - SIZE / 2, EDGE, w - SIZE - EDGE);
    const y = clamp(this.pos.y * h - SIZE / 2, EDGE + 56, h - SIZE - EDGE);
    this.el.style.transition = animate ? 'left 280ms var(--ease), top 280ms var(--ease)' : '';
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.#placeMenu(x, y);
  }

  #placeMenu(x, y) {
    const { w, h } = this.#viewport();
    const width = 230;
    const left = x + SIZE / 2 < w / 2 ? x : x + SIZE - width;
    const above = y > h / 2;
    this.menu.style.left = `${clamp(left, EDGE, w - width - EDGE)}px`;
    this.menu.style.width = `${width}px`;
    if (above) {
      this.menu.style.top = 'auto';
      this.menu.style.bottom = `${h - y + 10}px`;
    } else {
      this.menu.style.bottom = 'auto';
      this.menu.style.top = `${y + SIZE + 10}px`;
    }
  }

  #scheduleIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.el.classList.add('idle'), IDLE_MS);
  }

  #save() {
    prefs.set('bubble', this.pos);
  }

  #bind() {
    let start = null;
    let holdTimer = null;
    let dragged = false;
    let held = false;

    const onDown = (e) => {
      e.preventDefault();
      this.wake();
      this.el.setPointerCapture(e.pointerId);
      const rect = this.el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
      dragged = false;
      held = false;
      this.closeMenu();
      holdTimer = setTimeout(() => {
        held = true;
        navigator.vibrate?.(8);
        this.menu.classList.add('open');
      }, HOLD_MS);
    };

    const onMove = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < MOVE_TOLERANCE) return;
      dragged = true;
      clearTimeout(holdTimer);
      this.closeMenu();
      this.el.classList.add('dragging');
      const { w, h } = this.#viewport();
      const left = clamp(e.clientX - start.ox, EDGE, w - SIZE - EDGE);
      const top = clamp(e.clientY - start.oy, EDGE + 56, h - SIZE - EDGE);
      this.el.style.transition = '';
      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
    };

    const onUp = () => {
      if (!start) return;
      clearTimeout(holdTimer);
      this.el.classList.remove('dragging');

      if (dragged) {
        // Snap to whichever side is closer, keeping the vertical position.
        const { w, h } = this.#viewport();
        const rect = this.el.getBoundingClientRect();
        const centreX = rect.left + SIZE / 2;
        this.pos = {
          x: centreX < w / 2 ? (EDGE + SIZE / 2) / w : (w - EDGE - SIZE / 2) / w,
          y: (rect.top + SIZE / 2) / h,
        };
        this.#place(true);
        this.#save();
      } else if (!held) {
        this.onTap();
      }
      start = null;
      this.#scheduleIdle();
    };

    this.el.addEventListener('pointerdown', onDown);
    this.el.addEventListener('pointermove', onMove);
    this.el.addEventListener('pointerup', onUp);
    this.el.addEventListener('pointercancel', () => {
      clearTimeout(holdTimer);
      this.el.classList.remove('dragging');
      start = null;
    });

    this.menu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-act]');
      if (!item) return;
      this.closeMenu();
      this.onMenu(item.dataset.act);
    });

    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.classList.contains('open')) return;
      if (this.menu.contains(e.target) || this.el.contains(e.target)) return;
      this.closeMenu();
    });
  }
}
