-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCT AVAILABILITY CRON JOB
-- ═══════════════════════════════════════════════════════════════════════════════
-- This cron job runs every minute to automatically update product availability
-- based on their scheduled available_from and available_to times.
--
-- Products will automatically become:
-- - Available when current time is within their schedule
-- - Unavailable when current time is outside their schedule
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (ignore error if it doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('update-product-availability');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore error if job doesn't exist
END $$;

-- Create cron job to run every minute
-- ⚠️ SECURITY WARNING: Replace YOUR_SUPABASE_URL with your actual Supabase project URL
-- Get from: Supabase Dashboard → Settings → API → Project URL
-- Example: https://xxxxxxxxxxxxx.supabase.co
-- NEVER commit actual URLs to git
SELECT cron.schedule(
  'update-product-availability',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url:='YOUR_SUPABASE_URL/functions/v1/update-product-availability',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    ) as request_id;
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'update-product-availability';

-- View cron job execution history
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-product-availability') ORDER BY start_time DESC LIMIT 10;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MANUAL TESTING
-- ═══════════════════════════════════════════════════════════════════════════════

-- To manually test the function, run:
-- SELECT net.http_post(
--   url:='YOUR_SUPABASE_URL/functions/v1/update-product-availability',
--   headers:='{"Content-Type": "application/json"}'::jsonb
-- );

-- ═══════════════════════════════════════════════════════════════════════════════
