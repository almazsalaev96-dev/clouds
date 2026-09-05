"use client";

/**
 * Student state provider.
 *
 * Holds the whole student record in memory and persists it to IndexedDB after a
 * short debounce. The store is small enough that whole-document writes are
 * cheaper than the bookkeeping partial updates would need, and it removes any
 * possibility of two components disagreeing about the same fact.
 *
 * Mutations go through `update`, which also appends to the event log — so no
 * caller can change state without leaving an audit trail, and analytics can
 * never drift from what actually happened.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadState, saveState, clearState, exportState, importState } from "./local";
import { emptyState, type StudentState } from "./types";
import type { LearningEvent } from "@/domain/events";
import type { ContentBundle } from "@/content/bundle";

interface StoreValue {
  state: StudentState;
  ready: boolean;
  /** Apply a change and record the events it produced. */
  update: (fn: (draft: StudentState) => StudentState, events?: LearningEvent[]) => void;
  record: (...events: LearningEvent[]) => void;
  reset: () => Promise<void>;
  exportJson: () => string;
  importJson: (json: string) => void;
  now: () => string;
}

const StoreContext = createContext<StoreValue | null>(null);
const ContentContext = createContext<ContentBundle | null>(null);

export function ContentProvider({ bundle, children }: { bundle: ContentBundle; children: ReactNode }) {
  return <ContentContext.Provider value={bundle}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentBundle {
  const c = useContext(ContentContext);
  if (!c) throw new Error("useContent must be used inside ContentProvider.");
  return c;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudentState>(() => emptyState(new Date().toISOString()));
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (!cancelled) {
        setState(s);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence. 400ms is short enough that a closed tab loses at
  // most one keystroke, long enough that typing does not thrash IndexedDB.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveState(state), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, ready]);

  // Flush on unload so a closing tab does not lose the last edit.
  useEffect(() => {
    const flush = () => void saveState(state);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [state]);

  const update = useCallback((fn: (draft: StudentState) => StudentState, events: LearningEvent[] = []) => {
    setState((prev) => {
      const next = fn(prev);
      return events.length
        ? { ...next, events: [...next.events, ...events] }
        : next;
    });
  }, []);

  const record = useCallback((...events: LearningEvent[]) => {
    setState((prev) => ({ ...prev, events: [...prev.events, ...events] }));
  }, []);

  const reset = useCallback(async () => {
    await clearState();
    setState(emptyState(new Date().toISOString()));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      update,
      record,
      reset,
      exportJson: () => exportState(state),
      importJson: (json: string) => setState(importState(json)),
      now: () => new Date().toISOString(),
    }),
    [state, ready, update, record, reset],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider.");
  return s;
}

/**
 * Apply accessibility and theme settings to the document root.
 * Kept out of React's render path — these are document-level attributes that
 * CSS reads, not component state.
 */
export function useAppearance() {
  const { state, ready } = useStore();
  const s = state.settings;
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (s.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", s.theme);
    root.style.setProperty("--font-scale", String(s.fontScale));
    root.setAttribute("data-contrast", s.highContrast ? "high" : "normal");
    root.setAttribute("data-dyslexia", String(s.dyslexiaFriendly));
    root.setAttribute("data-motion", s.reducedMotion ? "reduced" : "normal");
  }, [ready, s.theme, s.fontScale, s.highContrast, s.dyslexiaFriendly, s.reducedMotion]);
}
