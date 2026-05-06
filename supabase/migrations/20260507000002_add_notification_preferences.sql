-- Add notification_preferences column to users table
-- This allows users to control their notification settings

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "orders": true,
  "promotions": true,
  "delivery": true,
  "loyalty": true
}'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN public.users.notification_preferences IS 'User notification preferences: orders, promotions, delivery, loyalty';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'notification_preferences';
