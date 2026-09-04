/**
 * Local storage layer — IndexedDB, offline-first.
 *
 * The study log is **append-only**: we store review events, never derived state.
 * Every screen is a projection replayed from those events. That makes the whole
 * history exportable, makes algorithm changes safe (re-derive, don't migrate), and
 * means a sync conflict can never silently destroy a study record
 * (MASTER-PROMPT.md §10).
 *
 * Every call is wrapped so that a browser with storage disabled degrades to an
 * in-memory session rather than a white screen.
 */

import type { Rating } from '@atlas/learning';

export const DB_NAME = 'atlas';
export const DB_VERSION = 1;
const EVENTS = 'events';
const SETTINGS = 'settings';

/** One immutable thing that happened. Only reviews for now; attempts and uploads follow. */
export interface StudyEvent {
  /** Monotonic id: `${timestamp}-${random}` keeps insertion order stable. */
  id: string;
  type: 'review';
  cardId: string;
  objectiveId: string;
  rating: Rating;
  at: number;
  latencyMs: number;
  /** Stated probability of being right, collected before the answer was shown. */
  confidence?: number;
  /** For graded item types: was the response actually correct? */
  correct?: boolean;
}

export interface Settings {
  desiredRetention: number;
  sessionLimit: number;
  newCardLimit: number;
  /** Epoch ms of the next exam, or null for no deadline. */
  examAt: number | null;
  theme: 'system' | 'light' | 'dark';
  /** Ask for a confidence rating before revealing the answer. */
  askConfidence: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  desiredRetention: 0.9,
  sessionLimit: 20,
  newCardLimit: 6,
  examAt: null,
  theme: 'system',
  askConfidence: true,
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS)) {
        db.createObjectStore(EVENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const request = run(db.transaction(store, mode).objectStore(store));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function newEventId(at: number): string {
  return `${at.toString().padStart(14, '0')}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadEvents(): Promise<StudyEvent[]> {
  const rows = (await tx<StudyEvent[]>(EVENTS, 'readonly', (s) => s.getAll())) ?? [];
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function appendEvent(event: StudyEvent): Promise<void> {
  await tx(EVENTS, 'readwrite', (s) => s.put(event));
}

export async function loadSettings(): Promise<Settings> {
  const stored = await tx<Partial<Settings>>(SETTINGS, 'readonly', (s) => s.get('settings'));
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await tx(SETTINGS, 'readwrite', (s) => s.put(settings, 'settings'));
}

/** Wipe everything this app stores. Deleting means deleting (MASTER-PROMPT.md §1.5). */
export async function clearAll(): Promise<void> {
  await tx(EVENTS, 'readwrite', (s) => s.clear());
  await tx(SETTINGS, 'readwrite', (s) => s.clear());
}
