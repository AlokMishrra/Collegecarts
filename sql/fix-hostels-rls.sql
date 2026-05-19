-- ============================================================================
-- FIX HOSTELS TABLE RLS POLICIES
-- ============================================================================
-- Allow employees to view all hostels
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view hostels" ON hostels;
DROP POLICY IF EXISTS "Enable read access for all users" ON hostels;
DROP POLICY IF EXISTS "Public hostels are viewable by everyone" ON hostels;

-- Enable RLS if not already enabled
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view all hostels
CREATE POLICY "Allow all authenticated users to view hostels"
    ON hostels
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update hostels (for admin operations)
CREATE POLICY "Allow authenticated users to manage hostels"
    ON hostels
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verification
DO $$
DECLARE
    hostel_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO hostel_count FROM hostels;
    RAISE NOTICE 'Total hostels in database: %', hostel_count;
    RAISE NOTICE 'RLS policies updated for hostels table';
    RAISE NOTICE 'All authenticated users can now view all hostels';
END $$;

-- Show all hostels
SELECT id, name, created_at FROM hostels ORDER BY name;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'hostels';
