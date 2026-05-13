-- ============================================================
-- ADD DESCRIPTION COLUMN TO CAMPAIGNS TABLE
-- ============================================================
-- Run this in Supabase SQL Editor to fix the campaign description error

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.campaigns.description IS 'Campaign description for display purposes';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'campaigns'
ORDER BY ordinal_position;
