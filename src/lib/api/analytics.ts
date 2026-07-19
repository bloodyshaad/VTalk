import { getSupabase } from "./supabase";

export interface AnalyticsSummary {
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalShares: number;
  followerCount: number;
  followingCount: number;
  topPosts: {
    id: string;
    content: string | null;
    type: string;
    likeCount: number;
    commentCount: number;
  }[];
}

export async function getMyAnalytics(): Promise<AnalyticsSummary> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("follower_count, following_count")
    .eq("id", user.id)
    .maybeSingle();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, content, type, like_count, comment_count, save_count, share_count")
    .eq("user_id", user.id)
    .order("like_count", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (posts ?? []) as {
    id: string;
    content: string | null;
    type: string;
    like_count: number;
    comment_count: number;
    save_count: number;
    share_count: number;
  }[];

  const totals = rows.reduce(
    (acc, p) => {
      acc.totalLikes += p.like_count ?? 0;
      acc.totalComments += p.comment_count ?? 0;
      acc.totalSaves += p.save_count ?? 0;
      acc.totalShares += p.share_count ?? 0;
      return acc;
    },
    { totalLikes: 0, totalComments: 0, totalSaves: 0, totalShares: 0 },
  );

  const prof = (profile ?? {}) as {
    follower_count?: number;
    following_count?: number;
  };

  return {
    postCount: rows.length,
    ...totals,
    followerCount: prof.follower_count ?? 0,
    followingCount: prof.following_count ?? 0,
    topPosts: rows.slice(0, 5).map((p) => ({
      id: p.id,
      content: p.content,
      type: p.type,
      likeCount: p.like_count ?? 0,
      commentCount: p.comment_count ?? 0,
    })),
  };
}
