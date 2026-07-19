import { getSupabase } from "./supabase";
import type { Profile } from "@/types/database";

export interface AuthResult {
  user: { id: string; email: string | null };
  session: { access_token: string; refresh_token: string } | null;
}

export async function signUp(
  email: string,
  password: string,
  username: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Sign up failed: no user returned");
  return {
    user: { id: data.user.id, email: data.user.email ?? null },
    session: data.session
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }
      : null,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session)
    throw new Error("Sign in failed: no session returned");
  return {
    user: { id: data.user.id, email: data.user.email ?? null },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Profile;
}

export async function ensureProfile(
  userId: string,
  email: string,
): Promise<Profile> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;
  const username = (email.split("@")[0] || "user") + Math.floor(Math.random() * 1000);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username,
      display_name: email.split("@")[0],
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}
