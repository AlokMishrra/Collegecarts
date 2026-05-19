-- ============================================================================
-- ENABLE REALTIME FOR HOSTEL_STOCK TABLE
-- ============================================================================
-- This enables Supabase Realtime for the hostel_stock table
-- so that stock changes are instantly broadcast to all connected clients
-- ============================================================================

-- Enable Realtime for hostel_stock table
ALTER PUBLICATION supabase_realtime ADD TABLE hostel_stock;

-- Verify Realtime is enabled
SELECT 
    schemaname,
    tablename,
    'Realtime enabled' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'hostel_stock';

-- ============================================================================
-- WHAT THIS DOES
-- ============================================================================
-- When an employee updates stock in the hostel_stock table:
-- 1. The change is saved to the database
-- 2. Supabase broadcasts the change to all connected clients
-- 3. Shop page receives the update via WebSocket
-- 4. Shop page automatically reloads data
-- 5. Users see updated stock INSTANTLY without refreshing
--
-- NO MORE CACHE ISSUES!
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'REALTIME ENABLED FOR HOSTEL_STOCK!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Stock changes will now be broadcast instantly';
    RAISE NOTICE 'Users will see updates without refreshing';
    RAISE NOTICE 'No more cache clearing needed!';
    RAISE NOTICE '============================================';
END $$;
