import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdaterState {
  checking: boolean;
  downloading: boolean;
  updateReady: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  restartAndInstall: () => Promise<void>;
}

let pendingUpdate: Update | null = null;

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  checking: false,
  downloading: false,
  updateReady: false,
  currentVersion: null,
  latestVersion: null,
  error: null,

  checkForUpdate: async () => {
    if (get().checking || get().updateReady) return;
    set({ checking: true, error: null });
    try {
      const update = await check();
      if (!update) {
        set({ checking: false });
        return;
      }
      set({
        currentVersion: update.currentVersion,
        latestVersion: update.version,
      });
      // Auto-download in the background per the chosen UX.
      set({ downloading: true });
      await update.downloadAndInstall((event) => {
        if (event.event === "Finished") set({ downloading: false });
      });
      pendingUpdate = update;
      set({ updateReady: true, checking: false, downloading: false });
    } catch (err) {
      set({
        checking: false,
        downloading: false,
        error: err instanceof Error ? err.message : "Update check failed",
      });
    }
  },

  restartAndInstall: async () => {
    try {
      await relaunch();
    } catch {
      // relaunch closes the app; if it returns, surface nothing.
    }
  },
}));
