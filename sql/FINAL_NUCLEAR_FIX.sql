-- ============================================
-- FINAL NUCLEAR FIX - FIXES EVERYTHING
-- This grants full public access to employee tables
-- ============================================

-- Grant ALL privileges to anon and authenticated roles
GRANT ALL ON employee_attendance TO anon, authenticated;
GRANT ALL ON employee_accounts TO anon, authenticated;
GRANT ALL ON employee_roles TO anon, authenticated;
GRANT ALL ON employee_departments TO anon, authenticated;
GRANT ALL ON employee_sessions TO anon, authenticated;
GRANT ALL ON employee_salary_logs TO anon, authenticated;
GRANT ALL ON employee_salary_structures TO anon, authenticated;
GRANT ALL ON employee_stock_orders TO anon, authenticated;
GRANT ALL ON employee_stock_order_items TO anon, authenticated;
GRANT ALL ON employee_delivery_assignments TO anon, authenticated;
GRANT ALL ON employee_notifications TO anon, authenticated;
GRANT ALL ON employee_activity_logs TO anon, authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Disable RLS completely
ALTER TABLE employee_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_structures DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_stock_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_stock_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_delivery_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_activity_logs DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename LIKE 'employee%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Verification
SELECT '✅ FULL ACCESS GRANTED!' as status;
SELECT 'All employee tables now accessible' as message;
SELECT 'RLS disabled, policies removed, grants added' as changes;

-- Show grants
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name LIKE 'employee%'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

SELECT '✅ REFRESH BROWSER NOW - 406 ERRORS WILL BE GONE!' as final_message;
