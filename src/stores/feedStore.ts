import { create } from "zustand";
import { getFeed, type FeedPostLite } from "@/lib/api/posts";
import { likePost, unlikePost, getMyLikedPostIds } from "@/lib/api/likes";
import { savePost, unsavePost, getMySavedPostIds } from "@/lib/api/saves";

interface FeedState {
  posts: FeedPostLite[];
  likedIds: Set<string>;
  savedIds: Set<string>;
  cursor: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  activeTab: "following" | "forYou";
  fetchFeed: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  refresh: () => Promise<void>;
  removePost: (id: string) => void;
  setActiveTab: (tab: "following" | "forYou") => void;
  toggleLike: (postId: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
}

const PAGE = 20;

async function loadMyInteractions(posts: FeedPostLite[]): Promise<{
  likedIds: Set<string>;
  savedIds: Set<string>;
}> {
  const ids = posts.map((p) => p.id);
  try {
    const [liked, saved] = await Promise.all([
      getMyLikedPostIds(ids),
      getMySavedPostIds(ids),
    ]);
    return { likedIds: liked, savedIds: saved };
  } catch {
    return { likedIds: new Set(), savedIds: new Set() };
  }
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  likedIds: new Set(),
  savedIds: new Set(),
  cursor: 0,
  hasMore: true,
  isLoading: false,
  error: null,
  activeTab: "forYou",

  fetchFeed: async () => {
    set({ isLoading: true, error: null });
    try {
      const posts = await getFeed(PAGE, 0);
      const { likedIds, savedIds } = await loadMyInteractions(posts);
      set({ posts, likedIds, savedIds, cursor: posts.length, hasMore: posts.length === PAGE });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load feed" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNextPage: async () => {
    const { cursor, isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;
    set({ isLoading: true });
    try {
      const posts = await getFeed(PAGE, cursor);
      const { likedIds, savedIds } = await loadMyInteractions(posts);
      set((s) => {
        const mergedLiked = new Set(s.likedIds);
        likedIds.forEach((id) => mergedLiked.add(id));
        const mergedSaved = new Set(s.savedIds);
        savedIds.forEach((id) => mergedSaved.add(id));
        return {
          posts: [...s.posts, ...posts],
          likedIds: mergedLiked,
          savedIds: mergedSaved,
          cursor: s.cursor + posts.length,
          hasMore: posts.length === PAGE,
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load more" });
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    await get().fetchFeed();
  },

  removePost: (id) =>
    set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleLike: async (postId) => {
    const wasLiked = get().likedIds.has(postId);
    set((s) => {
      const likedIds = new Set(s.likedIds);
      if (wasLiked) likedIds.delete(postId);
      else likedIds.add(postId);
      return {
        likedIds,
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, like_count: p.like_count + (wasLiked ? -1 : 1) }
            : p,
        ),
      };
    });
    try {
      if (wasLiked) await unlikePost(postId);
      else await likePost(postId);
    } catch {
      set((s) => {
        const likedIds = new Set(s.likedIds);
        if (wasLiked) likedIds.add(postId);
        else likedIds.delete(postId);
        return {
          likedIds,
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, like_count: p.like_count + (wasLiked ? 1 : -1) }
              : p,
          ),
        };
      });
    }
  },

  toggleSave: async (postId) => {
    const wasSaved = get().savedIds.has(postId);
    set((s) => {
      const savedIds = new Set(s.savedIds);
      if (wasSaved) savedIds.delete(postId);
      else savedIds.add(postId);
      return { savedIds };
    });
    try {
      if (wasSaved) await unsavePost(postId);
      else await savePost(postId);
    } catch (err) {
      set((s) => {
        const savedIds = new Set(s.savedIds);
        if (wasSaved) savedIds.add(postId);
        else savedIds.delete(postId);
        return {
          savedIds,
          error: err instanceof Error ? err.message : "Save failed",
        };
      });
    }
  },
}));
