-- ============================================================================
-- ENABLE REALTIME STOCK SYNC
-- ============================================================================
-- This script enables Supabase Realtime for the hostel_stock table
-- so that all connected clients receive instant updates when stock changes.
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Realtime for hostel_stock table
-- ============================================================================
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events

DO $$
BEGIN
  -- Check if hostel_stock is already in realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_stock;
    RAISE NOTICE '✅ Added hostel_stock to realtime publication';
  ELSE
    RAISE NOTICE 'ℹ️  hostel_stock already in realtime publication';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create updated_at trigger for hostel_stock
-- ============================================================================
-- This ensures updated_at is automatically set when stock changes

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_hostel_stock_updated_at ON public.hostel_stock;

-- Create trigger
CREATE TRIGGER update_hostel_stock_updated_at
    BEFORE UPDATE ON public.hostel_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE '✅ Created updated_at trigger for hostel_stock';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================
-- These indexes speed up stock queries

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_id 
ON public.hostel_stock(product_id);

-- Index for hostel_id lookups
CREATE INDEX IF NOT EXISTS idx_hostel_stock_hostel_id 
ON public.hostel_stock(hostel_id);

-- Composite index for product + hostel lookups
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_hostel 
ON public.hostel_stock(product_id, hostel_id);

-- Index for stock quantity (for finding out-of-stock items)
CREATE INDEX IF NOT EXISTS idx_hostel_stock_quantity 
ON public.hostel_stock(stock_quantity);

RAISE NOTICE '✅ Created performance indexes';

-- ============================================================================
-- STEP 4: Verify setup
-- ============================================================================

DO $$
DECLARE
  realtime_enabled BOOLEAN;
  trigger_exists BOOLEAN;
  index_count INTEGER;
BEGIN
  -- Check realtime
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
  ) INTO realtime_enabled;
  
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_hostel_stock_updated_at'
  ) INTO trigger_exists;
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'hostel_stock'
  AND indexname LIKE 'idx_hostel_stock%';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'REALTIME STOCK SYNC SETUP VERIFICATION';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Realtime enabled: %', realtime_enabled;
  RAISE NOTICE 'Updated_at trigger: %', trigger_exists;
  RAISE NOTICE 'Performance indexes: %', index_count;
  RAISE NOTICE '============================================';
  
  IF realtime_enabled AND trigger_exists AND index_count >= 4 THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED - Realtime stock sync is ready!';
  ELSE
    RAISE NOTICE '⚠️  SOME CHECKS FAILED - Please review the output above';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- STEP 5: Test realtime (optional)
-- ============================================================================
-- Uncomment to test realtime updates

/*
-- Update a product's stock to trigger realtime event
UPDATE public.hostel_stock
SET stock_quantity = stock_quantity + 1
WHERE product_id = (SELECT id FROM products LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali' LIMIT 1);

-- You should see this change reflected in real-time on the frontend
-- within 2 seconds (no page refresh needed)
*/

-- ============================================================================
-- DONE!
-- ============================================================================
-- Next steps:
-- 1. Run sql/stock-validation-functions.sql
-- 2. Restart your frontend development server
-- 3. Test by updating stock in admin panel and watching Shop page update
-- ============================================================================
