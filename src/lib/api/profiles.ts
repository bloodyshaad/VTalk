import { getSupabase } from "./supabase";
import type { Profile } from "@/types/database";
import type { UserSummary } from "@/types/models";

export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Profile;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Profile;
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "display_name"
    | "bio"
    | "avatar_url"
    | "cover_url"
    | "website"
    | "account_type"
    | "user_type"
    | "category"
    | "show_activity_status"
    | "read_receipts"
    | "notification_prefs"
  >
>;

export async function updateProfile(
  id: string,
  patch: ProfileUpdate,
): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function searchProfiles(
  query: string,
  limit = 20,
): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${query}%`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export function toUserSummary(p: Profile): UserSummary {
  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  };
}
