export type AccountType = "public" | "private";
export type UserType = "personal" | "professional" | "creator";
export type PostType = "image" | "video" | "text" | "poll" | "album";
export type MediaType = "image" | "video";
export type ChatType = "direct" | "group";
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "file"
  | "call"
  | "system";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  account_type: AccountType;
  user_type: UserType;
  category: string | null;
  is_verified: boolean;
  public_key: string | null;
  show_activity_status: boolean | null;
  read_receipts: boolean | null;
  notification_prefs: Record<string, boolean> | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
  updated_at: string;
};

export type PostMediaRow = {
  id: string;
  post_id: string;
  url: string;
  type: MediaType;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  alt_text: string | null;
  order_index: number;
  created_at: string;
}

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export type PollRow = {
  id: string;
  post_id: string;
  question: string;
  expires_at: string | null;
  is_multiple_choice: boolean;
  created_at: string;
}

export type PollOptionRow = {
  id: string;
  poll_id: string;
  text: string;
  order_index: number;
}

export type LikeRow = {
  id: string;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
}

export type SaveRow = {
  id: string;
  user_id: string;
  post_id: string;
  collection_id: string | null;
  created_at: string;
}

export type FollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  status: "accepted" | "pending";
  created_at: string;
}

type PostRow = {
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
  updated_at: string;
};

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          website?: string | null;
          account_type?: AccountType;
          user_type?: UserType;
          category?: string | null;
          is_verified?: boolean;
          public_key?: string | null;
          show_activity_status?: boolean | null;
          read_receipts?: boolean | null;
          notification_prefs?: Record<string, boolean> | null;
          follower_count?: number;
          following_count?: number;
          post_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          website?: string | null;
          account_type?: AccountType;
          user_type?: UserType;
          category?: string | null;
          is_verified?: boolean;
          public_key?: string | null;
          show_activity_status?: boolean | null;
          read_receipts?: boolean | null;
          notification_prefs?: Record<string, boolean> | null;
          follower_count?: number;
          following_count?: number;
          post_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: { user_id: string; type: PostType } & Partial<PostRow>;
        Update: Partial<PostRow>;
        Relationships: [];
      };
      post_media: {
        Row: PostMediaRow;
        Insert: { post_id: string; url: string; type: MediaType } & Partial<PostMediaRow>;
        Update: Partial<PostMediaRow>;
        Relationships: [];
      };
      polls: {
        Row: PollRow;
        Insert: { post_id: string; question: string } & Partial<PollRow>;
        Update: Partial<PollRow>;
        Relationships: [];
      };
      poll_options: {
        Row: PollOptionRow;
        Insert: { poll_id: string; text: string } & Partial<PollOptionRow>;
        Update: Partial<PollOptionRow>;
        Relationships: [];
      };
      comments: {
        Row: CommentRow;
        Insert: { post_id: string; user_id: string; content: string } & Partial<CommentRow>;
        Update: Partial<CommentRow>;
        Relationships: [];
      };
      likes: {
        Row: LikeRow;
        Insert: { user_id: string } & Partial<LikeRow>;
        Update: Partial<LikeRow>;
        Relationships: [];
      };
      saves: {
        Row: SaveRow;
        Insert: { user_id: string; post_id: string } & Partial<SaveRow>;
        Update: Partial<SaveRow>;
        Relationships: [];
      };
      follows: {
        Row: FollowRow;
        Insert: { follower_id: string; following_id: string } & Partial<FollowRow>;
        Update: Partial<FollowRow>;
        Relationships: [];
      };
      stories: {
        Row: StoryRow;
        Insert: { user_id: string; media_url: string; media_type: MediaType; expires_at: string } & Partial<StoryRow>;
        Update: Partial<StoryRow>;
        Relationships: [];
      };
      reels: {
        Row: ReelRow;
        Insert: { user_id: string; video_url: string } & Partial<ReelRow>;
        Update: Partial<ReelRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: { user_id: string; type: NotificationType; actor_id: string } & Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      chats: {
        Row: ChatRow;
        Insert: { type: ChatType } & Partial<ChatRow>;
        Update: Partial<ChatRow>;
        Relationships: [];
      };
      chat_members: {
        Row: ChatMemberRow;
        Insert: { chat_id: string; user_id: string } & Partial<ChatMemberRow>;
        Update: Partial<ChatMemberRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: { chat_id: string; sender_id: string; content: string } & Partial<MessageRow>;
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      message_reads: {
        Row: MessageReadRow;
        Insert: { message_id: string; user_id: string } & Partial<MessageReadRow>;
        Update: Partial<MessageReadRow>;
        Relationships: [];
      };
      poll_votes: {
        Row: { id: string; poll_id: string; option_id: string; user_id: string; created_at: string };
        Insert: { poll_id: string; option_id: string; user_id: string } & Partial<{ id: string; created_at: string }>;
        Update: Partial<{ poll_id: string; option_id: string; user_id: string }>;
        Relationships: [];
      };
      save_collections: {
        Row: { id: string; user_id: string; name: string; created_at: string };
        Insert: { user_id: string; name: string } & Partial<{ id: string; created_at: string }>;
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      story_views: {
        Row: { id: string; story_id: string; user_id: string; created_at: string };
        Insert: { story_id: string; user_id: string } & Partial<{ id: string; created_at: string }>;
        Update: Partial<{ story_id: string; user_id: string }>;
        Relationships: [];
      };
      drafts: {
        Row: {
          id: string;
          user_id: string;
          type: PostType;
          content: Record<string, unknown>;
          media_paths: string[] | null;
          scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; type: PostType; content: Record<string, unknown> } & Partial<{
          id: string;
          media_paths: string[] | null;
          scheduled_at: string | null;
          updated_at: string;
        }>;
        Update: Partial<{
          user_id: string;
          type: PostType;
          content: Record<string, unknown>;
          media_paths: string[] | null;
          scheduled_at: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type NotificationType =
  | "follow"
  | "like"
  | "comment"
  | "reply"
  | "share"
  | "mention"
  | "message"
  | "story"
  | "reel"
  | "follow_request"
  | "accepted"
  | "call";

export type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  text_overlay: string | null;
  background_color: string | null;
  link_url: string | null;
  duration: number;
  expires_at: string;
  created_at: string;
}

export type ReelRow = {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  music_track: string | null;
  duration: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type ChatRow = {
  id: string;
  type: ChatType;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ChatMemberRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  encryption_key_id: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
}

export type MessageReadRow = {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export type { Database, PostRow };
