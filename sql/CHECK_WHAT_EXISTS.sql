-- Check what roles exist in the database
SELECT 'Existing Roles:' as info;
SELECT id, role_name, role_code, dashboard_type FROM employee_roles ORDER BY role_name;

-- Check what departments exist
SELECT 'Existing Departments:' as info;
SELECT id, department_name, department_code FROM employee_departments ORDER BY department_name;

-- Check if employee CCEMP0780 exists
SELECT 'Employee CCEMP0780:' as info;
SELECT id, employee_code, full_name, email, role_id, department_id, status FROM employee_accounts WHERE employee_code = 'CCEMP0780';

-- Check all employees
SELECT 'All Employees:' as info;
SELECT employee_code, full_name, email, status FROM employee_accounts ORDER BY created_at DESC;
