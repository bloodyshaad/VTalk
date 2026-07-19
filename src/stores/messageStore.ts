import { create } from "zustand";
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  getOrCreateDirectChat,
  markChatRead,
  ensurePublishedKey,
  getChatPeerPublicKey,
} from "@/lib/api/messages";
import type { Chat, Message, UserSummary } from "@/types/models";

type PeerUser = UserSummary & { public_key?: string | null };

interface MessageState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  peer: UserSummary | null;
  peerPublicKey: string | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  unreadTotal: number;
  init: () => Promise<void>;
  refreshChats: () => Promise<void>;
  openChat: (chatId: string, peer: UserSummary | null, peerPublicKey?: string | null) => Promise<void>;
  send: (plaintext: string) => Promise<void>;
  startWith: (otherUser: PeerUser) => Promise<void>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  peer: null,
  peerPublicKey: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  error: null,
  unreadTotal: 0,

  init: async () => {
    try {
      await ensurePublishedKey();
    } catch {
      // ignore; encryption may be unavailable
    }
    await get().refreshChats();
  },

  refreshChats: async () => {
    set({ isLoadingChats: true, error: null });
    try {
      const chats = await getConversations();
      const unreadTotal = chats.reduce((acc, c) => acc + c.unread_count, 0);
      set({ chats, unreadTotal });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load chats" });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  openChat: async (chatId, peer, peerPublicKey) => {
    set({
      activeChatId: chatId,
      peer,
      peerPublicKey: peerPublicKey ?? null,
      isLoadingMessages: true,
      messages: [],
    });
    try {
      if (!peerPublicKey) {
        const key = await getChatPeerPublicKey(chatId);
        set({ peerPublicKey: key });
      }
      const messages = await getMessages(chatId);
      set({ messages });
      await markChatRead(chatId);
      await get().refreshChats();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load messages" });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  send: async (plaintext) => {
    const { activeChatId, peerPublicKey, messages } = get();
    if (!activeChatId || !peerPublicKey) {
      set({ error: "Cannot send: missing peer key" });
      return;
    }
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      chat_id: activeChatId,
      sender_id: "me",
      type: "text",
      content: plaintext,
      ciphertext: null,
      reply_to_id: null,
      is_deleted: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      pending: true,
    };
    set({ messages: [...messages, optimistic] });
    try {
      const sent = await apiSendMessage(activeChatId, plaintext, peerPublicKey);
      set((s) => ({
        messages: s.messages.map((m) => (m.id === optimistic.id ? sent : m)),
      }));
      await get().refreshChats();
    } catch (err) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === optimistic.id ? { ...m, pending: false, failed: true } : m,
        ),
        error: err instanceof Error ? err.message : "Failed to send",
      }));
    }
  },

  startWith: async (otherUser) => {
    if (!otherUser.public_key) {
      set({ error: "This user has no encryption key published" });
      return;
    }
    const peer: UserSummary = {
      id: otherUser.id,
      username: otherUser.username,
      display_name: otherUser.display_name,
      avatar_url: otherUser.avatar_url,
    };
    set({ isLoadingMessages: true });
    try {
      const chatId = await getOrCreateDirectChat(otherUser.id);
      await get().openChat(chatId, peer, otherUser.public_key);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to start chat", isLoadingMessages: false });
    }
  },
}));
