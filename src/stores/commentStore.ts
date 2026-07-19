import { create } from "zustand";
import type { Comment } from "@/types/models";
import {
  getComments,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
} from "@/lib/api/comments";
import { getMyLikedCommentIds } from "@/lib/api/likes";

function collectCommentIds(comments: Comment[]): string[] {
  const ids: string[] = [];
  const walk = (list: Comment[]) => {
    for (const c of list) {
      ids.push(c.id);
      if (c.replies && c.replies.length > 0) walk(c.replies);
    }
  };
  walk(comments);
  return ids;
}

interface CommentState {
  comments: Comment[];
  likedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  fetch: (postId: string) => Promise<void>;
  add: (postId: string, content: string, parentId?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => void;
  isLiked: (commentId: string) => boolean;
  setLiked: (commentId: string, liked: boolean) => void;
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  likedIds: new Set(),
  isLoading: false,
  error: null,

  fetch: async (postId) => {
    set({ isLoading: true, error: null });
    try {
      const comments = await getComments(postId);
      const allIds = collectCommentIds(comments);
      let likedIds = new Set<string>();
      try {
        likedIds = await getMyLikedCommentIds(allIds);
      } catch {
        likedIds = new Set();
      }
      set({ comments, likedIds, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load comments" });
    } finally {
      set({ isLoading: false });
    }
  },

  isLiked: (commentId) => get().likedIds.has(commentId),

  setLiked: (commentId, liked) =>
    set((s) => {
      const likedIds = new Set(s.likedIds);
      if (liked) likedIds.add(commentId);
      else likedIds.delete(commentId);
      return { likedIds };
    }),

  add: async (postId, content, parentId) => {
    try {
      const comment = await apiCreateComment(postId, content, parentId);
      set((s) => ({ comments: [...s.comments, comment] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add comment" });
      throw err;
    }
  },

  remove: async (id) => {
    try {
      await apiDeleteComment(id);
      set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete" });
    }
  },

  clear: () => set({ comments: [], error: null }),
}));
