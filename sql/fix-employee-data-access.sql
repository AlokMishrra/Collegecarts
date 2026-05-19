-- Fix Employee Data Access Issues
-- Run this in Supabase SQL Editor

-- Step 1: Check if data exists
SELECT 'Checking data...' as status;

SELECT 'Roles in database:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'Departments in database:' as info, COUNT(*) as count FROM employee_departments;

-- Step 2: Disable RLS temporarily to check if that's the issue
ALTER TABLE employee_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments DISABLE ROW LEVEL SECURITY;

-- Step 3: Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('employee_roles', 'employee_departments');

-- Step 4: Create permissive RLS policies for reading
DROP POLICY IF EXISTS "Allow public read access to employee_roles" ON employee_roles;
CREATE POLICY "Allow public read access to employee_roles"
  ON employee_roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public read access to employee_departments" ON employee_departments;
CREATE POLICY "Allow public read access to employee_departments"
  ON employee_departments
  FOR SELECT
  USING (true);

-- Step 5: Re-enable RLS with new policies
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;

-- Step 6: Verify data is accessible
SELECT 'After RLS fix - Roles:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'After RLS fix - Departments:' as info, COUNT(*) as count FROM employee_departments;

-- Step 7: Show sample data
SELECT 'Sample Roles:' as info;
SELECT id, role_name, role_code FROM employee_roles LIMIT 5;

SELECT 'Sample Departments:' as info;
SELECT id, department_name, department_code FROM employee_departments LIMIT 5;
