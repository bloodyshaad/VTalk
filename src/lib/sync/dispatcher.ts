/**
 * Offline sync dispatcher.
 *
 * Maps a queued `PendingOperation` (entity + operation + JSON payload) onto a
 * real Supabase write performed by the frontend. The Rust `SyncManager` emits a
 * `sync://flush` event with a batch of operations; the handler (see
 * `handler.ts`) applies each one through this dispatcher and reports success or
 * failure back to Rust via `mark_synced` / `mark_failed`.
 *
 * Operations are applied best-effort and idempotent where possible (upserts keyed
 * by id) so a duplicate flush does not corrupt data.
 */

import { getSupabase } from "@/lib/api/supabase";
import type { CreatePostInput } from "@/lib/api/posts";
import { createPost, deletePost } from "@/lib/api/posts";
import { likePost, unlikePost } from "@/lib/api/likes";
import { upsertDraft, deleteDraft } from "@/lib/api/drafts";
import type { DraftPayload } from "@/lib/api/drafts";

export interface PendingOp {
  id: string;
  entity: string;
  operation: string;
  payload: string;
}

/** Result of applying a single operation. */
export type ApplyResult = { ok: true } | { ok: false; error: string };

/**
 * Apply one operation. Returns Ok on success (op is cleared) or Err with a
 * human-readable reason (op is kept and retried with backoff).
 */
export async function applyOperation(op: PendingOp): Promise<ApplyResult> {
  const supabase = getSupabase();
  const key = `${op.entity}:${op.operation}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(op.payload);
  } catch {
    // Corrupt payload — drop it rather than retrying forever.
    return { ok: true };
  }

  try {
    switch (key) {
      case "posts:create": {
        // The post was composed offline; create it for real now.
        const input = parsed as CreatePostInput;
        await createPost(input);
        return { ok: true };
      }
      case "posts:delete": {
        const { id } = parsed as { id: string };
        await deletePost(id);
        return { ok: true };
      }
      case "posts:like": {
        const { post_id, liked } = parsed as { post_id: string; liked: boolean };
        if (liked) {
          await likePost(post_id);
        } else {
          await unlikePost(post_id);
        }
        return { ok: true };
      }
      case "drafts:upsert": {
        const p = parsed as DraftPayload & { id?: string };
        await upsertDraft(p, p.id);
        return { ok: true };
      }
      case "drafts:delete": {
        const { id } = parsed as { id: string };
        await deleteDraft(id);
        return { ok: true };
      }
      default:
        // Unknown operation: keep it queued so a future client version can
        // apply it. This avoids silently dropping user data.
        return { ok: false, error: `unknown operation ${key}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Build the canonical payload string for a known operation. */
export function encodeOp(payload: unknown): string {
  return JSON.stringify(payload);
}
