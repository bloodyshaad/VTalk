-- Fix RLS for the chat/messaging flow.
--
-- Symptom: "new row violates row-level security policy for table chats"
-- when creating a direct chat. The `chats` table had RLS enabled but
-- only a SELECT policy, so INSERT was unconditionally blocked. The
-- `chat_members_insert` policy also only allowed adding *yourself*,
-- which blocked inviting the peer into a direct chat.
--
-- Each statement is guarded so the migration is safe to re-run.
-- Run in the Supabase SQL Editor, or apply with `supabase db push`.

DROP POLICY IF EXISTS "chats_insert" ON chats;
CREATE POLICY "chats_insert" ON chats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chats_update" ON chats;
CREATE POLICY "chats_update" ON chats FOR UPDATE USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chats.id AND cm.user_id = auth.uid() AND cm.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chats.id AND cm.user_id = auth.uid() AND cm.role = 'admin')
);

DROP POLICY IF EXISTS "chats_delete" ON chats;
CREATE POLICY "chats_delete" ON chats FOR DELETE USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chats.id AND cm.user_id = auth.uid() AND cm.role = 'admin')
);

DROP POLICY IF EXISTS "chat_members_insert" ON chat_members;
CREATE POLICY "chat_members_insert" ON chat_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = messages.chat_id
      AND cm.user_id = auth.uid()
  )
);
