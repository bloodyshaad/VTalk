import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { timeAgo } from "@/lib/utils";
import type { AppNotification } from "@/types/models";

const TYPE_LABEL: Record<string, string> = {
  follow: "started following you",
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  share: "shared your post",
  mention: "mentioned you",
  message: "sent you a message",
  story: "posted a story",
  reel: "posted a reel",
  follow_request: "requested to follow you",
  accepted: "accepted your follow request",
  call: "called you",
};

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: AppNotification;
  onClick: () => void;
}) {
  const label = TYPE_LABEL[notification.type] ?? "interacted with you";
  const target = notification.post_id
    ? `/post/${notification.post_id}`
    : notification.actor
      ? `/profile/${notification.actor.username}`
      : "#";

  return (
    <Link
      to={target}
      onClick={onClick}
      className="flex items-start gap-3 rounded-md p-3 hover:bg-secondary"
    >
      <UserAvatar user={notification.actor} size={40} />
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-semibold">{notification.actor?.username ?? "Someone"}</span>{" "}
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(notification.created_at)}</p>
      </div>
      {!notification.is_read && (
        <span className="mt-1 h-2 w-2 rounded-full bg-foreground" />
      )}
    </Link>
  );
}
