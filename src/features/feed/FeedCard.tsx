import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { timeAgo, truncate, cn } from "@/lib/utils";
import { sharePost, type FeedPostLite } from "@/lib/api/posts";
import { useFeedStore } from "@/stores/feedStore";

export function FeedCard({ post }: { post: FeedPostLite }) {
  const navigate = useNavigate();
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const toggleSave = useFeedStore((s) => s.toggleSave);
  const liked = useFeedStore((s) => s.likedIds.has(post.id));
  const saved = useFeedStore((s) => s.savedIds.has(post.id));
  const author = post.author;
  const initial = (author?.display_name ?? author?.username ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card
      className="mx-auto w-full max-w-[680px] cursor-pointer overflow-hidden"
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="flex items-center gap-3 p-4">
        <Avatar className="h-9 w-9">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {author?.display_name ?? author?.username ?? "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground">
            @{author?.username ?? "unknown"} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>

      {post.content && (
        <p className="px-4 pb-3 text-sm leading-relaxed">
          {truncate(post.content, 280)}
        </p>
      )}

      {post.media[0] &&
        (post.media[0].type === "video" ? (
          <video
            src={post.media[0].url}
            controls
            className="max-h-[520px] w-full bg-secondary object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <OptimizedImage
            src={post.media[0].url}
            alt="post media"
            className="max-h-[520px] w-full bg-secondary object-cover"
          />
        ))}

      <div
        className="flex items-center justify-between border-t border-border px-4 py-2 text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <button
            className={cn(
              "flex items-center gap-1 text-sm hover:text-foreground",
              liked && "text-foreground",
            )}
            onClick={() => void toggleLike(post.id)}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />{" "}
            {post.like_count}
          </button>
          <button
            className="flex items-center gap-1 text-sm hover:text-foreground"
            onClick={() => navigate(`/post/${post.id}`)}
          >
            <MessageCircle className="h-4 w-4" /> {post.comment_count}
          </button>
          <button
            className="flex items-center gap-1 text-sm hover:text-foreground"
            onClick={() => void sharePost(post.id)}
          >
            <Share2 className="h-4 w-4" /> {post.share_count}
          </button>
        </div>
        <button
          className={cn("hover:text-foreground", saved && "text-foreground")}
          aria-label="Save"
          onClick={() => void toggleSave(post.id)}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </button>
      </div>
    </Card>
  );
}
