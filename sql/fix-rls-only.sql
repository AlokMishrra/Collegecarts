-- Fix RLS Policies ONLY
-- This script only fixes the access policies, doesn't touch the data
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check current data
-- ============================================
SELECT '📊 Current Data Status:' as info;
SELECT 'Roles:' as table_name, COUNT(*) as count FROM employee_roles;
SELECT 'Departments:' as table_name, COUNT(*) as count FROM employee_departments;

-- ============================================
-- STEP 2: Drop existing RLS policies
-- ============================================
DROP POLICY IF EXISTS "Allow public read access to employee_roles" ON employee_roles;
DROP POLICY IF EXISTS "Allow public read access to employee_departments" ON employee_departments;
DROP POLICY IF EXISTS "Allow authenticated read access to employee_roles" ON employee_roles;
DROP POLICY IF EXISTS "Allow authenticated read access to employee_departments" ON employee_departments;
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_departments;

-- ============================================
-- STEP 3: Create permissive read policies
-- ============================================
CREATE POLICY "Enable read access for all users"
  ON employee_roles
  FOR SELECT
  USING (true);

CREATE POLICY "Enable read access for all users"
  ON employee_departments
  FOR SELECT
  USING (true);

-- ============================================
-- STEP 4: Ensure RLS is enabled
-- ============================================
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Verify policies are working
-- ============================================
SELECT '✅ RLS Policies Created!' as status;

-- Test if we can read the data
SELECT '📋 Testing Read Access:' as info;
SELECT 'Roles accessible:' as test, COUNT(*) as count FROM employee_roles;
SELECT 'Departments accessible:' as test, COUNT(*) as count FROM employee_departments;

-- Show sample data
SELECT '📝 Sample Roles:' as info;
SELECT role_name, role_code FROM employee_roles ORDER BY hierarchy_level DESC LIMIT 5;

SELECT '📝 Sample Departments:' as info;
SELECT department_name, department_code FROM employee_departments ORDER BY department_name LIMIT 5;

SELECT '✅ Done! Now refresh your admin panel and the dropdowns should work!' as final_message;
