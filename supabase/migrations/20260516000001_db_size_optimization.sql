-- DB Size Optimization — Reclaim space + prevent regrowth
-- Run in Supabase SQL Editor
-- Fixes #1 bloat: data: URLs in TEXT columns (products/banners/etc) — each 2-5MB base64
-- Fixes #2: unbounded logs (error_logs, admin_alerts, notifications, chat_messages)

-- ── 1. DIAGNOSTICS (run these first to see sizes) ─────────────
-- SELECT
--   schemaname, tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total,
--   pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_only,
--   n_live_tup as rows
-- FROM pg_stat_user_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Count data: URLs (the main bloat)
-- SELECT 'products' as tbl, count(*) FROM products WHERE image_url LIKE 'data:%'
-- UNION ALL SELECT 'banners', count(*) FROM banners WHERE image_url LIKE 'data:%'
-- UNION ALL SELECT 'categories', count(*) FROM categories WHERE image_url LIKE 'data:%'
-- UNION ALL SELECT 'users', count(*) FROM users WHERE profile_photo LIKE 'data:%' OR avatar_url LIKE 'data:%'
-- UNION ALL SELECT 'promo_popups', count(*) FROM promo_popups WHERE image_url LIKE 'data:%';

-- ── 2. IMMEDIATE RECLAIM — delete old logs (keep last N days) ─
-- Adjust retention to your needs. These are safe to delete — they regrow.

-- Keep error_logs 14 days (was infinite)
DELETE FROM public.error_logs WHERE created_at < NOW() - INTERVAL '14 days';
-- Keep resolved admin_alerts 7 days, unresolved 30 days
DELETE FROM public.admin_alerts WHERE resolved = true AND created_at < NOW() - INTERVAL '7 days';
DELETE FROM public.admin_alerts WHERE resolved = false AND created_at < NOW() - INTERVAL '30 days';
-- Keep notifications 30 days (users rarely scroll older)
DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
-- Keep chat_messages 30 days
DELETE FROM public.chat_messages WHERE created_at < NOW() - INTERVAL '30 days' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_messages');
-- Keep loyalty/wallet transactions 90 days for history (adjust if needed)
-- DELETE FROM public.loyalty_transactions WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM public.wallet_transactions WHERE created_at < NOW() - INTERVAL '90 days';

-- ── 3. REMOVE DATA: URLs — replace huge base64 with placeholder ─
-- This is ~80% of bloat when storage bucket was missing. Each data: URL is 1-4MB TEXT.
-- Replace with Unsplash placeholder so UI still works, but DB shrinks 100x.

UPDATE public.products
SET image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'
WHERE image_url LIKE 'data:%' AND length(image_url) > 2000;

UPDATE public.banners
SET image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'
WHERE image_url LIKE 'data:%' AND length(image_url) > 2000;

UPDATE public.categories
SET image_url = NULL
WHERE image_url LIKE 'data:%' AND length(image_url) > 2000;

UPDATE public.users
SET profile_photo = NULL
WHERE profile_photo LIKE 'data:%' AND length(profile_photo) > 2000;

UPDATE public.users
SET avatar_url = NULL
WHERE avatar_url LIKE 'data:%' AND length(avatar_url) > 2000;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promo_popups' AND column_name='image_url') THEN
    UPDATE public.promo_popups SET image_url = NULL WHERE image_url LIKE 'data:%' AND length(image_url) > 2000;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='combos' AND column_name='image_url') THEN
    UPDATE public.combos SET image_url = NULL WHERE image_url LIKE 'data:%' AND length(image_url) > 2000;
  END IF;
END $$;

-- ── 4. RECLAIM DISK — (VACUUM removed: cannot run inside transaction) ─
-- Supabase SQL Editor runs in a transaction, so VACUUM fails with 25001.
-- Autovacuum will reclaim space automatically within minutes after DELETEs above.
-- To force immediate reclaim, run VACUUM separately via Dashboard → Database → Query
-- (uncheck "Run as transaction" if available) or via psql outside transaction:
--   VACUUM (ANALYZE) public.products; VACUUM (ANALYZE) public.error_logs; etc.
-- For manual full reclaim (locks 2-10s): VACUUM FULL public.products; etc. — run outside transaction only.

-- ── 5. AUTO-CLEANUP CRON — keep DB lean forever ───────────────
-- Requires pg_cron. Removes old logs daily at 03:00 UTC. Safe, low overhead.

-- Clean up helper function
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.error_logs WHERE created_at < NOW() - INTERVAL '14 days';
  DELETE FROM public.admin_alerts WHERE resolved = true AND created_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.admin_alerts WHERE resolved = false AND created_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
  -- Optional: chat
  BEGIN
    DELETE FROM public.chat_messages WHERE created_at < NOW() - INTERVAL '30 days';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  -- Vacuum to return space
  -- Note: VACUUM cannot run inside function transaction, so cron does it separately.
END;
$$;

-- Schedule daily cleanup (idempotent — unschedule first if exists)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-db-cleanup') FROM cron.job WHERE jobname = 'daily-db-cleanup';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-db-cleanup',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_logs(); $$
);

-- Note: VACUUM cannot run inside pg_cron transaction either — removed daily vacuum job.
-- Autovacuum handles it. Deleted cron 'daily-db-vacuum' if it existed.
DO $$
BEGIN
  PERFORM cron.unschedule('daily-db-vacuum') FROM cron.job WHERE jobname = 'daily-db-vacuum';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 6. PREVENT FUTURE DATA: URL BLOAT — CHECK constraint (soft) ─
-- Reject new data: URLs longer than 2KB (forces app to use Storage instead)
-- Commented by default — uncomment if you want hard block at DB level.
-- ALTER TABLE public.products ADD CONSTRAINT chk_products_no_data_url CHECK (image_url IS NULL OR image_url NOT LIKE 'data:%' OR length(image_url) < 5000);
-- ALTER TABLE public.banners ADD CONSTRAINT chk_banners_no_data_url CHECK (image_url IS NULL OR image_url NOT LIKE 'data:%' OR length(image_url) < 5000);

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';

-- Done. Check sizes again:
-- SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;
