/**
 * Local persistence.
 *
 * Pages (strokes + optional worksheet photo + their chat) live in IndexedDB
 * because a photo background can easily blow past the localStorage quota.
 * Small preferences live in localStorage so they are readable synchronously
 * during first paint (theme, mainly).
 */

const DB_NAME = 'mathbubble';
const DB_VERSION = 1;
const PAGES = 'pages';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PAGES)) {
        db.createObjectStore(PAGES, { keyPath: 'id' }).createIndex('order', 'order');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(PAGES, mode);
        const out = fn(t.objectStore(PAGES));
        t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const pages = {
  async all() {
    const list = await tx('readonly', (s) => s.getAll());
    return (list || []).sort((a, b) => a.order - b.order);
  },
  put(page) {
    return tx('readwrite', (s) => s.put(page));
  },
  remove(id) {
    return tx('readwrite', (s) => s.delete(id));
  },
};

export function newPage(order = 0) {
  return {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    strokes: [],
    bg: null,
    chat: [],
  };
}

/* ---------- preferences ---------- */

const PREF_KEY = 'mathbubble.prefs';

const DEFAULTS = {
  level: 'gcse',
  style: 'socratic',
  dark: false,
  pencilOnly: false,
  model: 'claude-sonnet-5',
  apiKey: '',
  // Only some Anthropic keys need this (identity-linked keys spanning more
  // than one workspace); left blank it is simply never sent.
  workspaceId: '',
  color: '#14162b',
  penWidth: 3,
  bubble: null, // {x, y} as a fraction of the viewport
};

export const prefs = {
  data: (() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
    } catch {
      return { ...DEFAULTS };
    }
  })(),
  get(key) {
    return this.data[key];
  },
  set(key, value) {
    this.data[key] = value;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.data));
    } catch {
      /* private browsing — settings just won't persist */
    }
  },
};
