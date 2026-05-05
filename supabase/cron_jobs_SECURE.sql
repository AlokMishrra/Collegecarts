-- CollegeCart Cron Jobs (SECURE VERSION)
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ SECURITY: This file contains NO hardcoded secrets
-- Replace placeholders with actual values when deploying
-- ─────────────────────────────────────────────────────────────────────────────

-- STEP 1: Enable extensions
-- Go to: Supabase Dashboard → Database → Extensions
-- Enable: pg_cron  AND  pg_net
-- OR run this SQL first:
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Tables and functions (safe to run without pg_cron)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_alerts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  type        TEXT NOT NULL,
  message     TEXT,
  data        TEXT,
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_alerts' AND policyname = 'Admin full access'
  ) THEN
    CREATE POLICY "Admin full access" ON admin_alerts
      USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_alerts' AND policyname = 'Service role insert'
  ) THEN
    CREATE POLICY "Service role insert" ON admin_alerts
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_type_resolved
  ON admin_alerts(type, resolved);

CREATE OR REPLACE FUNCTION increment_cod_balance(
  p_partner_id UUID,
  p_amount     NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE delivery_persons
  SET cod_balance = COALESCE(cod_balance, 0) + p_amount
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Cron schedules (run AFTER pg_cron is enabled)
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ SECURITY INSTRUCTIONS:
-- 1. Get your Supabase URL from: Dashboard → Settings → API → Project URL
-- 2. Get your Service Role Key from: Dashboard → Settings → API → service_role
-- 3. Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY below
-- 4. NEVER commit the actual values to git
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Release scheduled orders every minute
SELECT cron.schedule(
  'release-scheduled-orders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'YOUR_SUPABASE_URL/functions/v1/release-scheduled-orders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 2. Auto-batch and assign orders every 4 minutes
SELECT cron.schedule(
  'auto-batch-orders',
  '*/4 * * * *',
  $$
  SELECT net.http_post(
    url     := 'YOUR_SUPABASE_URL/functions/v1/auto-batch-orders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Auto-force partners offline when shift ends (pure SQL, every minute)
SELECT cron.schedule(
  'auto-offline-after-shift',
  '* * * * *',
  $$
  UPDATE delivery_persons
  SET
    is_available   = false,
    shift_end_time = NULL
  WHERE
    is_available   = true
    AND shift_end_time IS NOT NULL
    AND shift_end_time <= NOW();
  $$
);

-- 4. Warn partners approaching 24hr COD deadline (pure SQL, hourly)
SELECT cron.schedule(
  'cod-submission-warning',
  '0 * * * *',
  $$
  INSERT INTO admin_alerts (type, message, data, resolved)
  SELECT
    'cod_overdue',
    dp.name || ' has unsubmitted cash for over 20 hours',
    json_build_object('partnerId', dp.id, 'amount', dp.cod_held)::TEXT,
    false
  FROM delivery_persons dp
  WHERE
    dp.cod_held > 0
    AND dp.cod_held_since < NOW() - INTERVAL '20 hours'
    AND NOT EXISTS (
      SELECT 1 FROM admin_alerts aa
      WHERE aa.type = 'cod_overdue'
        AND aa.data::json->>'partnerId' = dp.id::TEXT
        AND aa.resolved = false
        AND aa.created_at > NOW() - INTERVAL '4 hours'
    );
  $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEPLOYMENT INSTRUCTIONS:
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Copy this file and replace placeholders with actual values
-- 2. Run the modified SQL in Supabase Dashboard → SQL Editor
-- 3. DO NOT commit the modified file with actual secrets
-- 4. Keep this template file in git for reference
-- ─────────────────────────────────────────────────────────────────────────────
