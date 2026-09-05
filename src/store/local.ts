/**
 * Local-first persistence.
 *
 * IndexedDB in the browser, an in-memory map on the server so that server
 * rendering never touches storage and never leaks one student's state into
 * another request. Writes are debounced and last-write-wins; the store is small
 * (a heavy year of study is a few megabytes) so it is read and written whole
 * rather than as a set of partial updates, which removes an entire class of
 * consistency bug for no meaningful cost.
 */

import { get, set, del, createStore, type UseStore } from "idb-keyval";
import { emptyState, STORE_VERSION, type StudentState } from "./types";

const KEY = "lodestar:student";

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  idb ??= createStore("lodestar", "state");
  return idb;
}

/** Server-side fallback so SSR renders an empty, non-shared state. */
const memoryFallback = new Map<string, StudentState>();

export async function loadState(): Promise<StudentState> {
  const now = new Date().toISOString();
  const s = store();
  if (!s) return memoryFallback.get(KEY) ?? emptyState(now);
  try {
    const raw = await get<StudentState>(KEY, s);
    if (!raw) return emptyState(now);
    return migrate(raw, now);
  } catch {
    // A corrupt or blocked store must not brick the app. Start clean and let
    // the student re-import a backup if they have one.
    return emptyState(now);
  }
}

export async function saveState(state: StudentState): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  const s = store();
  if (!s) {
    memoryFallback.set(KEY, next);
    return;
  }
  await set(KEY, next, s);
}

export async function clearState(): Promise<void> {
  const s = store();
  if (!s) {
    memoryFallback.delete(KEY);
    return;
  }
  await del(KEY, s);
}

/**
 * Forward migration. Student history must survive every schema change: losing
 * a term of attempts to a refactor is unrecoverable for the student and
 * unforgivable in a product whose entire value is accumulated evidence.
 */
export function migrate(raw: StudentState, now: string): StudentState {
  const base = emptyState(now);
  const merged: StudentState = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...raw.profile },
    settings: { ...base.settings, ...raw.settings },
    version: STORE_VERSION,
  };
  return merged;
}

// --- export / import -------------------------------------------------------

export function exportState(state: StudentState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importState(json: string): StudentState {
  const parsed = JSON.parse(json) as StudentState;
  if (typeof parsed !== "object" || parsed === null || !("attempts" in parsed)) {
    throw new Error("That file does not look like a Lodestar export.");
  }
  return migrate(parsed, new Date().toISOString());
}
