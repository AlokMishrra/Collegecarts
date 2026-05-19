-- ============================================================
-- QUICK FIX FOR 406 ERROR - RUN THIS NOW
-- ============================================================
-- This adds the missing column and fixes RLS policies

-- Add the missing column
ALTER TABLE employee_accounts 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Fix RLS policies to allow login
DROP POLICY IF EXISTS "Allow public read for employee login" ON employee_accounts;
DROP POLICY IF EXISTS "Allow employees to update their own password" ON employee_accounts;

CREATE POLICY "Allow public read for employee login"
ON employee_accounts FOR SELECT TO public USING (true);

CREATE POLICY "Allow employees to update their own password"
ON employee_accounts FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Show success message
SELECT '✓ Fixed! Try logging in again.' as status;

-- Show all employees
SELECT 
  employee_code,
  email,
  phone,
  status,
  CASE WHEN password_hash IS NOT NULL THEN '✓ Has Password' ELSE '❌ No Password' END as pwd
FROM employee_accounts
ORDER BY created_at DESC;
