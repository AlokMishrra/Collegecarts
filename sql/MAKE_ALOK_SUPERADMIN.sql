-- ============================================
-- MAKE ALOK SUPER ADMIN
-- This upgrades employee CCEMP0780 to Super Admin
-- ============================================

-- Step 1: Get the Super Admin role ID
DO $$
DECLARE
  super_admin_role_id UUID;
  employee_id UUID;
  operations_dept_id UUID;
BEGIN
  -- Get Super Admin role ID
  SELECT id INTO super_admin_role_id
  FROM employee_roles
  WHERE role_code = 'SUPER_ADMIN'
  LIMIT 1;

  -- Get Operations department ID (or any department)
  SELECT id INTO operations_dept_id
  FROM employee_departments
  WHERE department_code = 'OPS'
  LIMIT 1;

  -- Check if role exists
  IF super_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin role not found! Run ULTIMATE_FIX_RUN_THIS_NOW.sql first';
  END IF;

  -- Update employee to Super Admin
  UPDATE employee_accounts
  SET 
    role_id = super_admin_role_id,
    department_id = operations_dept_id,
    status = 'active',
    updated_at = NOW()
  WHERE employee_code = 'CCEMP0780'
  RETURNING id INTO employee_id;

  -- Check if employee was found and updated
  IF employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee CCEMP0780 not found!';
  END IF;

  RAISE NOTICE '✅ Employee CCEMP0780 (alok@collegecarts.in) is now SUPER ADMIN!';
  RAISE NOTICE '✅ Employee ID: %', employee_id;
  RAISE NOTICE '✅ Role ID: %', super_admin_role_id;
  RAISE NOTICE '✅ Department ID: %', operations_dept_id;
END $$;

-- Step 2: Verify the update
SELECT 
  '✅ VERIFICATION' as status,
  ea.employee_code,
  ea.full_name,
  ea.email,
  ea.slug,
  ea.status,
  er.role_name,
  er.role_code,
  er.dashboard_type,
  er.hierarchy_level,
  ed.department_name
FROM employee_accounts ea
LEFT JOIN employee_roles er ON ea.role_id = er.id
LEFT JOIN employee_departments ed ON ea.department_id = ed.id
WHERE ea.employee_code = 'CCEMP0780';

-- Step 3: Show Super Admin permissions
SELECT '📋 Super Admin Permissions:' as info;
SELECT 
  role_name,
  role_code,
  dashboard_type,
  permissions,
  hierarchy_level,
  description
FROM employee_roles
WHERE role_code = 'SUPER_ADMIN';

-- Success message
SELECT '🎉 SUCCESS!' as message;
SELECT 'Alok (CCEMP0780) is now Super Admin!' as status;
SELECT 'Login at: /employee/login' as next_step;
SELECT 'Email: alok@collegecarts.in' as credentials;
SELECT 'Full access to all employee system features!' as access;
