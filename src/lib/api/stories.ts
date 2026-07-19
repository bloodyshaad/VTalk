import { getSupabase } from "./supabase";
import type { Story, StoryGroup, UserSummary } from "@/types/models";
import type { MediaType } from "@/types/database";

interface RawStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  text_overlay: string | null;
  background_color: string | null;
  duration: number;
  expires_at: string;
  profiles: Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> | null;
}

function mapStory(r: RawStory): Story {
  return {
    id: r.id,
    user_id: r.user_id,
    media_url: r.media_url,
    media_type: r.media_type,
    text_overlay: r.text_overlay,
    background_color: r.background_color,
    duration: r.duration,
    expires_at: r.expires_at,
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

/** Fetch active (non-expired) stories grouped by author for the home tray. */
export async function getStoryGroups(): Promise<StoryGroup[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("stories")
    .select(
      "id, user_id, media_url, media_type, text_overlay, background_color, duration, expires_at, profiles ( id, username, display_name, avatar_url )",
    )
    .gt("expires_at", now)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  let viewedIds = new Set<string>();
  if (user) {
    const { data: views } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("user_id", user.id);
    viewedIds = new Set(
      ((views ?? []) as { story_id: string }[]).map((v) => v.story_id),
    );
  }

  const rows = (data ?? []) as RawStory[];
  const byAuthor = new Map<string, StoryGroup>();
  for (const r of rows) {
    const story = mapStory(r);
    const author = story.author;
    if (!author) continue;
    if (!byAuthor.has(author.id)) {
      byAuthor.set(author.id, { author, stories: [], viewed: true });
    }
    const group = byAuthor.get(author.id)!;
    group.stories.push(story);
    if (!viewedIds.has(story.id)) group.viewed = false;
  }
  return [...byAuthor.values()];
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, user_id: user.id },
      { onConflict: "story_id,user_id" },
    );
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function deleteStory(storyId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function createStory(input: {
  media_url: string;
  media_type: MediaType;
  text_overlay?: string | null;
  background_color?: string | null;
  duration?: number;
}): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      media_url: input.media_url,
      media_type: input.media_type,
      text_overlay: input.text_overlay ?? null,
      background_color: input.background_color ?? null,
      duration: input.duration ?? 5000,
      expires_at: expires,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
