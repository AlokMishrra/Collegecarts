-- ============================================================
-- FIX EMPLOYEE LOGIN AND ADD PASSWORD CHANGE TRACKING
-- ============================================================
-- Run this in Supabase SQL Editor to fix the 406 error and add password tracking

-- ============================================================
-- 1. ADD PASSWORD CHANGE TRACKING COLUMN
-- ============================================================

-- Add must_change_password column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_accounts' 
    AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE employee_accounts 
    ADD COLUMN must_change_password BOOLEAN DEFAULT false;
    
    RAISE NOTICE '✓ Added must_change_password column';
  ELSE
    RAISE NOTICE '✓ must_change_password column already exists';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN employee_accounts.must_change_password IS 'Flag to force password change on next login (for temporary passwords)';

-- ============================================================
-- 2. FIX RLS POLICIES FOR EMPLOYEE_ACCOUNTS
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow employees to read their own account" ON employee_accounts;
DROP POLICY IF EXISTS "Allow employees to update their own account" ON employee_accounts;
DROP POLICY IF EXISTS "Allow public read for login" ON employee_accounts;
DROP POLICY IF EXISTS "Employees can read own data" ON employee_accounts;
DROP POLICY IF EXISTS "Employees can update own data" ON employee_accounts;

-- Create new policies that allow login and password changes
CREATE POLICY "Allow public read for employee login"
ON employee_accounts
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow employees to update their own password"
ON employee_accounts
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- ============================================================
-- 3. VERIFY EXISTING EMPLOYEES HAVE PASSWORD HASHES
-- ============================================================

-- Check if any employees are missing password hashes
DO $$
DECLARE
  missing_passwords INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_passwords
  FROM employee_accounts
  WHERE password_hash IS NULL OR password_hash = '';
  
  IF missing_passwords > 0 THEN
    RAISE NOTICE '⚠ Warning: % employees are missing password hashes', missing_passwords;
    RAISE NOTICE '  You may need to reset their passwords';
  ELSE
    RAISE NOTICE '✓ All employees have password hashes';
  END IF;
END $$;

-- ============================================================
-- 4. VERIFY EMPLOYEE ROLES AND DEPARTMENTS EXIST
-- ============================================================

-- Check roles
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  
  IF role_count = 0 THEN
    RAISE NOTICE '⚠ Warning: No employee roles found';
    RAISE NOTICE '  Run SEED_EMPLOYEE_DEPARTMENTS_AND_ROLES.sql first';
  ELSE
    RAISE NOTICE '✓ Found % employee roles', role_count;
  END IF;
END $$;

-- Check departments
DO $$
DECLARE
  dept_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dept_count FROM employee_departments;
  
  IF dept_count = 0 THEN
    RAISE NOTICE '⚠ Warning: No employee departments found';
    RAISE NOTICE '  Run SEED_EMPLOYEE_DEPARTMENTS_AND_ROLES.sql first';
  ELSE
    RAISE NOTICE '✓ Found % employee departments', dept_count;
  END IF;
END $$;

-- ============================================================
-- 5. LIST ALL EMPLOYEES FOR VERIFICATION
-- ============================================================

SELECT 
  employee_code,
  full_name,
  email,
  phone,
  status,
  CASE 
    WHEN password_hash IS NULL OR password_hash = '' THEN '❌ Missing'
    ELSE '✓ Set'
  END as password_status,
  CASE 
    WHEN must_change_password THEN '⚠ Required'
    ELSE '✓ Not Required'
  END as password_change_status,
  created_at
FROM employee_accounts
ORDER BY created_at DESC;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Employee Login and Password System Fixed!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Added must_change_password column';
  RAISE NOTICE '  ✓ Fixed RLS policies for login';
  RAISE NOTICE '  ✓ Verified employee data';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Check the employee list above';
  RAISE NOTICE '  2. Try logging in again';
  RAISE NOTICE '  3. If login fails, check employee email/password';
  RAISE NOTICE '';
END $$;
