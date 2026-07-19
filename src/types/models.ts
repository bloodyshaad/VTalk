import type { PostType, MediaType, MessageType, ChatType } from "./database";

export interface UserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  order_index: number;
}

export interface Post {
  id: string;
  user_id: string;
  type: PostType;
  content: string | null;
  code_snippet: string | null;
  code_language: string | null;
  location: string | null;
  is_published: boolean;
  scheduled_at: string | null;
  like_count: number;
  comment_count: number;
  save_count: number;
  share_count: number;
  created_at: string;
  author: UserSummary | null;
  media: MediaItem[];
  liked_by_me?: boolean;
  saved_by_me?: boolean;
}

export interface PostSummary {
  id: string;
  content: string | null;
  author: UserSummary | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  author: UserSummary | null;
  replies: Comment[];
}

export interface PollOption {
  id: string;
  text: string;
  order_index: number;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  expires_at: string | null;
  is_multiple_choice: boolean;
  options: PollOption[];
  voted_option_ids: string[];
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  text_overlay: string | null;
  background_color: string | null;
  duration: number;
  expires_at: string;
  author: UserSummary | null;
}

export interface StoryGroup {
  author: UserSummary;
  stories: Story[];
  viewed: boolean;
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: UserSummary | null;
}

export interface AppNotification {
  id: string;
  type: string;
  actor: UserSummary | null;
  post_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  /** Plaintext when decrypted locally; empty for messages not yet decrypted. */
  content: string;
  /** Base64 ciphertext payload stored server-side (text type). */
  ciphertext: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatMember {
  user: UserSummary;
  role: "admin" | "member";
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  created_at: string;
  members: ChatMember[];
  /** For direct chats: the other participant. */
  other: UserSummary | null;
  last_message: string | null;
  unread_count: number;
}

