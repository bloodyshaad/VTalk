import { getSupabase } from "./supabase";
import type {
  Chat,
  ChatMember,
  Message,
  UserSummary,
} from "@/types/models";
import type { ChatType, ChatMemberRow, MessageType } from "@/types/database";
import { getProfileById } from "./profiles";
import {
  encryptForPeer,
  decryptFromPeer,
  getLocalPublicKey,
  initLocalKeyPair,
  packPayload,
  unpackPayload,
} from "@/lib/e2e";

interface ChatMemberJoin extends ChatMemberRow {
  profiles:
    | (Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> & {
        public_key?: string | null;
      })
    | null;
}

interface RawChat {
  id: string;
  type: ChatType;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  created_at: string;
  chat_members: ChatMemberJoin[];
  messages: { content: string; sender_id: string }[];
}

interface RawMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  reply_to_id: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
  read_by_me: boolean;
}

function summarizeUser(p: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}): UserSummary {
  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  };
}

/** Ensure the local user has published their E2E public key. */
export async function ensurePublishedKey(): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  let pub: string;
  try {
    pub = await getLocalPublicKey();
  } catch {
    // Key not initialized yet — create it once during onboarding.
    pub = await initLocalKeyPair();
  }
  await supabase
    .from("profiles")
    .update({ public_key: pub })
    .eq("id", user.id);
}

export async function getConversations(): Promise<Chat[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("chats")
    .select(
      "id, type, name, avatar_url, last_message_at, created_at, chat_members ( id, user_id, role, profiles ( id, username, display_name, avatar_url, public_key ) ), messages ( content, sender_id )",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RawChat[];
  const chats: Chat[] = [];
  for (const r of rows) {
    const members: ChatMember[] = (r.chat_members ?? [])
      .filter((m) => m.profiles)
      .map((m) => ({
        user: summarizeUser(m.profiles!),
        role: m.role,
      }));
    const others = members.filter((m) => m.user.id !== user.id).map((m) => m.user);
    const otherMember = (r.chat_members ?? []).find(
      (m) => m.profiles && m.profiles.id !== user.id,
    );
    const peerKey = otherMember?.profiles?.public_key ?? null;
    const last = r.messages?.[0];
    let preview: string | null = null;
    if (last) {
      const payload = unpackPayload(last.content);
      if (payload && peerKey) {
        try {
          preview = await decryptFromPeer(
            payload.ciphertext,
            payload.nonce,
            peerKey,
          );
        } catch {
          preview = "Message";
        }
      } else {
        preview = payload ? "Message" : last.content;
      }
    }
    const unread = await getUnreadCount(r.id);
    chats.push({
      id: r.id,
      type: r.type,
      name: r.name,
      avatar_url: r.avatar_url,
      last_message_at: r.last_message_at,
      created_at: r.created_at,
      members,
      other: others[0] ?? null,
      last_message: preview,
      unread_count: unread,
    });
  }
  return chats;
}

export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing, error: existingErr } = await supabase
    .from("chats")
    .select("id, chat_members ( user_id )")
    .eq("type", "direct");
  if (existingErr) throw new Error(existingErr.message);

  const found = (existing ?? []).find((c: { chat_members: { user_id: string }[] }) =>
    c.chat_members.some((m) => m.user_id === user.id) &&
    c.chat_members.some((m) => m.user_id === otherUserId),
  );
  if (found) return (found as { id: string }).id;

  const { data: created, error } = await supabase
    .from("chats")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const chatId = (created as { id: string }).id;

    const { error: memberErr } = await supabase
    .from("chat_members")
    .insert([
      { chat_id: chatId, user_id: user.id },
      { chat_id: chatId, user_id: otherUserId },
    ]);
  if (memberErr) throw new Error(memberErr.message);
  return chatId;
}

export async function getChatPeerPublicKey(
  chatId: string,
): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getOtherMemberPublicKey(chatId, user.id);
}

async function getOtherMemberPublicKey(
  chatId: string,
  selfId: string,
): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("chat_members")
    .select("user_id, profiles ( public_key )")
    .eq("chat_id", chatId);
  const rows = (data ?? []) as unknown as {
    user_id: string;
    profiles: { public_key: string | null } | null;
  }[];
  const other = rows.find((m) => m.user_id !== selfId);
  return other?.profiles?.public_key ?? null;
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, chat_id, sender_id, type, content, reply_to_id, is_deleted, is_edited, created_at",
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  const peerPublicKey = await getOtherMemberPublicKey(chatId, user.id);

  const rows = (data ?? []) as RawMessage[];
  const messages: Message[] = [];
  for (const r of rows) {
    let content = "";
    let ciphertext: string | null = null;
    if (r.type === "text" && r.content) {
      const payload = unpackPayload(r.content);
      if (payload) {
        ciphertext = r.content;
        const keyForDecrypt =
          r.sender_id === user.id
            ? peerPublicKey
            : (await getProfileById(r.sender_id))?.public_key ?? null;
        if (keyForDecrypt) {
          try {
            content = await decryptFromPeer(
              payload.ciphertext,
              payload.nonce,
              keyForDecrypt,
            );
          } catch {
            content = "[unable to decrypt]";
          }
        } else {
          content = "[unable to decrypt]";
        }
      } else {
        content = r.content;
      }
    } else {
      content = r.content;
    }
    messages.push({
      id: r.id,
      chat_id: r.chat_id,
      sender_id: r.sender_id,
      type: r.type,
      content,
      ciphertext,
      reply_to_id: r.reply_to_id,
      is_deleted: r.is_deleted,
      is_edited: r.is_edited,
      created_at: r.created_at,
    });
  }
  return messages;
}

export async function sendMessage(
  chatId: string,
  plaintext: string,
  recipientPublicKeyB64: string,
): Promise<Message> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { ciphertext, nonce } = await encryptForPeer(plaintext, recipientPublicKeyB64);
  const packed = packPayload(ciphertext, nonce);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: user.id,
      type: "text",
      content: packed,
    })
    .select("id, chat_id, sender_id, type, content, reply_to_id, is_deleted, is_edited, created_at")
    .single();
  if (error) throw new Error(error.message);
  const row = data as RawMessage;
  return {
    id: row.id,
    chat_id: row.chat_id,
    sender_id: row.sender_id,
    type: row.type,
    content: plaintext,
    ciphertext: row.content,
    reply_to_id: row.reply_to_id,
    is_deleted: row.is_deleted,
    is_edited: row.is_edited,
    created_at: row.created_at,
  };
}

export async function getUnreadCount(chatId: string): Promise<number> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // Messages from other people in this chat that the local user has NOT read.
  // Computed entirely server-side as a count so we never download message
  // bodies (was O(n) over the full message history before).
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .neq("sender_id", user.id)
    .not("id", "in", `(SELECT message_id FROM message_reads WHERE user_id = '${user.id}')`);
  if (error) return 0;
  return count ?? 0;
}

export async function markChatRead(chatId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: messages } = await supabase
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .neq("sender_id", user.id);
  if (!messages) return;
  const inserts = messages.map((m: { id: string }) => ({
    message_id: m.id,
    user_id: user.id,
  }));
  if (inserts.length === 0) return;
  await supabase.from("message_reads").upsert(inserts, {
    onConflict: "message_id,user_id",
  });
}
