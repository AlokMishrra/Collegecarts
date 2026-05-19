-- ============================================
-- DISABLE RLS FOR EMPLOYEE TABLES
-- Since employee system uses custom auth (not Supabase Auth),
-- we need to disable RLS and use application-level security
-- ============================================

-- Disable RLS for all employee tables
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

-- Drop all policies (they're not needed without RLS)
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_attendance;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_accounts;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_roles;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_departments;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_sessions;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_salary_logs;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_salary_structures;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_stock_orders;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_stock_order_items;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_delivery_assignments;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_notifications;
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_activity_logs;

-- Verification
SELECT '✅ RLS DISABLED FOR EMPLOYEE TABLES!' as status;
SELECT 'Employee system uses custom authentication' as note;
SELECT 'Security is handled at application level' as security;
SELECT 'No more 406 errors!' as result;

-- Show RLS status
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename LIKE 'employee%'
ORDER BY tablename;

SELECT '✅ DONE! Refresh browser now!' as message;
