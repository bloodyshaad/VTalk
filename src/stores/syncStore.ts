import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type SyncState =
  | "stopped"
  | "connecting"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

interface SyncStoreState {
  status: SyncState;
  pending: number;
  lastError: string | null;
  setStatus: (status: string, pending: number) => void;
  /** Queue an offline operation. No-op outside Tauri. */
  enqueue: (
    entity: string,
    operation: string,
    payload: unknown,
    dedupeKey: string,
  ) => Promise<void>;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: "stopped",
  pending: 0,
  lastError: null,

  setStatus: (status, pending) =>
    set({
      status: status as SyncState,
      pending,
      lastError: status === "error" ? "Sync failed — will retry" : null,
    }),

  enqueue: async (entity, operation, payload, dedupeKey) => {
    try {
      await invoke("enqueue_sync_operation", {
        entity,
        operation,
        payload: JSON.stringify(payload),
        dedupeKey,
      });
    } catch {
      // Not in a Tauri context: nothing to queue. The caller may choose to
      // perform the write directly when online.
    }
  },
}));
