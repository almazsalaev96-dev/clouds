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
import { strokesThumbnail } from './thumbnail.js';
import { listVoices, DEFAULT_VOICE } from './voice.js';

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
    this.board = new Board($('#board'), {
      prefs,
      onChange: () => this.savePage(),
      onSelectionChange: () => this.#syncSelectionBar(),
      onTextEdit: (item) => this.editText(item),
    });
    this.shader = new Shader($('#overlay'), this.board, {
      onSelection: (has) => {
        $('#shadeGo').disabled = !has;
        $('#shadeHint').textContent = has
          ? 'Looks good? Tap Ask.'
          : 'Shade over the question you need help with';
      },
    });

    this.chat = new Chat($('#chat'), {
      onPersist: (messages) => this.saveChat(messages),
      onVoiceError: (message) => toast(message),
    });

    this.bubble = new Bubble($('#bubble'), $('#bubbleMenu'), {
      onTap: () => this.startShading(),
      onMenu: (act) => this.runMenu(act),
    });

    this.pages = [];
    this.index = 0;
    this.saveTimer = null;
    this.hasLoadedPage = false; // guards showPage's flush — see there

    this.#buildSwatches();
    this.#bindToolbar();
    this.#bindShadeBar();
    this.#bindPages();
    this.#bindSettings();
    this.#bindWindow();
    this.#bindPencilHover();

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
      setTimeout(() => toast('Write your work, then tap the bubble to ask about it', 5200), 700);
    }

    this.#openSharedFile();
  }

  /**
   * Picks up a file the OS share sheet handed to sw.js's share-target route
   * (Android/Chrome, installed app only — iOS Safari has no equivalent API).
   * The service worker already redirected here with ?shared=1 and parked the
   * actual file in its own cache, since a redirect response can't carry one.
   */
  async #openSharedFile() {
    if (!location.search.includes('shared=1') || !('caches' in window)) return;
    history.replaceState(null, '', location.pathname);
    try {
      const cache = await caches.open('mathbubble-share');
      const res = await cache.match('shared-file');
      if (!res) return;
      await cache.delete('shared-file');
      const blob = await res.blob();
      const filename = decodeURIComponent(res.headers.get('x-filename') || 'shared-file');
      const type = res.headers.get('content-type') || blob.type;
      if (type === 'application/pdf' || /\.pdf$/i.test(filename)) {
        await this.importPdf(new File([blob], filename, { type }));
      } else if (type.startsWith('image/')) {
        this.board.setBackground(await downscaleImage(blob));
        toast('Opened what you shared — write on it, then shade your question');
      }
    } catch {
      // Best effort — the app just opens normally if this fails.
    }
  }

  get page() {
    return this.pages[this.index];
  }

  /**
   * Switches to page i, first flushing whatever page is on screen now.
   * Without that flush, strokes drawn less than 400ms earlier — exactly what
   * tapping an arrow right after writing looks like — never reached the
   * outgoing page's own record and were silently lost.
   *
   * Only safe when `this.pages` still has the outgoing page sitting at the
   * current index, i.e. the normal case: arrows, a page-grid tap, a fresh
   * page. A caller that has already spliced the array (deletePage,
   * importPdf) has either handled that page's data itself already or knows
   * it's gone — those call #loadPage directly to skip this flush.
   */
  showPage(i) {
    if (this.hasLoadedPage) {
      clearTimeout(this.saveTimer);
      Object.assign(this.page, this.board.serialize(), { updatedAt: Date.now() });
      pageStore.put({ ...this.page }).catch(() => {});
    }
    this.#loadPage(i);
  }

  #loadPage(i) {
    this.index = Math.max(0, Math.min(i, this.pages.length - 1));
    prefs.set('lastPage', this.index);
    this.board.load(this.page);
    this.chat.load(this.page.chat);
    this.hasLoadedPage = true;
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

  /** All pages at a glance — jump to one, or delete one, without stepping through arrows. */
  openPagesGrid() {
    // Bring the in-memory page up to date immediately; savePage()'s own
    // write to IndexedDB is debounced and would otherwise leave a stale
    // thumbnail for whichever page is open right now.
    Object.assign(this.page, this.board.serialize());
    this.#renderPagesGrid();
    $('#pagesGrid').showModal();
  }

  #renderPagesGrid() {
    const host = $('#pageGridBody');
    host.innerHTML = '';
    this.pages.forEach((p, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `page-card${i === this.index ? ' current' : ''}`;

      const thumb = p.bg?.src || strokesThumbnail(p);
      card.innerHTML =
        (thumb ? `<img src="${thumb}" alt="Page ${i + 1}" loading="lazy">` : `<div class="blank">Blank</div>`) +
        `<span class="num">${i + 1}</span>`;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', `Delete page ${i + 1}`);
      del.innerHTML = '<svg><use href="#i-trash"/></svg>';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePage(i);
      });
      card.append(del);

      card.addEventListener('click', () => {
        this.showPage(i);
        $('#pagesGrid').close();
      });
      host.append(card);
    });
  }

  async deletePage(i) {
    // Bring the in-memory current page up to date first — the debounced
    // autosave might not have run yet, and the bulk persist below would
    // otherwise write a stale copy of whichever page is presently open.
    Object.assign(this.page, this.board.serialize());

    if (this.pages.length <= 1) {
      // Always at least one page — clear it in place rather than deleting.
      const p = this.pages[i];
      p.strokes = [];
      p.bg = null;
      p.chat = [];
      await pageStore.put({ ...p });
      if (i === this.index) this.board.clear();
      toast('Only page — cleared instead of deleted');
      this.#renderPagesGrid();
      return;
    }
    if (!confirm(`Delete page ${i + 1}? This can't be undone.`)) return;

    const wasCurrent = i === this.index;
    const [removed] = this.pages.splice(i, 1);
    this.pages.forEach((p, idx) => { p.order = idx; });
    await Promise.all(this.pages.map((p) => pageStore.put({ ...p })));
    await pageStore.remove(removed.id);

    let next = i < this.index ? this.index - 1 : this.index;
    next = Math.max(0, Math.min(next, this.pages.length - 1));

    if (wasCurrent) {
      // The page the board was showing is the one just deleted; load
      // whichever page now sits at the (possibly shifted) current index —
      // #loadPage, not showPage, since there is nothing left to flush.
      this.#loadPage(next);
    } else {
      // The board is already showing the right page — just correct the
      // index and label; reloading it here would reset its undo history.
      this.index = next;
      prefs.set('lastPage', this.index);
      this.#syncPageBar();
      this.#syncUndo();
    }
    this.#renderPagesGrid();
    toast('Page deleted');
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

  /** Asks about whatever is currently marked out — a shaded region or a lasso selection. */
  askAboutSelection() {
    const bounds = this.shader.bounds() || this.board.selectionBounds();
    if (!bounds) return;
    const shot = this.board.captureRegion(bounds);
    this.stopShading();
    this.board.clearSelection();
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
    else if (act === 'pdf') $('#pdfInput').click();
    else if (act === 'paste') this.pasteFromClipboard();
    else if (act === 'chat') this.openChat();
  }

  /**
   * Pulls a screenshot — or, on iPadOS, a whole copied PDF (from Files, Mail,
   * or Teams) — straight off the system clipboard. This is the realistic
   * bridge into Teams on iPad: iOS has no Web Share Target API for a web
   * app, no matter how it's installed, so "tap Share, StudyBubble opens
   * with the file" (the Android/Chrome path — see share_target in the
   * manifest) isn't something Apple lets a PWA offer. Copy in Teams, switch
   * here, tap Paste is the closest equivalent that actually works.
   *
   * Must run inside a direct user gesture (a tap), which navigator.clipboard
   * requires — so this is only ever called from a click handler, never on a
   * timer or a visibility change.
   */
  async pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
      toast('This browser can’t paste — use the photo or PDF button instead');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const pdfType = item.types.find((t) => t === 'application/pdf');
        if (pdfType) {
          const blob = await item.getType(pdfType);
          await this.importPdf(new File([blob], 'pasted.pdf', { type: pdfType }));
          return;
        }
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const dataUrl = await downscaleImage(blob);
          this.board.setBackground(dataUrl);
          toast('Screenshot pasted — write on it, then shade your question');
          return;
        }
      }
      toast('Nothing to paste — copy a screenshot or PDF first');
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        toast('Allow Paste when your iPad asks, then try again');
      } else {
        toast("Couldn't paste that");
      }
    }
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

  #buildPaperMenu() {
    const host = $('#paperMenu');
    const styles = [
      ['dots', 'Dots', 'Light guide, stays out of the way'],
      ['lines', 'Lined', 'For writing and essays'],
      ['grid', 'Grid', 'For diagrams and tables'],
      ['graph', 'Graph', 'Squared, for plotting'],
      ['music', 'Music', 'Five-line staves'],
      ['plain', 'Plain', 'Nothing at all'],
    ];
    host.innerHTML = '';
    for (const [id, name, hint] of styles) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-item';
      b.dataset.template = id;
      b.setAttribute('role', 'menuitem');
      b.innerHTML =
        `<span class="paper-swatch ${id}"></span>` +
        `<span>${name}<small>${hint}</small></span>` +
        (this.board.template === id ? '<svg style="margin-left:auto"><use href="#i-check"/></svg>' : '');
      host.append(b);
    }
  }

  #togglePaperMenu(anchor) {
    const host = $('#paperMenu');
    if (host.classList.contains('open')) return host.classList.remove('open');
    this.#buildPaperMenu();
    const r = anchor.getBoundingClientRect();
    host.style.left = `${r.right + 10}px`;
    host.style.top = `${Math.min(r.top, window.innerHeight - 330)}px`;
    host.classList.add('open');
  }

  /** Keeps the floating selection actions pinned above the selection. */
  #syncSelectionBar() {
    const bar = $('#selectionBar');
    const bounds = this.board.selectionBounds();
    if (!bounds) return bar.classList.remove('open');

    const a = this.board.toScreen(bounds.x, bounds.y);
    const b = this.board.toScreen(bounds.x + bounds.w, bounds.y + bounds.h);
    bar.classList.add('open');
    const width = bar.offsetWidth || 190;
    const left = Math.min(Math.max((a.x + b.x) / 2 - width / 2, 12), window.innerWidth - width - 12);
    // Above the selection by default; below it when there's no room up top.
    const top = a.y - 60 < 70 ? b.y + 16 : a.y - 60;
    bar.style.left = `${left}px`;
    bar.style.top = `${Math.min(top, window.innerHeight - 70)}px`;
  }

  /**
   * Opens the typing overlay on a text box, positioned and scaled to match
   * exactly where it will land on the canvas.
   */
  editText(item) {
    const ta = $('#textEditor');
    const scale = this.board.view.scale;
    const screen = this.board.toScreen(item.x, item.y);
    const size = item.size * scale;

    ta.value = item.text || '';
    ta.style.font = `${size}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
    ta.style.color = item.color;
    ta.style.left = `${screen.x - 7}px`;
    ta.style.top = `${screen.y - size * 0.82 - 3}px`;
    ta.classList.add('open');

    const autosize = () => {
      ta.style.width = '10px';
      ta.style.height = '10px';
      ta.style.width = `${Math.max(ta.scrollWidth + 16, 60)}px`;
      ta.style.height = `${ta.scrollHeight + 4}px`;
    };
    autosize();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    const finish = () => {
      ta.removeEventListener('blur', finish);
      ta.removeEventListener('input', autosize);
      ta.removeEventListener('keydown', onKey);
      ta.classList.remove('open');
      this.board.commitText(item, ta.value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        ta.blur();
      }
      // Enter makes a new line; Cmd/Ctrl+Enter finishes, for a hardware keyboard.
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        ta.blur();
      }
    };
    ta.addEventListener('blur', finish);
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', onKey);
  }

  #toggleAddMenu(anchor) {
    const host = $('#addMenu');
    if (host.classList.contains('open')) return host.classList.remove('open');
    const r = anchor.getBoundingClientRect();
    host.style.left = `${r.right + 10}px`;
    host.style.top = `${Math.min(r.top, window.innerHeight - 190)}px`;
    host.classList.add('open');
  }

  #bindToolbar() {
    const tools = ['pen', 'marker', 'eraser', 'line', 'text', 'lasso', 'pan'];
    const buttons = {
      pen: $('#tPen'),
      marker: $('#tMarker'),
      eraser: $('#tEraser'),
      line: $('#tLine'),
      text: $('#tText'),
      lasso: $('#tLasso'),
      pan: $('#tPan'),
    };

    const select = (tool) => {
      // Leaving the lasso drops the selection, so its floating bar can't
      // linger over a tool that has nothing selected.
      if (tool !== 'lasso') this.board.clearSelection();
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
    $('#tAdd').addEventListener('click', () => this.#toggleAddMenu($('#tAdd')));
    $('#tShare').addEventListener('click', () => this.exportPage());
    $('#tPaper').addEventListener('click', () => this.#togglePaperMenu($('#tPaper')));

    $('#paperMenu').addEventListener('click', (e) => {
      const item = e.target.closest('[data-template]');
      if (!item) return;
      $('#paperMenu').classList.remove('open');
      this.board.setTemplate(item.dataset.template);
      this.#buildPaperMenu();
    });

    $('#selDelete').addEventListener('click', () => this.board.deleteSelection());
    $('#selDuplicate').addEventListener('click', () => this.board.duplicateSelection());
    $('#selColor').addEventListener('click', () => this.board.recolorSelection(this.board.color));
    $('#selAsk').addEventListener('click', () => this.askAboutSelection());
    $('#tSettings').addEventListener('click', () => $('#settings').showModal());

    $('#addMenu').addEventListener('click', (e) => {
      const item = e.target.closest('[data-act]');
      if (!item) return;
      $('#addMenu').classList.remove('open');
      this.runMenu(item.dataset.act);
    });

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

    $('#pdfInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      await this.importPdf(file);
    });

    document.addEventListener('pointerdown', (e) => {
      const swatches = $('#swatches');
      if (swatches.classList.contains('open') && !swatches.contains(e.target) && !e.target.closest('#toolbar')) {
        swatches.classList.remove('open');
      }
      const add = $('#addMenu');
      if (add.classList.contains('open') && !add.contains(e.target) && !e.target.closest('#toolbar')) {
        add.classList.remove('open');
      }
      const paper = $('#paperMenu');
      if (paper.classList.contains('open') && !paper.contains(e.target) && !e.target.closest('#toolbar')) {
        paper.classList.remove('open');
      }
    });
  }

  /**
   * Renders each page of a PDF (a past paper, a worksheet) into its own
   * board page, so a student can write directly on the real thing instead of
   * a single flattened screenshot of it.
   */
  /**
   * Shares (or, where that's unavailable, opens for saving) the current page
   * as one flattened image — the way out of the app, for showing a teacher
   * or keeping a copy, that isn't just asking the tutor.
   */
  async exportPage() {
    Object.assign(this.page, this.board.serialize());
    const bounds = this.board.contentBounds();
    if (!bounds) {
      toast('Nothing to share yet — write something first');
      return;
    }

    const dataUrl = this.board.captureRegion(bounds, { pad: 24, minSize: 0 });
    // Built synchronously (no fetch/await) so the share call below stays
    // inside the same user gesture — WebKit revokes permission once it's gone.
    const blob = dataUrlToBlob(dataUrl);
    await this.#shareFile(blob, `page-${this.index + 1}.png`, 'image/png');
  }

  /**
   * The whole notebook, every page in order, as one real PDF — the thing to
   * actually hand a teacher once the work is done, not a pile of loose
   * screenshots. Necessarily has real async work (loading each page's
   * background image, assembling the file) between the tap and the share
   * call, which WebKit's user-activation window may or may not survive —
   * #shareFile's tab fallback covers it either way, and that fallback is
   * arguably the better outcome anyway: Safari's own PDF viewer has its own
   * Share/Print/Save-to-Files button built in.
   */
  async exportNotebook() {
    Object.assign(this.page, this.board.serialize());
    toast('Building PDF…', 60000);
    try {
      const { pageToJpeg, buildPdf } = await import('./pdfexport.js');
      const jpegs = [];
      for (const p of this.pages) {
        const img = await pageToJpeg(p);
        if (img) jpegs.push(img);
      }
      if (!jpegs.length) {
        toast('Nothing to export yet — write something first');
        return;
      }
      const blob = buildPdf(jpegs);
      const filename = `studybubble-${new Date().toISOString().slice(0, 10)}.pdf`;
      await this.#shareFile(blob, filename, 'application/pdf');
      toast(`Exported ${jpegs.length} page${jpegs.length > 1 ? 's' : ''}`);
    } catch {
      toast("Couldn't build the PDF");
    }
  }

  /** Shared by exportPage and exportNotebook: share sheet, or a new tab to save from. */
  async #shareFile(blob, filename, mime) {
    if (navigator.share) {
      const file = new File([blob], filename, { type: mime });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return; // the student cancelled the sheet
          // otherwise fall through to the tab fallback below
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
    else toast("Couldn't open that — try again");
  }

  async importPdf(file) {
    toast(`Opening ${file.name}…`, 60000);
    try {
      const { pdfToPageImages } = await import('./pdfimport.js');
      const { images, truncated, totalPages } = await pdfToPageImages(file, (done, total) => {
        toast(`Opening ${file.name} — page ${done} of ${total}…`, 60000);
      });
      if (!images.length) {
        toast("Couldn't find any pages in that PDF");
        return;
      }

      // Bring the in-memory current page up to date first — the debounced
      // autosave may not have run yet, and both the blank check and the
      // bulk persist below need to see the real, current state.
      Object.assign(this.page, this.board.serialize());

      // A genuinely blank current page is replaced rather than left empty
      // and orphaned; anything with content is kept, and the import lands
      // straight after it. The blank page is removed first so the insertion
      // index below doesn't drift once new pages start shifting the array.
      const blank = !this.page.strokes.length && !this.page.bg && !this.page.chat.length;
      const replaced = blank ? this.pages.splice(this.index, 1)[0] : null;
      const insertAt = blank ? this.index : this.index + 1;

      images.forEach((img, i) => {
        const page = newPage(insertAt + i);
        // rect: null, not a pre-computed size — Board's own setBackground
        // auto-fit (used for every other image import) recomputes the fit
        // from the real viewport at the moment each page is actually shown,
        // rather than trusting a snapshot of window dimensions taken once at
        // import time that may be stale by the time page 2 or 3 is opened
        // (Safari's collapsing toolbar changes window.innerHeight after the
        // fact, and a rotated or resized device makes it wrong outright).
        page.bg = { src: img.dataUrl, rect: null };
        this.pages.splice(insertAt + i, 0, page);
      });

      this.pages.forEach((p, i) => { p.order = i; });
      await Promise.all(this.pages.map((p) => pageStore.put({ ...p })));
      if (replaced) await pageStore.remove(replaced.id);
      // #loadPage, not showPage — the array above has already been
      // restructured, so there is no valid "outgoing page at this.index" for
      // showPage's flush to write into; it would stomp whatever page ended
      // up at that slot with stale board content from before the import.
      this.#loadPage(insertAt);

      toast(
        truncated
          ? `Imported the first ${images.length} of ${totalPages} pages`
          : `Imported ${images.length} page${images.length > 1 ? 's' : ''} — write on it, then shade a question`
      );
    } catch (err) {
      toast("Couldn't open that PDF");
    }
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
    $('#pageLabel').addEventListener('click', () => this.openPagesGrid());

    $('#pagesGridClose').addEventListener('click', () => $('#pagesGrid').close());
    $('#pagesGridAdd').addEventListener('click', () => {
      this.addPage();
      this.#renderPagesGrid();
    });
    $('#pagesGridExport').addEventListener('click', () => this.exportNotebook());

    // The tutor surfaces an "Open Settings" button when no key is configured.
    $('#messages').addEventListener('click', (e) => {
      if (e.target.closest('[data-open-settings]')) $('#settings').showModal();
    });

    $('#chatClose').addEventListener('click', () => this.chat.close());
    $('#chatNew').addEventListener('click', () => {
      this.chat.reset();
      toast('Fresh conversation');
    });
    $('#chatDelete').addEventListener('click', () => {
      if (!this.chat.messages.length) return toast('Nothing to delete');
      if (!confirm('Delete this conversation? This can\'t be undone.')) return;
      this.chat.reset();
      this.chat.close();
      toast('Conversation deleted');
    });
  }

  #bindSettings() {
    const dialog = $('#settings');
    $('#settingsClose').addEventListener('click', () => dialog.close());

    const subject = $('#setSubject');
    subject.value = prefs.get('subject');
    subject.addEventListener('change', () => {
      prefs.set('subject', subject.value);
      // The follow-up chips are subject-specific, so they change with it.
      this.chat.refreshQuickActions();
    });

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
    toggle($('#setSnap'), 'snapShapes');

    const key = $('#setKey');
    key.value = prefs.get('apiKey') || '';
    key.addEventListener('change', () => prefs.set('apiKey', key.value.trim()));

    const workspace = $('#setWorkspace');
    workspace.value = prefs.get('workspaceId') || '';
    workspace.addEventListener('change', () => prefs.set('workspaceId', workspace.value.trim()));

    this.#bindVoiceSettings();

    serverConfig().then((config) => {
      if (config.hasServerKey) {
        $('#keyRow').style.display = 'none';
        $('#workspaceRow').style.display = 'none';
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

  /**
   * The voice rows only make sense once a key is entered — the picker needs
   * that key to even ask ElevenLabs which voices exist, and auto-speak is a
   * pointless toggle with nothing to speak with. So both stay hidden until
   * there's a key, exactly like the key row itself hides once a server key
   * makes it moot.
   */
  #bindVoiceSettings() {
    const keyInput = $('#setElevenKey');
    const voiceRow = $('#elevenVoiceRow');
    const voiceSelect = $('#setElevenVoice');
    const autoRow = $('#autoSpeakRow');
    const autoSwitch = $('#setAutoSpeak');

    keyInput.value = prefs.get('elevenKey') || '';

    const syncRows = () => {
      const has = Boolean((prefs.get('elevenKey') || '').trim());
      voiceRow.style.display = has ? '' : 'none';
      autoRow.style.display = has ? '' : 'none';
    };

    const populateVoices = async () => {
      const chosen = prefs.get('elevenVoice') || DEFAULT_VOICE;
      voiceSelect.innerHTML = '<option>Loading voices…</option>';
      const voices = await listVoices();
      voiceSelect.innerHTML = '';
      const list = voices.length ? voices : [{ id: DEFAULT_VOICE, name: 'Default voice' }];
      for (const v of list) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        voiceSelect.append(opt);
      }
      voiceSelect.value = list.some((v) => v.id === chosen) ? chosen : list[0].id;
      if (voiceSelect.value !== chosen) prefs.set('elevenVoice', voiceSelect.value);
    };

    keyInput.addEventListener('change', () => {
      prefs.set('elevenKey', keyInput.value.trim());
      syncRows();
      if (keyInput.value.trim()) populateVoices();
    });

    voiceSelect.addEventListener('change', () => prefs.set('elevenVoice', voiceSelect.value));

    toggle(autoSwitch, 'autoSpeak');

    syncRows();
    if (keyInput.value.trim()) populateVoices();

    function toggle(el, key) {
      el.setAttribute('aria-pressed', String(Boolean(prefs.get(key))));
      el.addEventListener('click', () => {
        const next = el.getAttribute('aria-pressed') !== 'true';
        el.setAttribute('aria-pressed', String(next));
        prefs.set(key, next);
      });
    }
  }

  #bindWindow() {
    const onResize = () => {
      this.board.resize();
      this.shader.resize();
      this.#syncSelectionBar();
    };

    // The bar is positioned in screen space from world coordinates, so it has
    // to be re-pinned whenever the view moves under it.
    const followView = () => {
      if (this.board.selection.size) this.#syncSelectionBar();
    };
    $('#board').addEventListener('pointermove', followView);
    $('#board').addEventListener('wheel', followView, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

    document.addEventListener('keydown', (e) => {
      const typing = e.target.closest('input, textarea, select');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        e.shiftKey ? this.board.redo() : this.board.undo();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (typing || !this.board.selection.size) return;
        e.preventDefault();
        this.board.deleteSelection();
      } else if (e.key === 'Escape') {
        if (this.board.selection.size) this.board.clearSelection();
        else if (this.shader.active) this.stopShading();
        else if (this.chat.isOpen) this.chat.close();
      } else if (!typing && e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) {
        this.startShading();
      }
    });

    // A hardware-keyboard Cmd/Ctrl+V with an image on the clipboard (e.g. a
    // screenshot copied from Teams) drops it straight onto the page. Typing
    // into an actual text field pastes text there as normal.
    document.addEventListener('paste', async (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      const items = [...(e.clipboardData?.items || [])];
      const pdfItem = items.find((i) => i.type === 'application/pdf');
      const imgItem = items.find((i) => i.type.startsWith('image/'));
      const item = pdfItem || imgItem;
      if (!item) return;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) return;
      try {
        if (item === pdfItem) await this.importPdf(file);
        else {
          this.board.setBackground(await downscaleImage(file));
          toast('Screenshot pasted — write on it, then shade your question');
        }
      } catch {
        toast("Couldn't paste that");
      }
    });

    // Stop Safari zooming the whole app on a pinch or a double tap, while
    // leaving double-click-to-select-a-word working inside the chat.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('#stage')) e.preventDefault();
    });
  }

  /**
   * Apple Pencil reports pointer position before the tip touches the glass —
   * "hovering" is a real Pointer Events state (pointerType 'pen', pressure 0,
   * buttons 0), not an iOS-only trick — so a ring the size of the current
   * brush can track it, the way a real pen-and-paper app would.
   */
  #bindPencilHover() {
    const dot = document.createElement('div');
    dot.id = 'pencilHover';
    document.body.append(dot);

    const hide = () => { dot.style.display = 'none'; };

    window.addEventListener('pointermove', (e) => {
      const live = e.pointerType === 'pen' && e.buttons === 0;
      const overCanvas = e.target.closest('#board, #overlay');
      const drawable = this.board.tool !== 'pan' && !this.shader.active;
      if (!live || !overCanvas || !drawable) return hide();

      const scale = this.board.view.scale;
      const diameter =
        (this.board.tool === 'eraser' ? this.board.width * 6 : this.board.tool === 'marker' ? this.board.width * 5 : this.board.width) *
        2 *
        scale;

      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.style.width = dot.style.height = `${Math.max(8, diameter)}px`;
      dot.style.borderColor = this.board.tool === 'eraser' ? 'var(--ink-3)' : this.board.color;
      dot.style.background = this.board.tool === 'marker' ? this.board.color : 'transparent';
      dot.style.display = 'block';
    });

    window.addEventListener('pointerdown', hide);
    window.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
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

/** Synchronous data-URL → Blob, so a share call stays inside the user gesture. */
function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

window.app = new App();

if ('serviceWorker' in navigator) {
  // Resolved against this module so the app also works from a sub-path
  // (a GitHub Pages project site, say), not just the origin root.
  const swUrl = new URL('../sw.js', import.meta.url);
  window.addEventListener('load', () => navigator.serviceWorker.register(swUrl).catch(() => {}));
}
