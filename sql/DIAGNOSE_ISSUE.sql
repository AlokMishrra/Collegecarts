-- Check if table exists
SELECT 'Table exists?' as check;
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'employee_attendance'
) as table_exists;

-- Check RLS status
SELECT 'RLS Status:' as check;
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'employee_attendance';

-- Check policies
SELECT 'Policies:' as check;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'employee_attendance';

-- Check if we can select (as postgres/service role)
SELECT 'Can we query?' as check;
SELECT COUNT(*) as row_count FROM employee_attendance;

-- Check table permissions
SELECT 'Table permissions:' as check;
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'employee_attendance';
