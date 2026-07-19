import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/api/supabase";
import {
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  getSession as apiGetSession,
  ensureProfile,
} from "@/lib/api/auth";
import type { Profile } from "@/types/database";

interface AuthState {
  user: { id: string; email: string | null } | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  clearError: () => void;
}

async function persistSessionInTauri(accessToken: string | undefined) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (accessToken) {
      await invoke("store_session", { token: accessToken });
    } else {
      await invoke("clear_session");
    }
  } catch {
    // Not running in Tauri (browser dev) — Supabase persists its own session.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  error: null,
  initialized: false,

  refreshSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await apiGetSession();
      if (!session) {
        set({ session: null, user: null, profile: null, initialized: true });
        await persistSessionInTauri(undefined);
        return;
      }
      const profile = await ensureProfile(session.user.id, session.user.email ?? "");
      set({
        session,
        user: { id: session.user.id, email: session.user.email ?? null },
        profile,
        initialized: true,
      });
      await persistSessionInTauri(session.access_token);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to restore session",
        initialized: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiSignIn(email, password);
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const profile = await ensureProfile(result.user.id, result.user.email ?? "");
      set({
        user: result.user,
        session,
        profile,
      });
      await persistSessionInTauri(session?.access_token);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Login failed" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, username) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiSignUp(email, password, username);
      if (!result.session) {
        set({
          error:
            "Registration successful. Please check your email to confirm your account.",
        });
        return;
      }
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const profile = await ensureProfile(result.user.id, result.user.email ?? "");
      set({ user: result.user, session: data.session, profile });
      await persistSessionInTauri(data.session?.access_token);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Registration failed" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiSignOut();
      await persistSessionInTauri(undefined);
      set({ user: null, session: null, profile: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Logout failed" });
    } finally {
      set({ isLoading: false });
    }
  },

  setProfile: (profile) => set({ profile }),
  clearError: () => set({ error: null }),
}));
