/**
 * Frontend wiring for the offline sync loop.
 *
 * Listens for `sync://flush` events emitted by the Rust `SyncManager`, applies
 * each operation through the dispatcher, then reports results back with
 * `mark_synced` / `mark_failed`. Also surfaces status to the `syncStore` so the
 * UI can show pending counts and errors.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { applyOperation, type PendingOp } from "./dispatcher";
import { useSyncStore } from "@/stores/syncStore";

interface FlushRequest {
  operations: PendingOp[];
}

interface StatusEvent {
  status: string;
  pending: number;
}

let started = false;
let unlistenFlush: UnlistenFn | null = null;
let unlistenStatus: UnlistenFn | null = null;

/** Start the sync event listeners. Idempotent. */
export async function startSyncHandler(): Promise<void> {
  if (started) return;
  started = true;

  unlistenFlush = await listen<FlushRequest>("sync://flush", async (event) => {
    const ops = event.payload.operations;
    const synced: string[] = [];
    for (const op of ops) {
      const result = await applyOperation(op);
      if (result.ok) {
        synced.push(op.id);
      } else {
        await invoke("mark_failed", { id: op.id, error: result.error });
      }
    }
    if (synced.length > 0) {
      await invoke("mark_synced", { ids: synced });
    }
  });

  unlistenStatus = await listen<StatusEvent>("sync://status", (event) => {
    useSyncStore.getState().setStatus(event.payload.status, event.payload.pending);
  });

  // Kick the background loop (no-op if already running).
  try {
    await invoke("start_background_sync");
  } catch {
    // Not in a Tauri context (e.g. web dev) — sync is a no-op there.
  }
}

export function stopSyncHandler(): void {
  unlistenFlush?.();
  unlistenStatus?.();
  unlistenFlush = null;
  unlistenStatus = null;
  started = false;
}
