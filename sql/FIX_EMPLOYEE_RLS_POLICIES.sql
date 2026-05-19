-- ============================================================
-- FIX EMPLOYEE SYSTEM RLS POLICIES
-- ============================================================
-- This fixes the "No departments found" error by ensuring
-- RLS policies allow reading departments and roles

-- ============================================================
-- 1. CHECK CURRENT DATA
-- ============================================================

-- Check if departments exist
SELECT 'Departments in database:' as info;
SELECT id, department_name, department_code, is_active 
FROM employee_departments 
ORDER BY department_name;

-- Check if roles exist
SELECT 'Roles in database:' as info;
SELECT id, role_name, role_code, hierarchy_level 
FROM employee_roles 
ORDER BY hierarchy_level;

-- ============================================================
-- 2. DROP EXISTING POLICIES (if any)
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read departments" ON employee_departments;
DROP POLICY IF EXISTS "Anyone can read roles" ON employee_roles;
DROP POLICY IF EXISTS "Admins can manage departments" ON employee_departments;
DROP POLICY IF EXISTS "Admins can manage roles" ON employee_roles;

-- ============================================================
-- 3. CREATE NEW RLS POLICIES
-- ============================================================

-- Allow everyone to READ departments (needed for dropdowns)
CREATE POLICY "Anyone can read departments"
ON employee_departments
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow everyone to READ roles (needed for dropdowns)
CREATE POLICY "Anyone can read roles"
ON employee_roles
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow admins to INSERT/UPDATE/DELETE departments
CREATE POLICY "Admins can manage departments"
ON employee_departments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Allow admins to INSERT/UPDATE/DELETE roles
CREATE POLICY "Admins can manage roles"
ON employee_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ============================================================
-- 4. ENSURE RLS IS ENABLED
-- ============================================================

ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON employee_departments TO authenticated, anon;
GRANT SELECT ON employee_roles TO authenticated, anon;
GRANT ALL ON employee_departments TO service_role;
GRANT ALL ON employee_roles TO service_role;

-- ============================================================
-- 6. VERIFY POLICIES
-- ============================================================

SELECT 'RLS Policies for employee_departments:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'employee_departments';

SELECT 'RLS Policies for employee_roles:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'employee_roles';

-- ============================================================
-- 7. TEST QUERY (as if from frontend)
-- ============================================================

SELECT 'Testing department query:' as info;
SELECT COUNT(*) as department_count FROM employee_departments WHERE is_active = true;

SELECT 'Testing roles query:' as info;
SELECT COUNT(*) as role_count FROM employee_roles;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
DECLARE
  dept_count INTEGER;
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dept_count FROM employee_departments WHERE is_active = true;
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS Policies fixed!';
  RAISE NOTICE '  - Departments visible: %', dept_count;
  RAISE NOTICE '  - Roles visible: %', role_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Refresh your browser to see the changes.';
END $$;
