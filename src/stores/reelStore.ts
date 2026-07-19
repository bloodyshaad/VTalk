import { create } from "zustand";
import { getReels, getReel, createReel as apiCreateReel } from "@/lib/api/reels";
import type { Reel } from "@/types/models";

interface ReelState {
  reels: Reel[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  load: (id: string) => Promise<void>;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  setPlaying: (p: boolean) => void;
  create: (input: { video_url: string; thumbnail_url?: string | null; caption?: string | null }) => Promise<void>;
}

export const useReelStore = create<ReelState>((set, get) => ({
  reels: [],
  currentIndex: 0,
  isPlaying: true,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const reels = await getReels();
      set({ reels });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load reels" });
    } finally {
      set({ isLoading: false });
    }
  },

  load: async (id) => {
    const reels = get().reels;
    const idx = reels.findIndex((r) => r.id === id);
    if (idx >= 0) {
      set({ currentIndex: idx });
      return;
    }
    try {
      const reel = await getReel(id);
      if (reel) set({ reels: [reel, ...reels], currentIndex: 0 });
    } catch {
      // ignore
    }
  },

  next: () =>
    set((s) => ({
      currentIndex: Math.min(s.currentIndex + 1, s.reels.length - 1),
      isPlaying: true,
    })),

  previous: () =>
    set((s) => ({
      currentIndex: Math.max(s.currentIndex - 1, 0),
      isPlaying: true,
    })),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (p) => set({ isPlaying: p }),

  create: async (input) => {
    await apiCreateReel(input);
    await get().fetch();
  },
}));
