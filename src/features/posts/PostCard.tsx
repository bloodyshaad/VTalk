import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { timeAgo, truncate } from "@/lib/utils";
import type { Post } from "@/types/models";

export function PostCard({ post }: { post: Post }) {
  const cover = post.media[0]?.url;
  return (
    <Link
      to={`/post/${post.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="aspect-square bg-secondary">
        {cover ? (
          <OptimizedImage src={cover} alt="post" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {truncate(post.content ?? "", 80)}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <UserAvatar user={post.author} size={24} />
          <span className="text-sm font-medium">@{post.author?.username}</span>
        </div>
        {post.content && (
          <p className="mt-1 text-sm text-muted-foreground">{truncate(post.content, 60)}</p>
        )}
      </div>
    </Link>
  );
}

export function PostCardMeta({ post }: { post: Post }) {
  return (
    <p className="text-xs text-muted-foreground">
      {post.like_count} likes · {post.comment_count} comments · {timeAgo(post.created_at)}
    </p>
  );
}
