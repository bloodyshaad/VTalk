import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { SafetyNumberDialog } from "./SafetyNumberDialog";
import { useMessageStore } from "@/stores/messageStore";
import type { Chat } from "@/types/models";

export function ChatView({ chat }: { chat: Chat }) {
  const { messages, isLoadingMessages, send, peer } = useMessageStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const title =
    chat.type === "direct"
      ? chat.other?.display_name ?? chat.other?.username ?? "Direct"
      : chat.name ?? "Group";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <UserAvatar user={chat.type === "direct" ? chat.other : null} size={40} />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> End-to-end encrypted
          </p>
        </div>
        <SafetyNumberDialog chatId={chat.id} />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoadingMessages ? (
          <LoadingSkeleton lines={4} />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <MessageComposer onSend={send} />
    </div>
  );
}
