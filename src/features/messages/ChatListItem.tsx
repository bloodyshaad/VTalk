import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { timeAgo } from "@/lib/utils";
import type { Chat } from "@/types/models";

export function ChatListItem({
  chat,
  active,
  onClick,
}: {
  chat: Chat;
  active: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const title =
    chat.type === "direct"
      ? chat.other?.display_name ?? chat.other?.username ?? "Direct"
      : chat.name ?? "Group";
  const avatar = chat.type === "direct" ? chat.other : null;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-secondary ${
        active ? "bg-secondary" : ""
      }`}
    >
      <UserAvatar user={avatar} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold">{title}</p>
          {chat.last_message_at && (
            <span className="text-xs text-muted-foreground">
              {timeAgo(chat.last_message_at)}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {chat.last_message ?? "No messages yet"}
        </p>
      </div>
      {chat.unread_count > 0 && (
        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
          {chat.unread_count}
        </span>
      )}
    </button>
  );
}
