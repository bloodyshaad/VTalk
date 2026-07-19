import { create } from "zustand";
import type { Profile } from "@/types/database";
import type { UserSummary } from "@/types/models";
import {
  getProfileByUsername,
  updateProfile as apiUpdateProfile,
  type ProfileUpdate,
} from "@/lib/api/profiles";
import { follow as apiFollow, unfollow as apiUnfollow, isFollowing } from "@/lib/api/follows";
import { getPostsByUser, type FeedPostLite } from "@/lib/api/posts";

interface ProfileState {
  profile: Profile | null;
  posts: FeedPostLite[];
  followers: UserSummary[];
  following: UserSummary[];
  isFollowing: boolean;
  isLoading: boolean;
  error: string | null;
  fetchByUsername: (username: string) => Promise<void>;
  fetchPosts: (userId: string) => Promise<void>;
  update: (patch: ProfileUpdate) => Promise<void>;
  toggleFollow: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  posts: [],
  followers: [],
  following: [],
  isFollowing: false,
  isLoading: false,
  error: null,

  fetchByUsername: async (username) => {
    set({ isLoading: true, error: null });
    try {
      const profile = await getProfileByUsername(username);
      if (!profile) {
        set({ error: "Profile not found", isLoading: false });
        return;
      }
      const following = await isFollowing(profile.id);
      set({ profile, isFollowing: following });
      await get().fetchPosts(profile.id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load profile" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPosts: async (userId) => {
    try {
      const posts = await getPostsByUser(userId);
      set({ posts });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load posts" });
    }
  },

  update: async (patch) => {
    const profile = get().profile;
    if (!profile) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await apiUpdateProfile(profile.id, patch);
      set({ profile: updated });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Update failed" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFollow: async () => {
    const profile = get().profile;
    if (!profile) return;
    const currently = get().isFollowing;
    set({ isFollowing: !currently });
    try {
      if (currently) {
        await apiUnfollow(profile.id);
      } else {
        await apiFollow(profile.id);
      }
    } catch (err) {
      set({ isFollowing: currently });
      set({ error: err instanceof Error ? err.message : "Follow action failed" });
    }
  },
}));
