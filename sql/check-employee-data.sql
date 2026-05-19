-- Quick check to see if employee roles and departments exist
-- Run this in Supabase SQL Editor

-- Check roles count
SELECT 'Total Roles:' as info, COUNT(*) as count FROM employee_roles;

-- Check departments count
SELECT 'Total Departments:' as info, COUNT(*) as count FROM employee_departments;

-- List all roles
SELECT 
  role_name, 
  role_code, 
  dashboard_type,
  hierarchy_level
FROM employee_roles 
ORDER BY hierarchy_level DESC;

-- List all departments
SELECT 
  department_name, 
  department_code, 
  is_active
FROM employee_departments 
ORDER BY department_name;

-- Check if generate_employee_code function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'generate_employee_code';
