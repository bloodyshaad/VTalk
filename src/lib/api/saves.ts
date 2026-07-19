import { getSupabase } from "./supabase";

async function currentUserId(): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export interface Collection {
  id: string;
  name: string;
  count: number;
}

export async function savePost(
  postId: string,
  collectionId?: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase.from("saves").upsert(
    { post_id: postId, user_id: userId, collection_id: collectionId ?? null },
    { onConflict: "user_id,post_id" },
  );
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function listCollections(): Promise<Collection[]> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("save_collections")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const cols = (data ?? []) as { id: string; name: string }[];

  const { data: saveRows } = await supabase
    .from("saves")
    .select("collection_id")
    .eq("user_id", userId);
  const counts = new Map<string, number>();
  for (const s of (saveRows ?? []) as { collection_id: string | null }[]) {
    if (s.collection_id)
      counts.set(s.collection_id, (counts.get(s.collection_id) ?? 0) + 1);
  }
  return cols.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));
}

export async function createCollection(name: string): Promise<Collection> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("save_collections")
    .insert({ name: name.trim(), user_id: userId })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  const c = data as { id: string; name: string };
  return { id: c.id, name: c.name, count: 0 };
}

export async function deleteCollection(id: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("save_collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function moveSaveToCollection(
  postId: string,
  collectionId: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("saves")
    .update({ collection_id: collectionId })
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function unsavePost(postId: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("saves")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getSavedPosts(limit = 50): Promise<string[]> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("saves")
    .select("post_id")
    .eq("user_id", userId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
}

export async function isSaved(postId: string): Promise<boolean> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("saves")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/**
 * Batch-fetch the set of post IDs (from `postIds`) that the current user has
 * already saved. Restores the "saved by me" state in the feed after a fresh
 * login, when the in-memory `savedIds` set is empty.
 */
export async function getMySavedPostIds(postIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (postIds.length === 0) return result;
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("saves")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { post_id: string }[]) {
    result.add(row.post_id);
  }
  return result;
}
