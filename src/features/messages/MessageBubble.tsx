import { UserAvatar } from "@/components/common/Avatar";
import { timeAgo } from "@/lib/utils";
import type { Message } from "@/types/models";

export function MessageBubble({ message }: { message: Message }) {
  const mine = message.sender_id === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
          mine
            ? "bg-foreground text-background"
            : "bg-secondary text-secondary-foreground"
        } ${message.pending ? "opacity-60" : ""} ${message.failed ? "ring-1 ring-destructive" : ""}`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            mine ? "text-background/70" : "text-muted-foreground"
          }`}
        >
          <span>{timeAgo(message.created_at)}</span>
          {message.failed && <span>· failed</span>}
          {message.pending && <span>· sending…</span>}
        </div>
      </div>
    </div>
  );
}
