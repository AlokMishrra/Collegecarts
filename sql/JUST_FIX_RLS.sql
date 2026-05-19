-- ============================================
-- JUST FIX RLS - NOTHING ELSE
-- Run this to fix 406 errors
-- ============================================

-- Drop and recreate policy for employee_attendance
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_attendance;
CREATE POLICY "authenticated_all_access" ON employee_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_accounts
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_accounts;
CREATE POLICY "authenticated_all_access" ON employee_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_accounts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_roles
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_roles;
CREATE POLICY "authenticated_all_access" ON employee_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_departments
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_departments;
CREATE POLICY "authenticated_all_access" ON employee_departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_sessions
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_sessions;
CREATE POLICY "authenticated_all_access" ON employee_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_salary_logs
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_salary_logs;
CREATE POLICY "authenticated_all_access" ON employee_salary_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_salary_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_salary_structures
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_salary_structures;
CREATE POLICY "authenticated_all_access" ON employee_salary_structures FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_salary_structures ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_stock_orders
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_stock_orders;
CREATE POLICY "authenticated_all_access" ON employee_stock_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_stock_orders ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_stock_order_items
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_stock_order_items;
CREATE POLICY "authenticated_all_access" ON employee_stock_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_stock_order_items ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_delivery_assignments
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_delivery_assignments;
CREATE POLICY "authenticated_all_access" ON employee_delivery_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_delivery_assignments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_notifications
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_notifications;
CREATE POLICY "authenticated_all_access" ON employee_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for employee_activity_logs
DROP POLICY IF EXISTS "authenticated_all_access" ON employee_activity_logs;
CREATE POLICY "authenticated_all_access" ON employee_activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE employee_activity_logs ENABLE ROW LEVEL SECURITY;

-- Verification
SELECT '✅ RLS POLICIES CREATED!' as status;
SELECT 'Policies created for all employee tables' as message;
SELECT 'Refresh browser and try again' as next_step;

-- Show what was created
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'employee%' 
ORDER BY tablename;
