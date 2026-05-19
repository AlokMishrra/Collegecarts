-- Fix RLS Policies for ALL Employee Tables
-- This allows admins to create, read, update, and delete employee data
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Fix employee_accounts table
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_accounts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON employee_accounts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON employee_accounts;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON employee_accounts;
DROP POLICY IF EXISTS "Allow admins full access" ON employee_accounts;

-- Create permissive policies for employee_accounts
-- Allow authenticated users to insert (admins creating employees)
CREATE POLICY "Enable insert for authenticated users"
  ON employee_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Enable read access for authenticated users"
  ON employee_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update
CREATE POLICY "Enable update for authenticated users"
  ON employee_accounts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete
CREATE POLICY "Enable delete for authenticated users"
  ON employee_accounts
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable RLS
ALTER TABLE employee_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Fix employee_sessions table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_sessions;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Fix employee_attendance table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_attendance;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_attendance
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Fix employee_salary_logs table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_salary_logs;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_salary_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_salary_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Fix employee_stock_orders table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_stock_orders;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_stock_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_stock_orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Fix employee_stock_order_items table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_stock_order_items;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_stock_order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_stock_order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: Fix employee_notifications table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_notifications;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_notifications
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: Fix employee_activity_logs table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_activity_logs;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_activity_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 9: Fix employee_delivery_assignments table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_delivery_assignments;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_delivery_assignments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_delivery_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 10: Fix employee_salary_structures table
-- ============================================

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_salary_structures;

CREATE POLICY "Enable all access for authenticated users"
  ON employee_salary_structures
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE employee_salary_structures ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ All RLS Policies Fixed!' as status;

-- Show all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename LIKE 'employee%'
ORDER BY tablename, policyname;

SELECT '✅ Done! You can now create employees from the admin panel!' as final_message;
