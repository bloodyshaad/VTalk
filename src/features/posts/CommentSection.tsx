import { useState } from "react";
import { Send, Heart } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeAgo, cn } from "@/lib/utils";
import { useCommentStore } from "@/stores/commentStore";
import { likeComment, unlikeComment } from "@/lib/api/likes";
import type { Comment } from "@/types/models";

function CommentNode({ comment, postId, depth }: { comment: Comment; postId: string; depth: number }) {
  const add = useCommentStore((s) => s.add);
  const liked = useCommentStore((s) => s.likedIds.has(comment.id));
  const setLiked = useCommentStore((s) => s.setLiked);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [likeCount, setLikeCount] = useState(comment.like_count);

  const submitReply = async () => {
    if (!text.trim()) return;
    await add(postId, text.trim(), comment.id);
    setText("");
    setReplying(false);
  };

  const toggleLike = async () => {
    const next = !liked;
    setLiked(comment.id, next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await likeComment(comment.id);
      else await unlikeComment(comment.id);
    } catch {
      setLiked(comment.id, !next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <div className={depth > 0 ? "ml-8 border-l border-border pl-3" : ""}>
      <div className="flex gap-2 py-2">
        <UserAvatar user={comment.author} size={32} />
        <div className="flex-1">
          <p className="text-sm">
            <span className="font-semibold">{comment.author?.username ?? "user"}</span>{" "}
            <span className="text-muted-foreground">{comment.content}</span>
          </p>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{timeAgo(comment.created_at)}</span>
            <button
              className={cn("flex items-center gap-1 hover:text-foreground", liked && "text-foreground")}
              onClick={() => void toggleLike()}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
              {likeCount > 0 && likeCount}
            </button>
            <button onClick={() => setReplying((r) => !r)}>Reply</button>
          </div>
          {replying && (
            <div className="mt-2 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a reply…"
                onKeyDown={(e) => e.key === "Enter" && void submitReply()}
              />
              <Button size="sm" onClick={() => void submitReply()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {comment.replies.map((r) => (
        <CommentNode key={r.id} comment={r} postId={postId} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CommentSection({ postId }: { postId: string }) {
  const { comments, isLoading, add } = useCommentStore();
  const [text, setText] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    await add(postId, text.trim());
    setText("");
  };

  return (
    <div className="border-t border-border">
      <div className="max-h-80 space-y-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <CommentNode key={c.id} comment={c} postId={postId} depth={0} />
          ))
        )}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        <Button size="sm" onClick={() => void submit()} disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
