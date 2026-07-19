import { create } from "zustand";
import {
  getStoryGroups,
  createStory as apiCreateStory,
  markStoryViewed,
  deleteStory as apiDeleteStory,
} from "@/lib/api/stories";
import type { StoryGroup, Story } from "@/types/models";
import type { MediaType } from "@/types/database";

interface StoryState {
  groups: StoryGroup[];
  activeGroupIndex: number;
  activeStoryIndex: number;
  isViewing: boolean;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  openViewer: (groupIndex: number) => void;
  closeViewer: () => void;
  next: () => void;
  previous: () => void;
  viewStory: (groupId: string, storyId: string) => void;
  markCurrentViewed: () => void;
  remove: (storyId: string) => Promise<void>;
  create: (input: {
    media_url: string;
    media_type: MediaType;
    text_overlay?: string | null;
    background_color?: string | null;
    duration?: number;
  }) => Promise<void>;
}

export const useStoryStore = create<StoryState>((set, get) => ({
  groups: [],
  activeGroupIndex: 0,
  activeStoryIndex: 0,
  isViewing: false,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const groups = await getStoryGroups();
      set({ groups });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load stories" });
    } finally {
      set({ isLoading: false });
    }
  },

  openViewer: (groupIndex) => {
    set({ isViewing: true, activeGroupIndex: groupIndex, activeStoryIndex: 0 });
    get().markCurrentViewed();
  },

  markCurrentViewed: () => {
    const { groups, activeGroupIndex, activeStoryIndex } = get();
    const story = groups[activeGroupIndex]?.stories[activeStoryIndex];
    if (story) void markStoryViewed(story.id);
  },

  remove: async (storyId) => {
    try {
      await apiDeleteStory(storyId);
      await get().fetch();
      set({ isViewing: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete story" });
    }
  },

  closeViewer: () => set({ isViewing: false }),

  next: () => {
    const { activeGroupIndex, activeStoryIndex, groups } = get();
    const group = groups[activeGroupIndex];
    if (!group) return;
    if (activeStoryIndex < group.stories.length - 1) {
      set({ activeStoryIndex: activeStoryIndex + 1 });
      get().markCurrentViewed();
    } else if (activeGroupIndex < groups.length - 1) {
      set({
        activeGroupIndex: activeGroupIndex + 1,
        activeStoryIndex: 0,
      });
      get().markCurrentViewed();
    } else {
      set({ isViewing: false });
    }
  },

  previous: () => {
    const { activeGroupIndex, activeStoryIndex, groups } = get();
    if (activeStoryIndex > 0) {
      set({ activeStoryIndex: activeStoryIndex - 1 });
      get().markCurrentViewed();
    } else if (activeGroupIndex > 0) {
      const prev = groups[activeGroupIndex - 1];
      set({
        activeGroupIndex: activeGroupIndex - 1,
        activeStoryIndex: prev.stories.length - 1,
      });
      get().markCurrentViewed();
    }
  },

  viewStory: (groupId, storyId) => {
    const groups = get().groups;
    const gi = groups.findIndex((g) => g.author.id === groupId);
    const si = groups[gi]?.stories.findIndex((s: Story) => s.id === storyId) ?? 0;
    if (gi >= 0) {
      set({ isViewing: true, activeGroupIndex: gi, activeStoryIndex: si });
      get().markCurrentViewed();
    }
  },

  create: async (input) => {
    await apiCreateStory(input);
    await get().fetch();
  },
}));
