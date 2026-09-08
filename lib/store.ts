"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelParams, ProviderId } from "./types";
import { DEFAULT_MODEL_ID } from "./models";

/**
 * Storage keys are deliberately not the product name.
 *
 * They were, and the app has since been called Clouds, Armi and Astra — each
 * rename putting everyone's theme, model choice and unsent drafts one typo away
 * from being orphaned. A brand is a marketing decision; where a user's settings
 * live should not be. These keys are now fixed, and a rename costs nothing.
 *
 * The one-time adoption below walks the old brand keys newest-first, so a
 * browser that last used any of those names keeps its state.
 */
export const SETTINGS_KEY = "store.settings.v1";
export const DRAFTS_KEY = "store.drafts.v1";

const BRAND_HISTORY = ["astra", "armi", "clouds"];

function adoptLegacyStorage(target: string, suffix: string) {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(target)) return;
    for (const brand of BRAND_HISTORY) {
      const value = localStorage.getItem(`${brand}.${suffix}`);
      if (value) {
        localStorage.setItem(target, value);
        return;
      }
    }
  } catch {
    /* private mode, or storage disabled */
  }
}
adoptLegacyStorage(SETTINGS_KEY, "settings");
adoptLegacyStorage(DRAFTS_KEY, "drafts");

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
    { name: SETTINGS_KEY, version: 1 },
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
    { name: DRAFTS_KEY, version: 1 },
  ),
);
