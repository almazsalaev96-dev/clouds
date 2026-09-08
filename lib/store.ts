"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelParams, ProviderId } from "./types";
import { DEFAULT_MODEL_ID } from "./models";

export type Theme = "light" | "dark" | "system";
export type Density = "compact" | "comfortable" | "spacious";

interface Settings {
  theme: Theme;
  density: Density;
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
    { name: "clouds.settings", version: 1 },
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
    { name: "clouds.drafts", version: 1 },
  ),
);
