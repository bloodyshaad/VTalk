import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedActions({
  likeCount,
  commentCount,
  shareCount,
  liked,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
}: {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-muted-foreground">
      <div className="flex gap-4">
        <button
          className={cn("flex items-center gap-1 text-sm hover:text-foreground", liked && "text-foreground")}
          onClick={onLike}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} /> {likeCount}
        </button>
        <button
          className="flex items-center gap-1 text-sm hover:text-foreground"
          onClick={onComment}
        >
          <MessageCircle className="h-4 w-4" /> {commentCount}
        </button>
        <button
          className="flex items-center gap-1 text-sm hover:text-foreground"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" /> {shareCount}
        </button>
      </div>
      <button
        className={cn("hover:text-foreground", saved && "text-foreground")}
        aria-label="Save"
        onClick={onSave}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
      </button>
    </div>
  );
}
