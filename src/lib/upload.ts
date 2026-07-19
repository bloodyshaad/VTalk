/**
 * Unified media upload. Performs the real transfer to Supabase Storage and
 * reports progress. When running inside Tauri, the item is also registered with
 * the native upload queue (`init_upload`) so the Rust backend tracks it; the
 * actual bytes are still sent through the webview's Supabase client.
 */

import type { FileOptions } from "@supabase/storage-js";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type UploadStatus =
  | "pending"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled";

export interface UploadItem {
  id: string;
  fileName: string;
  bucket: string;
  status: UploadStatus;
  progress: number; // 0..100
  url: string | null;
  error: string | null;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Upload a single file to a storage bucket. Returns the public URL. */
export async function uploadMedia(
  file: File,
  bucket: string,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const supabase = (await import("@/lib/api/supabase")).getSupabase();
  const path = `${userId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  // Register with the native queue for visibility (Tauri only).
  let tauriId: string | null = null;
  if (isTauri) {
    try {
      // The Rust queue expects an on-disk path; we pass a synthetic marker and
      // rely on the webview's Supabase client for the actual transfer.
      tauriId = await tauriInvoke<string>("init_upload", {
        file_path: path,
        bucket,
        user_id: userId,
      });
    } catch {
      tauriId = null;
    }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: ({ progress }: { progress: number }) => {
        const pct = Math.round(progress * 100);
        onProgress?.(pct);
        if (isTauri && tauriId) {
          void tauriInvoke("resume_upload", { upload_id: tauriId }).catch(() => {});
        }
      },
    } as FileOptions);

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  onProgress?.(100);
  return urlData.publicUrl;
}

export async function cancelTauriUpload(uploadId: string): Promise<void> {
  if (!isTauri) return;
  await tauriInvoke("cancel_upload", { upload_id: uploadId }).catch(() => {});
}
