import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ChatListItem } from "./ChatListItem";
import { ChatView } from "./ChatView";
import { useMessageStore } from "@/stores/messageStore";

export function DirectPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    chats,
    activeChatId,
    isLoadingChats,
    error,
    init,
    openChat,
  } = useMessageStore();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      void openChat(chatId, chat?.other ?? null);
    }
  }, [chatId, chats]);

  const active = chats.find((c) => c.id === (chatId ?? activeChatId));

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <h1 className="text-lg font-semibold">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoadingChats && chats.length === 0 ? (
            <LoadingSkeleton lines={5} className="p-3" />
          ) : chats.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-10 w-10" />}
              title="No conversations"
              description="Start a chat from a profile to message someone securely."
            />
          ) : (
            chats.map((c) => (
              <ChatListItem
                key={c.id}
                chat={c}
                active={c.id === (chatId ?? activeChatId)}
                onClick={() => navigate(`/direct/${c.id}`)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="flex-1">
        {error && (
          <p className="p-3 text-sm text-destructive-foreground dark:text-foreground">
            {error}
          </p>
        )}
        {active ? (
          <ChatView chat={active} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="h-10 w-10" />}
              title="Select a conversation"
              description="Choose a chat to view your encrypted messages."
            />
          </div>
        )}
      </main>
    </div>
  );
}
