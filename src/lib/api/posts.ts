import { getSupabase } from "./supabase";
import type { PostRow, PostType, MediaType } from "@/types/database";
import type { Post, MediaItem, UserSummary } from "@/types/models";

type PostWithAuthor = PostRow & {
  profiles: Pick<
    UserSummary,
    "id" | "username" | "display_name" | "avatar_url"
  > | null;
};

function mapPost(row: PostWithAuthor, media: MediaItem[] = []): Post {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    content: row.content,
    code_snippet: row.code_snippet,
    code_language: row.code_language,
    location: row.location,
    is_published: row.is_published,
    scheduled_at: row.scheduled_at,
    like_count: row.like_count,
    comment_count: row.comment_count,
    save_count: row.save_count,
    share_count: row.share_count,
    created_at: row.created_at,
    author: row.profiles
      ? {
          id: row.profiles.id,
          username: row.profiles.username,
          display_name: row.profiles.display_name,
          avatar_url: row.profiles.avatar_url,
        }
      : null,
    media,
  };
}

const POST_SELECT = `
  id, user_id, type, content, code_snippet, code_language, location,
  is_published, scheduled_at, like_count, comment_count, save_count,
  share_count, created_at,
  profiles ( id, username, display_name, avatar_url )
`;

export interface FeedPostLite {
  id: string;
  user_id: string;
  type: PostType;
  content: string | null;
  like_count: number;
  comment_count: number;
  save_count: number;
  share_count: number;
  created_at: string;
  author: UserSummary | null;
  media: MediaItem[];
}

const FEED_SELECT = `
  id, user_id, type, content, like_count, comment_count, save_count, share_count, created_at,
  profiles ( id, username, display_name, avatar_url ),
  post_media ( id, url, type, width, height, alt_text, order_index )
`;

function mapFeedRow(row: Record<string, unknown>): FeedPostLite {
  const media = ((row.post_media as MediaItem[] | null) ?? [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as PostType,
    content: (row.content as string) ?? null,
    like_count: row.like_count as number,
    comment_count: row.comment_count as number,
    save_count: row.save_count as number,
    share_count: row.share_count as number,
    created_at: row.created_at as string,
    author: (row.profiles as UserSummary | null) ?? null,
    media,
  };
}

export async function getFeed(limit = 20, offset = 0): Promise<FeedPostLite[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => mapFeedRow(row));
}

export interface CreatePostInput {
  type: PostType;
  content?: string | null;
  code_snippet?: string | null;
  code_language?: string | null;
  location?: string | null;
  media?: { url: string; media_type: MediaType; alt_text?: string }[];
  poll?: { question: string; options: string[]; is_multiple_choice?: boolean };
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      type: input.type,
      content: input.content ?? null,
      code_snippet: input.code_snippet ?? null,
      code_language: input.code_language ?? null,
      location: input.location ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const postId = (post as { id: string }).id;

  if (input.media && input.media.length > 0) {
    const rows = input.media.map((m, i) => ({
      post_id: postId,
      url: m.url,
      type: m.media_type,
      alt_text: m.alt_text ?? null,
      order_index: i,
    }));
    const { error: mediaErr } = await supabase.from("post_media").insert(rows);
    if (mediaErr) throw new Error(mediaErr.message);
  }

  if (input.poll) {
    const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .insert({
      post_id: postId,
      question: input.poll.question,
      is_multiple_choice: input.poll.is_multiple_choice ?? false,
    })
    .select("id")
    .single();
    if (pollErr) throw new Error(pollErr.message);
    const pollId = (poll as { id: string }).id;
    const { error: optErr } = await supabase.from("poll_options").insert(
      input.poll.options.map((text, i) => ({
        poll_id: pollId,
        text,
        order_index: i,
      })),
    );
    if (optErr) throw new Error(optErr.message);
  }

  return postId;
}

export async function getPost(id: string): Promise<Post | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select(`${POST_SELECT}, post_media ( * )`)
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  const row = data as PostWithAuthor & { post_media: MediaItem[] };
  return mapPost(row, (row.post_media ?? []) as MediaItem[]);
}

export async function deletePost(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function sharePost(postId: string): Promise<string> {
  const supabase = getSupabase();
  const url = `${window.location.origin}/post/${postId}`;
  const shareData = { title: "VTalk post", url };
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share(shareData);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // User cancelled the native share sheet; ignore.
  }
  const { data, error } = await supabase
    .from("posts")
    .select("share_count")
    .eq("id", postId)
    .single();
  if (!error && data) {
    await supabase
      .from("posts")
      .update({ share_count: (data as { share_count: number }).share_count + 1 })
      .eq("id", postId);
  }
  return url;
}

export async function getPostsByUser(
  userId: string,
  limit = 30,
): Promise<FeedPostLite[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("user_id", userId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => mapFeedRow(row));
}

export async function getSavedPostsDetailed(
  limit = 50,
  collectionId?: string | null,
): Promise<FeedPostLite[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  let saveQuery = supabase
    .from("saves")
    .select("post_id, created_at, collection_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (collectionId) saveQuery = saveQuery.eq("collection_id", collectionId);
  const { data: saveRows, error: saveErr } = await saveQuery;
  if (saveErr) throw new Error(saveErr.message);
  const ids = ((saveRows ?? []) as { post_id: string }[]).map((r) => r.post_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row: Record<string, unknown>) => mapFeedRow(row));
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export interface PollDTO {
  id: string;
  question: string;
  expires_at: string | null;
  is_multiple_choice: boolean;
  options: { id: string; text: string; order_index: number; votes: number }[];
  voted_option_ids: string[];
}

export async function getPoll(postId: string): Promise<PollDTO | null> {
  const supabase = getSupabase();
  const { data: poll, error } = await supabase
    .from("polls")
    .select("id, question, expires_at, is_multiple_choice, poll_options ( id, text, order_index )")
    .eq("post_id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!poll) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let voted: string[] = [];
  if (user) {
    const { data: votes } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", (poll as { id: string }).id)
      .eq("user_id", user.id);
    voted = ((votes ?? []) as { option_id: string }[]).map((v) => v.option_id);
  }

  const p = poll as {
    id: string;
    question: string;
    expires_at: string | null;
    is_multiple_choice: boolean;
    poll_options: { id: string; text: string; order_index: number }[];
  };

  const { data: allVotes } = await supabase
    .from("poll_votes")
    .select("option_id")
    .eq("poll_id", p.id);
  const counts = new Map<string, number>();
  for (const v of (allVotes ?? []) as { option_id: string }[]) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
  }

  return {
    id: p.id,
    question: p.question,
    expires_at: p.expires_at,
    is_multiple_choice: p.is_multiple_choice,
    options: p.poll_options
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((o) => ({ ...o, votes: counts.get(o.id) ?? 0 })),
    voted_option_ids: voted,
  };
}

export async function votePoll(
  pollId: string,
  optionIds: string[],
): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);
  if (optionIds.length === 0) return;
  const rows = optionIds.map((optionId) => ({
    poll_id: pollId,
    option_id: optionId,
    user_id: user.id,
  }));
  const { error } = await supabase.from("poll_votes").insert(rows);
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unvotePoll(pollId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
