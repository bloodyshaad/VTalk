import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Users,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { getMyAnalytics, type AnalyticsSummary } from "@/lib/api/analytics";

const STAT_ICONS = {
  posts: FileText,
  likes: Heart,
  comments: MessageCircle,
  saves: Bookmark,
  shares: Share2,
  followers: Users,
} as const;

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyAnalytics()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Failed to load analytics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          title="Analytics unavailable"
          description={error ?? "No data yet."}
        />
      </div>
    );
  }

  const stats: { key: keyof typeof STAT_ICONS; label: string; value: number }[] =
    [
      { key: "posts", label: "Posts", value: data.postCount },
      { key: "likes", label: "Likes", value: data.totalLikes },
      { key: "comments", label: "Comments", value: data.totalComments },
      { key: "saves", label: "Saves", value: data.totalSaves },
      { key: "shares", label: "Shares", value: data.totalShares },
      { key: "followers", label: "Followers", value: data.followerCount },
    ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = STAT_ICONS[s.key];
          return (
            <Card key={s.key} className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{s.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {s.value.toLocaleString()}
              </p>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Top posts
      </h2>
      {data.topPosts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No posts yet"
          description="Publish posts to see how they perform."
        />
      ) : (
        <ul className="space-y-2">
          {data.topPosts.map((p) => (
            <Card
              key={p.id}
              className="flex cursor-pointer items-center gap-3 p-3 hover:bg-secondary"
              onClick={() => navigate(`/post/${p.id}`)}
            >
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium uppercase">
                {p.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.content || "(no text)"}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3.5 w-3.5" /> {p.likeCount}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> {p.commentCount}
              </span>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
