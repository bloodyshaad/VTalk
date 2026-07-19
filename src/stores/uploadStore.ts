import { create } from "zustand";
import { uploadMedia, type UploadItem } from "@/lib/upload";
import { useAuthStore } from "@/stores/authStore";

interface UploadState {
  items: UploadItem[];
  enqueue: (file: File, bucket?: string) => Promise<string | null>;
  activeCount: () => number;
  remove: (id: string) => void;
  clearFinished: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  items: [],

  activeCount: () => get().items.filter((i) => i.status === "uploading").length,

  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clearFinished: () =>
    set((s) => ({
      items: s.items.filter(
        (i) => i.status === "uploading" || i.status === "pending",
      ),
    })),

  enqueue: async (file, bucket = "media") => {
    const user = useAuthStore.getState().profile;
    if (!user) {
      set((s) => ({
        items: [
          ...s.items,
          {
            id: `up-${Date.now()}`,
            fileName: file.name,
            bucket,
            status: "failed",
            progress: 0,
            url: null,
            error: "Not authenticated",
          },
        ],
      }));
      return null;
    }

    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({
      items: [
        ...s.items,
        {
          id,
          fileName: file.name,
          bucket,
          status: "uploading",
          progress: 0,
          url: null,
          error: null,
        },
      ],
    }));

    try {
      const url = await uploadMedia(file, bucket, user.id, (pct) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, progress: pct } : i,
          ),
        }));
      });
      set((s) => ({
        items: s.items.map((i) =>
          i.id === id ? { ...i, status: "completed", progress: 100, url } : i,
        ),
      }));
      return url;
    } catch (err) {
      set((s) => ({
        items: s.items.map((i) =>
          i.id === id
            ? {
                ...i,
                status: "failed",
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : i,
        ),
      }));
      return null;
    }
  },
}));
