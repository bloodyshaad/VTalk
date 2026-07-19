import { getSupabase } from "./supabase";
import type { UserSummary, PostSummary } from "@/types/models";

export type SearchFilter = "all" | "people" | "posts" | "tags";

export interface SearchResults {
  people: UserSummary[];
  posts: PostSummary[];
  tags: string[];
}

interface RawProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RawPost {
  id: string;
  content: string | null;
  profiles: Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> | null;
}

function mapProfile(p: RawProfile): UserSummary {
  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  };
}

function mapPost(p: RawPost): PostSummary {
  return {
    id: p.id,
    content: p.content,
    author: p.profiles
      ? {
          id: p.profiles.id,
          username: p.profiles.username,
          display_name: p.profiles.display_name,
          avatar_url: p.profiles.avatar_url,
        }
      : null,
  };
}

export async function searchUsers(query: string, limit = 20): Promise<UserSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawProfile[]).map(mapProfile);
}

export async function searchPosts(query: string, limit = 20): Promise<PostSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, profiles ( id, username, display_name, avatar_url )")
    .ilike("content", `%${query}%`)
    .eq("is_published", true)
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawPost[]).map(mapPost);
}

export async function search(query: string, filter: SearchFilter): Promise<SearchResults> {
  if (!query.trim()) return { people: [], posts: [], tags: [] };
  const supabase = getSupabase();
  const results: SearchResults = { people: [], posts: [], tags: [] };

  if (filter === "all" || filter === "people") {
    results.people = await searchUsers(query);
  }
  if (filter === "all" || filter === "posts") {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, profiles ( id, username, display_name, avatar_url )")
      .ilike("content", `%${query}%`)
      .eq("is_published", true)
      .limit(20);
    if (!error) {
      results.posts = ((data ?? []) as RawPost[]).map(mapPost);
    }
  }
  if (filter === "all" || filter === "tags") {
    const { data, error } = await supabase
      .from("posts")
      .select("content")
      .ilike("content", `%#${query}%`)
      .eq("is_published", true)
      .limit(50);
    if (!error) {
      const set = new Set<string>();
      for (const row of (data ?? []) as { content: string | null }[]) {
        const m = row.content?.match(/#(\w+)/g) ?? [];
        m.forEach((t) => set.add(t.toLowerCase()));
      }
      results.tags = [...set].slice(0, 10);
    }
  }
  return results;
}

export async function getTrendingTags(limit = 10): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("content")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { content: string | null }[]) {
    const tags = row.content?.match(/#(\w+)/g) ?? [];
    for (const t of tags) {
      const key = t.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}
