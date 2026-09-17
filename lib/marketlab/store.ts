"use client";

/**
 * Everything MarketLab remembers.
 *
 * It all lives in this browser. There is no account, no server-side store and
 * nothing to sign up for, which is deliberate: the brief is that a student
 * should be able to run an experiment within seconds of arriving, and a
 * registration wall is the fastest way to stop that happening. The cost is
 * that work does not follow you between devices, so every screen that holds
 * work also offers an export.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as React from "react";
import { emptyProject, type Note, type Provenance, type ResearchProject, type SavedRun, type SectionId } from "./research";

export type Interest = "economics" | "business" | "research" | "entrepreneurship";
export type Theme = "light" | "dark" | "system";
export type Currency = "GBP" | "USD" | "EUR" | "none";

interface State {
  theme: Theme;
  currency: Currency;
  /** Answered once, on the first visit. Steers what the home page leads with. */
  interests: Interest[];
  onboarded: boolean;

  runs: SavedRun[];
  projects: ResearchProject[];
  activeProjectId: string | null;

  setTheme: (t: Theme) => void;
  setCurrency: (c: Currency) => void;
  setInterests: (i: Interest[]) => void;
  completeOnboarding: () => void;

  saveRun: (run: Omit<SavedRun, "id" | "createdAt">) => SavedRun;
  deleteRun: (id: string) => void;
  renameRun: (id: string, label: string) => void;

  createProject: (title?: string) => ResearchProject;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProject: (id: string, patch: Partial<Omit<ResearchProject, "id" | "createdAt">>) => void;
  writeSection: (id: string, section: SectionId, text: string) => void;
  addNote: (id: string, body: string, provenance: Provenance) => void;
  deleteNote: (projectId: string, noteId: string) => void;
  attachRun: (projectId: string, runId: string) => void;
  detachRun: (projectId: string, runId: string) => void;

  clearEverything: () => void;
}

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useLab = create<State>()(
  persist(
    (set, get) => ({
      theme: "system",
      currency: "GBP",
      interests: [],
      onboarded: false,
      runs: [],
      projects: [],
      activeProjectId: null,

      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setInterests: (interests) => set({ interests }),
      completeOnboarding: () => set({ onboarded: true }),

      saveRun: (partial) => {
        const run: SavedRun = { ...partial, id: uid("run"), createdAt: Date.now() };
        set({ runs: [run, ...get().runs].slice(0, 200) });
        return run;
      },
      deleteRun: (id) => set({
        runs: get().runs.filter((r) => r.id !== id),
        // A run that no longer exists must not stay attached to a project, or
        // the report exports a reference to nothing.
        projects: get().projects.map((p) => ({ ...p, attachments: p.attachments.filter((a) => a !== id) })),
      }),
      renameRun: (id, label) => set({ runs: get().runs.map((r) => (r.id === id ? { ...r, label } : r)) }),

      createProject: (title) => {
        const project = emptyProject(title ?? "Untitled research project", uid("proj"));
        set({ projects: [project, ...get().projects], activeProjectId: project.id });
        return project;
      },
      deleteProject: (id) => set({
        projects: get().projects.filter((p) => p.id !== id),
        activeProjectId: get().activeProjectId === id ? null : get().activeProjectId,
      }),
      setActiveProject: (activeProjectId) => set({ activeProjectId }),
      updateProject: (id, patch) => set({
        projects: get().projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
      }),
      writeSection: (id, section, text) => set({
        projects: get().projects.map((p) =>
          p.id === id ? { ...p, sections: { ...p.sections, [section]: text }, updatedAt: Date.now() } : p),
      }),
      addNote: (id, body, provenance) => {
        const note: Note = { id: uid("note"), body, provenance, createdAt: Date.now() };
        set({
          projects: get().projects.map((p) =>
            p.id === id ? { ...p, notes: [note, ...p.notes], updatedAt: Date.now() } : p),
        });
      },
      deleteNote: (projectId, noteId) => set({
        projects: get().projects.map((p) =>
          p.id === projectId ? { ...p, notes: p.notes.filter((n) => n.id !== noteId), updatedAt: Date.now() } : p),
      }),
      attachRun: (projectId, runId) => set({
        projects: get().projects.map((p) =>
          p.id === projectId && !p.attachments.includes(runId)
            ? { ...p, attachments: [...p.attachments, runId], updatedAt: Date.now() }
            : p),
      }),
      detachRun: (projectId, runId) => set({
        projects: get().projects.map((p) =>
          p.id === projectId ? { ...p, attachments: p.attachments.filter((a) => a !== runId), updatedAt: Date.now() } : p),
      }),

      clearEverything: () => set({ runs: [], projects: [], activeProjectId: null, onboarded: false, interests: [] }),
    }),
    {
      name: "marketlab.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      /* Hydration is deferred so the server-rendered markup and the first
         client render agree. Without this, every page that reads saved work
         mismatches on hydration and React throws the whole tree away. */
      skipHydration: true,
    },
  ),
);

/** True once the persisted store has been read. Guards every saved-work render. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    void useLab.persist.rehydrate();
    const unsub = useLab.persist.onFinishHydration(() => { if (!cancelled) setHydrated(true); });
    // `rehydrate` resolves synchronously with localStorage, so the listener can
    // fire before it is attached. Checking the flag covers that race.
    if (useLab.persist.hasHydrated()) setHydrated(true);
    return () => { cancelled = true; unsub(); };
  }, []);
  return hydrated;
}

export function useProject(id: string | null): ResearchProject | null {
  return useLab((s) => s.projects.find((p) => p.id === id) ?? null);
}

/** Saves a file the browser has produced, without a round trip to a server. */
export function download(filename: string, contents: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately cancels the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugifyFilename(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "marketlab";
}
