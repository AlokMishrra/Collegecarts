-- ============================================================
-- ADD NOTIFICATION PREFERENCES TO USERS TABLE
-- ============================================================
-- Problem: notification_preferences column doesn't exist
-- Solution: Add jsonb column with default notification settings
-- ============================================================

-- Add the notification_preferences column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "orders": true,
  "promotions": true,
  "delivery": true,
  "loyalty": true
}'::jsonb;

-- Add a helpful comment
COMMENT ON COLUMN public.users.notification_preferences IS 'User notification preferences: orders, promotions, delivery, loyalty';

-- Verify the column was added successfully
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'notification_preferences';

-- Expected output:
-- column_name              | data_type | column_default                                                    | is_nullable
-- -------------------------+-----------+-------------------------------------------------------------------+-------------
-- notification_preferences | jsonb     | '{"orders": true, "promotions": true, "delivery": true, ...}'     | YES
