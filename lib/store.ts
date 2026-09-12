"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelParams, ProviderId } from "./types";
import { DEFAULT_MODEL_ID } from "./models";
import { DEFAULT_STYLE_ID } from "./styles";
import { DEFAULT_MODE } from "./modes";

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

/**
 * Move the old key, rather than copying it.
 *
 * This used to read the legacy value, write it to the new key and return —
 * leaving the original in place forever. Which means a copy of the settings
 * object, `keys` and all, sat under `astra.settings` in the browser of anybody
 * who had used the app before it was renamed. A plain-text API key under a
 * brand name the app has not used in months, that nothing reads, nothing shows
 * and nothing clears.
 *
 * It is a migration. A migration that leaves the source behind is a copy, and
 * a copy of a secret is the thing you were trying not to make.
 */
function adoptLegacyStorage(target: string, suffix: string) {
  if (typeof window === "undefined") return;
  try {
    const already = localStorage.getItem(target);
    let adopted = already;
    for (const brand of BRAND_HISTORY) {
      const legacy = `${brand}.${suffix}`;
      const value = localStorage.getItem(legacy);
      if (value && !adopted) {
        localStorage.setItem(target, value);
        adopted = value;
      }
      // Removed whether or not this one was the value taken: the others are
      // older copies of the same secret and there is no reading of "keep the
      // spares" that helps anybody.
      if (value) localStorage.removeItem(legacy);
    }
  } catch {
    /* private mode, or storage disabled */
  }
}
adoptLegacyStorage(SETTINGS_KEY, "settings");
adoptLegacyStorage(DRAFTS_KEY, "drafts");

/**
 * Every key this app has ever written to `localStorage`.
 *
 * The database is enumerated from its own live schema — `deleteAllData`
 * iterates `db.tables` precisely so a table added later cannot be forgotten —
 * and none of that reaches here. `localStorage` is the app's second database:
 * it holds the settings, which contain the browser-held API keys, and every
 * unsent draft. "Delete everything" cleared the first one and left the second
 * one whole, under a sentence promising that nothing is kept anywhere else.
 *
 * The scenario in the README is somebody wiping the app before handing over a
 * laptop. They handed it over with the key still on it.
 */
export const LOCAL_KEYS = [
  SETTINGS_KEY,
  DRAFTS_KEY,
  ...BRAND_HISTORY.flatMap((b) => [`${b}.settings`, `${b}.drafts`]),
];

/**
 * The other half of "delete everything", and it has to be said out loud.
 *
 * Memory first, then disk. Removing the storage key alone is not enough while
 * the store is still alive holding the same values: `persist` writes the whole
 * state back on the next change, so a wipe followed by any interaction at all
 * puts the API key straight back on disk. The reload that follows would hide
 * it, which is worse — it would look like it had worked.
 */
export function forgetLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    useSettings.setState({ ...DEFAULT_SETTINGS });
  } catch {
    /* the store not being there is not a reason to skip the disk */
  }
  try {
    for (const k of LOCAL_KEYS) localStorage.removeItem(k);
  } catch {
    /* private mode, or storage disabled — nothing was stored to clear */
  }
}

export type Theme = "light" | "dark" | "system";
export type Density = "compact" | "comfortable" | "spacious";
/**
 * The rooms.
 *
 * "creative" is where things get made: its page is the list of things this app
 * can build — a deck of flashcards, a week grid, a timer — and pressing one
 * builds it and runs it. It is a room rather than a mode because that is what
 * it always was: Creative used to be a switch in the composer, which asked the
 * question before you had said anything and put the answer somewhere nobody
 * looked. A place you go is findable.
 *
 * It has no viewer of its own. What it makes is a canvas, and canvases live
 * and run in "code" — two rooms rendering the same thing would be two places
 * for one object.
 */
export type Section = "chat" | "code" | "creative" | "projects" | "notebook";

interface Settings {
  theme: Theme;
  density: Density;
  section: Section;
  /** Where you were. Restored on load, so a reload does not lose your place. */
  lastConversationId: string | null;
  modelId: string;
  /**
   * Which model rewrites a canvas or a notebook page.
   *
   * Null means "whichever is cheapest that has a key", which is what the app
   * used to do silently — a reasonable default and a bad secret, since the
   * thing being chosen for you is what edits your file. Now it is shown on the
   * bar and it is yours to change.
   */
  reviseModelId: string | null;
  systemPrompt: string;
  /** The response style new chats start with. Threads can override it. */
  styleId: string;
  /** Chat or Creative, likewise. */
  mode: string;
  /** What to call you. Used in the greeting; stays in this browser. */
  name: string;
  /** Whether the blank page has asked yet. It asks once. */
  nameAsked: boolean;
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
  setLastConversation: (id: string | null) => void;
  setModel: (id: string) => void;
  setSystemPrompt: (s: string) => void;
  setStyle: (id: string) => void;
  setMode: (id: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setKey: (p: ProviderId, key: string) => void;
  setReviseModel: (id: string | null) => void;
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

/**
 * What this browser looks like before anybody has chosen anything.
 *
 * Exported because two places need it and a second copy would drift: the store
 * starts here, and `lib/backup.ts` compares against it to decide whether a
 * browser has been set up before it lets a restore bring settings in. A hand-
 * kept duplicate of this list would answer "untouched" about a setting nobody
 * had remembered to add to it.
 */
export const DEFAULT_SETTINGS = {
  theme: "system",
  density: "comfortable",
  section: "chat",
  lastConversationId: null,
  modelId: DEFAULT_MODEL_ID,
  reviseModelId: null,
  systemPrompt: "",
  styleId: DEFAULT_STYLE_ID,
  mode: DEFAULT_MODE,
  name: "",
  nameAsked: false,
  sidebarOpen: true,
  sendOnEnter: true,
  showLineNumbers: false,
  wrapCode: false,
  keys: {} as Record<string, string>,
  params: {} as Record<string, ModelParams>,
  favorites: [] as string[],
  recentModels: [] as string[],
} satisfies Partial<Settings>;

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setSection: (section) => set({ section }),
      setLastConversation: (lastConversationId) => set({ lastConversationId }),
      setModel: (modelId) =>
        set((s) => ({
          modelId,
          recentModels: [modelId, ...s.recentModels.filter((m) => m !== modelId)].slice(0, 5),
        })),
      setReviseModel: (reviseModelId) => set({ reviseModelId }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setStyle: (styleId) => set({ styleId }),
      setMode: (mode) => set({ mode }),
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
