-- NUCLEAR OPTION: Completely disable RLS for orders and notifications
-- Run this in Supabase SQL Editor NOW

-- ============================================================
-- STEP 1: Drop ALL existing policies
-- ============================================================

-- Drop all orders policies
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

-- Drop all notifications policies
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- ============================================================
-- STEP 2: Disable RLS completely
-- ============================================================

ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: Verify RLS is disabled
-- ============================================================

SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'notifications');

-- Should show rowsecurity = false for both tables

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS COMPLETELY DISABLED!';
  RAISE NOTICE '✅ Orders table: RLS OFF';
  RAISE NOTICE '✅ Notifications table: RLS OFF';
  RAISE NOTICE '✅ Try placing an order now';
END $$;
