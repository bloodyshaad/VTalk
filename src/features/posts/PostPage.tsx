import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { FeedActions } from "./FeedActions";
import { CommentSection } from "./CommentSection";
import { AlbumGrid } from "./AlbumGrid";
import { PollViewer } from "./PollViewer";
import { usePostStore } from "@/stores/postStore";
import { useCommentStore } from "@/stores/commentStore";
import { getPoll, sharePost, type PollDTO } from "@/lib/api/posts";
import { timeAgo } from "@/lib/utils";

export function PostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { post, isLoading, error, liked, saved, fetch, toggleLike, toggleSave } =
    usePostStore();
  const { fetch: fetchComments, clear } = useCommentStore();
  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const handleShare = async () => {
    if (!post) return;
    await sharePost(post.id);
    setShareMsg("Link copied");
    setTimeout(() => setShareMsg(null), 2000);
  };

  useEffect(() => {
    if (!id) return;
    void fetch(id);
    void fetchComments(id);
    void getPoll(id).then(setPoll).catch(() => setPoll(null));
    return () => clear();
  }, [id, fetch, fetchComments, clear]);

  if (isLoading && !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState title="Post not found" description={error} />
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>
      <div className="overflow-hidden rounded-xl border border-border bg-card md:flex">
        <div className="bg-secondary md:w-1/2">
          {post.media.length > 1 ? (
            <AlbumGrid media={post.media} />
          ) : post.media[0] ? (
            post.media[0].type === "video" ? (
              <video src={post.media[0].url} controls className="h-full w-full" />
            ) : (
              <OptimizedImage
                src={post.media[0].url}
                alt="post media"
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-64 items-center justify-center p-6 text-center text-muted-foreground">
              {post.content}
            </div>
          )}
        </div>

        <div className="flex flex-col md:w-1/2">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <button onClick={() => navigate(`/profile/${post.author?.username}`)}>
              <UserAvatar user={post.author} size={36} />
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold">@{post.author?.username}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto p-4">
            {post.content && <p className="text-sm leading-relaxed">{post.content}</p>}
            {post.location && (
              <p className="text-xs text-muted-foreground">📍 {post.location}</p>
            )}
            {post.type === "poll" && poll && (
              <PollViewer
                poll={poll}
                onVoted={() =>
                  void getPoll(post.id)
                    .then(setPoll)
                    .catch(() => {})
                }
              />
            )}
          </div>

          <FeedActions
            likeCount={post.like_count}
            commentCount={post.comment_count}
            shareCount={post.share_count}
            liked={liked}
            saved={saved}
            onLike={() => void toggleLike()}
            onShare={() => void handleShare()}
            onSave={() => void toggleSave()}
          />
          {shareMsg && (
            <p className="px-4 pb-1 text-xs text-muted-foreground">{shareMsg}</p>
          )}

          <CommentSection postId={post.id} />
        </div>
      </div>
    </div>
  );
}
