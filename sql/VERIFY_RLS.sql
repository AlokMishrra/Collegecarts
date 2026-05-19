-- Check if RLS policies exist
SELECT 'RLS Policies on employee_attendance:' as info;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'employee_attendance';

-- Check all employee table policies
SELECT 'All Employee Table Policies:' as info;
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename LIKE 'employee%'
GROUP BY tablename
ORDER BY tablename;

-- Check if RLS is enabled
SELECT 'RLS Status:' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename LIKE 'employee%'
ORDER BY tablename;
