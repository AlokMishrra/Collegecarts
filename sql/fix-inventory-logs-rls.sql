-- ============================================================================
-- FIX EMPLOYEE INVENTORY LOGS RLS POLICIES
-- ============================================================================
-- The employee system uses session-based auth, not Supabase auth.uid()
-- We need to allow inserts based on employee_id matching the logged-in employee
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view inventory logs" ON employee_inventory_logs;
DROP POLICY IF EXISTS "Employees can create inventory logs" ON employee_inventory_logs;

-- Create new policies that work with the employee system

-- Allow all authenticated users to view inventory logs
-- (The application will handle filtering based on permissions)
CREATE POLICY "Allow authenticated users to view inventory logs"
    ON employee_inventory_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert inventory logs
-- (The application validates employee permissions before calling)
CREATE POLICY "Allow authenticated users to create inventory logs"
    ON employee_inventory_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow updates to inventory logs (for corrections)
CREATE POLICY "Allow authenticated users to update inventory logs"
    ON employee_inventory_logs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'RLS policies updated for employee_inventory_logs';
    RAISE NOTICE 'Employees can now manage stock through the employee portal';
END $$;

-- Check policies
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
WHERE tablename = 'employee_inventory_logs';
