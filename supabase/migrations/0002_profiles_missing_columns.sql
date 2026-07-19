-- Add columns to `profiles` that the app expects but the originally
-- deployed schema did not include. Each addition is guarded so the
-- migration is safe to re-run.
--
-- Run in the Supabase SQL Editor, or apply with `supabase db push`.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_activity_status BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS read_receipts BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;
