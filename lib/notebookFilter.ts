import { create } from "zustand";

/**
 * "All notebooks" from the sidebar: the Notebook room's list shows only the
 * notebooks until it is cleared. Held apart from the saved settings — it is
 * where you are looking, not a preference.
 */
export const useNotebookFilter = create<{ only: boolean; set: (only: boolean) => void }>((set) => ({
  only: false,
  set: (only) => set({ only }),
}));
