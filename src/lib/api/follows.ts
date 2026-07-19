import { getSupabase } from "./supabase";

export async function follow(userId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: userId });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unfollow(userId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);
  if (error) throw new Error(error.message);
}

export async function isFollowing(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function getFollowers(userId: string, limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, profiles:follower_id ( id, username, display_name, avatar_url )")
    .eq("following_id", userId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown[];
}

export async function getFollowing(userId: string, limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id, profiles:following_id ( id, username, display_name, avatar_url )")
    .eq("follower_id", userId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown[];
}
