import { create } from "zustand";
import type { Post } from "@/types/models";
import { getPost, deletePost as apiDeletePost } from "@/lib/api/posts";
import { likePost, unlikePost, hasLikedPost } from "@/lib/api/likes";
import { savePost, unsavePost, isSaved } from "@/lib/api/saves";

interface PostState {
  post: Post | null;
  isLoading: boolean;
  error: string | null;
  liked: boolean;
  saved: boolean;
  fetch: (id: string) => Promise<void>;
  toggleLike: () => Promise<void>;
  toggleSave: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => void;
}

export const usePostStore = create<PostState>((set, get) => ({
  post: null,
  isLoading: false,
  error: null,
  liked: false,
  saved: false,

  fetch: async (id) => {
    set({ isLoading: true, error: null, post: null });
    try {
      const post = await getPost(id);
      if (!post) {
        set({ error: "Post not found", isLoading: false });
        return;
      }
      const [liked, saved] = await Promise.all([hasLikedPost(id), isSaved(id)]);
      set({ post, liked, saved, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load post" });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleLike: async () => {
    const { post, liked } = get();
    if (!post) return;
    set((s) => ({
      liked: !s.liked,
      post: s.post
        ? { ...s.post, like_count: s.post.like_count + (s.liked ? -1 : 1) }
        : null,
    }));
    try {
      if (liked) await unlikePost(post.id);
      else await likePost(post.id);
    } catch {
      set((s) => ({
        liked,
        post: s.post
          ? { ...s.post, like_count: s.post.like_count + (liked ? 1 : -1) }
          : null,
      }));
    }
  },

  toggleSave: async () => {
    const { post, saved } = get();
    if (!post) return;
    set((s) => ({ saved: !s.saved }));
    try {
      if (saved) await unsavePost(post.id);
      else await savePost(post.id);
    } catch {
      set({ saved });
    }
  },

  remove: async (id) => {
    await apiDeletePost(id);
    set({ post: null });
  },

  clear: () => set({ post: null, liked: false, saved: false, error: null }),
}));
