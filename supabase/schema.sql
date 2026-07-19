-- ============================================================================
-- VTalk — Supabase Schema
-- Run this entire script in the Supabase SQL Editor (Dashboard -> SQL -> New query).
-- Order: extensions -> tables -> indexes -> RLS -> policies -> storage buckets.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-maintain updated_at on row updates.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  website TEXT,
  account_type VARCHAR(20) DEFAULT 'public' CHECK (account_type IN ('public', 'private')),
  user_type VARCHAR(20) DEFAULT 'personal' CHECK (user_type IN ('personal', 'professional', 'creator')),
  category VARCHAR(50),
  is_verified BOOLEAN DEFAULT false,
  public_key TEXT,
  show_activity_status BOOLEAN DEFAULT true,
  read_receipts BOOLEAN DEFAULT true,
  notification_prefs JSONB DEFAULT '{}'::jsonb,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- POSTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'text', 'poll', 'album')),
  content TEXT,
  code_snippet TEXT,
  code_language VARCHAR(30),
  location TEXT,
  is_published BOOLEAN DEFAULT true,
  scheduled_at TIMESTAMPTZ,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  save_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
  width INT,
  height INT,
  size_bytes BIGINT,
  mime_type VARCHAR(50),
  alt_text TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- POLLS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  question TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_multiple_choice BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  order_index INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id, option_id)
);

-- ---------------------------------------------------------------------------
-- STORIES (24h expiry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  text_overlay TEXT,
  background_color VARCHAR(7),
  link_url TEXT,
  duration INT DEFAULT 5000,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- REELS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  music_track TEXT,
  duration INT,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- COMMENTS (nested)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- LIKES (polymorphic)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- ---------------------------------------------------------------------------
-- SAVES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  collection_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS save_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- FOLLOWS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'accepted' CHECK (status IN ('accepted', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- ---------------------------------------------------------------------------
-- CHATS + MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
  name TEXT,
  avatar_url TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'voice', 'file', 'call', 'system')),
  content TEXT NOT NULL,
  encryption_key_id TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'reply', 'share', 'mention', 'message', 'story', 'reel', 'follow_request', 'accepted', 'call')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- DRAFTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('post', 'story', 'reel')),
  content JSONB NOT NULL,
  media_paths TEXT[],
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- UPLOAD QUEUE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  bucket TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed', 'cancelled')),
  progress INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- ANALYTICS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- DEFERRED CONSTRAINTS (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'saves_collection_id_fkey' AND table_name = 'saves'
  ) THEN
    ALTER TABLE saves
      ADD CONSTRAINT saves_collection_id_fkey
      FOREIGN KEY (collection_id) REFERENCES save_collections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_reels_user ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_queue_user ON upload_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_chats_updated_at ON chats;
CREATE TRIGGER trg_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_drafts_updated_at ON drafts;
CREATE TRIGGER trg_drafts_updated_at BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_upload_queue_updated_at ON upload_queue;
CREATE TRIGGER trg_upload_queue_updated_at BEFORE UPDATE ON upload_queue FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Idempotency: drop any existing policies before recreating (safe to re-run).
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "posts_select" ON posts;
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
DROP POLICY IF EXISTS "posts_update_own" ON posts;
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
DROP POLICY IF EXISTS "post_media_select" ON post_media;
DROP POLICY IF EXISTS "post_media_insert" ON post_media;
DROP POLICY IF EXISTS "polls_select" ON polls;
DROP POLICY IF EXISTS "polls_insert" ON polls;
DROP POLICY IF EXISTS "poll_options_select" ON poll_options;
DROP POLICY IF EXISTS "poll_options_insert" ON poll_options;
DROP POLICY IF EXISTS "poll_votes_select" ON poll_votes;
DROP POLICY IF EXISTS "poll_votes_insert" ON poll_votes;
DROP POLICY IF EXISTS "stories_select" ON stories;
DROP POLICY IF EXISTS "stories_insert" ON stories;
DROP POLICY IF EXISTS "stories_delete" ON stories;
DROP POLICY IF EXISTS "reels_select" ON reels;
DROP POLICY IF EXISTS "reels_insert" ON reels;
DROP POLICY IF EXISTS "reels_update" ON reels;
DROP POLICY IF EXISTS "reels_delete" ON reels;
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
DROP POLICY IF EXISTS "likes_select" ON likes;
DROP POLICY IF EXISTS "likes_insert" ON likes;
DROP POLICY IF EXISTS "likes_delete" ON likes;
DROP POLICY IF EXISTS "saves_select" ON saves;
DROP POLICY IF EXISTS "saves_insert" ON saves;
DROP POLICY IF EXISTS "saves_delete" ON saves;
DROP POLICY IF EXISTS "save_collections_select" ON save_collections;
DROP POLICY IF EXISTS "save_collections_insert" ON save_collections;
DROP POLICY IF EXISTS "follows_select" ON follows;
DROP POLICY IF EXISTS "follows_insert" ON follows;
DROP POLICY IF EXISTS "follows_delete" ON follows;
DROP POLICY IF EXISTS "chats_select" ON chats;
DROP POLICY IF EXISTS "chat_members_select" ON chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON chat_members;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "message_reads_select" ON message_reads;
DROP POLICY IF EXISTS "message_reads_insert" ON message_reads;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "drafts_select" ON drafts;
DROP POLICY IF EXISTS "drafts_insert" ON drafts;
DROP POLICY IF EXISTS "drafts_update" ON drafts;
DROP POLICY IF EXISTS "drafts_delete" ON drafts;
DROP POLICY IF EXISTS "upload_queue_select" ON upload_queue;
DROP POLICY IF EXISTS "upload_queue_insert" ON upload_queue;
DROP POLICY IF EXISTS "upload_queue_update" ON upload_queue;
DROP POLICY IF EXISTS "analytics_select" ON analytics_events;
DROP POLICY IF EXISTS "analytics_insert" ON analytics_events;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
DROP POLICY IF EXISTS "posts_insert" ON storage.objects;
DROP POLICY IF EXISTS "stories_public_read" ON storage.objects;
DROP POLICY IF EXISTS "stories_insert" ON storage.objects;
DROP POLICY IF EXISTS "reels_public_read" ON storage.objects;
DROP POLICY IF EXISTS "reels_insert" ON storage.objects;
DROP POLICY IF EXISTS "messages_owner" ON storage.objects;
DROP POLICY IF EXISTS "drafts_owner" ON storage.objects;
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_insert" ON storage.objects;

-- PROFILES
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- POSTS
CREATE POLICY "posts_select" ON posts FOR SELECT USING (
  is_published = true
  AND (
    (SELECT account_type FROM profiles WHERE id = posts.user_id) = 'public'
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = posts.user_id AND status = 'accepted')
  )
);
CREATE POLICY "posts_insert_own" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON posts FOR DELETE USING (auth.uid() = user_id);

-- POST MEDIA
CREATE POLICY "post_media_select" ON post_media FOR SELECT USING (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = post_media.post_id AND (p.is_published = true OR p.user_id = auth.uid()))
);
CREATE POLICY "post_media_insert" ON post_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = post_media.post_id AND p.user_id = auth.uid())
);

-- POLLS / OPTIONS / VOTES
CREATE POLICY "polls_select" ON polls FOR SELECT USING (true);
CREATE POLICY "polls_insert" ON polls FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = polls.post_id AND p.user_id = auth.uid())
);
CREATE POLICY "poll_options_select" ON poll_options FOR SELECT USING (true);
CREATE POLICY "poll_options_insert" ON poll_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM polls pl WHERE pl.id = poll_options.poll_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = pl.post_id AND p.user_id = auth.uid()))
);
CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- STORIES
CREATE POLICY "stories_select" ON stories FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = stories.user_id AND status = 'accepted')
);
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON stories FOR DELETE USING (auth.uid() = user_id);

-- REELS
CREATE POLICY "reels_select" ON reels FOR SELECT USING (true);
CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update" ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON reels FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- LIKES
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);

-- SAVES
CREATE POLICY "saves_select" ON saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saves_insert" ON saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saves_delete" ON saves FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "save_collections_select" ON save_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "save_collections_insert" ON save_collections FOR INSERT WITH CHECK (auth.uid() = user_id);

-- FOLLOWS
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- CHATS / MEMBERS
CREATE POLICY "chats_select" ON chats FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chats.id AND cm.user_id = auth.uid())
);
CREATE POLICY "chat_members_select" ON chat_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "chat_members_insert" ON chat_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- MESSAGES
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = messages.chat_id AND cm.user_id = auth.uid())
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_own" ON messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (auth.uid() = sender_id);
CREATE POLICY "message_reads_select" ON message_reads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "message_reads_insert" ON message_reads FOR INSERT WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- DRAFTS
CREATE POLICY "drafts_select" ON drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "drafts_insert" ON drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "drafts_update" ON drafts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "drafts_delete" ON drafts FOR DELETE USING (auth.uid() = user_id);

-- UPLOAD QUEUE
CREATE POLICY "upload_queue_select" ON upload_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "upload_queue_insert" ON upload_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upload_queue_update" ON upload_queue FOR UPDATE USING (auth.uid() = user_id);

-- ANALYTICS
CREATE POLICY "analytics_select" ON analytics_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analytics_insert" ON analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===========================================================================
-- STORAGE BUCKETS
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('covers', 'covers', true, 10485760, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('posts', 'posts', true, 104857600, ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('stories', 'stories', true, 52428800, ARRAY['image/png','image/jpeg','image/webp','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('reels', 'reels', true, 524288000, ARRAY['video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('messages', 'messages', false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('drafts', 'drafts', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('media', 'media', true, 524288000, ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage access policies (public buckets: read for all; private: owner only)
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND owner = auth.uid());
CREATE POLICY "posts_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "posts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND owner = auth.uid());
CREATE POLICY "stories_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "stories_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND owner = auth.uid());
CREATE POLICY "reels_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "reels_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND owner = auth.uid());
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND owner = auth.uid());
CREATE POLICY "messages_owner" ON storage.objects FOR ALL USING (bucket_id = 'messages' AND owner = auth.uid()) WITH CHECK (bucket_id = 'messages' AND owner = auth.uid());
CREATE POLICY "drafts_owner" ON storage.objects FOR ALL USING (bucket_id = 'drafts' AND owner = auth.uid()) WITH CHECK (bucket_id = 'drafts' AND owner = auth.uid());

-- ===========================================================================
-- ADDENDUM (idempotent): notification generation, story views, user settings
-- ===========================================================================

-- --- Profile settings columns (privacy + notification preferences) ---------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_activity_status BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS read_receipts BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;

-- --- Story views (seen tracking) -------------------------------------------
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views(user_id);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;
CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --- Allow reading rows needed to render notification actors ----------------
-- (notifications table already restricts SELECT to the recipient via existing policy)

-- --- Notification generator function ---------------------------------------
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR,
  p_actor_id UUID,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;
  INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id, message_id)
  VALUES (p_user_id, p_type, p_actor_id, p_post_id, p_comment_id, p_message_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- On like: notify post/comment owner -------------------------------------
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS TRIGGER AS $$
DECLARE
  target_owner UUID;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT user_id INTO target_owner FROM posts WHERE id = NEW.post_id;
    PERFORM create_notification(target_owner, 'like', NEW.user_id, NEW.post_id, NULL, NULL);
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT user_id INTO target_owner FROM comments WHERE id = NEW.comment_id;
    PERFORM create_notification(target_owner, 'like', NEW.user_id, NULL, NEW.comment_id, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_on_like ON likes;
CREATE TRIGGER trg_notify_on_like AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- --- On comment: notify post owner (or parent-comment owner for replies) ----
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
  parent_owner UUID;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM comments WHERE id = NEW.parent_id;
    PERFORM create_notification(parent_owner, 'reply', NEW.user_id, NEW.post_id, NEW.id, NULL);
  END IF;
  PERFORM create_notification(post_owner, 'comment', NEW.user_id, NEW.post_id, NEW.id, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_on_comment ON comments;
CREATE TRIGGER trg_notify_on_comment AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- --- On follow: notify followed user ---------------------------------------
CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.following_id,
    CASE WHEN NEW.status = 'pending' THEN 'follow_request' ELSE 'follow' END,
    NEW.follower_id, NULL, NULL, NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_on_follow ON follows;
CREATE TRIGGER trg_notify_on_follow AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- --- On message: notify other chat members ---------------------------------
CREATE OR REPLACE FUNCTION notify_on_message() RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
BEGIN
  FOR member IN
    SELECT user_id FROM chat_members WHERE chat_id = NEW.chat_id AND user_id <> NEW.sender_id
  LOOP
    PERFORM create_notification(member.user_id, 'message', NEW.sender_id, NULL, NULL, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_on_message ON messages;
CREATE TRIGGER trg_notify_on_message AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_on_message();

-- ===========================================================================
-- COUNTER TRIGGERS (idempotent) — keep denormalized counts in sync
-- ===========================================================================

-- Likes -> posts.like_count / comments.like_count
CREATE OR REPLACE FUNCTION bump_like_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.post_id IS NOT NULL THEN
      UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF NEW.comment_id IS NOT NULL THEN
      UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.post_id IS NOT NULL THEN
      UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    ELSIF OLD.comment_id IS NOT NULL THEN
      UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_bump_like_counts ON likes;
CREATE TRIGGER trg_bump_like_counts AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION bump_like_counts();

-- Comments -> posts.comment_count
CREATE OR REPLACE FUNCTION bump_comment_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_bump_comment_counts ON comments;
CREATE TRIGGER trg_bump_comment_counts AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION bump_comment_counts();

-- Saves -> posts.save_count
CREATE OR REPLACE FUNCTION bump_save_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_bump_save_counts ON saves;
CREATE TRIGGER trg_bump_save_counts AFTER INSERT OR DELETE ON saves
  FOR EACH ROW EXECUTE FUNCTION bump_save_counts();

-- Follows -> profiles.follower_count / following_count
CREATE OR REPLACE FUNCTION bump_follow_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_bump_follow_counts ON follows;
CREATE TRIGGER trg_bump_follow_counts AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION bump_follow_counts();

-- Posts -> profiles.post_count
CREATE OR REPLACE FUNCTION bump_post_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_bump_post_counts ON posts;
CREATE TRIGGER trg_bump_post_counts AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION bump_post_counts();

-- --- Realtime: publish notifications + messages -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- --- Backfill: recompute all denormalized counts from actual rows ------------
-- Safe to re-run. Fixes counts that were created before the counter triggers
-- existed (e.g. likes that showed then reverted to 0 after a refetch).
UPDATE posts p SET like_count = COALESCE((
  SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id
), 0);

UPDATE comments c SET like_count = COALESCE((
  SELECT COUNT(*) FROM likes l WHERE l.comment_id = c.id
), 0);

UPDATE posts p SET comment_count = COALESCE((
  SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
), 0);

UPDATE posts p SET save_count = COALESCE((
  SELECT COUNT(*) FROM saves s WHERE s.post_id = p.id
), 0);

UPDATE profiles pr SET
  follower_count = COALESCE((
    SELECT COUNT(*) FROM follows f WHERE f.following_id = pr.id
  ), 0),
  following_count = COALESCE((
    SELECT COUNT(*) FROM follows f WHERE f.follower_id = pr.id
  ), 0),
  post_count = COALESCE((
    SELECT COUNT(*) FROM posts po WHERE po.user_id = pr.id
  ), 0);
