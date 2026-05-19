-- ============================================================
-- CREATE EMPLOYEE: apnafreelancer999@gmail.com
-- ============================================================
-- This creates the specific employee you're trying to login with

-- ============================================================
-- STEP 1: Ensure roles and departments exist
-- ============================================================

-- Create Super Admin role if not exists
INSERT INTO employee_roles (role_name, role_code, description, hierarchy_level, permissions)
VALUES ('Super Admin', 'SUPERADMIN', 'Full system access', 1, '{"all": true}'::jsonb)
ON CONFLICT (role_code) DO NOTHING;

-- Create Operations department if not exists
INSERT INTO employee_departments (department_name, department_code, description, is_active)
VALUES ('Operations', 'OPS', 'Store operations and management', true)
ON CONFLICT (department_code) DO NOTHING;

-- ============================================================
-- STEP 2: Check if employee already exists
-- ============================================================

DO $$
DECLARE
  emp_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO emp_count
  FROM employee_accounts
  WHERE email = 'apnafreelancer999@gmail.com';
  
  IF emp_count > 0 THEN
    RAISE NOTICE '⚠ Employee already exists with this email!';
    RAISE NOTICE '  Skipping creation...';
  ELSE
    RAISE NOTICE '✓ Email is available, creating employee...';
  END IF;
END $$;

-- ============================================================
-- STEP 3: Create the employee
-- ============================================================

-- Password: Test@123
-- Bcrypt hash generated for: Test@123
INSERT INTO employee_accounts (
  employee_code,
  slug,
  full_name,
  email,
  phone,
  password_hash,
  role_id,
  department_id,
  status,
  must_change_password,
  created_at,
  updated_at
)
SELECT
  'CCEMP' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'),
  'apna-freelancer-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'),
  'Apna Freelancer',
  'apnafreelancer999@gmail.com',
  '+919876543210',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye/IcefJUmf8xFhKZa6lLZf8xFhKZa6lL.',
  (SELECT id FROM employee_roles WHERE role_code = 'SUPERADMIN' LIMIT 1),
  (SELECT id FROM employee_departments WHERE department_code = 'OPS' LIMIT 1),
  'active',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM employee_accounts WHERE email = 'apnafreelancer999@gmail.com'
);

-- ============================================================
-- STEP 4: Verify the employee was created
-- ============================================================

SELECT 
  '═══════════════════════════════════════════════════════' as separator;

SELECT 
  'EMPLOYEE CREATED SUCCESSFULLY!' as title;

SELECT 
  '═══════════════════════════════════════════════════════' as separator;

SELECT 
  employee_code,
  full_name,
  email,
  phone,
  status,
  CASE 
    WHEN password_hash IS NULL THEN '❌ NO PASSWORD'
    ELSE '✓ Password Set'
  END as password_status,
  CASE 
    WHEN must_change_password THEN '⚠ Must Change on First Login'
    ELSE '✓ No Change Required'
  END as pwd_change_status,
  slug,
  created_at
FROM employee_accounts
WHERE email = 'apnafreelancer999@gmail.com';

-- ============================================================
-- STEP 5: Show login credentials
-- ============================================================

DO $$
DECLARE
  emp_code TEXT;
  emp_slug TEXT;
BEGIN
  SELECT employee_code, slug INTO emp_code, emp_slug
  FROM employee_accounts
  WHERE email = 'apnafreelancer999@gmail.com';
  
  IF emp_code IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '✓✓✓ EMPLOYEE CREATED! ✓✓✓';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'LOGIN CREDENTIALS:';
    RAISE NOTICE '  Employee Code: %', emp_code;
    RAISE NOTICE '  Email: apnafreelancer999@gmail.com';
    RAISE NOTICE '  Password: Test@123';
    RAISE NOTICE '  Role: Super Admin';
    RAISE NOTICE '  Department: Operations';
    RAISE NOTICE '';
    RAISE NOTICE 'LOGIN URL:';
    RAISE NOTICE '  http://localhost:5173/employee/login';
    RAISE NOTICE '';
    RAISE NOTICE 'PROFILE URL:';
    RAISE NOTICE '  http://localhost:5173/employee/%/profile', emp_slug;
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT:';
    RAISE NOTICE '  - You will be forced to change password on first login';
    RAISE NOTICE '  - Choose a strong password (min 8 chars, uppercase, lowercase, number, special char)';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '❌ Employee creation failed or already exists';
  END IF;
END $$;

-- ============================================================
-- STEP 6: Show all employees (for verification)
-- ============================================================

SELECT 
  '═══════════════════════════════════════════════════════' as separator;

SELECT 
  'ALL EMPLOYEES IN SYSTEM' as title;

SELECT 
  '═══════════════════════════════════════════════════════' as separator;

SELECT 
  employee_code,
  full_name,
  email,
  status,
  CASE WHEN password_hash IS NOT NULL THEN '✓' ELSE '❌' END as has_pwd
FROM employee_accounts
ORDER BY created_at DESC;
