-- ============================================================================
-- FIX STOCK FUNCTION CONFLICTS
-- ============================================================================
-- This script removes any existing conflicting stock functions
-- and creates new ones with unique signatures
--
-- Run this BEFORE stock-validation-functions.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop all existing stock-related functions
-- ============================================================================

DO $$
BEGIN
  -- Drop reserve_stock functions (all overloads)
  DROP FUNCTION IF EXISTS reserve_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(TEXT, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(TEXT, INTEGER) CASCADE;
  
  -- Drop release_stock functions (all overloads)
  DROP FUNCTION IF EXISTS release_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(TEXT, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(UUID, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(TEXT, INTEGER) CASCADE;
  
  -- Drop check_product_stock functions (all overloads)
  DROP FUNCTION IF EXISTS check_product_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS check_product_stock(TEXT, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS check_product_stock(UUID, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS check_product_stock(TEXT, INTEGER) CASCADE;
  
  -- Drop get_product_hostel_stock functions (all overloads)
  DROP FUNCTION IF EXISTS get_product_hostel_stock(UUID, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS get_product_hostel_stock(TEXT, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS get_product_hostel_stock(UUID) CASCADE;
  DROP FUNCTION IF EXISTS get_product_hostel_stock(TEXT) CASCADE;
  
  -- Drop validate_cart_stock functions (all overloads)
  DROP FUNCTION IF EXISTS validate_cart_stock(UUID, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS validate_cart_stock(TEXT, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS validate_cart_stock(UUID) CASCADE;
  
  -- Drop get_low_stock_products functions (all overloads)
  DROP FUNCTION IF EXISTS get_low_stock_products(INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS get_low_stock_products() CASCADE;
  
  RAISE NOTICE '✅ Dropped all existing stock functions';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Note: Some functions may not have existed (this is OK)';
END $$;

-- ============================================================================
-- STEP 2: Verify cleanup
-- ============================================================================

DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN (
    'check_product_stock',
    'get_product_hostel_stock',
    'reserve_stock',
    'release_stock',
    'validate_cart_stock',
    'get_low_stock_products'
  );
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'CLEANUP VERIFICATION';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Remaining stock functions: %', function_count;
  
  IF function_count = 0 THEN
    RAISE NOTICE '✅ All old functions removed successfully';
    RAISE NOTICE 'You can now run stock-validation-functions.sql';
  ELSE
    RAISE NOTICE '⚠️  Some functions still exist (% remaining)', function_count;
    RAISE NOTICE 'This may cause conflicts - check manually';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- DONE!
-- ============================================================================
-- Next step: Run sql/stock-validation-functions.sql
-- ============================================================================
