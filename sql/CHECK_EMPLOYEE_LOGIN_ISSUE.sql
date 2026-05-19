-- ============================================================
-- CHECK EMPLOYEE LOGIN ISSUE
-- ============================================================
-- Run this to diagnose why login is failing

-- Check if the employee exists
SELECT 
  'Employee Found' as status,
  id,
  employee_code,
  full_name,
  email,
  phone,
  status,
  CASE 
    WHEN password_hash IS NULL OR password_hash = '' THEN '❌ NO PASSWORD HASH'
    WHEN LENGTH(password_hash) < 20 THEN '❌ INVALID HASH (too short)'
    ELSE '✓ Password hash exists'
  END as password_status,
  role_id,
  department_id,
  created_at
FROM employee_accounts
WHERE email = 'apnafreelancer999@gmail.com'
   OR phone = 'apnafreelancer999@gmail.com';

-- If no results above, employee doesn't exist
-- Check all employees to see what exists
SELECT 
  employee_code,
  full_name,
  email,
  phone,
  status
FROM employee_accounts
ORDER BY created_at DESC
LIMIT 10;

-- Check if must_change_password column exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'employee_accounts'
  AND column_name = 'must_change_password';

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'employee_accounts';
