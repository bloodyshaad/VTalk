import { getSupabase } from "./supabase";
import type { Reel, UserSummary } from "@/types/models";

interface RawReel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles: Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> | null;
}

function mapReel(r: RawReel): Reel {
  return {
    id: r.id,
    user_id: r.user_id,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    caption: r.caption,
    view_count: r.view_count,
    like_count: r.like_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    author: r.profiles
      ? {
          id: r.profiles.id,
          username: r.profiles.username,
          display_name: r.profiles.display_name,
          avatar_url: r.profiles.avatar_url,
        }
      : null,
  };
}

export async function getReels(limit = 30): Promise<Reel[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select(
      "id, user_id, video_url, thumbnail_url, caption, view_count, like_count, comment_count, created_at, profiles ( id, username, display_name, avatar_url )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawReel[]).map(mapReel);
}

export async function getReel(id: string): Promise<Reel | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select(
      "id, user_id, video_url, thumbnail_url, caption, view_count, like_count, comment_count, created_at, profiles ( id, username, display_name, avatar_url )",
    )
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return mapReel(data as RawReel);
}

export async function createReel(input: {
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
}): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("reels")
    .insert({
      user_id: user.id,
      video_url: input.video_url,
      thumbnail_url: input.thumbnail_url ?? null,
      caption: input.caption ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
