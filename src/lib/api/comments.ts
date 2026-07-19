import { getSupabase } from "./supabase";
import type { Comment, UserSummary } from "@/types/models";

const COMMENT_SELECT = `
  id, post_id, user_id, parent_id, content, like_count, created_at,
  profiles ( id, username, display_name, avatar_url )
`;

type CommentRowWithAuthor = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  profiles: Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> | null;
};

function mapComment(row: CommentRowWithAuthor): Comment {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    parent_id: row.parent_id,
    content: row.content,
    like_count: row.like_count,
    created_at: row.created_at,
    author: row.profiles
      ? {
          id: row.profiles.id,
          username: row.profiles.username,
          display_name: row.profiles.display_name,
          avatar_url: row.profiles.avatar_url,
        }
      : null,
    replies: [],
  };
}

export async function getComments(postId: string): Promise<Comment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CommentRowWithAuthor[];
  const byId = new Map<string, Comment>();
  const roots: Comment[] = [];
  for (const r of rows) {
    byId.set(r.id, mapComment(r));
  }
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createComment(
  postId: string,
  content: string,
  parentId?: string | null,
): Promise<Comment> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
      parent_id: parentId ?? null,
    })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapComment(data as CommentRowWithAuthor);
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
