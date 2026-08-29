/**
 * Wires the pieces together: board + bubble + shade mode + chat, plus pages,
 * settings and persistence.
 */

import { Board } from './board.js';
import { Bubble } from './bubble.js';
import { Shader } from './shade.js';
import { Chat } from './chat.js';
import { pages as pageStore, newPage, prefs } from './store.js';
import { serverConfig } from './api.js';

const $ = (sel) => document.querySelector(sel);

const COLORS = ['#14162b', '#4f46e5', '#e11d48', '#16a34a', '#ea580c', '#0891b2', '#7c3aed', '#a16207'];

/* ---------------- theme ---------------- */

function applyTheme() {
  const dark = prefs.get('dark');
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // Dark paper needs light ink, and vice versa, but only for the default ink.
  const ink = dark ? '#f2f3fb' : '#14162b';
  if (prefs.get('color') === '#14162b' || prefs.get('color') === '#f2f3fb') prefs.set('color', ink);
}

applyTheme();

/* ---------------- toast ---------------- */

let toastTimer = null;
function toast(message, ms = 2400) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------- app ---------------- */

class App {
  constructor() {
    this.board = new Board($('#board'), { prefs, onChange: () => this.savePage() });
    this.shader = new Shader($('#overlay'), this.board, {
      onSelection: (has) => {
        $('#shadeGo').disabled = !has;
        $('#shadeHint').textContent = has
          ? 'Looks good? Tap Ask.'
          : 'Shade over the question you need help with';
      },
    });

    this.chat = new Chat($('#chat'), { onPersist: (messages) => this.saveChat(messages) });

    this.bubble = new Bubble($('#bubble'), $('#bubbleMenu'), {
      onTap: () => this.startShading(),
      onMenu: (act) => this.runMenu(act),
    });

    this.pages = [];
    this.index = 0;
    this.saveTimer = null;

    this.#buildSwatches();
    this.#bindToolbar();
    this.#bindShadeBar();
    this.#bindPages();
    this.#bindSettings();
    this.#bindWindow();

    this.load();
  }

  /* ---------------- pages ---------------- */

  async load() {
    try {
      this.pages = await pageStore.all();
    } catch {
      this.pages = [];
    }
    if (!this.pages.length) this.pages = [newPage(0)];
    this.index = Math.min(Number(prefs.get('lastPage') || 0), this.pages.length - 1);
    this.showPage(this.index);

    if (!prefs.get('seenTip')) {
      prefs.set('seenTip', true);
      setTimeout(() => toast('Write your maths, then tap the bubble to ask about it', 5200), 700);
    }
  }

  get page() {
    return this.pages[this.index];
  }

  showPage(i) {
    this.index = Math.max(0, Math.min(i, this.pages.length - 1));
    prefs.set('lastPage', this.index);
    this.board.load(this.page);
    this.chat.load(this.page.chat);
    this.#syncPageBar();
    this.#syncUndo();
  }

  addPage() {
    this.pages.push(newPage(this.pages.length));
    this.showPage(this.pages.length - 1);
    this.savePage();
    toast('New page');
  }

  savePage() {
    this.#syncUndo();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const snapshot = this.board.serialize();
      Object.assign(this.page, snapshot, { updatedAt: Date.now(), order: this.index });
      pageStore.put({ ...this.page }).catch(() => {});
    }, 400);
  }

  saveChat(messages) {
    this.page.chat = messages;
    pageStore.put({ ...this.page }).catch(() => {});
  }

  #syncPageBar() {
    $('#pageLabel').textContent = `Page ${this.index + 1} of ${this.pages.length}`;
    $('#pagePrev').disabled = this.index === 0;
    $('#pageNext').disabled = this.index === this.pages.length - 1;
  }

  #syncUndo() {
    $('#tUndo').disabled = !this.board.canUndo;
    $('#tRedo').disabled = !this.board.canRedo;
  }

  /* ---------------- shade flow ---------------- */

  startShading() {
    this.chat.close();
    this.shader.start();
    this.bubble.setArmed(true);
    $('#shadeBar').classList.add('open');
    $('#shadeGo').disabled = true;
    $('#shadeHint').textContent = 'Shade over the question you need help with';
  }

  stopShading() {
    this.shader.stop();
    this.bubble.setArmed(false);
    $('#shadeBar').classList.remove('open');
  }

  askAboutSelection() {
    const bounds = this.shader.bounds();
    if (!bounds) return;
    const shot = this.board.captureRegion(bounds);
    this.stopShading();
    this.openChat();
    this.chat.askAbout(shot);
  }

  askAboutPage() {
    const visible = this.board.visibleWorldRect();
    const content = this.board.contentBounds();
    // Prefer the actual work if it all fits on screen; otherwise send the view.
    const rect =
      content && content.w <= visible.w * 1.05 && content.h <= visible.h * 1.05 ? content : visible;
    if (!this.board.strokes.length && !this.board.bg) {
      toast('Write something first, then ask');
      return;
    }
    const shot = this.board.captureRegion(rect, { pad: 26 });
    this.stopShading();
    this.openChat();
    this.chat.askAbout(shot, 'Can you help me with this page?');
  }

  openChat() {
    this.chat.open();
    // The panel animates in; move the bubble once it has landed.
    setTimeout(() => this.bubble.avoid($('#chat')), 340);
  }

  runMenu(act) {
    if (act === 'shade') this.startShading();
    else if (act === 'page') this.askAboutPage();
    else if (act === 'photo') $('#photoInput').click();
    else if (act === 'chat') this.openChat();
  }

  /* ---------------- ui wiring ---------------- */

  #buildSwatches() {
    const host = $('#swatches');
    for (const color of COLORS) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      b.setAttribute('aria-label', `Colour ${color}`);
      b.setAttribute('aria-pressed', String(color === this.board.color));
      b.addEventListener('click', () => {
        this.board.setColor(color);
        host.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
      });
      host.append(b);
    }

    const sizes = document.createElement('div');
    sizes.className = 'sizes';
    sizes.innerHTML = `
      <div class="size-row">
        <span style="font-size:13px;color:var(--ink-3);width:44px">Size</span>
        <input type="range" min="1" max="10" step="0.5" value="${this.board.width}" id="sizeRange">
      </div>`;
    host.append(sizes);
    sizes.querySelector('#sizeRange').addEventListener('input', (e) => {
      this.board.setWidth(Number(e.target.value));
    });
  }

  #toggleSwatches(anchor) {
    const host = $('#swatches');
    if (host.classList.contains('open')) return host.classList.remove('open');
    const r = anchor.getBoundingClientRect();
    host.style.left = `${r.right + 10}px`;
    host.style.top = `${Math.min(r.top, window.innerHeight - 220)}px`;
    host.classList.add('open');
  }

  #bindToolbar() {
    const tools = ['pen', 'marker', 'eraser', 'pan'];
    const buttons = {
      pen: $('#tPen'),
      marker: $('#tMarker'),
      eraser: $('#tEraser'),
      pan: $('#tPan'),
    };

    const select = (tool) => {
      this.board.setTool(tool);
      for (const t of tools) buttons[t].setAttribute('aria-pressed', String(t === tool));
    };

    for (const t of tools) {
      buttons[t].addEventListener('click', () => {
        // Tapping the active pen or highlighter again opens colour + size.
        if (this.board.tool === t && (t === 'pen' || t === 'marker')) this.#toggleSwatches(buttons[t]);
        else $('#swatches').classList.remove('open');
        select(t);
      });
    }

    $('#tUndo').addEventListener('click', () => this.board.undo());
    $('#tRedo').addEventListener('click', () => this.board.redo());
    $('#tFit').addEventListener('click', () => this.board.resetView());
    $('#tPhoto').addEventListener('click', () => $('#photoInput').click());
    $('#tSettings').addEventListener('click', () => $('#settings').showModal());

    $('#photoInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await downscaleImage(file);
        this.board.setBackground(dataUrl);
        toast('Photo added — write on top of it, then shade a question');
      } catch {
        toast("Couldn't read that image");
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const host = $('#swatches');
      if (!host.classList.contains('open')) return;
      if (host.contains(e.target) || e.target.closest('#toolbar')) return;
      host.classList.remove('open');
    });
  }

  #bindShadeBar() {
    $('#shadeCancel').addEventListener('click', () => this.stopShading());
    $('#shadeGo').addEventListener('click', () => this.askAboutSelection());
    $('#shadeWhole').addEventListener('click', () => this.askAboutPage());
  }

  #bindPages() {
    $('#pagePrev').addEventListener('click', () => this.showPage(this.index - 1));
    $('#pageNext').addEventListener('click', () => this.showPage(this.index + 1));
    $('#pageAdd').addEventListener('click', () => this.addPage());
    $('#pageClear').addEventListener('click', () => {
      this.board.clear();
      toast('Page cleared — undo with the arrow');
    });

    // The tutor surfaces an "Open Settings" button when no key is configured.
    $('#messages').addEventListener('click', (e) => {
      if (e.target.closest('[data-open-settings]')) $('#settings').showModal();
    });

    $('#chatClose').addEventListener('click', () => this.chat.close());
    $('#chatNew').addEventListener('click', () => {
      this.chat.reset();
      toast('Fresh conversation');
    });
  }

  #bindSettings() {
    const dialog = $('#settings');
    $('#settingsClose').addEventListener('click', () => dialog.close());

    const level = $('#setLevel');
    level.value = prefs.get('level');
    level.addEventListener('change', () => prefs.set('level', level.value));

    const model = $('#setModel');
    model.value = prefs.get('model');
    model.addEventListener('change', () => {
      prefs.set('model', model.value);
      prefs.set('modelChosen', true);
    });

    const style = $('#setStyle');
    for (const b of style.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.style === prefs.get('style')));
      b.addEventListener('click', () => {
        prefs.set('style', b.dataset.style);
        for (const other of style.querySelectorAll('button')) {
          other.setAttribute('aria-pressed', String(other === b));
        }
      });
    }

    const toggle = (el, key, after) => {
      el.setAttribute('aria-pressed', String(Boolean(prefs.get(key))));
      el.addEventListener('click', () => {
        const next = el.getAttribute('aria-pressed') !== 'true';
        el.setAttribute('aria-pressed', String(next));
        prefs.set(key, next);
        after?.(next);
      });
    };

    toggle($('#setDark'), 'dark', () => {
      applyTheme();
      this.board.bakeDirty = true;
      this.board.dirty = true;
    });
    toggle($('#setPencil'), 'pencilOnly');

    const key = $('#setKey');
    key.value = prefs.get('apiKey') || '';
    key.addEventListener('change', () => prefs.set('apiKey', key.value.trim()));

    serverConfig().then((config) => {
      if (config.hasServerKey) {
        $('#keyRow').style.display = 'none';
      }
      // Respect the server's configured model until the student picks one.
      if (config.model && !prefs.get('modelChosen')) {
        const known = [...model.options].some((o) => o.value === config.model);
        if (known) {
          model.value = config.model;
          prefs.set('model', config.model);
        }
      }
    });
  }

  #bindWindow() {
    const onResize = () => {
      this.board.resize();
      this.shader.resize();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

    document.addEventListener('keydown', (e) => {
      const typing = e.target.closest('input, textarea, select');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        e.shiftKey ? this.board.redo() : this.board.undo();
      } else if (e.key === 'Escape') {
        if (this.shader.active) this.stopShading();
        else if (this.chat.isOpen) this.chat.close();
      } else if (!typing && e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) {
        this.startShading();
      }
    });

    // Stop Safari zooming the whole app on a pinch or a double tap, while
    // leaving double-click-to-select-a-word working inside the chat.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('#stage')) e.preventDefault();
    });
  }
}

/* ---------------- helpers ---------------- */

/** Photos from an iPad camera are huge; shrink before they hit IndexedDB. */
function downscaleImage(file, maxEdge = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

window.app = new App();

if ('serviceWorker' in navigator) {
  // Resolved against this module so the app also works from a sub-path
  // (a GitHub Pages project site, say), not just the origin root.
  const swUrl = new URL('../sw.js', import.meta.url);
  window.addEventListener('load', () => navigator.serviceWorker.register(swUrl).catch(() => {}));
}
