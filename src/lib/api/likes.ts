import { getSupabase } from "./supabase";

async function currentUserId(): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function likePost(postId: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("likes")
    .insert({ post_id: postId, user_id: userId });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unlikePost(postId: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function likeComment(commentId: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("likes")
    .insert({ comment_id: commentId, user_id: userId });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unlikeComment(commentId: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function hasLikedPost(postId: string): Promise<boolean> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/**
 * Batch-fetch the set of post IDs (from `postIds`) that the current user has
 * already liked. Used to restore the "liked by me" heart state after a fresh
 * login, when the in-memory `likedIds` set is empty.
 */
export async function getMyLikedPostIds(postIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (postIds.length === 0) return result;
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { post_id: string }[]) {
    result.add(row.post_id);
  }
  return result;
}

/**
 * Batch-fetch the set of comment IDs (from `commentIds`) that the current user
 * has already liked. Restores the "liked by me" heart state in the comment
 * section after a fresh login.
 */
export async function getMyLikedCommentIds(
  commentIds: string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  if (commentIds.length === 0) return result;
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("likes")
    .select("comment_id")
    .eq("user_id", userId)
    .in("comment_id", commentIds)
    .not("comment_id", "is", null);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { comment_id: string }[]) {
    result.add(row.comment_id);
  }
  return result;
}
