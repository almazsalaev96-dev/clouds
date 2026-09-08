"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelParams, ProviderId } from "./types";
import { DEFAULT_MODEL_ID } from "./models";

/**
 * The app has been renamed twice: Clouds, then Armi, now Astra. Settings and
 * drafts follow the name rather than resetting with it, and the chain is
 * ordered newest-first so the most recent state wins if several exist.
 */
const NAME_HISTORY = ["armi", "clouds"];

function adoptPreviousStorage(suffix: string) {
  if (typeof window === "undefined") return;
  const target = `astra.${suffix}`;
  try {
    if (localStorage.getItem(target)) return;
    for (const old of NAME_HISTORY) {
      const value = localStorage.getItem(`${old}.${suffix}`);
      if (value) {
        localStorage.setItem(target, value);
        return;
      }
    }
  } catch {
    /* private mode, or storage disabled */
  }
}
adoptPreviousStorage("settings");
adoptPreviousStorage("drafts");

export type Theme = "light" | "dark" | "system";
export type Density = "compact" | "comfortable" | "spacious";
export type Section = "chat" | "notes" | "cards" | "papers";

interface Settings {
  theme: Theme;
  density: Density;
  section: Section;
  modelId: string;
  systemPrompt: string;
  sidebarOpen: boolean;
  sendOnEnter: boolean;
  showLineNumbers: boolean;
  wrapCode: boolean;
  /** Browser-held keys, used only when the server has none for that provider. */
  keys: Partial<Record<ProviderId, string>>;
  params: Record<string, ModelParams>;
  favorites: string[];
  recentModels: string[];

  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  setSection: (s: Section) => void;
  setModel: (id: string) => void;
  setSystemPrompt: (s: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setKey: (p: ProviderId, key: string) => void;
  setParams: (modelId: string, p: Partial<ModelParams>) => void;
  toggleFavorite: (id: string) => void;
  set: (partial: Partial<Settings>) => void;
}

export const DEFAULT_PARAMS: ModelParams = {
  temperature: 1,
  maxTokens: 8192,
  topP: 1,
  reasoningEffort: "medium",
};

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      theme: "system",
      density: "comfortable",
      section: "chat",
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "",
      sidebarOpen: true,
      sendOnEnter: true,
      showLineNumbers: false,
      wrapCode: false,
      keys: {},
      params: {},
      favorites: [],
      recentModels: [],

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setSection: (section) => set({ section }),
      setModel: (modelId) =>
        set((s) => ({
          modelId,
          recentModels: [modelId, ...s.recentModels.filter((m) => m !== modelId)].slice(0, 5),
        })),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
      setKey: (p, key) => set((s) => ({ keys: { ...s.keys, [p]: key } })),
      setParams: (modelId, p) =>
        set((s) => ({
          params: { ...s.params, [modelId]: { ...(s.params[modelId] ?? DEFAULT_PARAMS), ...p } },
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      set: (partial) => set(partial),
    }),
    { name: "astra.settings", version: 1 },
  ),
);

export function paramsFor(modelId: string): ModelParams {
  return useSettings.getState().params[modelId] ?? DEFAULT_PARAMS;
}

/** Drafts are per-conversation and survive switching away mid-sentence. */
interface DraftState {
  drafts: Record<string, string>;
  setDraft: (id: string, text: string) => void;
}
export const useDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (id, text) => set((s) => ({ drafts: { ...s.drafts, [id]: text } })),
    }),
    { name: "astra.drafts", version: 1 },
  ),
);
